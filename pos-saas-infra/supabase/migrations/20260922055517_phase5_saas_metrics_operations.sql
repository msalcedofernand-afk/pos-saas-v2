-- Phase 5: SaaS metrics and operational visibility.
-- Operational data is server-only. The API authenticates platform_admin and
-- the database grant prevents direct browser/Data API access.

CREATE TABLE public.platform_operation_errors (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  occurred_at timestamptz NOT NULL DEFAULT pg_catalog.now(),
  severity text NOT NULL DEFAULT 'error'
    CHECK (severity IN ('warning', 'error', 'critical')),
  source text NOT NULL CHECK (length(source) BETWEEN 2 AND 80),
  operation text NOT NULL CHECK (length(operation) BETWEEN 2 AND 120),
  organization_id uuid REFERENCES public.organizations(id) ON DELETE SET NULL,
  actor_user_id uuid REFERENCES public.users(id) ON DELETE SET NULL,
  message text NOT NULL CHECK (length(message) BETWEEN 2 AND 1000),
  details jsonb NOT NULL DEFAULT '{}'::jsonb
);

CREATE INDEX platform_operation_errors_occurred_idx
  ON public.platform_operation_errors (occurred_at DESC, id DESC);
CREATE INDEX platform_operation_errors_org_idx
  ON public.platform_operation_errors (organization_id, occurred_at DESC)
  WHERE organization_id IS NOT NULL;
CREATE INDEX platform_operation_errors_operation_idx
  ON public.platform_operation_errors (operation, occurred_at DESC);

ALTER TABLE public.platform_operation_errors ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.platform_operation_errors FROM anon, authenticated;
GRANT ALL ON TABLE public.platform_operation_errors TO service_role;

CREATE OR REPLACE FUNCTION public.get_platform_operational_metrics(
  p_actor_user_id uuid,
  p_organization_id uuid DEFAULT NULL,
  p_since timestamptz DEFAULT (pg_catalog.now() - interval '30 days'),
  p_until timestamptz DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY INVOKER
SET search_path = ''
AS $$
DECLARE
  v_until timestamptz := coalesce(p_until, pg_catalog.now());
  v_organization jsonb;
  v_organization_metrics jsonb;
  v_recent_errors jsonb;
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM public.user_roles ur
    JOIN public.roles r ON r.id = ur.role_id
    WHERE ur.user_id = p_actor_user_id
      AND r.name = 'platform_admin'
  ) THEN
    RAISE EXCEPTION 'No autorizado' USING ERRCODE = '42501';
  END IF;

  IF p_since IS NULL OR v_until <= p_since THEN
    RAISE EXCEPTION 'Rango de métricas inválido' USING ERRCODE = '22023';
  END IF;

  IF p_organization_id IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM public.organizations o WHERE o.id = p_organization_id
  ) THEN
    RAISE EXCEPTION 'Organización no encontrada' USING ERRCODE = 'P0001';
  END IF;

  SELECT pg_catalog.jsonb_build_object(
    'total', count(*),
    'active', count(*) FILTER (WHERE o.status = 'active'),
    'suspended', count(*) FILTER (WHERE o.status = 'suspended'),
    'pending', count(*) FILTER (WHERE o.status = 'pending'),
    'archived', count(*) FILTER (WHERE o.status = 'archived')
  )
  INTO v_organization
  FROM public.organizations o;

  SELECT coalesce(pg_catalog.jsonb_agg(pg_catalog.jsonb_build_object(
    'organizationId', o.id,
    'name', o.name,
    'slug', o.slug,
    'status', o.status,
    'activeUsers', (
      SELECT count(*)
      FROM public.organization_members om
      JOIN public.users u ON u.id = om.user_id
      WHERE om.organization_id = o.id AND NOT u.is_blocked
    ),
    'recentlyActiveUsers', (
      SELECT count(DISTINCT om.user_id)
      FROM public.organization_members om
      JOIN auth.users au ON au.id = om.user_id
      WHERE om.organization_id = o.id
        AND au.last_sign_in_at >= p_since
        AND au.last_sign_in_at < v_until
    ),
    'orders', (
      SELECT count(*)
      FROM public.orders ord
      WHERE ord.organization_id = o.id
        AND ord.created_at >= p_since AND ord.created_at < v_until
    ),
    'paidOrders', (
      SELECT count(*)
      FROM public.orders ord
      WHERE ord.organization_id = o.id AND ord.status = 'paid'
        AND ord.created_at >= p_since AND ord.created_at < v_until
    ),
    'sales', coalesce((
      SELECT sum(ord.total_amount)
      FROM public.orders ord
      WHERE ord.organization_id = o.id AND ord.status = 'paid'
        AND ord.created_at >= p_since AND ord.created_at < v_until
    ), 0),
    'pendingInvitations', (
      SELECT count(DISTINCT om.user_id)
      FROM public.organization_members om
      JOIN auth.users au ON au.id = om.user_id
      WHERE om.organization_id = o.id
        AND au.invited_at IS NOT NULL
        AND au.confirmed_at IS NULL
        AND au.deleted_at IS NULL
    ),
    'lastActivityAt', greatest(
      o.last_activity_at,
      (SELECT max(ord.created_at) FROM public.orders ord WHERE ord.organization_id = o.id),
      (SELECT max(pal.created_at)
       FROM public.platform_audit_logs pal
       WHERE pal.auditable_id = o.id
          OR pal.new_values ->> 'organization_id' = o.id::text
          OR pal.old_values ->> 'organization_id' = o.id::text)
    )
  ) ORDER BY o.created_at DESC), '[]'::jsonb)
  INTO v_organization_metrics
  FROM public.organizations o;

  SELECT coalesce(pg_catalog.jsonb_agg(item ORDER BY item ->> 'occurredAt' DESC), '[]'::jsonb)
  INTO v_recent_errors
  FROM (
    SELECT pg_catalog.jsonb_build_object(
      'id', poe.id,
      'occurredAt', poe.occurred_at,
      'severity', poe.severity,
      'source', poe.source,
      'operation', poe.operation,
      'organizationId', poe.organization_id,
      'message', poe.message,
      'details', poe.details
    ) AS item
    FROM public.platform_operation_errors poe
    WHERE poe.occurred_at >= p_since AND poe.occurred_at < v_until
      AND (p_organization_id IS NULL OR poe.organization_id = p_organization_id)
    ORDER BY poe.occurred_at DESC
    LIMIT 20
  ) recent;

  RETURN pg_catalog.jsonb_build_object(
    'range', pg_catalog.jsonb_build_object('since', p_since, 'until', v_until),
    'organizations', v_organization,
    'users', pg_catalog.jsonb_build_object(
      'total', (SELECT count(*) FROM public.users),
      'active', (SELECT count(*) FROM public.users WHERE NOT is_blocked),
      'recentlyActive', (
        SELECT count(*) FROM auth.users au
        JOIN public.users u ON u.id = au.id
        WHERE NOT u.is_blocked AND au.last_sign_in_at >= p_since AND au.last_sign_in_at < v_until
      )
    ),
    'orders', pg_catalog.jsonb_build_object(
      'total', (SELECT count(*) FROM public.orders ord WHERE (p_organization_id IS NULL OR ord.organization_id = p_organization_id) AND ord.created_at >= p_since AND ord.created_at < v_until),
      'paid', (SELECT count(*) FROM public.orders ord WHERE (p_organization_id IS NULL OR ord.organization_id = p_organization_id) AND ord.status = 'paid' AND ord.created_at >= p_since AND ord.created_at < v_until),
      'sales', coalesce((SELECT sum(ord.total_amount) FROM public.orders ord WHERE (p_organization_id IS NULL OR ord.organization_id = p_organization_id) AND ord.status = 'paid' AND ord.created_at >= p_since AND ord.created_at < v_until), 0)
    ),
    'pendingInvitations', (
      SELECT count(*)
      FROM auth.users au
      WHERE au.invited_at IS NOT NULL AND au.confirmed_at IS NULL AND au.deleted_at IS NULL
        AND (p_organization_id IS NULL OR EXISTS (
          SELECT 1 FROM public.organization_members om WHERE om.user_id = au.id AND om.organization_id = p_organization_id
        ))
    ),
    'lastActivityAt', CASE
      WHEN p_organization_id IS NULL THEN greatest(
        (SELECT max(o.last_activity_at) FROM public.organizations o),
        (SELECT max(ord.created_at) FROM public.orders ord WHERE ord.created_at >= p_since AND ord.created_at < v_until),
        (SELECT max(pal.created_at) FROM public.platform_audit_logs pal WHERE pal.created_at >= p_since AND pal.created_at < v_until)
      )::text
      ELSE (SELECT item ->> 'lastActivityAt' FROM jsonb_array_elements(v_organization_metrics) item WHERE item ->> 'organizationId' = p_organization_id::text LIMIT 1)
    END,
    'recentErrors', v_recent_errors,
    'organizationMetrics', v_organization_metrics
  );
END;
$$;

REVOKE ALL ON FUNCTION public.get_platform_operational_metrics(uuid, uuid, timestamptz, timestamptz) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.get_platform_operational_metrics(uuid, uuid, timestamptz, timestamptz) TO service_role;
