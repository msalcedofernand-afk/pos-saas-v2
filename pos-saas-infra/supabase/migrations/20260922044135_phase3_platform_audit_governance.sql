-- Phase 3: expose global administrative audit data through a server-only,
-- paginated read model. The API authenticates platform_admin before calling
-- this function; the database grant prevents direct browser access as well.

CREATE INDEX IF NOT EXISTS platform_audit_logs_action_created_idx
  ON public.platform_audit_logs (action, created_at DESC, id DESC);

CREATE INDEX IF NOT EXISTS platform_audit_logs_created_id_idx
  ON public.platform_audit_logs (created_at DESC, id DESC);

CREATE OR REPLACE FUNCTION public.list_platform_audit_logs(
  p_actor_user_id uuid,
  p_actor_filter uuid DEFAULT NULL,
  p_organization_id uuid DEFAULT NULL,
  p_action text DEFAULT NULL,
  p_auditable_type text DEFAULT NULL,
  p_from timestamptz DEFAULT NULL,
  p_to timestamptz DEFAULT NULL,
  p_page integer DEFAULT 1,
  p_page_size integer DEFAULT 25
)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY INVOKER
SET search_path = ''
AS $$
DECLARE
  v_total integer;
  v_items jsonb;
BEGIN
  IF p_page < 1 OR p_page_size < 1 OR p_page_size > 100 THEN
    RAISE EXCEPTION 'Paginación inválida' USING ERRCODE = '22023';
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM public.user_roles ur
    JOIN public.roles r ON r.id = ur.role_id
    WHERE ur.user_id = p_actor_user_id
      AND r.name = 'platform_admin'
  ) THEN
    RAISE EXCEPTION 'No autorizado' USING ERRCODE = '42501';
  END IF;

  SELECT count(*)::integer
  INTO v_total
  FROM public.platform_audit_logs pal
  WHERE (p_actor_filter IS NULL OR pal.actor_user_id = p_actor_filter)
    AND (p_action IS NULL OR pal.action = p_action)
    AND (p_auditable_type IS NULL OR pal.auditable_type = p_auditable_type)
    AND (p_from IS NULL OR pal.created_at >= p_from)
    AND (p_to IS NULL OR pal.created_at < p_to)
    AND (
      p_organization_id IS NULL
      OR (
        CASE
          WHEN pal.auditable_type = 'organizations' THEN pal.auditable_id::text
          ELSE coalesce(
            pal.new_values ->> 'organization_id',
            pal.old_values ->> 'organization_id',
            pal.new_values -> 'organization' ->> 'id',
            pal.old_values -> 'organization' ->> 'id'
          )
        END
      ) = p_organization_id::text
    );

  SELECT coalesce(jsonb_agg(to_jsonb(page_row) - 'organization_id' ORDER BY page_row.created_at DESC, page_row.id DESC), '[]'::jsonb)
  INTO v_items
  FROM (
    SELECT
      pal.id,
      pal.actor_user_id,
      actor.email AS actor_email,
      actor.name AS actor_name,
      pal.action,
      pal.auditable_type,
      pal.auditable_id,
      CASE
        WHEN pal.auditable_type = 'organizations' THEN pal.auditable_id::text
        ELSE coalesce(
          pal.new_values ->> 'organization_id',
          pal.old_values ->> 'organization_id',
          pal.new_values -> 'organization' ->> 'id',
          pal.old_values -> 'organization' ->> 'id'
        )
      END AS organization_id,
      pal.old_values,
      pal.new_values,
      pal.created_at
    FROM public.platform_audit_logs pal
    JOIN public.users actor ON actor.id = pal.actor_user_id
    WHERE (p_actor_filter IS NULL OR pal.actor_user_id = p_actor_filter)
      AND (p_action IS NULL OR pal.action = p_action)
      AND (p_auditable_type IS NULL OR pal.auditable_type = p_auditable_type)
      AND (p_from IS NULL OR pal.created_at >= p_from)
      AND (p_to IS NULL OR pal.created_at < p_to)
      AND (
        p_organization_id IS NULL
        OR (
          CASE
            WHEN pal.auditable_type = 'organizations' THEN pal.auditable_id::text
            ELSE coalesce(
              pal.new_values ->> 'organization_id',
              pal.old_values ->> 'organization_id',
              pal.new_values -> 'organization' ->> 'id',
              pal.old_values -> 'organization' ->> 'id'
            )
          END
        ) = p_organization_id::text
      )
    ORDER BY pal.created_at DESC, pal.id DESC
    OFFSET (p_page - 1) * p_page_size
    LIMIT p_page_size
  ) page_row;

  RETURN jsonb_build_object(
    'items', v_items,
    'total', v_total,
    'page', p_page,
    'pageSize', p_page_size,
    'pageCount', CASE WHEN v_total = 0 THEN 0 ELSE ceil(v_total::numeric / p_page_size)::integer END
  );
END;
$$;

REVOKE ALL ON FUNCTION public.list_platform_audit_logs(uuid, uuid, uuid, text, text, timestamptz, timestamptz, integer, integer) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.list_platform_audit_logs(uuid, uuid, uuid, text, text, timestamptz, timestamptz, integer, integer) FROM anon, authenticated;
GRANT EXECUTE ON FUNCTION public.list_platform_audit_logs(uuid, uuid, uuid, text, text, timestamptz, timestamptz, integer, integer) TO service_role;
