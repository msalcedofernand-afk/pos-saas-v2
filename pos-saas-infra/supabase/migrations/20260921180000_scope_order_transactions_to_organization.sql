-- Scope order creation to the organization selected by the authenticated API request.

DROP FUNCTION IF EXISTS public.create_order_transaction_idempotent(uuid, uuid, integer, text, jsonb, text, text);
DROP FUNCTION IF EXISTS public.create_order_transaction(uuid, uuid, integer, text, jsonb);

CREATE OR REPLACE FUNCTION public.create_order_transaction(
  p_user_id uuid,
  p_organization_id uuid,
  p_table_id uuid,
  p_guests integer,
  p_notes text,
  p_items jsonb
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = ''
AS $$
DECLARE
  v_order_id uuid;
  v_item_count integer;
  v_total numeric(10,2);
  v_org_id uuid;
  v_table_status public.table_status;
BEGIN
  SELECT organization_members.organization_id
  INTO v_org_id
  FROM public.organization_members
  JOIN public.organizations ON organizations.id = organization_members.organization_id
  WHERE organization_members.user_id = p_user_id
    AND organization_members.organization_id = p_organization_id
    AND organizations.is_active = true;
  IF v_org_id IS NULL THEN RAISE EXCEPTION 'Organización inválida'; END IF;
  IF p_user_id IS NULL OR p_guests IS NULL OR p_guests < 1 THEN RAISE EXCEPTION 'Datos del pedido inválidos'; END IF;
  IF pg_catalog.jsonb_typeof(p_items) <> 'array' OR pg_catalog.jsonb_array_length(p_items) = 0 THEN RAISE EXCEPTION 'El pedido debe tener productos'; END IF;
  IF EXISTS (
    SELECT 1 FROM pg_catalog.jsonb_to_recordset(p_items) AS requested(product_id uuid, quantity integer, notes text)
    WHERE requested.product_id IS NULL OR requested.quantity IS NULL OR requested.quantity < 1
  ) THEN RAISE EXCEPTION 'Los productos del pedido son inválidos'; END IF;

  IF p_table_id IS NOT NULL THEN
    SELECT status INTO v_table_status FROM public.tables_restaurant
    WHERE id = p_table_id AND organization_id = v_org_id FOR UPDATE;
    IF NOT FOUND THEN RAISE EXCEPTION 'Mesa no encontrada'; END IF;
    IF v_table_status <> 'available' THEN RAISE EXCEPTION 'La mesa no está disponible'; END IF;
  END IF;

  SELECT count(*), COALESCE(sum(requested.quantity * products.price), 0)::numeric(10,2)
  INTO v_item_count, v_total
  FROM pg_catalog.jsonb_to_recordset(p_items) AS requested(product_id uuid, quantity integer, notes text)
  JOIN public.products ON products.id = requested.product_id
    AND products.organization_id = v_org_id AND products.is_available = true;
  IF v_item_count <> pg_catalog.jsonb_array_length(p_items) THEN RAISE EXCEPTION 'Uno de los productos no está disponible'; END IF;

  INSERT INTO public.orders (organization_id, table_id, user_id, status, total_amount, guests, notes)
  VALUES (v_org_id, p_table_id, p_user_id, 'confirmed', v_total, p_guests, p_notes)
  RETURNING id INTO v_order_id;
  INSERT INTO public.order_items (organization_id, order_id, product_id, quantity, unit_price, subtotal, status, notes)
  SELECT v_org_id, v_order_id, requested.product_id, requested.quantity, products.price,
    (requested.quantity * products.price)::numeric(10,2), 'pending', requested.notes
  FROM pg_catalog.jsonb_to_recordset(p_items) AS requested(product_id uuid, quantity integer, notes text)
  JOIN public.products ON products.id = requested.product_id
    AND products.organization_id = v_org_id AND products.is_available = true;
  IF p_table_id IS NOT NULL THEN
    UPDATE public.tables_restaurant SET status = 'occupied' WHERE id = p_table_id AND organization_id = v_org_id;
  END IF;
  RETURN v_order_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.create_order_transaction_idempotent(
  p_user_id uuid,
  p_organization_id uuid,
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
  SELECT organization_members.organization_id
  INTO v_org_id
  FROM public.organization_members
  JOIN public.organizations ON organizations.id = organization_members.organization_id
  WHERE organization_members.user_id = p_user_id
    AND organization_members.organization_id = p_organization_id
    AND organizations.is_active = true;
  IF v_org_id IS NULL THEN RAISE EXCEPTION 'Organización inválida'; END IF;

  SELECT * INTO v_claim FROM private.claim_api_idempotency(
    v_org_id, p_user_id, 'create_order', p_idempotency_key, p_request_hash
  );
  IF v_claim.is_replay THEN RETURN v_claim.response || jsonb_build_object('replayed', true); END IF;

  SELECT public.create_order_transaction(p_user_id, v_org_id, p_table_id, p_guests, p_notes, p_items)
  INTO v_order_id;
  v_response := jsonb_build_object('orderId', v_order_id, 'replayed', false);
  PERFORM private.complete_api_idempotency(v_org_id, p_user_id, 'create_order', p_idempotency_key, v_response);
  RETURN v_response;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.create_order_transaction(uuid, uuid, uuid, integer, text, jsonb) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.create_order_transaction(uuid, uuid, uuid, integer, text, jsonb) TO service_role;
REVOKE EXECUTE ON FUNCTION public.create_order_transaction_idempotent(uuid, uuid, uuid, integer, text, jsonb, text, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.create_order_transaction_idempotent(uuid, uuid, uuid, integer, text, jsonb, text, text) TO service_role;
