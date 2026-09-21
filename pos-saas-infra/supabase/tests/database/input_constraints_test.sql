BEGIN;

SELECT plan(10);

INSERT INTO auth.users (id, email, encrypted_password, aud, role, email_confirmed_at)
VALUES (
  '00000000-0000-0000-0000-000000000401',
  'constraints-test@example.com',
  '',
  'authenticated',
  'authenticated',
  now()
);

INSERT INTO public.categories (id, organization_id, name)
VALUES (
  '00000000-0000-0000-0000-000000000402',
  '00000000-0000-0000-0000-000000000001',
  'Constraints tests'
);

INSERT INTO public.products (id, organization_id, category_id, name, price)
VALUES (
  '00000000-0000-0000-0000-000000000403',
  '00000000-0000-0000-0000-000000000001',
  '00000000-0000-0000-0000-000000000402',
  'Constraint product',
  10
);

INSERT INTO public.orders (id, organization_id, user_id, status, total_amount)
VALUES (
  '00000000-0000-0000-0000-000000000404',
  '00000000-0000-0000-0000-000000000001',
  '00000000-0000-0000-0000-000000000401',
  'served',
  10
);

INSERT INTO public.shifts (id, organization_id, user_id, status)
VALUES (
  '00000000-0000-0000-0000-000000000405',
  '00000000-0000-0000-0000-000000000001',
  '00000000-0000-0000-0000-000000000401',
  'open'
);

INSERT INTO public.inventory_categories (id, organization_id, name)
VALUES (
  '00000000-0000-0000-0000-000000000406',
  '00000000-0000-0000-0000-000000000001',
  'Constraints inventory'
);

INSERT INTO public.inventory_items (id, organization_id, inventory_category_id, name)
VALUES (
  '00000000-0000-0000-0000-000000000407',
  '00000000-0000-0000-0000-000000000001',
  '00000000-0000-0000-0000-000000000406',
  'Constraint item'
);

SELECT throws_ok(
  $$INSERT INTO public.categories (organization_id, name) VALUES ('00000000-0000-0000-0000-000000000001', '')$$,
  '23514', NULL,
  'rechaza nombres de categoría vacíos'
);

SELECT throws_ok(
  $$INSERT INTO public.products (organization_id, category_id, name, price)
    VALUES ('00000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000402', 'Invalid price', -1)$$,
  '23514', NULL,
  'rechaza precios negativos'
);

SELECT throws_ok(
  $$INSERT INTO public.products (organization_id, category_id, name, prep_time_minutes)
    VALUES ('00000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000402', 'Invalid prep time', 1000)$$,
  '23514', NULL,
  'rechaza tiempos de preparación fuera de rango'
);

SELECT throws_ok(
  $$INSERT INTO public.orders (organization_id, user_id, guests)
    VALUES ('00000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000401', 0)$$,
  '23514', NULL,
  'rechaza invitados fuera de rango'
);

SELECT throws_ok(
  $$INSERT INTO public.order_items (organization_id, order_id, product_id, quantity)
    VALUES ('00000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000404', '00000000-0000-0000-0000-000000000403', 0)$$,
  '23514', NULL,
  'rechaza cantidades de pedido inválidas'
);

SELECT throws_ok(
  $$INSERT INTO public.payments (organization_id, order_id, user_id, method, amount)
    VALUES ('00000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000404', '00000000-0000-0000-0000-000000000401', 'cash', 0)$$,
  '23514', NULL,
  'rechaza pagos no positivos'
);

SELECT throws_ok(
  $$INSERT INTO public.shifts (organization_id, user_id, opening_amount, status)
    VALUES ('00000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000401', -1, 'open')$$,
  '23514', NULL,
  'rechaza montos iniciales negativos'
);

SELECT throws_ok(
  $$INSERT INTO public.cash_movements (organization_id, shift_id, type, amount, user_id)
    VALUES ('00000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000405', 'deposit', -1, '00000000-0000-0000-0000-000000000401')$$,
  '23514', NULL,
  'rechaza movimientos de caja negativos'
);

SELECT throws_ok(
  $$INSERT INTO public.inventory_items (organization_id, inventory_category_id, name, current_stock)
    VALUES ('00000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000406', 'Invalid stock', -1)$$,
  '23514', NULL,
  'rechaza stock negativo'
);

SELECT throws_ok(
  $$INSERT INTO public.stock_movements (organization_id, inventory_item_id, type, quantity, user_id)
    VALUES ('00000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000407', 'in', 0, '00000000-0000-0000-0000-000000000401')$$,
  '23514', NULL,
  'rechaza movimientos de stock no positivos'
);

SELECT * FROM finish();
ROLLBACK;
