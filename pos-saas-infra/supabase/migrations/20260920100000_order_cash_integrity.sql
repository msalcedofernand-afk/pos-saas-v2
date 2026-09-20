-- Enforce order state transitions and cash reconciliation inside transactions.

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
  v_table_status public.table_status;
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

  IF p_table_id IS NOT NULL THEN
    SELECT tables_restaurant.status
    INTO v_table_status
    FROM public.tables_restaurant
    WHERE tables_restaurant.id = p_table_id
    FOR UPDATE;

    IF NOT FOUND THEN
      RAISE EXCEPTION 'Mesa no encontrada';
    END IF;
    IF v_table_status <> 'available' THEN
      RAISE EXCEPTION 'La mesa no está disponible';
    END IF;
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
    UPDATE public.tables_restaurant
    SET status = 'occupied'
    WHERE tables_restaurant.id = p_table_id;
  END IF;

  RETURN v_order_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.transition_order_status_transaction(
  p_order_id uuid,
  p_user_id uuid,
  p_status public.order_status,
  p_reason text DEFAULT NULL
)
RETURNS TABLE (id uuid, status public.order_status, table_id uuid, updated_at timestamptz)
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = ''
AS $$
DECLARE
  v_order public.orders%ROWTYPE;
BEGIN
  SELECT *
  INTO v_order
  FROM public.orders
  WHERE public.orders.id = p_order_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Pedido no encontrado';
  END IF;

  IF p_status = 'confirmed' AND v_order.status <> 'pending' THEN
    RAISE EXCEPTION 'Solo se puede confirmar un pedido pendiente';
  END IF;
  IF p_status = 'cancelled' AND v_order.status NOT IN ('pending', 'confirmed') THEN
    RAISE EXCEPTION 'Este pedido ya está en preparación y no puede cancelarse desde pedidos';
  END IF;
  IF p_status NOT IN ('confirmed', 'cancelled') THEN
    RAISE EXCEPTION 'Transición de pedido no permitida';
  END IF;

  UPDATE public.orders
  SET status = p_status, updated_at = pg_catalog.now()
  WHERE public.orders.id = p_order_id;

  IF p_status = 'cancelled' THEN
    UPDATE public.order_items
    SET status = 'cancelled', updated_at = pg_catalog.now()
    WHERE public.order_items.order_id = p_order_id;

    IF v_order.table_id IS NOT NULL AND NOT EXISTS (
      SELECT 1
      FROM public.orders
      WHERE public.orders.table_id = v_order.table_id
        AND public.orders.id <> p_order_id
        AND public.orders.status NOT IN ('paid', 'cancelled')
    ) THEN
      UPDATE public.tables_restaurant
      SET status = 'available'
      WHERE public.tables_restaurant.id = v_order.table_id;
    END IF;
  END IF;

  INSERT INTO public.audit_logs (
    user_id, action, auditable_type, auditable_id, old_values, new_values
  ) VALUES (
    p_user_id,
    'order_' || p_status::text,
    'orders',
    p_order_id,
    pg_catalog.jsonb_build_object('status', v_order.status),
    pg_catalog.jsonb_build_object('status', p_status, 'reason', p_reason)
  );

  RETURN QUERY
  SELECT orders.id, orders.status, orders.table_id, orders.updated_at
  FROM public.orders
  WHERE orders.id = p_order_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.transition_kitchen_order_transaction(
  p_order_id uuid,
  p_user_id uuid,
  p_status public.order_status,
  p_reason text DEFAULT NULL
)
RETURNS TABLE (id uuid, status public.order_status, notes text, updated_at timestamptz)
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = ''
AS $$
DECLARE
  v_order public.orders%ROWTYPE;
  v_next_item_status public.order_item_status;
  v_next_notes text;
BEGIN
  SELECT *
  INTO v_order
  FROM public.orders
  WHERE public.orders.id = p_order_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Pedido no encontrado';
  END IF;

  IF p_status = 'preparing' AND v_order.status NOT IN ('pending', 'confirmed') THEN
    RAISE EXCEPTION 'No se puede pasar de % a preparing', v_order.status;
  ELSIF p_status = 'ready' AND v_order.status <> 'preparing' THEN
    RAISE EXCEPTION 'No se puede pasar de % a ready', v_order.status;
  ELSIF p_status = 'served' AND v_order.status <> 'ready' THEN
    RAISE EXCEPTION 'No se puede pasar de % a served', v_order.status;
  ELSIF p_status = 'cancelled' AND v_order.status NOT IN ('pending', 'confirmed', 'preparing') THEN
    RAISE EXCEPTION 'No se puede cancelar un pedido en estado %', v_order.status;
  ELSIF p_status NOT IN ('preparing', 'ready', 'served', 'cancelled') THEN
    RAISE EXCEPTION 'Transición de cocina no permitida';
  END IF;

  IF p_status = 'cancelled' AND pg_catalog.nullif(pg_catalog.btrim(COALESCE(p_reason, '')), '') IS NULL THEN
    RAISE EXCEPTION 'Debe indicar el motivo de rechazo o cancelación';
  END IF;

  v_next_item_status := CASE p_status
    WHEN 'preparing' THEN 'preparing'::public.order_item_status
    WHEN 'ready' THEN 'ready'::public.order_item_status
    WHEN 'served' THEN 'served'::public.order_item_status
    ELSE 'cancelled'::public.order_item_status
  END;
  v_next_notes := CASE
    WHEN p_reason IS NULL OR pg_catalog.btrim(p_reason) = '' THEN v_order.notes
    ELSE pg_catalog.concat_ws(E'\n', v_order.notes, 'Incidencia cocina: ' || pg_catalog.btrim(p_reason))
  END;

  UPDATE public.orders
  SET status = p_status, notes = v_next_notes, updated_at = pg_catalog.now()
  WHERE public.orders.id = p_order_id;

  UPDATE public.order_items
  SET status = v_next_item_status, updated_at = pg_catalog.now()
  WHERE public.order_items.order_id = p_order_id
    AND public.order_items.status <> 'cancelled';

  IF p_status = 'cancelled' AND v_order.table_id IS NOT NULL AND NOT EXISTS (
    SELECT 1
    FROM public.orders
    WHERE public.orders.table_id = v_order.table_id
      AND public.orders.id <> p_order_id
      AND public.orders.status NOT IN ('paid', 'cancelled')
  ) THEN
    UPDATE public.tables_restaurant
    SET status = 'available'
    WHERE public.tables_restaurant.id = v_order.table_id;
  END IF;

  INSERT INTO public.audit_logs (
    user_id, action, auditable_type, auditable_id, old_values, new_values
  ) VALUES (
    p_user_id,
    'kitchen_order_' || p_status::text,
    'orders',
    p_order_id,
    pg_catalog.jsonb_build_object('status', v_order.status),
    pg_catalog.jsonb_build_object('status', p_status, 'reason', p_reason)
  );

  RETURN QUERY
  SELECT orders.id, orders.status, orders.notes, orders.updated_at
  FROM public.orders
  WHERE orders.id = p_order_id;
END;
$$;

DROP FUNCTION IF EXISTS public.close_cash_shift(uuid, numeric);

CREATE FUNCTION public.close_cash_shift(
  p_user_id uuid,
  p_closing_amount numeric,
  p_difference_reason text DEFAULT NULL
)
RETURNS TABLE (
  id uuid,
  closed_at timestamptz,
  closing_amount numeric,
  status public.shift_status,
  expected_amount numeric,
  difference numeric,
  difference_reason text
)
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = ''
AS $$
DECLARE
  v_shift public.shifts%ROWTYPE;
  v_expected numeric(10,2);
  v_difference numeric(10,2);
  v_reason text;
BEGIN
  IF p_closing_amount IS NULL OR p_closing_amount < 0 THEN
    RAISE EXCEPTION 'El monto final de caja es inválido';
  END IF;

  SELECT *
  INTO v_shift
  FROM public.shifts
  WHERE public.shifts.user_id = p_user_id
    AND public.shifts.status = 'open'
  ORDER BY public.shifts.opened_at DESC
  LIMIT 1
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'No tienes una caja abierta';
  END IF;

  SELECT (
    v_shift.opening_amount + COALESCE(SUM(
      CASE
        WHEN cash_movements.type IN ('sale', 'deposit', 'adjustment') THEN cash_movements.amount
        WHEN cash_movements.type IN ('refund', 'withdrawal') THEN -cash_movements.amount
        ELSE 0
      END
    ), 0)
  )::numeric(10,2)
  INTO v_expected
  FROM public.cash_movements
  WHERE cash_movements.shift_id = v_shift.id;

  v_difference := (p_closing_amount - v_expected)::numeric(10,2);
  v_reason := pg_catalog.nullif(pg_catalog.btrim(COALESCE(p_difference_reason, '')), '');
  IF v_difference <> 0 AND v_reason IS NULL THEN
    RAISE EXCEPTION 'Debes indicar el motivo de la diferencia de caja';
  END IF;

  UPDATE public.shifts
  SET closing_amount = p_closing_amount,
      closed_at = pg_catalog.now(),
      status = 'closed'
  WHERE public.shifts.id = v_shift.id;

  RETURN QUERY
  SELECT
    shifts.id,
    shifts.closed_at,
    shifts.closing_amount,
    shifts.status,
    v_expected,
    v_difference,
    v_reason
  FROM public.shifts
  WHERE shifts.id = v_shift.id;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.create_order_transaction(uuid, uuid, integer, text, jsonb) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.transition_order_status_transaction(uuid, uuid, public.order_status, text) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.transition_kitchen_order_transaction(uuid, uuid, public.order_status, text) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.close_cash_shift(uuid, numeric, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.create_order_transaction(uuid, uuid, integer, text, jsonb) TO service_role;
GRANT EXECUTE ON FUNCTION public.transition_order_status_transaction(uuid, uuid, public.order_status, text) TO service_role;
GRANT EXECUTE ON FUNCTION public.transition_kitchen_order_transaction(uuid, uuid, public.order_status, text) TO service_role;
GRANT EXECUTE ON FUNCTION public.close_cash_shift(uuid, numeric, text) TO service_role;
