CREATE OR REPLACE FUNCTION public.get_dashboard_metrics(
  p_organization_id uuid,
  p_start timestamptz,
  p_end timestamptz
)
RETURNS jsonb
LANGUAGE sql
STABLE
SECURITY INVOKER
SET search_path = ''
AS $$
  SELECT pg_catalog.jsonb_build_object(
    'sales', COALESCE((
      SELECT sum(o.total_amount)
      FROM public.orders o
      WHERE o.organization_id = p_organization_id
        AND o.status = 'paid'
        AND o.created_at >= p_start
        AND o.created_at < p_end
    ), 0),
    'paidOrders', (
      SELECT count(*)
      FROM public.orders o
      WHERE o.organization_id = p_organization_id
        AND o.status = 'paid'
        AND o.created_at >= p_start
        AND o.created_at < p_end
    ),
    'activeOrders', (
      SELECT count(*)
      FROM public.orders o
      WHERE o.organization_id = p_organization_id
        AND o.status IN ('pending', 'confirmed', 'preparing', 'ready')
    ),
    'kitchenOrders', (
      SELECT count(*)
      FROM public.orders o
      WHERE o.organization_id = p_organization_id
        AND o.status IN ('pending', 'confirmed', 'preparing', 'ready')
    ),
    'cashOpen', EXISTS (
      SELECT 1
      FROM public.shifts s
      WHERE s.organization_id = p_organization_id AND s.status = 'open'
    ),
    'lowStock', (
      SELECT count(*)
      FROM public.inventory_items i
      WHERE i.organization_id = p_organization_id
        AND i.current_stock <= i.minimum_stock
    ),
    'productCount', (
      SELECT count(*) FROM public.products p WHERE p.organization_id = p_organization_id
    ),
    'categoryCount', (
      SELECT count(*) FROM public.categories c WHERE c.organization_id = p_organization_id
    )
  );
$$;

REVOKE EXECUTE ON FUNCTION public.get_dashboard_metrics(uuid, timestamptz, timestamptz) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_dashboard_metrics(uuid, timestamptz, timestamptz) TO service_role;
