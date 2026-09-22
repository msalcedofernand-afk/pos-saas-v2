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
const platformOrganizationRouteUrl = new URL("../src/app/api/v1/platform/organizations/route.ts", import.meta.url);
const platformOrganizationDetailRouteUrl = new URL(
  "../src/app/api/v1/platform/organizations/[id]/route.ts",
  import.meta.url,
);
const platformOrganizationSuspendRouteUrl = new URL(
  "../src/app/api/v1/platform/organizations/[id]/suspend/route.ts",
  import.meta.url,
);
const platformOrganizationReactivateRouteUrl = new URL(
  "../src/app/api/v1/platform/organizations/[id]/reactivate/route.ts",
  import.meta.url,
);
const organizationLifecycleMigrationUrl = new URL(
  "../../pos-saas-infra/supabase/migrations/20260922034230_phase1_organization_lifecycle.sql",
  import.meta.url,
);
const organizationActionsMigrationUrl = new URL(
  "../../pos-saas-infra/supabase/migrations/20260922034517_phase1_organization_actions.sql",
  import.meta.url,
);
const platformContextMigrationUrl = new URL(
  "../../pos-saas-infra/supabase/migrations/20260922032040_phase0_explicit_platform_context.sql",
  import.meta.url,
);
const apiAuthUrl = new URL("../src/lib/auth/api.ts", import.meta.url);
const phase2MigrationUrl = new URL(
  "../../pos-saas-infra/supabase/migrations/20260922041825_phase2_user_membership_administration.sql",
  import.meta.url,
);
const phase2IndexesMigrationUrl = new URL(
  "../../pos-saas-infra/supabase/migrations/20260922042409_phase2_user_membership_indexes.sql",
  import.meta.url,
);
const platformUsersRouteUrl = new URL("../src/app/api/v1/platform/users/route.ts", import.meta.url);
const platformUserActionsUrl = new URL("../src/lib/platform/user-actions.ts", import.meta.url);
const phase4SupportMigrationUrl = new URL(
  "../../pos-saas-infra/supabase/migrations/20260922050934_phase4_secure_support_access.sql",
  import.meta.url,
);
const supportAccessRouteUrl = new URL("../src/app/api/v1/platform/support/access/route.ts", import.meta.url);
const supportWriteRouteUrl = new URL("../src/app/api/v1/platform/support/access/[id]/write/route.ts", import.meta.url);
const supportRevokeRouteUrl = new URL(
  "../src/app/api/v1/platform/support/access/[id]/revoke/route.ts",
  import.meta.url,
);
const phase3AuditMigrationUrl = new URL(
  "../../pos-saas-infra/supabase/migrations/20260922044135_phase3_platform_audit_governance.sql",
  import.meta.url,
);
const platformAuditRouteUrl = new URL("../src/app/api/v1/platform/audit/route.ts", import.meta.url);
const platformAuditDetailRouteUrl = new URL("../src/app/api/v1/platform/audit/[id]/route.ts", import.meta.url);
const phase5MetricsMigrationUrl = new URL(
  "../../pos-saas-infra/supabase/migrations/20260922055517_phase5_saas_metrics_operations.sql",
  import.meta.url,
);
const platformMetricsRouteUrl = new URL("../src/app/api/v1/platform/metrics/route.ts", import.meta.url);

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

test("la administración global de organizaciones es reversible y auditable", async () => {
  const [listRoute, detailRoute, suspendRoute, reactivateRoute, lifecycleMigration, actionsMigration] =
    await Promise.all([
      readFile(platformOrganizationRouteUrl, "utf8"),
      readFile(platformOrganizationDetailRouteUrl, "utf8"),
      readFile(platformOrganizationSuspendRouteUrl, "utf8"),
      readFile(platformOrganizationReactivateRouteUrl, "utf8"),
      readFile(organizationLifecycleMigrationUrl, "utf8"),
      readFile(organizationActionsMigrationUrl, "utf8"),
    ]);

  assert.match(listRoute, /platform_admin/);
  assert.match(listRoute, /status/);
  assert.match(detailRoute, /metrics/);
  assert.match(detailRoute, /platform_admin/);
  assert.match(suspendRoute, /runPlatformOrganizationAction/);
  assert.match(reactivateRoute, /runPlatformOrganizationAction/);
  assert.match(lifecycleMigration, /organizations_status_active_consistency_check/);
  assert.match(lifecycleMigration, /platform_organization_action_requests/);
  assert.match(actionsMigration, /organization_suspended/);
  assert.match(actionsMigration, /organization_reactivated/);
  assert.match(actionsMigration, /REVOKE ALL ON FUNCTION public\.apply_platform_organization_action/);
});

test("la Fase 2 centraliza usuarios y membresías en acciones globales seguras", async () => {
  const [migration, indexesMigration, usersRoute, actions] = await Promise.all([
    readFile(phase2MigrationUrl, "utf8"),
    readFile(phase2IndexesMigrationUrl, "utf8"),
    readFile(platformUsersRouteUrl, "utf8"),
    readFile(platformUserActionsUrl, "utf8"),
  ]);

  assert.match(migration, /platform_user_action_requests/);
  assert.match(migration, /platform_membership_action_requests/);
  assert.match(migration, /apply_platform_user_action/);
  assert.match(migration, /apply_platform_membership_action/);
  assert.match(migration, /La organización debe conservar al menos un administrador/);
  assert.match(migration, /r\.name = 'platform_admin'/);
  assert.match(migration, /REVOKE ALL ON FUNCTION public\.apply_platform_user_action/);
  assert.match(migration, /REVOKE ALL ON FUNCTION public\.apply_platform_membership_action/);
  assert.match(indexesMigration, /platform_user_action_requests_actor_idx/);
  assert.match(indexesMigration, /platform_membership_action_requests_actor_idx/);
  assert.match(usersRoute, /platform_admin/);
  assert.match(usersRoute, /is_blocked/);
  assert.match(actions, /inviteUserByEmail|updateUserById/);
  assert.match(actions, /Idempotency-Key|idempotency/);
});

test("la Fase 3 expone auditoría global paginada y protegida", async () => {
  const [migration, auditRoute, detailRoute] = await Promise.all([
    readFile(phase3AuditMigrationUrl, "utf8"),
    readFile(platformAuditRouteUrl, "utf8"),
    readFile(platformAuditDetailRouteUrl, "utf8"),
  ]);

  assert.match(migration, /list_platform_audit_logs/);
  assert.match(migration, /SECURITY INVOKER/);
  assert.match(migration, /REVOKE ALL ON FUNCTION public\.list_platform_audit_logs/);
  assert.match(migration, /GRANT EXECUTE ON FUNCTION public\.list_platform_audit_logs.*service_role/);
  assert.match(migration, /p_organization_id/);
  assert.match(migration, /p_page_size/);
  assert.match(auditRoute, /authenticateApiRequest\(request, \["platform_admin"\]\)/);
  assert.match(auditRoute, /actorUserId/);
  assert.match(auditRoute, /organizationId/);
  assert.match(auditRoute, /from/);
  assert.match(auditRoute, /to/);
  assert.match(auditRoute, /pageSize/);
  assert.match(detailRoute, /platform_admin/);
  assert.match(detailRoute, /old_values/);
  assert.match(detailRoute, /new_values/);
});

test("la Fase 4 limita el soporte a concesiones temporales auditables", async () => {
  const [migration, auth, accessRoute, writeRoute, revokeRoute] = await Promise.all([
    readFile(phase4SupportMigrationUrl, "utf8"),
    readFile(apiAuthUrl, "utf8"),
    readFile(supportAccessRouteUrl, "utf8"),
    readFile(supportWriteRouteUrl, "utf8"),
    readFile(supportRevokeRouteUrl, "utf8"),
  ]);

  assert.match(migration, /platform_support_access_requests/);
  assert.match(migration, /duration_minutes integer NOT NULL CHECK/);
  assert.match(migration, /mode text NOT NULL DEFAULT 'read_only'/);
  assert.match(migration, /expires_at timestamptz NOT NULL/);
  assert.match(migration, /support_access_expired/);
  assert.match(migration, /support_access_entered/);
  assert.match(migration, /support_access_write_enabled/);
  assert.match(migration, /support_access_revoked/);
  assert.match(migration, /CONFIRMAR_ACCESO_ESCRITURA/);
  assert.match(migration, /REVOKE ALL ON TABLE public\.platform_support_access_requests FROM anon, authenticated/);
  assert.match(auth, /x-support-access-id/);
  assert.match(auth, /El acceso temporal es de solo lectura/);
  assert.match(accessRoute, /reason/);
  assert.match(accessRoute, /durationMinutes/);
  assert.match(writeRoute, /CONFIRMAR_ACCESO_ESCRITURA/);
  assert.match(revokeRoute, /revocar/);
});

test("la Fase 5 expone métricas SaaS y errores operativos aislados", async () => {
  const [migration, metricsRoute, errorRecorder, monitoring] = await Promise.all([
    readFile(phase5MetricsMigrationUrl, "utf8"),
    readFile(platformMetricsRouteUrl, "utf8"),
    readFile(new URL("../src/lib/platform/operational-metrics.ts", import.meta.url), "utf8"),
    readFile(new URL("../../.github/workflows/saas-monitoring.yml", import.meta.url), "utf8"),
  ]);

  assert.match(migration, /platform_operation_errors/);
  assert.match(migration, /get_platform_operational_metrics/);
  assert.match(migration, /organizationMetrics/);
  assert.match(migration, /pendingInvitations/);
  assert.match(migration, /recentErrors/);
  assert.match(migration, /REVOKE ALL ON FUNCTION public\.get_platform_operational_metrics/);
  assert.match(metricsRoute, /authenticateApiRequest\(request, \["platform_admin"\]\)/);
  assert.match(metricsRoute, /organizationId/);
  assert.match(metricsRoute, /days/);
  assert.match(errorRecorder, /platform_operation_errors/);
  assert.match(monitoring, /health\/ready/);
  assert.match(monitoring, /HEALTH_ALERT_WEBHOOK_URL/);
});

test("la Fase 7 centraliza planes, límites y consumo por organización", async () => {
  const [
    migration,
    backfill,
    platformPlansRoute,
    subscriptionRoute,
    tenantSubscriptionRoute,
    plansPage,
    subscriptionPage,
  ] = await Promise.all([
    readFile(
      new URL("../../pos-saas-infra/supabase/migrations/20260922160023_phase7_plans_limits_usage.sql", import.meta.url),
      "utf8",
    ),
    readFile(
      new URL(
        "../../pos-saas-infra/supabase/migrations/20260922160656_phase7_legacy_plan_backfill.sql",
        import.meta.url,
      ),
      "utf8",
    ),
    readFile(new URL("../src/app/api/v1/platform/plans/route.ts", import.meta.url), "utf8"),
    readFile(new URL("../src/app/api/v1/platform/organizations/[id]/subscription/route.ts", import.meta.url), "utf8"),
    readFile(new URL("../src/app/api/v1/subscription/route.ts", import.meta.url), "utf8"),
    readFile(new URL("../../pos-saas-web/src/app/dashboard/platform/plans/page.tsx", import.meta.url), "utf8"),
    readFile(new URL("../../pos-saas-web/src/app/dashboard/subscription/page.tsx", import.meta.url), "utf8"),
  ]);

  assert.match(migration, /CREATE TABLE public\.plans/);
  assert.match(migration, /CREATE TABLE public\.organization_subscriptions/);
  assert.match(migration, /CREATE TABLE public\.organization_limits/);
  assert.match(migration, /CREATE TABLE public\.usage_counters/);
  assert.match(migration, /get_organization_plan_usage/);
  assert.match(migration, /set_organization_subscription/);
  assert.match(migration, /enforce_organization_plan_limit/);
  assert.match(migration, /organizations_default_plan/);
  assert.match(migration, /REVOKE ALL ON TABLE public\.plans, public\.organization_subscriptions/);
  assert.match(backfill, /starter/);
  assert.match(platformPlansRoute, /authenticateApiRequest\(request, \["platform_admin"\]\)/);
  assert.match(subscriptionRoute, /set_organization_subscription/);
  assert.match(subscriptionRoute, /platform_admin/);
  assert.match(tenantSubscriptionRoute, /requireOrganization: true/);
  assert.match(tenantSubscriptionRoute, /get_organization_plan_usage/);
  assert.match(plansPage, /Planes, límites y uso/);
  assert.match(subscriptionPage, /Plan y límites/);
});
