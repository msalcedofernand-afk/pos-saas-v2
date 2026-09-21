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

  SELECT keys.request_hash, keys.status, keys.response, keys.updated_at
  INTO v_hash, v_status, v_response, v_updated_at
  FROM public.api_idempotency_keys AS keys
  WHERE keys.organization_id = p_organization_id
    AND keys.user_id = p_user_id
    AND keys.operation = p_operation
    AND keys.idempotency_key = p_idempotency_key
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

REVOKE EXECUTE ON FUNCTION private.claim_api_idempotency(uuid, uuid, text, text, text) FROM PUBLIC;
