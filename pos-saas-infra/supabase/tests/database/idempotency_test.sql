BEGIN;

SELECT plan(10);

INSERT INTO auth.users (id, email, encrypted_password, aud, role, email_confirmed_at)
VALUES ('00000000-0000-0000-0000-000000000301', 'idempotency@example.com', '', 'authenticated', 'authenticated', now());

INSERT INTO public.organization_members (organization_id, user_id, role_id, is_default)
SELECT '00000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000301', id, true
FROM public.roles WHERE name = 'admin';

INSERT INTO public.categories (id, organization_id, name)
VALUES ('00000000-0000-0000-0000-000000000302', '00000000-0000-0000-0000-000000000001', 'Idempotency tests');
INSERT INTO public.products (id, organization_id, category_id, name, price)
VALUES ('00000000-0000-0000-0000-000000000303', '00000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000302', 'Idempotency product', 10);

SELECT lives_ok(
  $$SELECT public.create_order_transaction_idempotent(
    '00000000-0000-0000-0000-000000000301', '00000000-0000-0000-0000-000000000001', NULL, 1, NULL,
    '[{"product_id":"00000000-0000-0000-0000-000000000303","quantity":1}]'::jsonb,
    'order-key-1', repeat('a', 64)
  )$$,
  'crea el pedido idempotente'
);

SELECT is(
  (SELECT count(*)::integer FROM public.orders WHERE user_id = '00000000-0000-0000-0000-000000000301'),
  1,
  'la primera solicitud crea un solo pedido'
);

SELECT is(
  (SELECT count(*)::integer FROM public.orders WHERE id = (
    SELECT (public.create_order_transaction_idempotent(
      '00000000-0000-0000-0000-000000000301', '00000000-0000-0000-0000-000000000001', NULL, 1, NULL,
      '[{"product_id":"00000000-0000-0000-0000-000000000303","quantity":1}]'::jsonb,
      'order-key-1', repeat('a', 64)
    )->>'orderId')::uuid
  )),
  1,
  'el reintento devuelve el mismo pedido'
);

SELECT throws_ok(
  $$SELECT public.create_order_transaction_idempotent(
    '00000000-0000-0000-0000-000000000301', '00000000-0000-0000-0000-000000000001', NULL, 2, NULL,
    '[{"product_id":"00000000-0000-0000-0000-000000000303","quantity":1}]'::jsonb,
    'order-key-1', repeat('b', 64)
  )$$,
  'P0001',
  'La clave de idempotencia fue reutilizada con otros datos',
  'rechaza reutilizar una clave con otro payload'
);

SELECT lives_ok(
  $$SELECT public.open_cash_shift_idempotent(
    '00000000-0000-0000-0000-000000000301', 50, 'open-key-1', repeat('c', 64)
  )$$,
  'abre caja idempotentemente'
);

SELECT is(
  (SELECT count(*)::integer FROM public.shifts WHERE user_id = '00000000-0000-0000-0000-000000000301' AND status = 'open'),
  1,
  'el reintento de apertura no duplica la caja'
);

INSERT INTO public.orders (id, organization_id, user_id, status, total_amount)
VALUES ('00000000-0000-0000-0000-000000000304', '00000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000301', 'served', 10);

SELECT lives_ok(
  $$SELECT public.register_payment_transaction_idempotent(
    '00000000-0000-0000-0000-000000000304',
    '00000000-0000-0000-0000-000000000301',
    'cash'::public.payment_method, 10, 10, NULL, 'payment-key-1', repeat('e', 64)
  )$$,
  'registra el pago idempotentemente'
);

SELECT is(
  (SELECT count(*)::integer FROM public.payments WHERE order_id = '00000000-0000-0000-0000-000000000304'),
  1,
  'el reintento de pago no duplica el cobro'
);

SELECT lives_ok(
  $$SELECT public.close_cash_shift_idempotent(
    '00000000-0000-0000-0000-000000000301', 60, NULL, 'close-key-1', repeat('d', 64)
  )$$,
  'cierra caja idempotentemente'
);

SELECT is(
  (SELECT count(*)::integer FROM public.shifts WHERE user_id = '00000000-0000-0000-0000-000000000301' AND status = 'closed'),
  1,
  'el reintento de cierre no crea otro turno'
);

SELECT * FROM finish();
ROLLBACK;
