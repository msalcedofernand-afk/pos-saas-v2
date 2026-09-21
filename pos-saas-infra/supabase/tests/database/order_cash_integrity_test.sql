BEGIN;

SELECT plan(9);

-- Minimal fixture created through auth so the public.users trigger also runs.
INSERT INTO auth.users (id, email, encrypted_password, aud, role, email_confirmed_at)
VALUES (
  '00000000-0000-0000-0000-000000000101',
  'integrity-test@example.com',
  '',
  'authenticated',
  'authenticated',
  now()
);

INSERT INTO public.organization_members (organization_id, user_id, role_id, is_default)
SELECT '00000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000101', id, true
FROM public.roles WHERE name = 'admin';

INSERT INTO public.shifts (id, user_id, opening_amount, status)
VALUES ('00000000-0000-0000-0000-000000000102', '00000000-0000-0000-0000-000000000101', 0, 'open');

INSERT INTO public.orders (id, user_id, status, total_amount)
VALUES ('00000000-0000-0000-0000-000000000103', '00000000-0000-0000-0000-000000000101', 'served', 300);

SELECT lives_ok(
  $$SELECT public.register_payment_transaction(
    '00000000-0000-0000-0000-000000000103',
    '00000000-0000-0000-0000-000000000101',
    'cash'::public.payment_method,
    100,
    100,
    NULL
  )$$,
  'registra pagos en efectivo'
);

SELECT lives_ok(
  $$SELECT public.register_payment_transaction(
    '00000000-0000-0000-0000-000000000103',
    '00000000-0000-0000-0000-000000000101',
    'card'::public.payment_method,
    200,
    200,
    'terminal-1'
  )$$,
  'registra pagos no monetarios'
);

SELECT is(
  (SELECT count(*)::integer FROM public.cash_movements WHERE shift_id = '00000000-0000-0000-0000-000000000102'),
  1,
  'solo el pago en efectivo crea movimiento de caja'
);

SELECT is(
  (SELECT amount FROM public.cash_movements WHERE shift_id = '00000000-0000-0000-0000-000000000102'),
  100::numeric,
  'el movimiento de caja contiene solo el efectivo'
);

SELECT is(
  (SELECT expected_amount FROM public.close_cash_shift(
    '00000000-0000-0000-0000-000000000101',
    100,
    NULL
  )),
  100::numeric,
  'el efectivo esperado excluye tarjeta'
);

INSERT INTO public.categories (id, organization_id, name)
VALUES ('00000000-0000-0000-0000-000000000104', '00000000-0000-0000-0000-000000000001', 'Integrity tests');
INSERT INTO public.products (id, organization_id, category_id, name, price)
VALUES ('00000000-0000-0000-0000-000000000105', '00000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000104', 'Test product', 10);
INSERT INTO public.tables_restaurant (id, organization_id, name, status)
VALUES ('00000000-0000-0000-0000-000000000106', '00000000-0000-0000-0000-000000000001', 'Test table', 'available');

SELECT lives_ok(
  $$SELECT public.create_order_transaction(
    '00000000-0000-0000-0000-000000000101',
    '00000000-0000-0000-0000-000000000001',
    '00000000-0000-0000-0000-000000000106',
    1,
    NULL,
    '[{"product_id":"00000000-0000-0000-0000-000000000105","quantity":1}]'::jsonb
  )$$,
  'crea el primer pedido de la mesa'
);

SELECT throws_ok(
  $$SELECT public.create_order_transaction(
    '00000000-0000-0000-0000-000000000101',
    '00000000-0000-0000-0000-000000000001',
    '00000000-0000-0000-0000-000000000106',
    1,
    NULL,
    '[{"product_id":"00000000-0000-0000-0000-000000000105","quantity":1}]'::jsonb
  )$$,
  'P0001',
  'La mesa no está disponible',
  'rechaza un segundo pedido sobre una mesa ocupada'
);

INSERT INTO public.orders (id, user_id, status, total_amount)
VALUES ('00000000-0000-0000-0000-000000000107', '00000000-0000-0000-0000-000000000101', 'paid', 10);

SELECT throws_ok(
  $$SELECT public.transition_order_status_transaction(
    '00000000-0000-0000-0000-000000000107',
    '00000000-0000-0000-0000-000000000101',
    'confirmed'::public.order_status,
    NULL
  )$$,
  'P0001',
  'Solo se puede confirmar un pedido pendiente',
  'impide paid a confirmed'
);

SELECT throws_ok(
  $$SELECT public.transition_order_status_transaction(
    '00000000-0000-0000-0000-000000000107',
    '00000000-0000-0000-0000-000000000101',
    'cancelled'::public.order_status,
    NULL
  )$$,
  'P0001',
  'Este pedido ya está en preparación y no puede cancelarse desde pedidos',
  'impide paid a cancelled'
);

SELECT * FROM finish();
ROLLBACK;
