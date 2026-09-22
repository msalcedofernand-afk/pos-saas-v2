BEGIN;

SELECT plan(8);

INSERT INTO auth.users (id, email, encrypted_password, aud, role, email_confirmed_at)
VALUES
  ('00000000-0000-0000-0000-000000000701', 'platform-phase3-actor@example.com', '', 'authenticated', 'authenticated', now()),
  ('00000000-0000-0000-0000-000000000702', 'platform-phase3-other@example.com', '', 'authenticated', 'authenticated', now())
ON CONFLICT (id) DO NOTHING;

INSERT INTO public.user_roles (user_id, role_id)
SELECT '00000000-0000-0000-0000-000000000701', id
FROM public.roles
WHERE name = 'platform_admin'
ON CONFLICT DO NOTHING;

INSERT INTO public.platform_audit_logs (
  id, actor_user_id, action, auditable_type, auditable_id, new_values
)
VALUES (
  '00000000-0000-0000-0000-000000000703',
  '00000000-0000-0000-0000-000000000701',
  'phase3_audit_read_test',
  'organizations',
  '00000000-0000-0000-0000-000000000704',
  jsonb_build_object('organization_id', '00000000-0000-0000-0000-000000000704')
)
ON CONFLICT (id) DO NOTHING;

SELECT is(
  has_function_privilege('anon', 'public.list_platform_audit_logs(uuid,uuid,uuid,text,text,timestamptz,timestamptz,integer,integer)', 'execute'),
  false,
  'anon no puede consultar la auditoría global'
);

SELECT is(
  has_function_privilege('authenticated', 'public.list_platform_audit_logs(uuid,uuid,uuid,text,text,timestamptz,timestamptz,integer,integer)', 'execute'),
  false,
  'authenticated no puede consultar la auditoría global'
);

SET LOCAL ROLE service_role;

SELECT lives_ok($$SELECT public.list_platform_audit_logs(
  '00000000-0000-0000-0000-000000000701', NULL,
  '00000000-0000-0000-0000-000000000704', 'phase3_audit_read_test', NULL,
  NULL, NULL, 1, 10
)$$, 'service_role puede consultar la auditoría paginada');

SELECT is(
  (public.list_platform_audit_logs(
    '00000000-0000-0000-0000-000000000701', NULL,
    '00000000-0000-0000-0000-000000000704', 'phase3_audit_read_test', NULL,
    NULL, NULL, 1, 10
  )->>'total')::integer,
  1,
  'el filtro por organización y acción devuelve un evento'
);

SELECT is(
  public.list_platform_audit_logs(
    '00000000-0000-0000-0000-000000000701', NULL,
    '00000000-0000-0000-0000-000000000704', 'phase3_audit_read_test', NULL,
    NULL, NULL, 1, 10
  )->'items'->0->>'actor_email',
  'platform-phase3-actor@example.com',
  'la auditoría incluye la identidad del actor'
);

SELECT throws_ok($$SELECT public.list_platform_audit_logs(
  '00000000-0000-0000-0000-000000000702', NULL, NULL, NULL, NULL, NULL, NULL, 1, 10
)$$, '42501', 'No autorizado', 'un usuario sin platform_admin no puede consultar logs globales');

SELECT throws_ok($$SELECT public.list_platform_audit_logs(
  '00000000-0000-0000-0000-000000000701', NULL, NULL, NULL, NULL, NULL, 1, 101
)$$, '22023', 'Paginación inválida', 'la función limita el tamaño de página');

SELECT * FROM finish();
ROLLBACK;
