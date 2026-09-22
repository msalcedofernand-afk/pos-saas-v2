BEGIN;

SELECT plan(13);

INSERT INTO auth.users (id, email, encrypted_password, aud, role, email_confirmed_at)
VALUES
  ('00000000-0000-0000-0000-000000000801', 'platform-phase4-actor@example.com', '', 'authenticated', 'authenticated', now()),
  ('00000000-0000-0000-0000-000000000802', 'platform-phase4-other@example.com', '', 'authenticated', 'authenticated', now())
ON CONFLICT (id) DO NOTHING;

INSERT INTO public.user_roles (user_id, role_id)
SELECT '00000000-0000-0000-0000-000000000801', id
FROM public.roles
WHERE name = 'platform_admin'
ON CONFLICT DO NOTHING;

SELECT is(
  has_function_privilege('anon', 'public.create_platform_support_access(uuid,uuid,text,integer,text,text)', 'execute'),
  false,
  'anon no puede crear accesos temporales'
);

SELECT is(
  has_function_privilege('authenticated', 'public.mark_platform_support_access_entered(uuid,uuid,uuid)', 'execute'),
  false,
  'authenticated no puede marcar entradas de soporte'
);

SET LOCAL ROLE service_role;

SELECT lives_ok($$SELECT public.create_platform_support_access(
  '00000000-0000-0000-0000-000000000801',
  '00000000-0000-0000-0000-000000000001',
  'Prueba de soporte temporal con motivo', 30,
  'phase4-create-test', repeat('a', 64)
)$$, 'service_role crea un acceso temporal');

SELECT is(
  (SELECT mode FROM public.platform_support_access_requests WHERE idempotency_key = 'phase4-create-test'),
  'read_only',
  'el acceso inicia en solo lectura'
);

SELECT is(
  public.mark_platform_support_access_entered(
    '00000000-0000-0000-0000-000000000801',
    (SELECT id FROM public.platform_support_access_requests WHERE idempotency_key = 'phase4-create-test'),
    '00000000-0000-0000-0000-000000000001'
  ),
  true,
  'la primera entrada queda marcada'
);

SELECT throws_ok($$SELECT public.enable_platform_support_write(
  '00000000-0000-0000-0000-000000000801',
  (SELECT id FROM public.platform_support_access_requests WHERE idempotency_key = 'phase4-create-test'),
  'NO_CONFIRMAR', 'phase4-write-invalid', repeat('b', 64)
)$$, '22023', 'Debes confirmar explícitamente el acceso de escritura', 'la escritura exige confirmación explícita');

SELECT lives_ok($$SELECT public.enable_platform_support_write(
  '00000000-0000-0000-0000-000000000801',
  (SELECT id FROM public.platform_support_access_requests WHERE idempotency_key = 'phase4-create-test'),
  'CONFIRMAR_ACCESO_ESCRITURA', 'phase4-write-test', repeat('c', 64)
)$$, 'la escritura se habilita solo tras confirmar');

SELECT is(
  (SELECT mode FROM public.platform_support_access_requests WHERE idempotency_key = 'phase4-create-test'),
  'write',
  'el modo cambia a escritura después de confirmar'
);

SELECT lives_ok($$SELECT public.revoke_platform_support_access(
  '00000000-0000-0000-0000-000000000801',
  (SELECT id FROM public.platform_support_access_requests WHERE idempotency_key = 'phase4-create-test'),
  'Prueba finalizada', 'phase4-revoke-test', repeat('d', 64)
)$$, 'el acceso se puede revocar manualmente');

SELECT is(
  (SELECT status FROM public.platform_support_access_requests WHERE idempotency_key = 'phase4-create-test'),
  'revoked',
  'la revocación deja el acceso inactivo'
);

SELECT lives_ok($$SELECT public.create_platform_support_access(
  '00000000-0000-0000-0000-000000000801',
  '00000000-0000-0000-0000-000000000001',
  'Prueba de expiración automática', 30,
  'phase4-expiry-test', repeat('e', 64)
)$$, 'se crea un acceso para probar expiración');

UPDATE public.platform_support_access_requests
SET expires_at = now() - interval '1 minute'
WHERE idempotency_key = 'phase4-expiry-test';

SELECT is(public.expire_platform_support_access_sessions(), 1, 'la expiración automática marca sesiones vencidas');

SELECT is(
  (SELECT status FROM public.platform_support_access_requests WHERE idempotency_key = 'phase4-expiry-test'),
  'expired',
  'la sesión vencida ya no queda activa'
);

SELECT * FROM finish();
ROLLBACK;
