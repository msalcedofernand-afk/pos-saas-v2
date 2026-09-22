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
const platformMigrationUrl = new URL(
  "../../pos-saas-infra/supabase/migrations/20260921214645_platform_administration.sql",
  import.meta.url,
);
const platformSecurityMigrationUrl = new URL(
  "../../pos-saas-infra/supabase/migrations/20260921215701_platform_provisioning_security.sql",
  import.meta.url,
);
const platformRouteUrl = new URL("../src/app/api/v1/platform/organizations/route.ts", import.meta.url);
const platformContextRouteUrl = new URL("../src/app/api/v1/platform/context/route.ts", import.meta.url);
const platformContextMigrationUrl = new URL(
  "../../pos-saas-infra/supabase/migrations/20260922032040_phase0_explicit_platform_context.sql",
  import.meta.url,
);
const apiAuthUrl = new URL("../src/lib/auth/api.ts", import.meta.url);

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

test("el alta global permanece separada del admin de una organización", async () => {
  const [platformMigration, platformSecurityMigration, platformRoute] = await Promise.all([
    readFile(platformMigrationUrl, "utf8"),
    readFile(platformSecurityMigrationUrl, "utf8"),
    readFile(platformRouteUrl, "utf8"),
  ]);

  assert.match(platformMigration, /platform_admin/);
  assert.match(platformSecurityMigration, /platform_audit_logs/);
  assert.match(platformSecurityMigration, /platform_provisioning_requests/);
  assert.match(platformSecurityMigration, /REVOKE ALL ON TABLE public\.platform_audit_logs FROM anon, authenticated/);
  assert.match(platformRoute, /authenticateApiRequest\(request, \["platform_admin"\]\)/g);
  assert.match(platformRoute, /inviteUserByEmail/);
  assert.match(platformRoute, /idempotency-key/);
  assert.doesNotMatch(platformRoute, /adminPassword/);
});

test("el administrador global debe seleccionar el contexto operativo", async () => {
  const [migration, auth, contextRoute] = await Promise.all([
    readFile(platformContextMigrationUrl, "utf8"),
    readFile(apiAuthUrl, "utf8"),
    readFile(platformContextRouteUrl, "utf8"),
  ]);

  assert.match(migration, /DROP POLICY IF EXISTS roles_insert/);
  assert.match(migration, /REVOKE EXECUTE ON FUNCTION public\.has_role\(text\) FROM anon, authenticated/);
  assert.match(auth, /organizationId: string \| null/);
  assert.match(auth, /Selecciona una organización desde el panel de plataforma/);
  assert.doesNotMatch(auth, /order\("created_at", \{ ascending: true \}\)\.limit\(1\)/);
  assert.match(contextRoute, /platform_organization_context_selected/);
  assert.match(contextRoute, /authenticateApiRequest\(request, \["platform_admin"\]\)/);
});
