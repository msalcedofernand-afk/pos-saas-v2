CREATE OR REPLACE FUNCTION public.update_organization_member_roles_transaction(
  p_actor_user_id uuid,
  p_target_user_id uuid,
  p_organization_id uuid,
  p_role_ids uuid[]
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_old_role_ids jsonb;
  v_new_role_ids jsonb;
  v_role_count integer;
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM public.organization_members om
    JOIN public.roles r ON r.id = om.role_id
    JOIN public.organizations o ON o.id = om.organization_id
    WHERE om.organization_id = p_organization_id
      AND om.user_id = p_actor_user_id
      AND r.name = 'admin'
      AND o.is_active = true
  ) THEN
    RAISE EXCEPTION 'No tienes permisos para administrar roles en esta organización';
  END IF;

  IF NOT EXISTS (SELECT 1 FROM public.users WHERE id = p_target_user_id) THEN
    RAISE EXCEPTION 'Usuario no encontrado';
  END IF;

  SELECT count(*) INTO v_role_count FROM unnest(COALESCE(p_role_ids, ARRAY[]::uuid[])) AS requested(role_id);
  IF v_role_count <> (SELECT count(DISTINCT role_id) FROM unnest(COALESCE(p_role_ids, ARRAY[]::uuid[])) AS requested(role_id)) THEN
    RAISE EXCEPTION 'La lista de roles contiene duplicados';
  END IF;
  IF EXISTS (
    SELECT 1
    FROM unnest(COALESCE(p_role_ids, ARRAY[]::uuid[])) AS requested(role_id)
    WHERE NOT EXISTS (SELECT 1 FROM public.roles WHERE id = requested.role_id)
  ) THEN
    RAISE EXCEPTION 'Uno de los roles no existe';
  END IF;

  -- Lock the target even when it currently has no membership rows.
  PERFORM 1 FROM public.users WHERE id = p_target_user_id FOR UPDATE;
  SELECT COALESCE(pg_catalog.jsonb_agg(om.role_id ORDER BY om.role_id), '[]'::jsonb)
  INTO v_old_role_ids
  FROM public.organization_members om
  WHERE om.organization_id = p_organization_id AND om.user_id = p_target_user_id;

  DELETE FROM public.organization_members
  WHERE organization_id = p_organization_id AND user_id = p_target_user_id;

  INSERT INTO public.organization_members (organization_id, user_id, role_id, is_default)
  SELECT p_organization_id, p_target_user_id, requested.role_id, requested.ordinality = 1
  FROM unnest(COALESCE(p_role_ids, ARRAY[]::uuid[])) WITH ORDINALITY AS requested(role_id, ordinality);

  SELECT COALESCE(pg_catalog.jsonb_agg(om.role_id ORDER BY om.role_id), '[]'::jsonb)
  INTO v_new_role_ids
  FROM public.organization_members om
  WHERE om.organization_id = p_organization_id AND om.user_id = p_target_user_id;

  INSERT INTO public.audit_logs (
    organization_id, user_id, action, auditable_type, auditable_id, old_values, new_values
  )
  VALUES (
    p_organization_id,
    p_actor_user_id,
    'update_user_roles',
    'users',
    p_target_user_id,
    pg_catalog.jsonb_build_object('role_ids', v_old_role_ids),
    pg_catalog.jsonb_build_object('role_ids', v_new_role_ids)
  );

  RETURN pg_catalog.jsonb_build_object(
    'userId', p_target_user_id,
    'roleIds', v_new_role_ids
  );
END;
$$;

REVOKE EXECUTE ON FUNCTION public.update_organization_member_roles_transaction(uuid, uuid, uuid, uuid[]) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.update_organization_member_roles_transaction(uuid, uuid, uuid, uuid[]) TO service_role;
