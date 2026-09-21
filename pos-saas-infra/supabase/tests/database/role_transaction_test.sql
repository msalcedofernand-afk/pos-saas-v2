BEGIN;

SELECT plan(5);

INSERT INTO auth.users (id, email, encrypted_password, aud, role, email_confirmed_at)
VALUES
  ('00000000-0000-0000-0000-000000000401', 'role-admin@example.com', '', 'authenticated', 'authenticated', now()),
  ('00000000-0000-0000-0000-000000000402', 'role-target@example.com', '', 'authenticated', 'authenticated', now());

INSERT INTO public.organization_members (organization_id, user_id, role_id, is_default)
SELECT '00000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000401', id, true
FROM public.roles WHERE name = 'admin';
INSERT INTO public.organization_members (organization_id, user_id, role_id, is_default)
SELECT '00000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000402', id, true
FROM public.roles WHERE name = 'waiter';

SELECT lives_ok(
  $$SELECT public.update_organization_member_roles_transaction(
    '00000000-0000-0000-0000-000000000401',
    '00000000-0000-0000-0000-000000000402',
    '00000000-0000-0000-0000-000000000001',
    ARRAY[(SELECT id FROM public.roles WHERE name = 'cashier')]
  )$$,
  'actualiza roles y auditoría en una transacción'
);

SELECT is(
  (SELECT count(*)::integer FROM public.organization_members WHERE user_id = '00000000-0000-0000-0000-000000000402' AND organization_id = '00000000-0000-0000-0000-000000000001'),
  1,
  'el usuario conserva una única membresía'
);

SELECT is(
  (SELECT r.name FROM public.organization_members om JOIN public.roles r ON r.id = om.role_id WHERE om.user_id = '00000000-0000-0000-0000-000000000402' AND om.organization_id = '00000000-0000-0000-0000-000000000001'),
  'cashier',
  'el rol actualizado es el esperado'
);

SELECT is(
  (SELECT count(*)::integer FROM public.audit_logs WHERE user_id = '00000000-0000-0000-0000-000000000401' AND action = 'update_user_roles' AND auditable_id = '00000000-0000-0000-0000-000000000402'),
  1,
  'cada cambio de roles genera auditoría'
);

SELECT throws_ok(
  $$SELECT public.update_organization_member_roles_transaction(
    '00000000-0000-0000-0000-000000000401',
    '00000000-0000-0000-0000-000000000402',
    '00000000-0000-0000-0000-000000000001',
    ARRAY[(SELECT id FROM public.roles WHERE name = 'cashier'), (SELECT id FROM public.roles WHERE name = 'cashier')]
  )$$,
  'P0001',
  'La lista de roles contiene duplicados',
  'rechaza roles duplicados'
);

SELECT * FROM finish();
ROLLBACK;
