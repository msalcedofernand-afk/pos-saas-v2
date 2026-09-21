-- Multi-tenant foundation.
-- Existing rows are assigned to the first organization so this migration is
-- backwards compatible with the original single-restaurant deployment.

CREATE SCHEMA IF NOT EXISTS private;
REVOKE ALL ON SCHEMA private FROM PUBLIC;
GRANT USAGE ON SCHEMA private TO authenticated, service_role;

CREATE TABLE public.organizations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  slug text NOT NULL UNIQUE,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE public.organization_members (
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  role_id uuid NOT NULL REFERENCES public.roles(id) ON DELETE RESTRICT,
  is_default boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (organization_id, user_id, role_id)
);

CREATE INDEX idx_organization_members_user ON public.organization_members(user_id);
CREATE INDEX idx_organization_members_org ON public.organization_members(organization_id);

INSERT INTO public.organizations (id, name, slug)
VALUES ('00000000-0000-0000-0000-000000000001', 'Mesa Clara', 'mesa-clara')
ON CONFLICT (id) DO NOTHING;

DO $$
DECLARE
  table_name text;
BEGIN
  FOREACH table_name IN ARRAY ARRAY[
    'settings', 'categories', 'products', 'tables_restaurant', 'shifts',
    'orders', 'order_items', 'payments', 'cash_movements', 'order_discounts',
    'refunds', 'kitchen_stations', 'inventory_categories', 'suppliers',
    'inventory_items', 'purchase_orders', 'purchase_order_items',
    'stock_movements', 'audit_logs'
  ] LOOP
    EXECUTE format('ALTER TABLE public.%I ADD COLUMN IF NOT EXISTS organization_id uuid', table_name);
    EXECUTE format(
      'UPDATE public.%I SET organization_id = ''00000000-0000-0000-0000-000000000001''::uuid WHERE organization_id IS NULL',
      table_name
    );
    EXECUTE format('ALTER TABLE public.%I ALTER COLUMN organization_id SET NOT NULL', table_name);
    EXECUTE format(
      'ALTER TABLE public.%I ADD CONSTRAINT %I FOREIGN KEY (organization_id) REFERENCES public.organizations(id) ON DELETE RESTRICT',
      table_name, table_name || '_organization_id_fkey'
    );
    EXECUTE format('CREATE INDEX IF NOT EXISTS %I ON public.%I(organization_id)', 'idx_' || table_name || '_organization_id', table_name);
    EXECUTE format('ALTER TABLE public.%I ADD CONSTRAINT %I UNIQUE (id, organization_id)', table_name, table_name || '_id_organization_key');
  END LOOP;
END;
$$;

INSERT INTO public.organization_members (organization_id, user_id, role_id, is_default)
SELECT '00000000-0000-0000-0000-000000000001'::uuid, ur.user_id, ur.role_id, true
FROM public.user_roles ur
ON CONFLICT (organization_id, user_id, role_id) DO UPDATE SET is_default = true;

ALTER TABLE public.settings DROP CONSTRAINT IF EXISTS settings_key_key;
ALTER TABLE public.settings ADD CONSTRAINT settings_organization_key_key UNIQUE (organization_id, key);

-- Composite references prevent a row from one organization pointing at a row
-- belonging to another organization.
ALTER TABLE public.products DROP CONSTRAINT IF EXISTS products_category_id_fkey;
ALTER TABLE public.orders DROP CONSTRAINT IF EXISTS orders_table_id_fkey;
ALTER TABLE public.order_items DROP CONSTRAINT IF EXISTS order_items_order_id_fkey;
ALTER TABLE public.order_items DROP CONSTRAINT IF EXISTS order_items_product_id_fkey;
ALTER TABLE public.payments DROP CONSTRAINT IF EXISTS payments_order_id_fkey;
ALTER TABLE public.payments DROP CONSTRAINT IF EXISTS payments_shift_id_fkey;
ALTER TABLE public.cash_movements DROP CONSTRAINT IF EXISTS cash_movements_shift_id_fkey;
ALTER TABLE public.order_discounts DROP CONSTRAINT IF EXISTS order_discounts_order_id_fkey;
ALTER TABLE public.refunds DROP CONSTRAINT IF EXISTS refunds_order_id_fkey;
ALTER TABLE public.refunds DROP CONSTRAINT IF EXISTS refunds_payment_id_fkey;
ALTER TABLE public.inventory_items DROP CONSTRAINT IF EXISTS inventory_items_inventory_category_id_fkey;
ALTER TABLE public.inventory_items DROP CONSTRAINT IF EXISTS inventory_items_supplier_id_fkey;
ALTER TABLE public.purchase_orders DROP CONSTRAINT IF EXISTS purchase_orders_supplier_id_fkey;
ALTER TABLE public.purchase_order_items DROP CONSTRAINT IF EXISTS purchase_order_items_purchase_order_id_fkey;
ALTER TABLE public.purchase_order_items DROP CONSTRAINT IF EXISTS purchase_order_items_inventory_item_id_fkey;
ALTER TABLE public.stock_movements DROP CONSTRAINT IF EXISTS stock_movements_inventory_item_id_fkey;

ALTER TABLE public.products ADD CONSTRAINT products_category_org_fkey
  FOREIGN KEY (category_id, organization_id) REFERENCES public.categories(id, organization_id);
ALTER TABLE public.orders ADD CONSTRAINT orders_table_org_fkey
  FOREIGN KEY (table_id, organization_id) REFERENCES public.tables_restaurant(id, organization_id);
ALTER TABLE public.order_items ADD CONSTRAINT order_items_order_org_fkey
  FOREIGN KEY (order_id, organization_id) REFERENCES public.orders(id, organization_id);
ALTER TABLE public.order_items ADD CONSTRAINT order_items_product_org_fkey
  FOREIGN KEY (product_id, organization_id) REFERENCES public.products(id, organization_id);
ALTER TABLE public.payments ADD CONSTRAINT payments_order_org_fkey
  FOREIGN KEY (order_id, organization_id) REFERENCES public.orders(id, organization_id);
ALTER TABLE public.payments ADD CONSTRAINT payments_shift_org_fkey
  FOREIGN KEY (shift_id, organization_id) REFERENCES public.shifts(id, organization_id);
ALTER TABLE public.cash_movements ADD CONSTRAINT cash_movements_shift_org_fkey
  FOREIGN KEY (shift_id, organization_id) REFERENCES public.shifts(id, organization_id);
ALTER TABLE public.order_discounts ADD CONSTRAINT order_discounts_order_org_fkey
  FOREIGN KEY (order_id, organization_id) REFERENCES public.orders(id, organization_id);
ALTER TABLE public.refunds ADD CONSTRAINT refunds_order_org_fkey
  FOREIGN KEY (order_id, organization_id) REFERENCES public.orders(id, organization_id);
ALTER TABLE public.refunds ADD CONSTRAINT refunds_payment_org_fkey
  FOREIGN KEY (payment_id, organization_id) REFERENCES public.payments(id, organization_id);
ALTER TABLE public.inventory_items ADD CONSTRAINT inventory_items_category_org_fkey
  FOREIGN KEY (inventory_category_id, organization_id) REFERENCES public.inventory_categories(id, organization_id);
ALTER TABLE public.inventory_items ADD CONSTRAINT inventory_items_supplier_org_fkey
  FOREIGN KEY (supplier_id, organization_id) REFERENCES public.suppliers(id, organization_id);
ALTER TABLE public.purchase_orders ADD CONSTRAINT purchase_orders_supplier_org_fkey
  FOREIGN KEY (supplier_id, organization_id) REFERENCES public.suppliers(id, organization_id);
ALTER TABLE public.purchase_order_items ADD CONSTRAINT purchase_order_items_order_org_fkey
  FOREIGN KEY (purchase_order_id, organization_id) REFERENCES public.purchase_orders(id, organization_id);
ALTER TABLE public.purchase_order_items ADD CONSTRAINT purchase_order_items_item_org_fkey
  FOREIGN KEY (inventory_item_id, organization_id) REFERENCES public.inventory_items(id, organization_id);
ALTER TABLE public.stock_movements ADD CONSTRAINT stock_movements_item_org_fkey
  FOREIGN KEY (inventory_item_id, organization_id) REFERENCES public.inventory_items(id, organization_id);

CREATE OR REPLACE FUNCTION private.is_org_member(p_organization_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.organization_members
    JOIN public.organizations ON organizations.id = organization_members.organization_id
    WHERE organization_id = p_organization_id
      AND organizations.is_active = true
      AND user_id = (SELECT auth.uid())
  );
$$;

CREATE OR REPLACE FUNCTION private.has_org_role(p_organization_id uuid, p_role_name text)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.organization_members om
    JOIN public.roles r ON r.id = om.role_id
    JOIN public.organizations o ON o.id = om.organization_id
    WHERE om.organization_id = p_organization_id
      AND o.is_active = true
      AND om.user_id = (SELECT auth.uid())
      AND r.name = p_role_name
  );
$$;

REVOKE ALL ON FUNCTION private.is_org_member(uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION private.has_org_role(uuid, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION private.is_org_member(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION private.has_org_role(uuid, text) TO authenticated;

ALTER TABLE public.organizations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.organization_members ENABLE ROW LEVEL SECURITY;

CREATE POLICY organizations_select_member ON public.organizations
  FOR SELECT TO authenticated
  USING (private.is_org_member(id));
CREATE POLICY organization_members_select_member ON public.organization_members
  FOR SELECT TO authenticated
  USING (private.is_org_member(organization_id));

DO $$
DECLARE
  table_name text;
  policy_row record;
BEGIN
  FOREACH table_name IN ARRAY ARRAY[
    'settings', 'categories', 'products', 'tables_restaurant', 'shifts',
    'orders', 'order_items', 'payments', 'cash_movements', 'order_discounts',
    'refunds', 'kitchen_stations', 'inventory_categories', 'suppliers',
    'inventory_items', 'purchase_orders', 'purchase_order_items',
    'stock_movements', 'audit_logs'
  ] LOOP
    FOR policy_row IN
      SELECT policyname
      FROM pg_policies
      WHERE schemaname = 'public' AND tablename = table_name
    LOOP
      EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I', policy_row.policyname, table_name);
    END LOOP;

    EXECUTE format(
      'CREATE POLICY tenant_select ON public.%I FOR SELECT TO authenticated USING (private.is_org_member(organization_id))',
      table_name
    );
    EXECUTE format(
      'CREATE POLICY tenant_insert ON public.%I FOR INSERT TO authenticated WITH CHECK (private.is_org_member(organization_id))',
      table_name
    );
    EXECUTE format(
      'CREATE POLICY tenant_update ON public.%I FOR UPDATE TO authenticated USING (private.is_org_member(organization_id)) WITH CHECK (private.is_org_member(organization_id))',
      table_name
    );
    EXECUTE format(
      'CREATE POLICY tenant_delete ON public.%I FOR DELETE TO authenticated USING (private.is_org_member(organization_id))',
      table_name
    );
  END LOOP;
END;
$$;

-- Keep role authorization scoped to the active organization. The API uses the
-- service role, while direct Data API access is protected by these policies.
CREATE OR REPLACE FUNCTION public.has_role(role_name text)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.organization_members om
    JOIN public.roles r ON r.id = om.role_id
    JOIN public.organizations o ON o.id = om.organization_id
    WHERE om.user_id = (SELECT auth.uid())
      AND o.is_active = true
      AND r.name = role_name
  );
$$;
REVOKE ALL ON FUNCTION public.has_role(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.has_role(text) TO authenticated;

CREATE OR REPLACE FUNCTION public.get_user_roles()
RETURNS SETOF text
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT r.name
  FROM public.organization_members om
  JOIN public.roles r ON r.id = om.role_id
  WHERE om.user_id = (SELECT auth.uid());
$$;
REVOKE ALL ON FUNCTION public.get_user_roles() FROM PUBLIC;
-- Role lookup is performed by the server with the admin client. Keeping this
-- helper private prevents exposing role enumeration through the browser RPC.

CREATE OR REPLACE FUNCTION private.user_organization(p_user_id uuid)
RETURNS uuid
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT organization_id
  FROM public.organization_members
  JOIN public.organizations ON organizations.id = organization_members.organization_id
  WHERE user_id = p_user_id
    AND organizations.is_active = true
  ORDER BY organization_members.is_default DESC,
           organization_members.created_at ASC
  LIMIT 1;
$$;

REVOKE ALL ON FUNCTION private.user_organization(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION private.user_organization(uuid) TO service_role;

CREATE OR REPLACE FUNCTION private.assign_organization_from_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  IF NEW.organization_id IS NULL THEN
    NEW.organization_id := private.user_organization(NEW.user_id);
  END IF;
  IF NEW.organization_id IS NULL THEN
    RAISE EXCEPTION 'El usuario no pertenece a ninguna organización';
  END IF;
  RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION private.assign_organization_from_user() FROM PUBLIC;

DROP TRIGGER IF EXISTS trg_assign_org_shifts ON public.shifts;
CREATE TRIGGER trg_assign_org_shifts BEFORE INSERT ON public.shifts
FOR EACH ROW EXECUTE FUNCTION private.assign_organization_from_user();
DROP TRIGGER IF EXISTS trg_assign_org_payments ON public.payments;
CREATE TRIGGER trg_assign_org_payments BEFORE INSERT ON public.payments
FOR EACH ROW EXECUTE FUNCTION private.assign_organization_from_user();
DROP TRIGGER IF EXISTS trg_assign_org_cash_movements ON public.cash_movements;
CREATE TRIGGER trg_assign_org_cash_movements BEFORE INSERT ON public.cash_movements
FOR EACH ROW EXECUTE FUNCTION private.assign_organization_from_user();
DROP TRIGGER IF EXISTS trg_assign_org_audit_logs ON public.audit_logs;
CREATE TRIGGER trg_assign_org_audit_logs BEFORE INSERT ON public.audit_logs
FOR EACH ROW EXECUTE FUNCTION private.assign_organization_from_user();
DROP TRIGGER IF EXISTS trg_organizations_updated_at ON public.organizations;
CREATE TRIGGER trg_organizations_updated_at BEFORE UPDATE ON public.organizations
FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE OR REPLACE FUNCTION private.assign_organization_from_order()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_org_id uuid;
BEGIN
  IF NEW.organization_id IS NULL THEN
    SELECT organization_id INTO v_org_id
    FROM public.orders
    WHERE id = NEW.order_id;
    NEW.organization_id := v_org_id;
  END IF;
  IF NEW.organization_id IS NULL THEN
    RAISE EXCEPTION 'El pedido no pertenece a ninguna organización';
  END IF;
  RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION private.assign_organization_from_order() FROM PUBLIC;

DROP TRIGGER IF EXISTS trg_assign_org_orders ON public.orders;
CREATE TRIGGER trg_assign_org_orders BEFORE INSERT ON public.orders
FOR EACH ROW EXECUTE FUNCTION private.assign_organization_from_user();
DROP TRIGGER IF EXISTS trg_assign_org_order_items ON public.order_items;
CREATE TRIGGER trg_assign_org_order_items BEFORE INSERT ON public.order_items
FOR EACH ROW EXECUTE FUNCTION private.assign_organization_from_order();
DROP TRIGGER IF EXISTS trg_assign_org_order_discounts ON public.order_discounts;
CREATE TRIGGER trg_assign_org_order_discounts BEFORE INSERT ON public.order_discounts
FOR EACH ROW EXECUTE FUNCTION private.assign_organization_from_user();
DROP TRIGGER IF EXISTS trg_assign_org_refunds ON public.refunds;
CREATE TRIGGER trg_assign_org_refunds BEFORE INSERT ON public.refunds
FOR EACH ROW EXECUTE FUNCTION private.assign_organization_from_user();
DROP TRIGGER IF EXISTS trg_assign_org_purchase_orders ON public.purchase_orders;
CREATE TRIGGER trg_assign_org_purchase_orders BEFORE INSERT ON public.purchase_orders
FOR EACH ROW EXECUTE FUNCTION private.assign_organization_from_user();
DROP TRIGGER IF EXISTS trg_assign_org_stock_movements ON public.stock_movements;
CREATE TRIGGER trg_assign_org_stock_movements BEFORE INSERT ON public.stock_movements
FOR EACH ROW EXECUTE FUNCTION private.assign_organization_from_user();

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
  v_org_id uuid;
  v_table_status public.table_status;
BEGIN
  SELECT private.user_organization(p_user_id) INTO v_org_id;
  IF v_org_id IS NULL THEN RAISE EXCEPTION 'El usuario no pertenece a ninguna organización'; END IF;
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
  SELECT * INTO v_order FROM public.orders WHERE id = p_order_id AND organization_id = v_org_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Pedido no encontrado'; END IF;
  IF v_order.status NOT IN ('served', 'paid') THEN RAISE EXCEPTION 'El pedido todavía no está listo para cobrar'; END IF;
  IF v_order.status = 'paid' THEN RAISE EXCEPTION 'El pedido ya está pagado'; END IF;
  IF p_amount IS NULL OR p_amount <= 0 THEN RAISE EXCEPTION 'El monto del pago es inválido'; END IF;
  SELECT COALESCE(sum(amount), 0)::numeric(10,2) INTO v_paid FROM public.payments WHERE order_id = p_order_id AND organization_id = v_org_id;
  v_due := (v_order.total_amount - v_paid)::numeric(10,2);
  IF p_amount > v_due THEN RAISE EXCEPTION 'El monto supera el saldo del pedido'; END IF;
  v_received := COALESCE(p_received_amount, p_amount)::numeric(10,2);
  IF p_method = 'cash' AND v_received < p_amount THEN RAISE EXCEPTION 'El efectivo recibido es insuficiente'; END IF;
  IF p_method <> 'cash' THEN v_received := p_amount; END IF;
  v_change := pg_catalog.greatest(0, v_received - p_amount)::numeric(10,2);
  SELECT id INTO v_shift_id FROM public.shifts WHERE user_id = p_user_id AND organization_id = v_org_id AND status = 'open' ORDER BY opened_at DESC LIMIT 1 FOR UPDATE;
  IF v_shift_id IS NULL THEN RAISE EXCEPTION 'Abre una caja antes de registrar pagos'; END IF;
  INSERT INTO public.payments (organization_id, order_id, user_id, method, amount, change_amount, shift_id, reference)
  VALUES (v_org_id, p_order_id, p_user_id, p_method, p_amount, v_change, v_shift_id, p_reference) RETURNING id INTO v_payment_id;
  IF p_method = 'cash' THEN
    INSERT INTO public.cash_movements (organization_id, shift_id, type, amount, description, user_id)
    VALUES (v_org_id, v_shift_id, 'sale', p_amount, 'Pedido ' || pg_catalog.right(p_order_id::text, 6), p_user_id);
  END IF;
  v_paid := (v_paid + p_amount)::numeric(10,2);
  v_status := CASE WHEN v_paid >= v_order.total_amount THEN 'paid' ELSE 'served' END;
  UPDATE public.orders SET status = v_status, updated_at = pg_catalog.now() WHERE id = p_order_id AND organization_id = v_org_id;
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
  SELECT * INTO v_item FROM public.inventory_items WHERE id = p_inventory_item_id AND organization_id = v_org_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Insumo no encontrado'; END IF;
  v_next := CASE p_type WHEN 'in' THEN v_item.current_stock + p_quantity WHEN 'out' THEN v_item.current_stock - p_quantity ELSE p_quantity END;
  IF v_next < 0 THEN RAISE EXCEPTION 'El stock no puede quedar negativo'; END IF;
  INSERT INTO public.stock_movements (organization_id, inventory_item_id, type, quantity, unit_cost, description, user_id)
  VALUES (v_org_id, p_inventory_item_id, p_type, p_quantity, COALESCE(p_unit_cost, 0), p_description, p_user_id);
  UPDATE public.inventory_items SET current_stock = v_next, updated_at = pg_catalog.now() WHERE id = p_inventory_item_id AND organization_id = v_org_id;
  RETURN QUERY SELECT v_item.id, v_item.name, v_next, v_item.minimum_stock, v_item.unit;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.create_order_transaction(uuid, uuid, integer, text, jsonb) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.register_payment_transaction(uuid, uuid, public.payment_method, numeric, numeric, text) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.register_inventory_movement(uuid, uuid, public.stock_movement_type, numeric, numeric, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.create_order_transaction(uuid, uuid, integer, text, jsonb) TO service_role;
GRANT EXECUTE ON FUNCTION public.register_payment_transaction(uuid, uuid, public.payment_method, numeric, numeric, text) TO service_role;
GRANT EXECUTE ON FUNCTION public.register_inventory_movement(uuid, uuid, public.stock_movement_type, numeric, numeric, text) TO service_role;

CREATE OR REPLACE FUNCTION public.transition_order_status_transaction(
  p_order_id uuid, p_user_id uuid, p_status public.order_status, p_reason text DEFAULT NULL
)
RETURNS TABLE (id uuid, status public.order_status, table_id uuid, updated_at timestamptz)
LANGUAGE plpgsql SECURITY INVOKER SET search_path = ''
AS $$
DECLARE v_order public.orders%ROWTYPE; v_org_id uuid;
BEGIN
  SELECT private.user_organization(p_user_id) INTO v_org_id;
  SELECT * INTO v_order FROM public.orders WHERE id = p_order_id AND organization_id = v_org_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Pedido no encontrado'; END IF;
  IF p_status = 'confirmed' AND v_order.status <> 'pending' THEN RAISE EXCEPTION 'Solo se puede confirmar un pedido pendiente'; END IF;
  IF p_status = 'cancelled' AND v_order.status NOT IN ('pending', 'confirmed') THEN RAISE EXCEPTION 'Este pedido ya está en preparación y no puede cancelarse desde pedidos'; END IF;
  IF p_status NOT IN ('confirmed', 'cancelled') THEN RAISE EXCEPTION 'Transición de pedido no permitida'; END IF;
  UPDATE public.orders SET status = p_status, updated_at = pg_catalog.now() WHERE id = p_order_id AND organization_id = v_org_id;
  IF p_status = 'cancelled' THEN
    UPDATE public.order_items SET status = 'cancelled', updated_at = pg_catalog.now() WHERE order_id = p_order_id AND organization_id = v_org_id;
    IF v_order.table_id IS NOT NULL AND NOT EXISTS (
      SELECT 1 FROM public.orders WHERE table_id = v_order.table_id AND organization_id = v_org_id AND id <> p_order_id AND status NOT IN ('paid', 'cancelled')
    ) THEN
      UPDATE public.tables_restaurant SET status = 'available' WHERE id = v_order.table_id AND organization_id = v_org_id;
    END IF;
  END IF;
  INSERT INTO public.audit_logs (organization_id, user_id, action, auditable_type, auditable_id, old_values, new_values)
  VALUES (v_org_id, p_user_id, 'order_' || p_status::text, 'orders', p_order_id,
    pg_catalog.jsonb_build_object('status', v_order.status), pg_catalog.jsonb_build_object('status', p_status, 'reason', p_reason));
  RETURN QUERY SELECT o.id, o.status, o.table_id, o.updated_at FROM public.orders o WHERE o.id = p_order_id AND o.organization_id = v_org_id;
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
  SELECT * INTO v_order FROM public.orders WHERE id = p_order_id AND organization_id = v_org_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Pedido no encontrado'; END IF;
  IF p_status = 'preparing' AND v_order.status NOT IN ('pending', 'confirmed') THEN RAISE EXCEPTION 'No se puede pasar de % a preparing', v_order.status;
  ELSIF p_status = 'ready' AND v_order.status <> 'preparing' THEN RAISE EXCEPTION 'No se puede pasar de % a ready', v_order.status;
  ELSIF p_status = 'served' AND v_order.status <> 'ready' THEN RAISE EXCEPTION 'No se puede pasar de % a served', v_order.status;
  ELSIF p_status = 'cancelled' AND v_order.status NOT IN ('pending', 'confirmed', 'preparing') THEN RAISE EXCEPTION 'No se puede cancelar un pedido en estado %', v_order.status;
  ELSIF p_status NOT IN ('preparing', 'ready', 'served', 'cancelled') THEN RAISE EXCEPTION 'Transición de cocina no permitida'; END IF;
  IF p_status = 'cancelled' AND NULLIF(pg_catalog.btrim(COALESCE(p_reason, '')), '') IS NULL THEN RAISE EXCEPTION 'Debe indicar el motivo de rechazo o cancelación'; END IF;
  v_next_item_status := CASE p_status WHEN 'preparing' THEN 'preparing'::public.order_item_status WHEN 'ready' THEN 'ready'::public.order_item_status WHEN 'served' THEN 'served'::public.order_item_status ELSE 'cancelled'::public.order_item_status END;
  v_next_notes := CASE WHEN p_reason IS NULL OR pg_catalog.btrim(p_reason) = '' THEN v_order.notes ELSE pg_catalog.concat_ws(E'\n', v_order.notes, 'Incidencia cocina: ' || pg_catalog.btrim(p_reason)) END;
  UPDATE public.orders SET status = p_status, notes = v_next_notes, updated_at = pg_catalog.now() WHERE id = p_order_id AND organization_id = v_org_id;
  UPDATE public.order_items SET status = v_next_item_status, updated_at = pg_catalog.now() WHERE order_id = p_order_id AND organization_id = v_org_id AND status <> 'cancelled';
  IF p_status = 'cancelled' AND v_order.table_id IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM public.orders WHERE table_id = v_order.table_id AND organization_id = v_org_id AND id <> p_order_id AND status NOT IN ('paid', 'cancelled')
  ) THEN UPDATE public.tables_restaurant SET status = 'available' WHERE id = v_order.table_id AND organization_id = v_org_id; END IF;
  INSERT INTO public.audit_logs (organization_id, user_id, action, auditable_type, auditable_id, old_values, new_values)
  VALUES (v_org_id, p_user_id, 'kitchen_order_' || p_status::text, 'orders', p_order_id,
    pg_catalog.jsonb_build_object('status', v_order.status), pg_catalog.jsonb_build_object('status', p_status, 'reason', p_reason));
  RETURN QUERY SELECT o.id, o.status, o.notes, o.updated_at FROM public.orders o WHERE o.id = p_order_id AND o.organization_id = v_org_id;
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
  SELECT * INTO v_shift FROM public.shifts WHERE user_id = p_user_id AND organization_id = v_org_id AND status = 'open' ORDER BY opened_at DESC LIMIT 1 FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'No tienes una caja abierta'; END IF;
  SELECT (v_shift.opening_amount + COALESCE(SUM(CASE WHEN cm.type IN ('sale', 'deposit', 'adjustment') THEN cm.amount WHEN cm.type IN ('refund', 'withdrawal') THEN -cm.amount ELSE 0 END), 0))::numeric(10,2)
  INTO v_expected FROM public.cash_movements cm WHERE cm.shift_id = v_shift.id AND cm.organization_id = v_org_id;
  v_difference := (p_closing_amount - v_expected)::numeric(10,2);
  v_reason := NULLIF(pg_catalog.btrim(COALESCE(p_difference_reason, '')), '');
  IF v_difference <> 0 AND v_reason IS NULL THEN RAISE EXCEPTION 'Debes indicar el motivo de la diferencia de caja'; END IF;
  UPDATE public.shifts SET closing_amount = p_closing_amount, closed_at = pg_catalog.now(), status = 'closed' WHERE id = v_shift.id AND organization_id = v_org_id;
  RETURN QUERY SELECT s.id, s.closed_at, s.closing_amount, s.status, v_expected, v_difference, v_reason FROM public.shifts s WHERE s.id = v_shift.id AND s.organization_id = v_org_id;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.transition_order_status_transaction(uuid, uuid, public.order_status, text) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.transition_kitchen_order_transaction(uuid, uuid, public.order_status, text) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.close_cash_shift(uuid, numeric, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.transition_order_status_transaction(uuid, uuid, public.order_status, text) TO service_role;
GRANT EXECUTE ON FUNCTION public.transition_kitchen_order_transaction(uuid, uuid, public.order_status, text) TO service_role;
GRANT EXECUTE ON FUNCTION public.close_cash_shift(uuid, numeric, text) TO service_role;

CREATE OR REPLACE FUNCTION public.get_report_summary(
  p_organization_id uuid,
  p_start timestamptz,
  p_end timestamptz
)
RETURNS jsonb
LANGUAGE sql
STABLE
SECURITY INVOKER
SET search_path = ''
AS $$
  SELECT pg_catalog.jsonb_build_object(
    'orders', (SELECT count(*) FROM public.orders WHERE organization_id = p_organization_id AND created_at >= p_start AND created_at < p_end),
    'paidOrders', (SELECT count(*) FROM public.orders WHERE organization_id = p_organization_id AND status = 'paid' AND created_at >= p_start AND created_at < p_end),
    'cancelled', (SELECT count(*) FROM public.orders WHERE organization_id = p_organization_id AND status = 'cancelled' AND created_at >= p_start AND created_at < p_end),
    'sales', COALESCE((SELECT sum(total_amount) FROM public.orders WHERE organization_id = p_organization_id AND status = 'paid' AND created_at >= p_start AND created_at < p_end), 0),
    'paymentsByMethod', COALESCE((
      SELECT pg_catalog.jsonb_object_agg(method::text, total)
      FROM (
        SELECT method, sum(amount)::numeric(12,2) AS total
        FROM public.payments
        WHERE organization_id = p_organization_id AND created_at >= p_start AND created_at < p_end
        GROUP BY method
      ) grouped_payments
    ), '{}'::jsonb)
  );
$$;

REVOKE EXECUTE ON FUNCTION public.get_report_summary(uuid, timestamptz, timestamptz) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_report_summary(uuid, timestamptz, timestamptz) TO service_role;
