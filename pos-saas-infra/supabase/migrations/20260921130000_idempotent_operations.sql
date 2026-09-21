-- Idempotency records are server-only and are claimed in the same transaction
-- as the business operation they protect.
CREATE TABLE public.api_idempotency_keys (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  operation text NOT NULL CHECK (operation IN ('create_order', 'register_payment', 'open_cash', 'close_cash')),
  idempotency_key text NOT NULL CHECK (length(idempotency_key) BETWEEN 1 AND 128),
  request_hash text NOT NULL CHECK (length(request_hash) = 64),
  status text NOT NULL CHECK (status IN ('processing', 'completed')),
  response jsonb,
  created_at timestamptz NOT NULL DEFAULT pg_catalog.now(),
  updated_at timestamptz NOT NULL DEFAULT pg_catalog.now(),
  UNIQUE (organization_id, user_id, operation, idempotency_key)
);

ALTER TABLE public.api_idempotency_keys ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.api_idempotency_keys FROM PUBLIC, anon, authenticated;
CREATE INDEX api_idempotency_keys_expiry_idx
  ON public.api_idempotency_keys (updated_at);

CREATE OR REPLACE FUNCTION private.claim_api_idempotency(
  p_organization_id uuid,
  p_user_id uuid,
  p_operation text,
  p_idempotency_key text,
  p_request_hash text
)
RETURNS TABLE (is_replay boolean, response jsonb)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_id uuid;
  v_status text;
  v_hash text;
  v_response jsonb;
  v_updated_at timestamptz;
BEGIN
  IF p_organization_id IS NULL OR p_user_id IS NULL OR p_operation IS NULL
    OR p_idempotency_key IS NULL OR p_request_hash IS NULL THEN
    RAISE EXCEPTION 'Datos de idempotencia inválidos';
  END IF;

  INSERT INTO public.api_idempotency_keys (
    organization_id, user_id, operation, idempotency_key, request_hash, status
  )
  VALUES (
    p_organization_id, p_user_id, p_operation, p_idempotency_key, p_request_hash, 'processing'
  )
  ON CONFLICT (organization_id, user_id, operation, idempotency_key) DO NOTHING
  RETURNING id INTO v_id;

  IF v_id IS NOT NULL THEN
    RETURN QUERY SELECT false, NULL::jsonb;
    RETURN;
  END IF;

  SELECT request_hash, status, response, updated_at
  INTO v_hash, v_status, v_response, v_updated_at
  FROM public.api_idempotency_keys
  WHERE organization_id = p_organization_id
    AND user_id = p_user_id
    AND operation = p_operation
    AND idempotency_key = p_idempotency_key
  FOR UPDATE;

  IF v_hash <> p_request_hash THEN
    RAISE EXCEPTION 'La clave de idempotencia fue reutilizada con otros datos';
  END IF;

  IF v_status = 'completed' THEN
    RETURN QUERY SELECT true, v_response;
    RETURN;
  END IF;

  IF v_updated_at < pg_catalog.now() - pg_catalog.make_interval(mins => 15) THEN
    UPDATE public.api_idempotency_keys
    SET status = 'processing', updated_at = pg_catalog.now()
    WHERE id = v_id;
    RETURN QUERY SELECT false, NULL::jsonb;
    RETURN;
  END IF;

  RAISE EXCEPTION 'La solicitud idempotente sigue en proceso; reintenta';
END;
$$;

CREATE OR REPLACE FUNCTION private.complete_api_idempotency(
  p_organization_id uuid,
  p_user_id uuid,
  p_operation text,
  p_idempotency_key text,
  p_response jsonb
)
RETURNS void
LANGUAGE sql
SECURITY DEFINER
SET search_path = ''
AS $$
  UPDATE public.api_idempotency_keys
  SET status = 'completed', response = p_response, updated_at = pg_catalog.now()
  WHERE organization_id = p_organization_id
    AND user_id = p_user_id
    AND operation = p_operation
    AND idempotency_key = p_idempotency_key;
$$;

REVOKE EXECUTE ON FUNCTION private.claim_api_idempotency(uuid, uuid, text, text, text) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION private.complete_api_idempotency(uuid, uuid, text, text, jsonb) FROM PUBLIC;

CREATE OR REPLACE FUNCTION public.create_order_transaction_idempotent(
  p_user_id uuid,
  p_table_id uuid,
  p_guests integer,
  p_notes text,
  p_items jsonb,
  p_idempotency_key text,
  p_request_hash text
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_org_id uuid;
  v_order_id uuid;
  v_claim record;
  v_response jsonb;
BEGIN
  SELECT private.user_organization(p_user_id) INTO v_org_id;
  SELECT * INTO v_claim FROM private.claim_api_idempotency(
    v_org_id, p_user_id, 'create_order', p_idempotency_key, p_request_hash
  );
  IF v_claim.is_replay THEN RETURN v_claim.response || jsonb_build_object('replayed', true); END IF;

  SELECT public.create_order_transaction(p_user_id, p_table_id, p_guests, p_notes, p_items)
  INTO v_order_id;
  v_response := jsonb_build_object('orderId', v_order_id, 'replayed', false);
  PERFORM private.complete_api_idempotency(v_org_id, p_user_id, 'create_order', p_idempotency_key, v_response);
  RETURN v_response;
END;
$$;

CREATE OR REPLACE FUNCTION public.register_payment_transaction_idempotent(
  p_order_id uuid,
  p_user_id uuid,
  p_method public.payment_method,
  p_amount numeric,
  p_received_amount numeric,
  p_reference text,
  p_idempotency_key text,
  p_request_hash text
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_org_id uuid;
  v_payment record;
  v_claim record;
  v_response jsonb;
BEGIN
  SELECT private.user_organization(p_user_id) INTO v_org_id;
  SELECT * INTO v_claim FROM private.claim_api_idempotency(
    v_org_id, p_user_id, 'register_payment', p_idempotency_key, p_request_hash
  );
  IF v_claim.is_replay THEN RETURN v_claim.response || jsonb_build_object('replayed', true); END IF;

  SELECT * INTO v_payment FROM public.register_payment_transaction(
    p_order_id, p_user_id, p_method, p_amount, p_received_amount, p_reference
  );
  v_response := jsonb_build_object(
    'payment', jsonb_build_object(
      'payment_id', v_payment.payment_id,
      'order_id', v_payment.order_id,
      'method', v_payment.method,
      'amount', v_payment.amount,
      'change_amount', v_payment.change_amount,
      'order_status', v_payment.order_status,
      'total_paid', v_payment.total_paid,
      'remaining', v_payment.remaining
    ),
    'replayed', false
  );
  PERFORM private.complete_api_idempotency(v_org_id, p_user_id, 'register_payment', p_idempotency_key, v_response);
  RETURN v_response;
END;
$$;

CREATE OR REPLACE FUNCTION public.open_cash_shift_idempotent(
  p_user_id uuid,
  p_opening_amount numeric,
  p_idempotency_key text,
  p_request_hash text
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_org_id uuid;
  v_shift public.shifts%ROWTYPE;
  v_claim record;
  v_response jsonb;
BEGIN
  SELECT private.user_organization(p_user_id) INTO v_org_id;
  SELECT * INTO v_claim FROM private.claim_api_idempotency(
    v_org_id, p_user_id, 'open_cash', p_idempotency_key, p_request_hash
  );
  IF v_claim.is_replay THEN RETURN v_claim.response || jsonb_build_object('replayed', true); END IF;
  IF p_opening_amount IS NULL OR p_opening_amount < 0 THEN RAISE EXCEPTION 'El monto inicial de caja es inválido'; END IF;

  IF EXISTS (SELECT 1 FROM public.shifts WHERE user_id = p_user_id AND organization_id = v_org_id AND status = 'open') THEN
    RAISE EXCEPTION 'Ya tienes una caja abierta';
  END IF;
  INSERT INTO public.shifts (organization_id, user_id, opening_amount, status)
  VALUES (v_org_id, p_user_id, p_opening_amount, 'open')
  RETURNING * INTO v_shift;
  v_response := jsonb_build_object('shift', jsonb_build_object(
    'id', v_shift.id, 'opened_at', v_shift.opened_at,
    'opening_amount', v_shift.opening_amount, 'status', v_shift.status
  ), 'replayed', false);
  PERFORM private.complete_api_idempotency(v_org_id, p_user_id, 'open_cash', p_idempotency_key, v_response);
  RETURN v_response;
END;
$$;

CREATE OR REPLACE FUNCTION public.close_cash_shift_idempotent(
  p_user_id uuid,
  p_closing_amount numeric,
  p_difference_reason text,
  p_idempotency_key text,
  p_request_hash text
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_org_id uuid;
  v_shift record;
  v_claim record;
  v_response jsonb;
BEGIN
  SELECT private.user_organization(p_user_id) INTO v_org_id;
  SELECT * INTO v_claim FROM private.claim_api_idempotency(
    v_org_id, p_user_id, 'close_cash', p_idempotency_key, p_request_hash
  );
  IF v_claim.is_replay THEN RETURN v_claim.response || jsonb_build_object('replayed', true); END IF;

  SELECT * INTO v_shift FROM public.close_cash_shift(p_user_id, p_closing_amount, p_difference_reason);
  v_response := jsonb_build_object('shift', to_jsonb(v_shift), 'replayed', false);
  PERFORM private.complete_api_idempotency(v_org_id, p_user_id, 'close_cash', p_idempotency_key, v_response);
  RETURN v_response;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.create_order_transaction_idempotent(uuid, uuid, integer, text, jsonb, text, text) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.register_payment_transaction_idempotent(uuid, uuid, public.payment_method, numeric, numeric, text, text, text) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.open_cash_shift_idempotent(uuid, numeric, text, text) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.close_cash_shift_idempotent(uuid, numeric, text, text, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.create_order_transaction_idempotent(uuid, uuid, integer, text, jsonb, text, text) TO service_role;
GRANT EXECUTE ON FUNCTION public.register_payment_transaction_idempotent(uuid, uuid, public.payment_method, numeric, numeric, text, text, text) TO service_role;
GRANT EXECUTE ON FUNCTION public.open_cash_shift_idempotent(uuid, numeric, text, text) TO service_role;
GRANT EXECUTE ON FUNCTION public.close_cash_shift_idempotent(uuid, numeric, text, text, text) TO service_role;
