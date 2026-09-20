-- =============================================================================
-- POS SaaS System - Initial Schema Migration
-- Single-restaurant POS with multi-role support
-- =============================================================================

-- Extensions
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- =============================================================================
-- 1. ROLES
-- =============================================================================
CREATE TABLE public.roles (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name        text NOT NULL UNIQUE,
  display_name text NOT NULL,
  created_at  timestamptz NOT NULL DEFAULT now()
);

-- =============================================================================
-- 2. USERS
-- =============================================================================
CREATE TABLE public.users (
  id            uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email         text NOT NULL,
  name          text,
  password_hash text,
  is_blocked    boolean NOT NULL DEFAULT false,
  theme         text NOT NULL DEFAULT 'light',
  created_at    timestamptz NOT NULL DEFAULT now(),
  updated_at    timestamptz NOT NULL DEFAULT now()
);

-- =============================================================================
-- 3. USER ROLES (pivot)
-- =============================================================================
CREATE TABLE public.user_roles (
  user_id uuid NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  role_id uuid NOT NULL REFERENCES public.roles(id) ON DELETE CASCADE,
  PRIMARY KEY (user_id, role_id)
);

-- =============================================================================
-- 4. SETTINGS
-- =============================================================================
CREATE TABLE public.settings (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  key        text NOT NULL UNIQUE,
  value      jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- =============================================================================
-- 5. CATEGORIES
-- =============================================================================
CREATE TABLE public.categories (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name       text NOT NULL,
  sort_order integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- =============================================================================
-- 6. PRODUCTS
-- =============================================================================
CREATE TABLE public.products (
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  category_id      uuid NOT NULL REFERENCES public.categories(id) ON DELETE CASCADE,
  name             text NOT NULL,
  price            numeric(10,2) NOT NULL DEFAULT 0,
  description      text,
  image_url        text,
  is_available     boolean NOT NULL DEFAULT true,
  prep_time_minutes integer NOT NULL DEFAULT 0,
  created_at       timestamptz NOT NULL DEFAULT now(),
  updated_at       timestamptz NOT NULL DEFAULT now()
);

-- =============================================================================
-- 7. TABLES RESTAURANT
-- =============================================================================
CREATE TYPE public.table_status AS ENUM ('available', 'occupied', 'reserved');

CREATE TABLE public.tables_restaurant (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name       text NOT NULL,
  capacity   integer NOT NULL DEFAULT 4,
  status     public.table_status NOT NULL DEFAULT 'available',
  position_x numeric(8,2),
  position_y numeric(8,2),
  created_at timestamptz NOT NULL DEFAULT now()
);

-- =============================================================================
-- 8. SHIFTS
-- =============================================================================
CREATE TYPE public.shift_status AS ENUM ('open', 'closed');

CREATE TABLE public.shifts (
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id        uuid NOT NULL REFERENCES public.users(id) ON DELETE RESTRICT,
  opened_at      timestamptz NOT NULL DEFAULT now(),
  closed_at      timestamptz,
  opening_amount numeric(10,2) NOT NULL DEFAULT 0,
  closing_amount numeric(10,2),
  status         public.shift_status NOT NULL DEFAULT 'open',
  created_at     timestamptz NOT NULL DEFAULT now()
);

-- =============================================================================
-- 9. ORDERS
-- =============================================================================
CREATE TYPE public.order_status AS ENUM (
  'pending', 'confirmed', 'preparing', 'ready', 'served', 'paid', 'cancelled'
);

CREATE TABLE public.orders (
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  table_id       uuid REFERENCES public.tables_restaurant(id) ON DELETE SET NULL,
  user_id        uuid NOT NULL REFERENCES public.users(id) ON DELETE RESTRICT,
  status         public.order_status NOT NULL DEFAULT 'pending',
  total_amount   numeric(10,2) NOT NULL DEFAULT 0,
  tax_amount     numeric(10,2) NOT NULL DEFAULT 0,
  discount_amount numeric(10,2) NOT NULL DEFAULT 0,
  notes          text,
  guests         integer NOT NULL DEFAULT 1,
  created_at     timestamptz NOT NULL DEFAULT now(),
  updated_at     timestamptz NOT NULL DEFAULT now()
);

-- =============================================================================
-- 10. ORDER ITEMS
-- =============================================================================
CREATE TYPE public.order_item_status AS ENUM (
  'pending', 'preparing', 'ready', 'served', 'cancelled'
);

CREATE TABLE public.order_items (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id    uuid NOT NULL REFERENCES public.orders(id) ON DELETE CASCADE,
  product_id  uuid NOT NULL REFERENCES public.products(id) ON DELETE RESTRICT,
  quantity    integer NOT NULL DEFAULT 1,
  unit_price  numeric(10,2) NOT NULL DEFAULT 0,
  subtotal    numeric(10,2) NOT NULL DEFAULT 0,
  status      public.order_item_status NOT NULL DEFAULT 'pending',
  notes       text,
  created_at  timestamptz NOT NULL DEFAULT now(),
  updated_at  timestamptz NOT NULL DEFAULT now()
);

-- =============================================================================
-- 11. PAYMENTS
-- =============================================================================
CREATE TYPE public.payment_method AS ENUM (
  'cash', 'card', 'yape', 'plin', 'transfer', 'qr'
);

CREATE TABLE public.payments (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id      uuid NOT NULL REFERENCES public.orders(id) ON DELETE RESTRICT,
  user_id       uuid NOT NULL REFERENCES public.users(id) ON DELETE RESTRICT,
  method        public.payment_method NOT NULL,
  amount        numeric(10,2) NOT NULL DEFAULT 0,
  change_amount numeric(10,2) NOT NULL DEFAULT 0,
  shift_id      uuid REFERENCES public.shifts(id) ON DELETE SET NULL,
  reference     text,
  created_at    timestamptz NOT NULL DEFAULT now()
);

-- =============================================================================
-- 12. CASH MOVEMENTS
-- =============================================================================
CREATE TYPE public.cash_movement_type AS ENUM (
  'sale', 'refund', 'withdrawal', 'deposit', 'adjustment'
);

CREATE TABLE public.cash_movements (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  shift_id    uuid NOT NULL REFERENCES public.shifts(id) ON DELETE CASCADE,
  type        public.cash_movement_type NOT NULL,
  amount      numeric(10,2) NOT NULL DEFAULT 0,
  description text,
  user_id     uuid NOT NULL REFERENCES public.users(id) ON DELETE RESTRICT,
  created_at  timestamptz NOT NULL DEFAULT now()
);

-- =============================================================================
-- 13. ORDER DISCOUNTS
-- =============================================================================
CREATE TYPE public.discount_type AS ENUM ('percentage', 'fixed');

CREATE TABLE public.order_discounts (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id   uuid NOT NULL REFERENCES public.orders(id) ON DELETE CASCADE,
  user_id    uuid NOT NULL REFERENCES public.users(id) ON DELETE RESTRICT,
  type       public.discount_type NOT NULL,
  value      numeric(10,2) NOT NULL DEFAULT 0,
  amount     numeric(10,2) NOT NULL DEFAULT 0,
  reason     text,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- =============================================================================
-- 14. REFUNDS
-- =============================================================================
CREATE TYPE public.refund_status AS ENUM ('pending', 'approved', 'rejected');

CREATE TABLE public.refunds (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id   uuid NOT NULL REFERENCES public.orders(id) ON DELETE RESTRICT,
  payment_id uuid NOT NULL REFERENCES public.payments(id) ON DELETE RESTRICT,
  user_id    uuid NOT NULL REFERENCES public.users(id) ON DELETE RESTRICT,
  amount     numeric(10,2) NOT NULL DEFAULT 0,
  reason     text NOT NULL,
  status     public.refund_status NOT NULL DEFAULT 'pending',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- =============================================================================
-- 15. KITCHEN STATIONS
-- =============================================================================
CREATE TABLE public.kitchen_stations (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name       text NOT NULL,
  is_active  boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- =============================================================================
-- 16. INVENTORY CATEGORIES
-- =============================================================================
CREATE TABLE public.inventory_categories (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name       text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- =============================================================================
-- 17. SUPPLIERS
-- =============================================================================
CREATE TABLE public.suppliers (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name       text NOT NULL,
  phone      text,
  email      text,
  address    text,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- =============================================================================
-- 18. INVENTORY ITEMS
-- =============================================================================
CREATE TABLE public.inventory_items (
  id                    uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  inventory_category_id uuid NOT NULL REFERENCES public.inventory_categories(id) ON DELETE CASCADE,
  name                  text NOT NULL,
  unit                  text NOT NULL DEFAULT 'unit',
  current_stock         numeric(12,3) NOT NULL DEFAULT 0,
  minimum_stock         numeric(12,3) NOT NULL DEFAULT 0,
  cost_per_unit         numeric(10,4) NOT NULL DEFAULT 0,
  supplier_id           uuid REFERENCES public.suppliers(id) ON DELETE SET NULL,
  created_at            timestamptz NOT NULL DEFAULT now(),
  updated_at            timestamptz NOT NULL DEFAULT now()
);

-- =============================================================================
-- 19. PURCHASE ORDERS
-- =============================================================================
CREATE TYPE public.purchase_order_status AS ENUM ('draft', 'ordered', 'received', 'cancelled');

CREATE TABLE public.purchase_orders (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  supplier_id   uuid NOT NULL REFERENCES public.suppliers(id) ON DELETE RESTRICT,
  user_id       uuid NOT NULL REFERENCES public.users(id) ON DELETE RESTRICT,
  status        public.purchase_order_status NOT NULL DEFAULT 'draft',
  total_amount  numeric(10,2) NOT NULL DEFAULT 0,
  notes         text,
  created_at    timestamptz NOT NULL DEFAULT now(),
  updated_at    timestamptz NOT NULL DEFAULT now()
);

-- =============================================================================
-- 20. PURCHASE ORDER ITEMS
-- =============================================================================
CREATE TABLE public.purchase_order_items (
  id                 uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  purchase_order_id  uuid NOT NULL REFERENCES public.purchase_orders(id) ON DELETE CASCADE,
  inventory_item_id  uuid NOT NULL REFERENCES public.inventory_items(id) ON DELETE RESTRICT,
  quantity           numeric(12,3) NOT NULL DEFAULT 0,
  unit_cost          numeric(10,4) NOT NULL DEFAULT 0,
  total_cost         numeric(10,2) NOT NULL DEFAULT 0,
  created_at         timestamptz NOT NULL DEFAULT now()
);

-- =============================================================================
-- 21. STOCK MOVEMENTS
-- =============================================================================
CREATE TYPE public.stock_movement_type AS ENUM ('in', 'out', 'adjustment');

CREATE TABLE public.stock_movements (
  id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  inventory_item_id uuid NOT NULL REFERENCES public.inventory_items(id) ON DELETE RESTRICT,
  type              public.stock_movement_type NOT NULL,
  quantity          numeric(12,3) NOT NULL DEFAULT 0,
  unit_cost         numeric(10,4) NOT NULL DEFAULT 0,
  description       text,
  user_id           uuid NOT NULL REFERENCES public.users(id) ON DELETE RESTRICT,
  reference_type    text,
  reference_id      uuid,
  created_at        timestamptz NOT NULL DEFAULT now()
);

-- =============================================================================
-- 22. AUDIT LOGS
-- =============================================================================
CREATE TABLE public.audit_logs (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id         uuid REFERENCES public.users(id) ON DELETE SET NULL,
  action          text NOT NULL,
  auditable_type  text NOT NULL,
  auditable_id    uuid,
  old_values      jsonb,
  new_values      jsonb,
  ip              text,
  user_agent      text,
  created_at      timestamptz NOT NULL DEFAULT now()
);

-- =============================================================================
-- INDEXES
-- =============================================================================

-- users
CREATE INDEX idx_users_email ON public.users(email);
CREATE INDEX idx_users_is_blocked ON public.users(is_blocked);

-- user_roles
CREATE INDEX idx_user_roles_role_id ON public.user_roles(role_id);

-- categories
CREATE INDEX idx_categories_sort_order ON public.categories(sort_order);

-- products
CREATE INDEX idx_products_category_id ON public.products(category_id);
CREATE INDEX idx_products_is_available ON public.products(is_available);

-- tables_restaurant
CREATE INDEX idx_tables_restaurant_status ON public.tables_restaurant(status);

-- shifts
CREATE INDEX idx_shifts_user_id ON public.shifts(user_id);
CREATE INDEX idx_shifts_status ON public.shifts(status);

-- orders
CREATE INDEX idx_orders_table_id ON public.orders(table_id);
CREATE INDEX idx_orders_user_id ON public.orders(user_id);
CREATE INDEX idx_orders_status ON public.orders(status);
CREATE INDEX idx_orders_created_at ON public.orders(created_at DESC);

-- order_items
CREATE INDEX idx_order_items_order_id ON public.order_items(order_id);
CREATE INDEX idx_order_items_product_id ON public.order_items(product_id);
CREATE INDEX idx_order_items_status ON public.order_items(status);

-- payments
CREATE INDEX idx_payments_order_id ON public.payments(order_id);
CREATE INDEX idx_payments_user_id ON public.payments(user_id);
CREATE INDEX idx_payments_shift_id ON public.payments(shift_id);
CREATE INDEX idx_payments_method ON public.payments(method);
CREATE INDEX idx_payments_created_at ON public.payments(created_at DESC);

-- cash_movements
CREATE INDEX idx_cash_movements_shift_id ON public.cash_movements(shift_id);
CREATE INDEX idx_cash_movements_user_id ON public.cash_movements(user_id);
CREATE INDEX idx_cash_movements_type ON public.cash_movements(type);

-- order_discounts
CREATE INDEX idx_order_discounts_order_id ON public.order_discounts(order_id);

-- refunds
CREATE INDEX idx_refunds_order_id ON public.refunds(order_id);
CREATE INDEX idx_refunds_payment_id ON public.refunds(payment_id);
CREATE INDEX idx_refunds_status ON public.refunds(status);

-- inventory_items
CREATE INDEX idx_inventory_items_category_id ON public.inventory_items(inventory_category_id);
CREATE INDEX idx_inventory_items_supplier_id ON public.inventory_items(supplier_id);
CREATE INDEX idx_inventory_items_low_stock ON public.inventory_items(current_stock, minimum_stock)
  WHERE current_stock <= minimum_stock;

-- purchase_orders
CREATE INDEX idx_purchase_orders_supplier_id ON public.purchase_orders(supplier_id);
CREATE INDEX idx_purchase_orders_user_id ON public.purchase_orders(user_id);
CREATE INDEX idx_purchase_orders_status ON public.purchase_orders(status);

-- purchase_order_items
CREATE INDEX idx_purchase_order_items_order_id ON public.purchase_order_items(purchase_order_id);
CREATE INDEX idx_purchase_order_items_item_id ON public.purchase_order_items(inventory_item_id);

-- stock_movements
CREATE INDEX idx_stock_movements_item_id ON public.stock_movements(inventory_item_id);
CREATE INDEX idx_stock_movements_user_id ON public.stock_movements(user_id);
CREATE INDEX idx_stock_movements_type ON public.stock_movements(type);
CREATE INDEX idx_stock_movements_created_at ON public.stock_movements(created_at DESC);

-- audit_logs
CREATE INDEX idx_audit_logs_user_id ON public.audit_logs(user_id);
CREATE INDEX idx_audit_logs_auditable ON public.audit_logs(auditable_type, auditable_id);
CREATE INDEX idx_audit_logs_action ON public.audit_logs(action);
CREATE INDEX idx_audit_logs_created_at ON public.audit_logs(created_at DESC);

-- =============================================================================
-- HELPER FUNCTIONS
-- =============================================================================

-- Check if current user has a specific role
CREATE OR REPLACE FUNCTION public.has_role(role_name text)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.user_roles ur
    JOIN public.roles r ON r.id = ur.role_id
    WHERE ur.user_id = auth.uid()
      AND r.name = role_name
  );
$$;

-- Get all roles for the current user
CREATE OR REPLACE FUNCTION public.get_user_roles()
RETURNS SETOF text
LANGUAGE sql
STABLE
SECURITY DEFINER
AS $$
  SELECT r.name
  FROM public.user_roles ur
  JOIN public.roles r ON r.id = ur.role_id
  WHERE ur.user_id = auth.uid();
$$;

-- Auto-update updated_at column
CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

-- =============================================================================
-- TRIGGERS: auto-update updated_at
-- =============================================================================

CREATE TRIGGER trg_users_updated_at
  BEFORE UPDATE ON public.users
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TRIGGER trg_settings_updated_at
  BEFORE UPDATE ON public.settings
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TRIGGER trg_products_updated_at
  BEFORE UPDATE ON public.products
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TRIGGER trg_orders_updated_at
  BEFORE UPDATE ON public.orders
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TRIGGER trg_order_items_updated_at
  BEFORE UPDATE ON public.order_items
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TRIGGER trg_refunds_updated_at
  BEFORE UPDATE ON public.refunds
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TRIGGER trg_inventory_items_updated_at
  BEFORE UPDATE ON public.inventory_items
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TRIGGER trg_purchase_orders_updated_at
  BEFORE UPDATE ON public.purchase_orders
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- =============================================================================
-- TRIGGER: auto-create user profile on signup
-- =============================================================================

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  INSERT INTO public.users (id, email, name, password_hash)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'name', split_part(NEW.email, '@', 1)),
    NULL
  );
  RETURN NEW;
END;
$$;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- =============================================================================
-- ROW LEVEL SECURITY
-- =============================================================================

ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.roles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.products ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tables_restaurant ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.order_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.payments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.shifts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.cash_movements ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.order_discounts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.refunds ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.kitchen_stations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.inventory_categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.inventory_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.suppliers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.purchase_orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.purchase_order_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.stock_movements ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.audit_logs ENABLE ROW LEVEL SECURITY;

-- =============================================================================
-- RLS POLICIES
-- =============================================================================

-- Helper: authenticated + not blocked
-- Admin check is done per-table via has_role('admin')

-- ROLES: everyone authenticated can read; admin manages
CREATE POLICY "roles_select" ON public.roles
  FOR SELECT TO authenticated USING (true);

CREATE POLICY "roles_insert" ON public.roles
  FOR INSERT TO authenticated WITH CHECK (public.has_role('admin'));

CREATE POLICY "roles_update" ON public.roles
  FOR UPDATE TO authenticated USING (public.has_role('admin'));

CREATE POLICY "roles_delete" ON public.roles
  FOR DELETE TO authenticated USING (public.has_role('admin'));

-- USER ROLES: admin full access; users can read own
CREATE POLICY "user_roles_select_own" ON public.user_roles
  FOR SELECT TO authenticated
  USING (user_id = auth.uid() OR public.has_role('admin'));

CREATE POLICY "user_roles_insert" ON public.user_roles
  FOR INSERT TO authenticated WITH CHECK (public.has_role('admin'));

CREATE POLICY "user_roles_update" ON public.user_roles
  FOR UPDATE TO authenticated USING (public.has_role('admin'));

CREATE POLICY "user_roles_delete" ON public.user_roles
  FOR DELETE TO authenticated USING (public.has_role('admin'));

-- USERS: read own profile; admin reads all
CREATE POLICY "users_select" ON public.users
  FOR SELECT TO authenticated
  USING (id = auth.uid() OR public.has_role('admin'));

CREATE POLICY "users_update_own" ON public.users
  FOR UPDATE TO authenticated
  USING (id = auth.uid() OR public.has_role('admin'));

CREATE POLICY "users_insert_own" ON public.users
  FOR INSERT TO authenticated
  WITH CHECK (id = auth.uid());

-- SETTINGS: all authenticated read; admin write
CREATE POLICY "settings_select" ON public.settings
  FOR SELECT TO authenticated USING (true);

CREATE POLICY "settings_insert" ON public.settings
  FOR INSERT TO authenticated WITH CHECK (public.has_role('admin'));

CREATE POLICY "settings_update" ON public.settings
  FOR UPDATE TO authenticated USING (public.has_role('admin'));

CREATE POLICY "settings_delete" ON public.settings
  FOR DELETE TO authenticated USING (public.has_role('admin'));

-- CATEGORIES: all authenticated read; admin/cashier manage
CREATE POLICY "categories_select" ON public.categories
  FOR SELECT TO authenticated USING (true);

CREATE POLICY "categories_insert" ON public.categories
  FOR INSERT TO authenticated
  WITH CHECK (public.has_role('admin') OR public.has_role('cashier'));

CREATE POLICY "categories_update" ON public.categories
  FOR UPDATE TO authenticated
  USING (public.has_role('admin') OR public.has_role('cashier'));

CREATE POLICY "categories_delete" ON public.categories
  FOR DELETE TO authenticated
  USING (public.has_role('admin'));

-- PRODUCTS: all authenticated read; admin/cashier manage
CREATE POLICY "products_select" ON public.products
  FOR SELECT TO authenticated USING (true);

CREATE POLICY "products_insert" ON public.products
  FOR INSERT TO authenticated
  WITH CHECK (public.has_role('admin') OR public.has_role('cashier'));

CREATE POLICY "products_update" ON public.products
  FOR UPDATE TO authenticated
  USING (public.has_role('admin') OR public.has_role('cashier'));

CREATE POLICY "products_delete" ON public.products
  FOR DELETE TO authenticated
  USING (public.has_role('admin'));

-- TABLES RESTAURANT: all authenticated read; admin manage
CREATE POLICY "tables_select" ON public.tables_restaurant
  FOR SELECT TO authenticated USING (true);

CREATE POLICY "tables_insert" ON public.tables_restaurant
  FOR INSERT TO authenticated WITH CHECK (public.has_role('admin'));

CREATE POLICY "tables_update" ON public.tables_restaurant
  FOR UPDATE TO authenticated
  USING (public.has_role('admin') OR public.has_role('waiter'));

CREATE POLICY "tables_delete" ON public.tables_restaurant
  FOR DELETE TO authenticated USING (public.has_role('admin'));

-- ORDERS: all authenticated read; waiter/cashier/admin create
CREATE POLICY "orders_select" ON public.orders
  FOR SELECT TO authenticated USING (true);

CREATE POLICY "orders_insert" ON public.orders
  FOR INSERT TO authenticated
  WITH CHECK (
    public.has_role('admin') OR
    public.has_role('waiter') OR
    public.has_role('cashier')
  );

CREATE POLICY "orders_update" ON public.orders
  FOR UPDATE TO authenticated
  USING (true);

-- ORDER ITEMS: all authenticated read; waiter/kitchen/cashier/admin manage
CREATE POLICY "order_items_select" ON public.order_items
  FOR SELECT TO authenticated USING (true);

CREATE POLICY "order_items_insert" ON public.order_items
  FOR INSERT TO authenticated
  WITH CHECK (
    public.has_role('admin') OR
    public.has_role('waiter') OR
    public.has_role('cashier')
  );

CREATE POLICY "order_items_update" ON public.order_items
  FOR UPDATE TO authenticated USING (true);

CREATE POLICY "order_items_delete" ON public.order_items
  FOR DELETE TO authenticated
  USING (public.has_role('admin'));

-- PAYMENTS: all authenticated read; cashier/admin create
CREATE POLICY "payments_select" ON public.payments
  FOR SELECT TO authenticated
  USING (user_id = auth.uid() OR public.has_role('admin'));

CREATE POLICY "payments_insert" ON public.payments
  FOR INSERT TO authenticated
  WITH CHECK (
    public.has_role('admin') OR public.has_role('cashier')
  );

-- SHIFTS: own shifts read; admin reads all; admin/cashier manage
CREATE POLICY "shifts_select" ON public.shifts
  FOR SELECT TO authenticated
  USING (user_id = auth.uid() OR public.has_role('admin'));

CREATE POLICY "shifts_insert" ON public.shifts
  FOR INSERT TO authenticated
  WITH CHECK (
    public.has_role('admin') OR public.has_role('cashier')
  );

CREATE POLICY "shifts_update" ON public.shifts
  FOR UPDATE TO authenticated
  USING (
    user_id = auth.uid() OR public.has_role('admin')
  );

-- CASH MOVEMENTS: own shift movements + admin all
CREATE POLICY "cash_movements_select" ON public.cash_movements
  FOR SELECT TO authenticated
  USING (
    user_id = auth.uid() OR public.has_role('admin')
  );

CREATE POLICY "cash_movements_insert" ON public.cash_movements
  FOR INSERT TO authenticated
  WITH CHECK (
    public.has_role('admin') OR public.has_role('cashier')
  );

-- ORDER DISCOUNTS: all authenticated read; admin/cashier create
CREATE POLICY "order_discounts_select" ON public.order_discounts
  FOR SELECT TO authenticated USING (true);

CREATE POLICY "order_discounts_insert" ON public.order_discounts
  FOR INSERT TO authenticated
  WITH CHECK (
    public.has_role('admin') OR public.has_role('cashier')
  );

CREATE POLICY "order_discounts_delete" ON public.order_discounts
  FOR DELETE TO authenticated USING (public.has_role('admin'));

-- REFUNDS: all authenticated read; admin manages approval
CREATE POLICY "refunds_select" ON public.refunds
  FOR SELECT TO authenticated USING (true);

CREATE POLICY "refunds_insert" ON public.refunds
  FOR INSERT TO authenticated
  WITH CHECK (
    public.has_role('admin') OR public.has_role('cashier')
  );

CREATE POLICY "refunds_update" ON public.refunds
  FOR UPDATE TO authenticated USING (public.has_role('admin'));

-- KITCHEN STATIONS: all authenticated read; admin manage
CREATE POLICY "kitchen_stations_select" ON public.kitchen_stations
  FOR SELECT TO authenticated USING (true);

CREATE POLICY "kitchen_stations_insert" ON public.kitchen_stations
  FOR INSERT TO authenticated WITH CHECK (public.has_role('admin'));

CREATE POLICY "kitchen_stations_update" ON public.kitchen_stations
  FOR UPDATE TO authenticated USING (public.has_role('admin'));

CREATE POLICY "kitchen_stations_delete" ON public.kitchen_stations
  FOR DELETE TO authenticated USING (public.has_role('admin'));

-- INVENTORY CATEGORIES: all authenticated read; admin manage
CREATE POLICY "inventory_categories_select" ON public.inventory_categories
  FOR SELECT TO authenticated USING (true);

CREATE POLICY "inventory_categories_insert" ON public.inventory_categories
  FOR INSERT TO authenticated WITH CHECK (public.has_role('admin'));

CREATE POLICY "inventory_categories_update" ON public.inventory_categories
  FOR UPDATE TO authenticated USING (public.has_role('admin'));

CREATE POLICY "inventory_categories_delete" ON public.inventory_categories
  FOR DELETE TO authenticated USING (public.has_role('admin'));

-- SUPPLIERS: all authenticated read; admin manage
CREATE POLICY "suppliers_select" ON public.suppliers
  FOR SELECT TO authenticated USING (true);

CREATE POLICY "suppliers_insert" ON public.suppliers
  FOR INSERT TO authenticated WITH CHECK (public.has_role('admin'));

CREATE POLICY "suppliers_update" ON public.suppliers
  FOR UPDATE TO authenticated USING (public.has_role('admin'));

CREATE POLICY "suppliers_delete" ON public.suppliers
  FOR DELETE TO authenticated USING (public.has_role('admin'));

-- INVENTORY ITEMS: all authenticated read; admin manage
CREATE POLICY "inventory_items_select" ON public.inventory_items
  FOR SELECT TO authenticated USING (true);

CREATE POLICY "inventory_items_insert" ON public.inventory_items
  FOR INSERT TO authenticated WITH CHECK (public.has_role('admin'));

CREATE POLICY "inventory_items_update" ON public.inventory_items
  FOR UPDATE TO authenticated USING (public.has_role('admin'));

CREATE POLICY "inventory_items_delete" ON public.inventory_items
  FOR DELETE TO authenticated USING (public.has_role('admin'));

-- PURCHASE ORDERS: admin only manage
CREATE POLICY "purchase_orders_select" ON public.purchase_orders
  FOR SELECT TO authenticated USING (true);

CREATE POLICY "purchase_orders_insert" ON public.purchase_orders
  FOR INSERT TO authenticated WITH CHECK (public.has_role('admin'));

CREATE POLICY "purchase_orders_update" ON public.purchase_orders
  FOR UPDATE TO authenticated USING (public.has_role('admin'));

CREATE POLICY "purchase_orders_delete" ON public.purchase_orders
  FOR DELETE TO authenticated USING (public.has_role('admin'));

-- PURCHASE ORDER ITEMS: admin only manage
CREATE POLICY "purchase_order_items_select" ON public.purchase_order_items
  FOR SELECT TO authenticated USING (true);

CREATE POLICY "purchase_order_items_insert" ON public.purchase_order_items
  FOR INSERT TO authenticated WITH CHECK (public.has_role('admin'));

CREATE POLICY "purchase_order_items_update" ON public.purchase_order_items
  FOR UPDATE TO authenticated USING (public.has_role('admin'));

CREATE POLICY "purchase_order_items_delete" ON public.purchase_order_items
  FOR DELETE TO authenticated USING (public.has_role('admin'));

-- STOCK MOVEMENTS: admin read/write
CREATE POLICY "stock_movements_select" ON public.stock_movements
  FOR SELECT TO authenticated USING (true);

CREATE POLICY "stock_movements_insert" ON public.stock_movements
  FOR INSERT TO authenticated WITH CHECK (public.has_role('admin'));

-- AUDIT LOGS: admin only
CREATE POLICY "audit_logs_select" ON public.audit_logs
  FOR SELECT TO authenticated USING (public.has_role('admin'));

CREATE POLICY "audit_logs_insert" ON public.audit_logs
  FOR INSERT TO authenticated WITH CHECK (true);

-- =============================================================================
-- SEED DATA: default roles
-- =============================================================================

INSERT INTO public.roles (name, display_name) VALUES
  ('admin',   'Administrador'),
  ('waiter',  'Mesero'),
  ('kitchen', 'Cocina'),
  ('cashier', 'Cajero'),
  ('staff',   'Personal');

-- =============================================================================
-- ENABLE REALTIME
-- =============================================================================

ALTER PUBLICATION supabase_realtime ADD TABLE orders;
ALTER PUBLICATION supabase_realtime ADD TABLE shifts;
ALTER PUBLICATION supabase_realtime ADD TABLE audit_logs;

-- =============================================================================
-- END OF MIGRATION
-- =============================================================================
