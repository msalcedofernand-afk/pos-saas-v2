-- Atomic domain operations used by the server API.
-- These functions are invoker functions and are callable only by service_role.

CREATE OR REPLACE FUNCTION public.create_order_transaction(
  p_user_id uuid,
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
BEGIN
  IF p_user_id IS NULL OR p_guests IS NULL OR p_guests < 1 THEN
    RAISE EXCEPTION 'Datos del pedido inválidos';
  END IF;

  IF jsonb_typeof(p_items) <> 'array' OR jsonb_array_length(p_items) = 0 THEN
    RAISE EXCEPTION 'El pedido debe tener productos';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM jsonb_to_recordset(p_items) AS requested(product_id uuid, quantity integer, notes text)
    WHERE requested.product_id IS NULL OR requested.quantity IS NULL OR requested.quantity < 1
  ) THEN
    RAISE EXCEPTION 'Los productos del pedido son inválidos';
  END IF;

  IF p_table_id IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM public.tables_restaurant
    WHERE id = p_table_id
    FOR UPDATE
  ) THEN
    RAISE EXCEPTION 'Mesa no encontrada';
  END IF;

  SELECT count(*), COALESCE(sum(requested.quantity * products.price), 0)::numeric(10,2)
  INTO v_item_count, v_total
  FROM jsonb_to_recordset(p_items) AS requested(product_id uuid, quantity integer, notes text)
  JOIN public.products ON products.id = requested.product_id
    AND products.is_available = true;

  IF v_item_count <> jsonb_array_length(p_items) THEN
    RAISE EXCEPTION 'Uno de los productos no está disponible';
  END IF;

  INSERT INTO public.orders (table_id, user_id, status, total_amount, guests, notes)
  VALUES (p_table_id, p_user_id, 'confirmed', v_total, p_guests, p_notes)
  RETURNING id INTO v_order_id;

  INSERT INTO public.order_items (order_id, product_id, quantity, unit_price, subtotal, status, notes)
  SELECT v_order_id, requested.product_id, requested.quantity, products.price,
    (requested.quantity * products.price)::numeric(10,2), 'pending', requested.notes
  FROM jsonb_to_recordset(p_items) AS requested(product_id uuid, quantity integer, notes text)
  JOIN public.products ON products.id = requested.product_id
    AND products.is_available = true;

  IF p_table_id IS NOT NULL THEN
    UPDATE public.tables_restaurant SET status = 'occupied' WHERE id = p_table_id;
  END IF;

  RETURN v_order_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.register_payment_transaction(
  p_order_id uuid,
  p_user_id uuid,
  p_method public.payment_method,
  p_amount numeric,
  p_received_amount numeric,
  p_reference text
)
RETURNS TABLE (
  payment_id uuid,
  order_id uuid,
  method public.payment_method,
  amount numeric,
  change_amount numeric,
  order_status public.order_status,
  total_paid numeric,
  remaining numeric
)
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = ''
AS $$
DECLARE
  v_order public.orders%ROWTYPE;
  v_shift_id uuid;
  v_payment_id uuid;
  v_paid numeric(10,2);
  v_due numeric(10,2);
  v_received numeric(10,2);
  v_change numeric(10,2);
  v_status public.order_status;
BEGIN
  SELECT * INTO v_order FROM public.orders WHERE id = p_order_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Pedido no encontrado'; END IF;
  IF v_order.status NOT IN ('served', 'paid') THEN RAISE EXCEPTION 'El pedido todavía no está listo para cobrar'; END IF;
  IF v_order.status = 'paid' THEN RAISE EXCEPTION 'El pedido ya está pagado'; END IF;
  IF p_amount IS NULL OR p_amount <= 0 THEN RAISE EXCEPTION 'El monto del pago es inválido'; END IF;

  SELECT COALESCE(sum(payments.amount), 0)::numeric(10,2) INTO v_paid
  FROM public.payments WHERE payments.order_id = p_order_id;
  v_due := (v_order.total_amount - v_paid)::numeric(10,2);
  IF p_amount > v_due THEN RAISE EXCEPTION 'El monto supera el saldo del pedido'; END IF;

  v_received := COALESCE(p_received_amount, p_amount)::numeric(10,2);
  IF p_method = 'cash' AND v_received < p_amount THEN RAISE EXCEPTION 'El efectivo recibido es insuficiente'; END IF;
  IF p_method <> 'cash' THEN v_received := p_amount; END IF;
  v_change := GREATEST(0, v_received - p_amount)::numeric(10,2);

  SELECT shifts.id INTO v_shift_id FROM public.shifts
  WHERE shifts.user_id = p_user_id AND shifts.status = 'open'
  ORDER BY shifts.opened_at DESC LIMIT 1 FOR UPDATE;
  IF v_shift_id IS NULL THEN RAISE EXCEPTION 'Abre una caja antes de registrar pagos'; END IF;

  INSERT INTO public.payments (order_id, user_id, method, amount, change_amount, shift_id, reference)
  VALUES (p_order_id, p_user_id, p_method, p_amount, v_change, v_shift_id, p_reference)
  RETURNING payments.id INTO v_payment_id;

  INSERT INTO public.cash_movements (shift_id, type, amount, description, user_id)
  VALUES (v_shift_id, 'sale', p_amount, 'Pedido ' || right(p_order_id::text, 6), p_user_id);

  v_paid := (v_paid + p_amount)::numeric(10,2);
  v_status := CASE WHEN v_paid >= v_order.total_amount THEN 'paid' ELSE 'served' END;
  UPDATE public.orders SET status = v_status, updated_at = now() WHERE id = p_order_id;

  RETURN QUERY SELECT v_payment_id, p_order_id, p_method, p_amount, v_change, v_status, v_paid, GREATEST(0, v_order.total_amount - v_paid)::numeric(10,2);
END;
$$;

CREATE OR REPLACE FUNCTION public.register_inventory_movement(
  p_inventory_item_id uuid,
  p_user_id uuid,
  p_type public.stock_movement_type,
  p_quantity numeric,
  p_unit_cost numeric,
  p_description text
)
RETURNS TABLE (id uuid, name text, current_stock numeric, minimum_stock numeric, unit text)
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = ''
AS $$
DECLARE
  v_item public.inventory_items%ROWTYPE;
  v_next numeric(12,3);
BEGIN
  IF p_quantity IS NULL OR p_quantity <= 0 THEN RAISE EXCEPTION 'La cantidad debe ser mayor que cero'; END IF;
  SELECT * INTO v_item FROM public.inventory_items WHERE inventory_items.id = p_inventory_item_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Insumo no encontrado'; END IF;

  v_next := CASE p_type WHEN 'in' THEN v_item.current_stock + p_quantity WHEN 'out' THEN v_item.current_stock - p_quantity ELSE p_quantity END;
  IF v_next < 0 THEN RAISE EXCEPTION 'El stock no puede quedar negativo'; END IF;

  INSERT INTO public.stock_movements (inventory_item_id, type, quantity, unit_cost, description, user_id)
  VALUES (p_inventory_item_id, p_type, p_quantity, COALESCE(p_unit_cost, 0), p_description, p_user_id);
  UPDATE public.inventory_items SET current_stock = v_next, updated_at = now() WHERE inventory_items.id = p_inventory_item_id;
  RETURN QUERY SELECT v_item.id, v_item.name, v_next, v_item.minimum_stock, v_item.unit;
END;
$$;

CREATE OR REPLACE FUNCTION public.close_cash_shift(p_user_id uuid, p_closing_amount numeric)
RETURNS TABLE (id uuid, closed_at timestamptz, closing_amount numeric, status public.shift_status)
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = ''
AS $$
DECLARE
  v_shift_id uuid;
BEGIN
  SELECT shifts.id INTO v_shift_id FROM public.shifts
  WHERE shifts.user_id = p_user_id AND shifts.status = 'open'
  ORDER BY shifts.opened_at DESC LIMIT 1 FOR UPDATE;
  IF v_shift_id IS NULL THEN RAISE EXCEPTION 'No tienes una caja abierta'; END IF;
  IF EXISTS (SELECT 1 FROM public.orders WHERE status = 'served') THEN RAISE EXCEPTION 'Hay pedidos servidos pendientes de cobro'; END IF;
  RETURN QUERY UPDATE public.shifts
  SET closing_amount = p_closing_amount, closed_at = now(), status = 'closed'
  WHERE shifts.id = v_shift_id
  RETURNING shifts.id, shifts.closed_at, shifts.closing_amount, shifts.status;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.create_order_transaction(uuid, uuid, integer, text, jsonb) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.register_payment_transaction(uuid, uuid, public.payment_method, numeric, numeric, text) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.register_inventory_movement(uuid, uuid, public.stock_movement_type, numeric, numeric, text) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.close_cash_shift(uuid, numeric) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.create_order_transaction(uuid, uuid, integer, text, jsonb) TO service_role;
GRANT EXECUTE ON FUNCTION public.register_payment_transaction(uuid, uuid, public.payment_method, numeric, numeric, text) TO service_role;
GRANT EXECUTE ON FUNCTION public.register_inventory_movement(uuid, uuid, public.stock_movement_type, numeric, numeric, text) TO service_role;
GRANT EXECUTE ON FUNCTION public.close_cash_shift(uuid, numeric) TO service_role;
