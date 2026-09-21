CREATE OR REPLACE FUNCTION public.register_payment_transaction(
  p_order_id uuid,
  p_user_id uuid,
  p_method public.payment_method,
  p_amount numeric,
  p_received_amount numeric,
  p_reference text
)
RETURNS TABLE (payment_id uuid, order_id uuid, method public.payment_method, amount numeric, change_amount numeric, order_status public.order_status, total_paid numeric, remaining numeric)
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = ''
AS $$
DECLARE
  v_order public.orders%ROWTYPE;
  v_org_id uuid;
  v_shift_id uuid;
  v_payment_id uuid;
  v_paid numeric(10,2);
  v_due numeric(10,2);
  v_received numeric(10,2);
  v_change numeric(10,2);
  v_status public.order_status;
BEGIN
  SELECT private.user_organization(p_user_id) INTO v_org_id;
  SELECT * INTO v_order
  FROM public.orders
  WHERE public.orders.id = p_order_id
    AND public.orders.organization_id = v_org_id
  FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Pedido no encontrado'; END IF;
  IF v_order.status NOT IN ('served', 'paid') THEN RAISE EXCEPTION 'El pedido todavía no está listo para cobrar'; END IF;
  IF v_order.status = 'paid' THEN RAISE EXCEPTION 'El pedido ya está pagado'; END IF;
  IF p_amount IS NULL OR p_amount <= 0 THEN RAISE EXCEPTION 'El monto del pago es inválido'; END IF;
  SELECT COALESCE(sum(public.payments.amount), 0)::numeric(10,2)
  INTO v_paid
  FROM public.payments
  WHERE public.payments.order_id = p_order_id
    AND public.payments.organization_id = v_org_id;
  v_due := (v_order.total_amount - v_paid)::numeric(10,2);
  IF p_amount > v_due THEN RAISE EXCEPTION 'El monto supera el saldo del pedido'; END IF;
  v_received := COALESCE(p_received_amount, p_amount)::numeric(10,2);
  IF p_method = 'cash' AND v_received < p_amount THEN RAISE EXCEPTION 'El efectivo recibido es insuficiente'; END IF;
  IF p_method <> 'cash' THEN v_received := p_amount; END IF;
  v_change := pg_catalog.greatest(0::numeric, v_received - p_amount)::numeric(10,2);
  SELECT public.shifts.id INTO v_shift_id
  FROM public.shifts
  WHERE public.shifts.user_id = p_user_id
    AND public.shifts.organization_id = v_org_id
    AND public.shifts.status = 'open'
  ORDER BY public.shifts.opened_at DESC
  LIMIT 1
  FOR UPDATE;
  IF v_shift_id IS NULL THEN RAISE EXCEPTION 'Abre una caja antes de registrar pagos'; END IF;
  INSERT INTO public.payments (organization_id, order_id, user_id, method, amount, change_amount, shift_id, reference)
  VALUES (v_org_id, p_order_id, p_user_id, p_method, p_amount, v_change, v_shift_id, p_reference)
  RETURNING public.payments.id INTO v_payment_id;
  IF p_method = 'cash' THEN
    INSERT INTO public.cash_movements (organization_id, shift_id, type, amount, description, user_id)
    VALUES (v_org_id, v_shift_id, 'sale', p_amount, 'Pedido ' || pg_catalog.right(p_order_id::text, 6), p_user_id);
  END IF;
  v_paid := (v_paid + p_amount)::numeric(10,2);
  v_status := CASE WHEN v_paid >= v_order.total_amount THEN 'paid' ELSE 'served' END;
  UPDATE public.orders
  SET status = v_status, updated_at = pg_catalog.now()
  WHERE public.orders.id = p_order_id
    AND public.orders.organization_id = v_org_id;
  RETURN QUERY SELECT v_payment_id, p_order_id, p_method, p_amount, v_change, v_status, v_paid, pg_catalog.greatest(0::numeric, v_order.total_amount - v_paid)::numeric(10,2);
END;
$$;

REVOKE EXECUTE ON FUNCTION public.register_payment_transaction(uuid, uuid, public.payment_method, numeric, numeric, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.register_payment_transaction(uuid, uuid, public.payment_method, numeric, numeric, text) TO service_role;
