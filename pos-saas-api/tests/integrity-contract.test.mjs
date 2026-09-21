import { readFile } from "node:fs/promises";
import { test } from "node:test";
import assert from "node:assert/strict";

const migrationUrl = new URL(
  "../../pos-saas-infra/supabase/migrations/20260920100000_order_cash_integrity.sql",
  import.meta.url,
);
const paymentMigrationUrl = new URL(
  "../../pos-saas-infra/supabase/migrations/20260920210208_cash_method_reconciliation.sql",
  import.meta.url,
);
const orderRouteUrl = new URL("../src/app/api/v1/orders/[id]/status/route.ts", import.meta.url);
const kitchenRouteUrl = new URL("../src/app/api/v1/kitchen/orders/[id]/status/route.ts", import.meta.url);

test("la migración conserva las invariantes críticas de pedidos y caja", async () => {
  const migration = await readFile(migrationUrl, "utf8");

  assert.match(migration, /transition_order_status_transaction/);
  assert.match(migration, /transition_kitchen_order_transaction/);
  assert.match(migration, /v_order\.status <> 'pending'/);
  assert.match(migration, /v_table_status <> 'available'/);
  assert.match(migration, /FOR UPDATE/);
  assert.match(migration, /v_expected/);
  assert.match(migration, /v_difference/);
  assert.match(migration, /p_difference_reason/);
  assert.doesNotMatch(migration, /IF EXISTS \(SELECT 1 FROM public\.orders WHERE status = 'served'\)/);
});

test("la conciliación solo convierte efectivo en movimiento de caja", async () => {
  const migration = await readFile(paymentMigrationUrl, "utf8");

  assert.match(migration, /IF p_method = 'cash' THEN/);
  assert.match(migration, /INSERT INTO public\.payments/);
  assert.match(migration, /INSERT INTO public\.cash_movements/);
  assert.match(migration, /END IF;/);
});

test("las rutas de estados no realizan escrituras parciales", async () => {
  const [orderRoute, kitchenRoute] = await Promise.all([
    readFile(orderRouteUrl, "utf8"),
    readFile(kitchenRouteUrl, "utf8"),
  ]);

  assert.match(orderRoute, /rpc\("transition_order_status_transaction"/);
  assert.match(kitchenRoute, /rpc\("transition_kitchen_order_transaction"/);
  assert.doesNotMatch(orderRoute, /\.from\("order_items"\)/);
  assert.doesNotMatch(kitchenRoute, /\.from\("order_items"\)/);
});
