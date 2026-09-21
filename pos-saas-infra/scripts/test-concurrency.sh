#!/usr/bin/env bash
set -euo pipefail

container="supabase_db_pos-saas-infra"
actor_id="00000000-0000-0000-0000-000000000501"
category_id="00000000-0000-0000-0000-000000000502"
product_id="00000000-0000-0000-0000-000000000503"
table_id="00000000-0000-0000-0000-000000000504"
organization_id="00000000-0000-0000-0000-000000000001"
locker_log="${RUNNER_TEMP:-/tmp}/pos-saas-locker.log"
contender_log="${RUNNER_TEMP:-/tmp}/pos-saas-contender.log"

psql_exec() {
  docker exec "$container" psql -U postgres -d postgres -v ON_ERROR_STOP=1 "$@"
}

cleanup() {
  psql_exec -c "
    DELETE FROM public.products WHERE id = '$product_id';
    DELETE FROM public.categories WHERE id = '$category_id';
    DELETE FROM public.tables_restaurant WHERE id = '$table_id';
    DELETE FROM auth.users WHERE id = '$actor_id';
  " >/dev/null 2>&1 || true
}
trap cleanup EXIT

psql_exec -c "
  INSERT INTO auth.users (id, email, encrypted_password, aud, role, email_confirmed_at)
  VALUES ('$actor_id', 'concurrency-test@example.com', '', 'authenticated', 'authenticated', now());
  INSERT INTO public.organization_members (organization_id, user_id, role_id, is_default)
  SELECT '$organization_id', '$actor_id', id, true FROM public.roles WHERE name = 'admin';
  INSERT INTO public.categories (id, organization_id, name)
  VALUES ('$category_id', '$organization_id', 'Concurrency test');
  INSERT INTO public.products (id, organization_id, category_id, name, price)
  VALUES ('$product_id', '$organization_id', '$category_id', 'Concurrency product', 10);
  INSERT INTO public.tables_restaurant (id, organization_id, name, status)
  VALUES ('$table_id', '$organization_id', 'Concurrency table', 'available');
"

# Hold the table row lock and mark it occupied. The contender must wait for
# this short transaction and then observe the committed occupied state.
(
  psql_exec -c "
    BEGIN;
    SELECT id FROM public.tables_restaurant WHERE id = '$table_id' FOR UPDATE;
    UPDATE public.tables_restaurant SET status = 'occupied' WHERE id = '$table_id';
    SELECT pg_sleep(2);
    COMMIT;
  " >"$locker_log" 2>&1
) &
locker_pid=$!
sleep 0.4

set +e
psql_exec -c "
  SELECT public.create_order_transaction(
    '$actor_id', '$organization_id', '$table_id', 1, NULL,
    '[{\"product_id\":\"$product_id\",\"quantity\":1}]'::jsonb
  );
" >"$contender_log" 2>&1
contender_status=$?
set -e
wait "$locker_pid"

if [[ "$contender_status" -eq 0 ]]; then
  echo "La operación concurrente creó un pedido sobre una mesa ocupada" >&2
  cat "$contender_log" >&2
  exit 1
fi
if ! grep -q "La mesa no está disponible" "$contender_log"; then
  echo "La operación concurrente falló por una causa inesperada" >&2
  cat "$contender_log" >&2
  exit 1
fi

echo "Concurrency check passed: la segunda operación observó la mesa ocupada después del bloqueo."
