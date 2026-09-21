BEGIN;

SELECT plan(4);

INSERT INTO auth.users (id, email, encrypted_password, aud, role, email_confirmed_at)
VALUES (
  '00000000-0000-0000-0000-000000000201',
  'tenant-two@example.com',
  '',
  'authenticated',
  'authenticated',
  now()
);

INSERT INTO public.organizations (id, name, slug)
VALUES ('00000000-0000-0000-0000-000000000202', 'Segundo negocio', 'segundo-negocio');

INSERT INTO public.organization_members (organization_id, user_id, role_id, is_default)
SELECT '00000000-0000-0000-0000-000000000202', '00000000-0000-0000-0000-000000000201', id, true
FROM public.roles WHERE name = 'admin';

INSERT INTO public.categories (id, organization_id, name)
VALUES ('00000000-0000-0000-0000-000000000203', '00000000-0000-0000-0000-000000000202', 'Segundo catálogo');

SET LOCAL ROLE authenticated;
SELECT set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-000000000101', true);

SELECT is(
  (SELECT count(*)::integer FROM public.categories WHERE organization_id = '00000000-0000-0000-0000-000000000202'),
  0,
  'un usuario no puede leer categorías de otra organización'
);

SELECT is(
  (SELECT count(*)::integer FROM public.organizations WHERE id = '00000000-0000-0000-0000-000000000202'),
  0,
  'un usuario no puede descubrir otra organización'
);

SELECT throws_ok(
  $$INSERT INTO public.categories (organization_id, name) VALUES ('00000000-0000-0000-0000-000000000202', 'Intento cruzado')$$,
  '42501',
  NULL,
  'un usuario no puede insertar datos en otra organización'
);

SELECT ok(
  private.is_org_member('00000000-0000-0000-0000-000000000001'),
  'el usuario sí conserva acceso a su organización'
);

SELECT * FROM finish();
ROLLBACK;
