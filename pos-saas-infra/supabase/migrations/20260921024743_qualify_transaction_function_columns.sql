-- Avoid ambiguity between PL/pgSQL OUT parameters/variables and table columns.

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
  v_change := pg_catalog.greatest(0, v_received - p_amount)::numeric(10,2);
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
  RETURN QUERY SELECT v_payment_id, p_order_id, p_method, p_amount, v_change, v_status, v_paid, pg_catalog.greatest(0, v_order.total_amount - v_paid)::numeric(10,2);
END;
$$;

CREATE OR REPLACE FUNCTION public.register_inventory_movement(
  p_inventory_item_id uuid, p_user_id uuid, p_type public.stock_movement_type,
  p_quantity numeric, p_unit_cost numeric, p_description text
)
RETURNS TABLE (id uuid, name text, current_stock numeric, minimum_stock numeric, unit text)
LANGUAGE plpgsql SECURITY INVOKER SET search_path = ''
AS $$
DECLARE v_item public.inventory_items%ROWTYPE; v_next numeric(12,3); v_org_id uuid;
BEGIN
  SELECT private.user_organization(p_user_id) INTO v_org_id;
  IF p_quantity IS NULL OR p_quantity <= 0 THEN RAISE EXCEPTION 'La cantidad debe ser mayor que cero'; END IF;
  SELECT * INTO v_item
  FROM public.inventory_items
  WHERE public.inventory_items.id = p_inventory_item_id
    AND public.inventory_items.organization_id = v_org_id
  FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Insumo no encontrado'; END IF;
  v_next := CASE p_type WHEN 'in' THEN v_item.current_stock + p_quantity WHEN 'out' THEN v_item.current_stock - p_quantity ELSE p_quantity END;
  IF v_next < 0 THEN RAISE EXCEPTION 'El stock no puede quedar negativo'; END IF;
  INSERT INTO public.stock_movements (organization_id, inventory_item_id, type, quantity, unit_cost, description, user_id)
  VALUES (v_org_id, p_inventory_item_id, p_type, p_quantity, COALESCE(p_unit_cost, 0), p_description, p_user_id);
  UPDATE public.inventory_items
  SET current_stock = v_next, updated_at = pg_catalog.now()
  WHERE public.inventory_items.id = p_inventory_item_id
    AND public.inventory_items.organization_id = v_org_id;
  RETURN QUERY SELECT v_item.id, v_item.name, v_next, v_item.minimum_stock, v_item.unit;
END;
$$;

CREATE OR REPLACE FUNCTION public.transition_order_status_transaction(
  p_order_id uuid, p_user_id uuid, p_status public.order_status, p_reason text DEFAULT NULL
)
RETURNS TABLE (id uuid, status public.order_status, table_id uuid, updated_at timestamptz)
LANGUAGE plpgsql SECURITY INVOKER SET search_path = ''
AS $$
DECLARE v_order public.orders%ROWTYPE; v_org_id uuid;
BEGIN
  SELECT private.user_organization(p_user_id) INTO v_org_id;
  SELECT * INTO v_order
  FROM public.orders
  WHERE public.orders.id = p_order_id
    AND public.orders.organization_id = v_org_id
  FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Pedido no encontrado'; END IF;
  IF p_status = 'confirmed' AND v_order.status <> 'pending' THEN RAISE EXCEPTION 'Solo se puede confirmar un pedido pendiente'; END IF;
  IF p_status = 'cancelled' AND v_order.status NOT IN ('pending', 'confirmed') THEN RAISE EXCEPTION 'Este pedido ya está en preparación y no puede cancelarse desde pedidos'; END IF;
  IF p_status NOT IN ('confirmed', 'cancelled') THEN RAISE EXCEPTION 'Transición de pedido no permitida'; END IF;
  UPDATE public.orders SET status = p_status, updated_at = pg_catalog.now() WHERE public.orders.id = p_order_id AND public.orders.organization_id = v_org_id;
  IF p_status = 'cancelled' THEN
    UPDATE public.order_items SET status = 'cancelled', updated_at = pg_catalog.now() WHERE public.order_items.order_id = p_order_id AND public.order_items.organization_id = v_org_id;
    IF v_order.table_id IS NOT NULL AND NOT EXISTS (
      SELECT 1 FROM public.orders AS other_order
      WHERE other_order.table_id = v_order.table_id
        AND other_order.organization_id = v_org_id
        AND other_order.id <> p_order_id
        AND other_order.status NOT IN ('paid', 'cancelled')
    ) THEN
      UPDATE public.tables_restaurant SET status = 'available' WHERE public.tables_restaurant.id = v_order.table_id AND public.tables_restaurant.organization_id = v_org_id;
    END IF;
  END IF;
  INSERT INTO public.audit_logs (organization_id, user_id, action, auditable_type, auditable_id, old_values, new_values)
  VALUES (v_org_id, p_user_id, 'order_' || p_status::text, 'orders', p_order_id,
    pg_catalog.jsonb_build_object('status', v_order.status), pg_catalog.jsonb_build_object('status', p_status, 'reason', p_reason));
  RETURN QUERY SELECT o.id, o.status, o.table_id, o.updated_at FROM public.orders AS o WHERE o.id = p_order_id AND o.organization_id = v_org_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.transition_kitchen_order_transaction(
  p_order_id uuid, p_user_id uuid, p_status public.order_status, p_reason text DEFAULT NULL
)
RETURNS TABLE (id uuid, status public.order_status, notes text, updated_at timestamptz)
LANGUAGE plpgsql SECURITY INVOKER SET search_path = ''
AS $$
DECLARE v_order public.orders%ROWTYPE; v_org_id uuid; v_next_item_status public.order_item_status; v_next_notes text;
BEGIN
  SELECT private.user_organization(p_user_id) INTO v_org_id;
  SELECT * INTO v_order
  FROM public.orders
  WHERE public.orders.id = p_order_id
    AND public.orders.organization_id = v_org_id
  FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Pedido no encontrado'; END IF;
  IF p_status = 'preparing' AND v_order.status NOT IN ('pending', 'confirmed') THEN RAISE EXCEPTION 'No se puede pasar de % a preparing', v_order.status;
  ELSIF p_status = 'ready' AND v_order.status <> 'preparing' THEN RAISE EXCEPTION 'No se puede pasar de % a ready', v_order.status;
  ELSIF p_status = 'served' AND v_order.status <> 'ready' THEN RAISE EXCEPTION 'No se puede pasar de % a served', v_order.status;
  ELSIF p_status = 'cancelled' AND v_order.status NOT IN ('pending', 'confirmed', 'preparing') THEN RAISE EXCEPTION 'No se puede cancelar un pedido en estado %', v_order.status;
  ELSIF p_status NOT IN ('preparing', 'ready', 'served', 'cancelled') THEN RAISE EXCEPTION 'Transición de cocina no permitida'; END IF;
  IF p_status = 'cancelled' AND NULLIF(pg_catalog.btrim(COALESCE(p_reason, '')), '') IS NULL THEN RAISE EXCEPTION 'Debe indicar el motivo de rechazo o cancelación'; END IF;
  v_next_item_status := CASE p_status WHEN 'preparing' THEN 'preparing'::public.order_item_status WHEN 'ready' THEN 'ready'::public.order_item_status WHEN 'served' THEN 'served'::public.order_item_status ELSE 'cancelled'::public.order_item_status END;
  v_next_notes := CASE WHEN p_reason IS NULL OR pg_catalog.btrim(p_reason) = '' THEN v_order.notes ELSE pg_catalog.concat_ws(E'\n', v_order.notes, 'Incidencia cocina: ' || pg_catalog.btrim(p_reason)) END;
  UPDATE public.orders SET status = p_status, notes = v_next_notes, updated_at = pg_catalog.now() WHERE public.orders.id = p_order_id AND public.orders.organization_id = v_org_id;
  UPDATE public.order_items SET status = v_next_item_status, updated_at = pg_catalog.now() WHERE public.order_items.order_id = p_order_id AND public.order_items.organization_id = v_org_id AND public.order_items.status <> 'cancelled';
  IF p_status = 'cancelled' AND v_order.table_id IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM public.orders AS other_order
    WHERE other_order.table_id = v_order.table_id
      AND other_order.organization_id = v_org_id
      AND other_order.id <> p_order_id
      AND other_order.status NOT IN ('paid', 'cancelled')
  ) THEN UPDATE public.tables_restaurant SET status = 'available' WHERE public.tables_restaurant.id = v_order.table_id AND public.tables_restaurant.organization_id = v_org_id; END IF;
  INSERT INTO public.audit_logs (organization_id, user_id, action, auditable_type, auditable_id, old_values, new_values)
  VALUES (v_org_id, p_user_id, 'kitchen_order_' || p_status::text, 'orders', p_order_id,
    pg_catalog.jsonb_build_object('status', v_order.status), pg_catalog.jsonb_build_object('status', p_status, 'reason', p_reason));
  RETURN QUERY SELECT o.id, o.status, o.notes, o.updated_at FROM public.orders AS o WHERE o.id = p_order_id AND o.organization_id = v_org_id;
END;
$$;

DROP FUNCTION IF EXISTS public.close_cash_shift(uuid, numeric, text);
CREATE FUNCTION public.close_cash_shift(p_user_id uuid, p_closing_amount numeric, p_difference_reason text DEFAULT NULL)
RETURNS TABLE (id uuid, closed_at timestamptz, closing_amount numeric, status public.shift_status, expected_amount numeric, difference numeric, difference_reason text)
LANGUAGE plpgsql SECURITY INVOKER SET search_path = ''
AS $$
DECLARE v_shift public.shifts%ROWTYPE; v_org_id uuid; v_expected numeric(10,2); v_difference numeric(10,2); v_reason text;
BEGIN
  SELECT private.user_organization(p_user_id) INTO v_org_id;
  IF p_closing_amount IS NULL OR p_closing_amount < 0 THEN RAISE EXCEPTION 'El monto final de caja es inválido'; END IF;
  SELECT * INTO v_shift
  FROM public.shifts
  WHERE public.shifts.user_id = p_user_id
    AND public.shifts.organization_id = v_org_id
    AND public.shifts.status = 'open'
  ORDER BY public.shifts.opened_at DESC
  LIMIT 1
  FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'No tienes una caja abierta'; END IF;
  SELECT (v_shift.opening_amount + COALESCE(SUM(CASE WHEN cm.type IN ('sale', 'deposit', 'adjustment') THEN cm.amount WHEN cm.type IN ('refund', 'withdrawal') THEN -cm.amount ELSE 0 END), 0))::numeric(10,2)
  INTO v_expected
  FROM public.cash_movements AS cm
  WHERE cm.shift_id = v_shift.id
    AND cm.organization_id = v_org_id;
  v_difference := (p_closing_amount - v_expected)::numeric(10,2);
  v_reason := NULLIF(pg_catalog.btrim(COALESCE(p_difference_reason, '')), '');
  IF v_difference <> 0 AND v_reason IS NULL THEN RAISE EXCEPTION 'Debes indicar el motivo de la diferencia de caja'; END IF;
  UPDATE public.shifts SET closing_amount = p_closing_amount, closed_at = pg_catalog.now(), status = 'closed' WHERE public.shifts.id = v_shift.id AND public.shifts.organization_id = v_org_id;
  RETURN QUERY SELECT s.id, s.closed_at, s.closing_amount, s.status, v_expected, v_difference, v_reason FROM public.shifts AS s WHERE s.id = v_shift.id AND s.organization_id = v_org_id;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.register_payment_transaction(uuid, uuid, public.payment_method, numeric, numeric, text) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.register_inventory_movement(uuid, uuid, public.stock_movement_type, numeric, numeric, text) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.transition_order_status_transaction(uuid, uuid, public.order_status, text) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.transition_kitchen_order_transaction(uuid, uuid, public.order_status, text) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.close_cash_shift(uuid, numeric, text) FROM PUBLIC;

GRANT EXECUTE ON FUNCTION public.register_payment_transaction(uuid, uuid, public.payment_method, numeric, numeric, text) TO service_role;
GRANT EXECUTE ON FUNCTION public.register_inventory_movement(uuid, uuid, public.stock_movement_type, numeric, numeric, text) TO service_role;
GRANT EXECUTE ON FUNCTION public.transition_order_status_transaction(uuid, uuid, public.order_status, text) TO service_role;
GRANT EXECUTE ON FUNCTION public.transition_kitchen_order_transaction(uuid, uuid, public.order_status, text) TO service_role;
GRANT EXECUTE ON FUNCTION public.close_cash_shift(uuid, numeric, text) TO service_role;
