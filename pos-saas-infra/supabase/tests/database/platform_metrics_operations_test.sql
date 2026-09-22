BEGIN;

SELECT plan(10);

INSERT INTO auth.users (id, email, encrypted_password, aud, role, email_confirmed_at, invited_at, last_sign_in_at)
VALUES
  ('00000000-0000-0000-0000-000000000901', 'platform-phase5-actor@example.com', '', 'authenticated', 'authenticated', now(), NULL, now())
ON CONFLICT (id) DO NOTHING;

INSERT INTO public.organizations (id, name, slug, status)
VALUES ('00000000-0000-0000-0000-000000000905', 'Phase 5 Metrics', 'phase-5-metrics', 'active')
ON CONFLICT (id) DO NOTHING;

INSERT INTO public.user_roles (user_id, role_id)
SELECT '00000000-0000-0000-0000-000000000901', id
FROM public.roles WHERE name = 'platform_admin'
ON CONFLICT DO NOTHING;

SELECT is(
  (SELECT relrowsecurity FROM pg_class WHERE oid = 'public.platform_operation_errors'::regclass),
  true,
  'los errores operativos tienen RLS habilitado'
);

SELECT is(
  has_function_privilege('anon', 'public.get_platform_operational_metrics(uuid,uuid,timestamptz,timestamptz)', 'execute'),
  false,
  'anon no puede consultar métricas globales'
);

SELECT is(
  has_function_privilege('authenticated', 'public.get_platform_operational_metrics(uuid,uuid,timestamptz,timestamptz)', 'execute'),
  false,
  'authenticated no puede consultar métricas globales'
);

SET LOCAL ROLE service_role;

SELECT is(
  has_table_privilege('anon', 'public.platform_operation_errors', 'select'),
  false,
  'anon no puede leer errores operativos'
);

SELECT is(
  has_table_privilege('service_role', 'public.platform_operation_errors', 'select'),
  true,
  'service_role puede leer errores operativos'
);

SELECT lives_ok($$SELECT public.get_platform_operational_metrics(
  '00000000-0000-0000-0000-000000000901', NULL, now() - interval '30 days', '9999-12-31'::timestamptz
)$$, 'service_role puede consultar métricas globales');

SELECT ok(
  (public.get_platform_operational_metrics(
    '00000000-0000-0000-0000-000000000901', NULL, now() - interval '30 days', '9999-12-31'::timestamptz
  )->'users'->>'active')::integer >= 1,
  'las métricas globales incluyen usuarios activos'
);

SELECT ok(
  public.get_platform_operational_metrics(
    '00000000-0000-0000-0000-000000000901', NULL, now() - interval '30 days', '9999-12-31'::timestamptz
  )->'organizationMetrics' @> '[{"organizationId":"00000000-0000-0000-0000-000000000905"}]'::jsonb,
  'las métricas incluyen el restaurante objetivo'
);

INSERT INTO public.platform_operation_errors (
  occurred_at, source, operation, organization_id, actor_user_id, message, details
)
VALUES (
  now() - interval '1 minute', 'platform', 'phase5_invitation_failure', '00000000-0000-0000-0000-000000000905',
  '00000000-0000-0000-0000-000000000901', 'Fallo de invitación de prueba', '{}'::jsonb
);

SELECT ok(
  public.get_platform_operational_metrics(
    '00000000-0000-0000-0000-000000000901', '00000000-0000-0000-0000-000000000905', now() - interval '30 days', '9999-12-31'::timestamptz
  )->'recentErrors' @> '[{"operation":"phase5_invitation_failure"}]'::jsonb,
  'las métricas muestran errores recientes por restaurante'
);

SELECT ok(
  jsonb_typeof(public.get_platform_operational_metrics(
    '00000000-0000-0000-0000-000000000901', '00000000-0000-0000-0000-000000000905', now() - interval '30 days', '9999-12-31'::timestamptz
  )->'pendingInvitations') = 'number',
  'las métricas exponen invitaciones pendientes como contador'
);

SELECT * FROM finish();
ROLLBACK;
