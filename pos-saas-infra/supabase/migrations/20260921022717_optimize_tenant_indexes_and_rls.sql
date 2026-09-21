-- Cover the composite foreign keys introduced by the tenant foundation.
CREATE INDEX IF NOT EXISTS idx_cash_movements_shift_org
  ON public.cash_movements (shift_id, organization_id);
CREATE INDEX IF NOT EXISTS idx_inventory_items_category_org
  ON public.inventory_items (inventory_category_id, organization_id);
CREATE INDEX IF NOT EXISTS idx_inventory_items_supplier_org
  ON public.inventory_items (supplier_id, organization_id);
CREATE INDEX IF NOT EXISTS idx_order_discounts_order_org
  ON public.order_discounts (order_id, organization_id);
CREATE INDEX IF NOT EXISTS idx_order_items_order_org
  ON public.order_items (order_id, organization_id);
CREATE INDEX IF NOT EXISTS idx_order_items_product_org
  ON public.order_items (product_id, organization_id);
CREATE INDEX IF NOT EXISTS idx_orders_table_org
  ON public.orders (table_id, organization_id);
CREATE INDEX IF NOT EXISTS idx_organization_members_role
  ON public.organization_members (role_id);
CREATE INDEX IF NOT EXISTS idx_payments_order_org
  ON public.payments (order_id, organization_id);
CREATE INDEX IF NOT EXISTS idx_payments_shift_org
  ON public.payments (shift_id, organization_id);
CREATE INDEX IF NOT EXISTS idx_products_category_org
  ON public.products (category_id, organization_id);
CREATE INDEX IF NOT EXISTS idx_purchase_order_items_item_org
  ON public.purchase_order_items (inventory_item_id, organization_id);
CREATE INDEX IF NOT EXISTS idx_purchase_order_items_order_org
  ON public.purchase_order_items (purchase_order_id, organization_id);
CREATE INDEX IF NOT EXISTS idx_purchase_orders_supplier_org
  ON public.purchase_orders (supplier_id, organization_id);
CREATE INDEX IF NOT EXISTS idx_refunds_order_org
  ON public.refunds (order_id, organization_id);
CREATE INDEX IF NOT EXISTS idx_refunds_payment_org
  ON public.refunds (payment_id, organization_id);
CREATE INDEX IF NOT EXISTS idx_stock_movements_item_org
  ON public.stock_movements (inventory_item_id, organization_id);

-- Keep security-state data server-managed. The API already validates the
-- organization and user before using its service-role client.
DO $$
DECLARE
  policy_row record;
BEGIN
  FOR policy_row IN
    SELECT schemaname, tablename, policyname
    FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename IN ('user_security', 'passkeys')
  LOOP
    EXECUTE format(
      'DROP POLICY IF EXISTS %I ON %I.%I',
      policy_row.policyname,
      policy_row.schemaname,
      policy_row.tablename
    );
  END LOOP;
END;
$$;

ALTER TABLE public.user_security ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.passkeys ENABLE ROW LEVEL SECURITY;

REVOKE ALL PRIVILEGES ON TABLE public.user_security
  FROM PUBLIC, anon, authenticated;

CREATE POLICY passkeys_select_own ON public.passkeys
  FOR SELECT TO authenticated
  USING ((SELECT auth.uid()) = user_id);

CREATE POLICY passkeys_insert_own ON public.passkeys
  FOR INSERT TO authenticated
  WITH CHECK ((SELECT auth.uid()) = user_id);

CREATE POLICY passkeys_update_own ON public.passkeys
  FOR UPDATE TO authenticated
  USING ((SELECT auth.uid()) = user_id)
  WITH CHECK ((SELECT auth.uid()) = user_id);

CREATE POLICY passkeys_delete_own ON public.passkeys
  FOR DELETE TO authenticated
  USING ((SELECT auth.uid()) = user_id);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.passkeys TO authenticated;
