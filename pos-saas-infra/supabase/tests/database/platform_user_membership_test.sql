BEGIN;

SELECT plan(11);

INSERT INTO auth.users (id, email, encrypted_password, aud, role, email_confirmed_at)
VALUES
  ('00000000-0000-0000-0000-000000000601', 'platform-phase2-actor@example.com', '', 'authenticated', 'authenticated', now()),
  ('00000000-0000-0000-0000-000000000603', 'platform-phase2-target@example.com', '', 'authenticated', 'authenticated', now())
ON CONFLICT (id) DO NOTHING;

INSERT INTO public.organizations (id, name, slug, owner_user_id)
VALUES ('00000000-0000-0000-0000-000000000602', 'Phase 2 organization', 'phase-2-organization', '00000000-0000-0000-0000-000000000601')
ON CONFLICT (id) DO NOTHING;

INSERT INTO public.organization_members (organization_id, user_id, role_id, is_default)
SELECT '00000000-0000-0000-0000-000000000602', '00000000-0000-0000-0000-000000000601', id, true
FROM public.roles WHERE name = 'admin'
ON CONFLICT DO NOTHING;

INSERT INTO public.organization_members (organization_id, user_id, role_id, is_default)
SELECT '00000000-0000-0000-0000-000000000602', '00000000-0000-0000-0000-000000000603', id, true
FROM public.roles WHERE name = 'waiter'
ON CONFLICT DO NOTHING;

SELECT is(
  has_function_privilege('anon', 'public.apply_platform_user_action(uuid,uuid,text,text,text)', 'execute'),
  false,
  'anon no puede ejecutar acciones globales de usuarios'
);

SELECT is(
  has_function_privilege('authenticated', 'public.apply_platform_membership_action(uuid,uuid,uuid,text,uuid[],text,text)', 'execute'),
  false,
  'authenticated no puede ejecutar acciones globales de membresías'
);

SET LOCAL ROLE service_role;

SELECT lives_ok($$SELECT public.apply_platform_user_action(
  '00000000-0000-0000-0000-000000000601',
  '00000000-0000-0000-0000-000000000603',
  'block', 'phase2-user-block-test', repeat('a', 64)
)$$, 'service_role puede bloquear un usuario');

SELECT is(
  (SELECT is_blocked FROM public.users WHERE id = '00000000-0000-0000-0000-000000000603'),
  true,
  'bloquear cambia el perfil operativo'
);

SELECT lives_ok($$SELECT public.apply_platform_user_action(
  '00000000-0000-0000-0000-000000000601',
  '00000000-0000-0000-0000-000000000603',
  'block', 'phase2-user-block-test', repeat('a', 64)
)$$, 'bloquear de nuevo es idempotente');

SELECT is(
  (SELECT count(*)::integer FROM public.platform_audit_logs WHERE auditable_id = '00000000-0000-0000-0000-000000000603' AND action = 'user_block'),
  1,
  'la repetición no duplica la auditoría de bloqueo'
);

SELECT lives_ok($$SELECT public.apply_platform_membership_action(
  '00000000-0000-0000-0000-000000000601',
  '00000000-0000-0000-0000-000000000602',
  '00000000-0000-0000-0000-000000000603',
  'set', ARRAY[(SELECT id FROM public.roles WHERE name = 'admin')],
  'phase2-membership-promote-test', repeat('b', 64)
)$$, 'service_role puede cambiar una membresía');

SELECT lives_ok($$SELECT public.apply_platform_membership_action(
  '00000000-0000-0000-0000-000000000601',
  '00000000-0000-0000-0000-000000000602',
  '00000000-0000-0000-0000-000000000601',
  'revoke', ARRAY[]::uuid[],
  'phase2-membership-revoke-actor-test', repeat('c', 64)
)$$, 'se puede revocar al administrador anterior cuando queda otro');

SELECT throws_ok($$SELECT public.apply_platform_membership_action(
  '00000000-0000-0000-0000-000000000601',
  '00000000-0000-0000-0000-000000000602',
  '00000000-0000-0000-0000-000000000603',
  'revoke', ARRAY[]::uuid[],
  'phase2-membership-last-admin-test', repeat('d', 64)
)$$, 'P0001', 'La organización debe conservar al menos un administrador', 'se protege el último administrador');

SELECT is(
  (SELECT count(*)::integer FROM public.organization_members om JOIN public.roles r ON r.id = om.role_id WHERE om.organization_id = '00000000-0000-0000-0000-000000000602' AND r.name = 'admin'),
  1,
  'la organización conserva un administrador después del rechazo'
);

SELECT * FROM finish();
ROLLBACK;
