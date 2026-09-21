BEGIN;

SELECT plan(12);

SELECT is(
  (SELECT allowed FROM public.check_login_rate_limit('email:test-security-key', 2, 900, 60)),
  true,
  'permite el primer intento dentro del límite'
);

SELECT lives_ok(
  $$SELECT * FROM public.record_login_failure('email:test-security-key', 2, 900, 60)$$,
  'registra un intento fallido'
);

SELECT is(
  (SELECT blocked FROM public.record_login_failure('email:test-security-key', 2, 900, 60)),
  true,
  'bloquea al alcanzar el máximo de intentos'
);

SELECT is(
  (SELECT allowed FROM public.check_login_rate_limit('email:test-security-key', 2, 900, 60)),
  false,
  'rechaza nuevos intentos durante el bloqueo'
);

SELECT lives_ok(
  $$SELECT public.reset_login_rate_limit('email:test-security-key')$$,
  'permite reiniciar el límite de una clave'
);

SELECT is(
  (SELECT allowed FROM public.check_login_rate_limit('email:test-security-key', 2, 900, 60)),
  true,
  'el reinicio libera la clave'
);

INSERT INTO auth.users (id, email, encrypted_password, aud, role, email_confirmed_at)
VALUES (
  '00000000-0000-0000-0000-000000000301',
  'security-test@example.com',
  '',
  'authenticated',
  'authenticated',
  now()
)
ON CONFLICT (id) DO NOTHING;

SELECT is(
  (SELECT locked FROM public.check_user_login_lock('00000000-0000-0000-0000-000000000301')),
  false,
  'un usuario nuevo no está bloqueado'
);

SELECT lives_ok(
  $$SELECT * FROM public.record_user_login_failure('00000000-0000-0000-0000-000000000301', 'test-ip', 2, 60)$$,
  'registra un fallo para el usuario'
);

SELECT is(
  (SELECT blocked FROM public.record_user_login_failure('00000000-0000-0000-0000-000000000301', 'test-ip', 2, 60)),
  true,
  'bloquea el usuario después de los intentos configurados'
);

SELECT is(
  (SELECT locked FROM public.check_user_login_lock('00000000-0000-0000-0000-000000000301')),
  true,
  'detecta el bloqueo persistido del usuario'
);

SELECT lives_ok(
  $$SELECT public.reset_user_login_security('00000000-0000-0000-0000-000000000301')$$,
  'permite desbloquear el estado de seguridad'
);

SELECT is(
  (SELECT locked FROM public.check_user_login_lock('00000000-0000-0000-0000-000000000301')),
  false,
  'el desbloqueo permite volver a iniciar sesión'
);

SELECT * FROM finish();
ROLLBACK;
