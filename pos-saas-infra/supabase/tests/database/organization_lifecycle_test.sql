BEGIN;

SELECT plan(12);

INSERT INTO auth.users (id, email, encrypted_password, aud, role, email_confirmed_at)
VALUES (
  '00000000-0000-0000-0000-000000000501',
  'organization-lifecycle@example.com',
  '',
  'authenticated',
  'authenticated',
  now()
)
ON CONFLICT (id) DO NOTHING;

INSERT INTO public.organizations (id, name, slug, owner_user_id)
VALUES (
  '00000000-0000-0000-0000-000000000502',
  'Lifecycle test organization',
  'lifecycle-test-organization',
  '00000000-0000-0000-0000-000000000501'
);

SELECT is(
  (SELECT status FROM public.organizations WHERE id = '00000000-0000-0000-0000-000000000502'),
  'active',
  'una organización nueva comienza activa'
);

SELECT is(
  (SELECT is_active FROM public.organizations WHERE id = '00000000-0000-0000-0000-000000000502'),
  true,
  'una organización nueva permite operación'
);

SET LOCAL ROLE authenticated;

SELECT throws_ok(
  $$SELECT public.apply_platform_organization_action(
    '00000000-0000-0000-0000-000000000501',
    '00000000-0000-0000-0000-000000000502',
    'suspend',
    'authenticated-cannot-call',
    repeat('a', 64),
    NULL,
    'no autorizado'
  )$$,
  '42501',
  NULL,
  'los usuarios autenticados no pueden ejecutar acciones globales'
);

SET LOCAL ROLE service_role;

SELECT lives_ok(
  $$SELECT public.apply_platform_organization_action(
    '00000000-0000-0000-0000-000000000501',
    '00000000-0000-0000-0000-000000000502',
    'suspend',
    'suspend-lifecycle-test',
    repeat('b', 64),
    NULL,
    'Prueba de suspensión'
  )$$,
  'service_role puede suspender una organización'
);

SELECT is(
  (SELECT status FROM public.organizations WHERE id = '00000000-0000-0000-0000-000000000502'),
  'suspended',
  'suspender cambia el estado'
);

SELECT is(
  (SELECT is_active FROM public.organizations WHERE id = '00000000-0000-0000-0000-000000000502'),
  false,
  'suspender bloquea la operación'
);

SELECT is(
  (SELECT count(*)::integer FROM public.organizations WHERE id = '00000000-0000-0000-0000-000000000502'),
  1,
  'suspender no elimina la organización'
);

SELECT is(
  (SELECT count(*)::integer FROM public.platform_audit_logs
   WHERE auditable_id = '00000000-0000-0000-0000-000000000502'
     AND action = 'organization_suspended'),
  1,
  'suspender genera una auditoría'
);

SELECT lives_ok(
  $$SELECT public.apply_platform_organization_action(
    '00000000-0000-0000-0000-000000000501',
    '00000000-0000-0000-0000-000000000502',
    'suspend',
    'suspend-lifecycle-test',
    repeat('b', 64),
    NULL,
    'Prueba de suspensión'
  )$$,
  'repetir la misma suspensión es idempotente'
);

SELECT is(
  (SELECT count(*)::integer FROM public.platform_audit_logs
   WHERE auditable_id = '00000000-0000-0000-0000-000000000502'
     AND action = 'organization_suspended'),
  1,
  'repetir la suspensión no duplica la auditoría'
);

SELECT lives_ok(
  $$SELECT public.apply_platform_organization_action(
    '00000000-0000-0000-0000-000000000501',
    '00000000-0000-0000-0000-000000000502',
    'reactivate',
    'reactivate-lifecycle-test',
    repeat('c', 64)
  )$$,
  'service_role puede reactivar una organización'
);

SELECT is(
  (SELECT status FROM public.organizations WHERE id = '00000000-0000-0000-0000-000000000502'),
  'active',
  'reactivar devuelve el estado activo'
);

SELECT * FROM finish();
ROLLBACK;
