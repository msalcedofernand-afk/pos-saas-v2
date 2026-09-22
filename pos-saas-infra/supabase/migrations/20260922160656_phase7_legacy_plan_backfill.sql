-- Keep the existing tenant operational when plan enforcement is enabled.
-- New organizations continue to start on the trial plan.
UPDATE public.organization_subscriptions s
SET plan_id = p.id,
    updated_at = pg_catalog.now()
FROM public.plans p
WHERE p.code = 'starter'
  AND s.organization_id = '00000000-0000-0000-0000-000000000001'
  AND s.status = 'trial';

UPDATE public.organization_limits ol
SET plan_id = p.id,
    max_users = p.max_users,
    max_branches = p.max_branches,
    max_products = p.max_products,
    max_monthly_orders = p.max_monthly_orders,
    max_storage_bytes = p.max_storage_bytes,
    features = p.features,
    updated_at = pg_catalog.now()
FROM public.plans p
WHERE p.code = 'starter'
  AND ol.organization_id = '00000000-0000-0000-0000-000000000001';
