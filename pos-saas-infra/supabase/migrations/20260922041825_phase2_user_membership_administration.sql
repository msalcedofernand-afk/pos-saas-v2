-- Phase 2: global user and membership administration.
-- The platform API is the only caller. Auth Admin operations remain server-only.

CREATE TABLE public.platform_user_action_requests (
  idempotency_key text PRIMARY KEY CHECK (length(idempotency_key) BETWEEN 16 AND 128),
  actor_user_id uuid NOT NULL REFERENCES public.users(id) ON DELETE RESTRICT,
  target_user_id uuid NOT NULL REFERENCES public.users(id) ON DELETE RESTRICT,
  action text NOT NULL CHECK (action IN ('block', 'unblock')),
  request_hash text NOT NULL,
  status text NOT NULL CHECK (status IN ('processing', 'completed')),
  response jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE public.platform_membership_action_requests (
  idempotency_key text PRIMARY KEY CHECK (length(idempotency_key) BETWEEN 16 AND 128),
  actor_user_id uuid NOT NULL REFERENCES public.users(id) ON DELETE RESTRICT,
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE RESTRICT,
  target_user_id uuid NOT NULL REFERENCES public.users(id) ON DELETE RESTRICT,
  action text NOT NULL CHECK (action IN ('set', 'revoke')),
  request_hash text NOT NULL,
  status text NOT NULL CHECK (status IN ('processing', 'completed')),
  response jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX platform_user_action_requests_target_idx
  ON public.platform_user_action_requests (target_user_id, created_at DESC);
CREATE INDEX platform_membership_action_requests_target_idx
  ON public.platform_membership_action_requests (organization_id, target_user_id, created_at DESC);

ALTER TABLE public.platform_user_action_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.platform_membership_action_requests ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.platform_user_action_requests FROM PUBLIC, anon, authenticated;
REVOKE ALL ON TABLE public.platform_membership_action_requests FROM PUBLIC, anon, authenticated;
GRANT ALL ON TABLE public.platform_user_action_requests TO service_role;
GRANT ALL ON TABLE public.platform_membership_action_requests TO service_role;

CREATE OR REPLACE FUNCTION public.apply_platform_user_action(
  p_actor_user_id uuid,
  p_target_user_id uuid,
  p_action text,
  p_idempotency_key text,
  p_request_hash text
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_claimed integer;
  v_existing public.platform_user_action_requests%ROWTYPE;
  v_old_blocked boolean;
  v_response jsonb;
BEGIN
  IF p_action NOT IN ('block', 'unblock') THEN
    RAISE EXCEPTION 'Acción de usuario inválida';
  END IF;
  IF p_actor_user_id = p_target_user_id THEN
    RAISE EXCEPTION 'No puedes bloquear o desbloquear tu propia cuenta';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM public.users WHERE id = p_target_user_id) THEN
    RAISE EXCEPTION 'Usuario no encontrado';
  END IF;
  IF EXISTS (
    SELECT 1
    FROM public.user_roles ur
    JOIN public.roles r ON r.id = ur.role_id
    WHERE ur.user_id = p_target_user_id AND r.name = 'platform_admin'
  ) THEN
    RAISE EXCEPTION 'Los administradores de plataforma requieren un procedimiento de seguridad separado';
  END IF;

  INSERT INTO public.platform_user_action_requests (
    idempotency_key, actor_user_id, target_user_id, action, request_hash, status
  ) VALUES (
    p_idempotency_key, p_actor_user_id, p_target_user_id, p_action, p_request_hash, 'processing'
  ) ON CONFLICT (idempotency_key) DO NOTHING;
  GET DIAGNOSTICS v_claimed = ROW_COUNT;
  IF v_claimed = 0 THEN
    SELECT * INTO v_existing
    FROM public.platform_user_action_requests
    WHERE idempotency_key = p_idempotency_key
    FOR UPDATE;
    IF v_existing.actor_user_id <> p_actor_user_id OR v_existing.request_hash <> p_request_hash THEN
      RAISE EXCEPTION 'La clave de idempotencia ya fue usada para otra solicitud';
    END IF;
    IF v_existing.status = 'completed' AND v_existing.response IS NOT NULL THEN
      RETURN v_existing.response;
    END IF;
    RAISE EXCEPTION 'La solicitud ya se está procesando';
  END IF;

  SELECT is_blocked INTO v_old_blocked FROM public.users WHERE id = p_target_user_id FOR UPDATE;
  UPDATE public.users
  SET is_blocked = (p_action = 'block'), updated_at = pg_catalog.now()
  WHERE id = p_target_user_id;

  v_response := pg_catalog.jsonb_build_object(
    'data', pg_catalog.jsonb_build_object(
      'userId', p_target_user_id,
      'isBlocked', (p_action = 'block')
    )
  );

  INSERT INTO public.platform_audit_logs (
    actor_user_id, action, auditable_type, auditable_id, old_values, new_values
  ) VALUES (
    p_actor_user_id,
    'user_' || p_action,
    'users',
    p_target_user_id,
    pg_catalog.jsonb_build_object('is_blocked', v_old_blocked),
    pg_catalog.jsonb_build_object('is_blocked', (p_action = 'block'))
  );

  UPDATE public.platform_user_action_requests
  SET status = 'completed', response = v_response, updated_at = pg_catalog.now()
  WHERE idempotency_key = p_idempotency_key;
  RETURN v_response;
END;
$$;

CREATE OR REPLACE FUNCTION public.apply_platform_membership_action(
  p_actor_user_id uuid,
  p_organization_id uuid,
  p_target_user_id uuid,
  p_action text,
  p_role_ids uuid[],
  p_idempotency_key text,
  p_request_hash text
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_claimed integer;
  v_existing_request public.platform_membership_action_requests%ROWTYPE;
  v_old_role_ids jsonb;
  v_new_role_ids jsonb;
  v_existing_admin_count integer;
  v_resulting_admin_count integer;
  v_target_is_admin boolean;
  v_requested_admin boolean := false;
  v_target_is_member boolean;
  v_response jsonb;
BEGIN
  IF p_action NOT IN ('set', 'revoke') THEN
    RAISE EXCEPTION 'Acción de membresía inválida';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM public.organizations WHERE id = p_organization_id) THEN
    RAISE EXCEPTION 'Organización no encontrada';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM public.users WHERE id = p_target_user_id) THEN
    RAISE EXCEPTION 'Usuario no encontrado';
  END IF;
  IF p_action = 'set' AND COALESCE(pg_catalog.array_length(p_role_ids, 1), 0) = 0 THEN
    RAISE EXCEPTION 'La lista de roles no puede estar vacía';
  END IF;
  IF p_action = 'set' AND (
    SELECT count(*) FROM pg_catalog.unnest(p_role_ids) AS requested(role_id)
  ) <> (
    SELECT count(DISTINCT role_id) FROM pg_catalog.unnest(p_role_ids) AS requested(role_id)
  ) THEN
    RAISE EXCEPTION 'La lista de roles contiene duplicados';
  END IF;
  IF p_action = 'set' AND EXISTS (
    SELECT 1
    FROM pg_catalog.unnest(p_role_ids) AS requested(role_id)
    LEFT JOIN public.roles r ON r.id = requested.role_id
    WHERE r.id IS NULL OR r.name = 'platform_admin'
  ) THEN
    RAISE EXCEPTION 'Rol inválido para una membresía de restaurante';
  END IF;

  INSERT INTO public.platform_membership_action_requests (
    idempotency_key, actor_user_id, organization_id, target_user_id, action, request_hash, status
  ) VALUES (
    p_idempotency_key, p_actor_user_id, p_organization_id, p_target_user_id, p_action, p_request_hash, 'processing'
  ) ON CONFLICT (idempotency_key) DO NOTHING;
  GET DIAGNOSTICS v_claimed = ROW_COUNT;
  IF v_claimed = 0 THEN
    SELECT * INTO v_existing_request
    FROM public.platform_membership_action_requests
    WHERE idempotency_key = p_idempotency_key
    FOR UPDATE;
    IF v_existing_request.actor_user_id <> p_actor_user_id OR v_existing_request.request_hash <> p_request_hash THEN
      RAISE EXCEPTION 'La clave de idempotencia ya fue usada para otra solicitud';
    END IF;
    IF v_existing_request.status = 'completed' AND v_existing_request.response IS NOT NULL THEN
      RETURN v_existing_request.response;
    END IF;
    RAISE EXCEPTION 'La solicitud ya se está procesando';
  END IF;

  -- Lock the organization membership set so concurrent changes cannot remove
  -- the last administrator at the same time.
  PERFORM 1
  FROM public.organization_members om
  WHERE om.organization_id = p_organization_id
  ORDER BY om.user_id, om.role_id
  FOR UPDATE;

  SELECT EXISTS (
    SELECT 1 FROM public.organization_members
    WHERE organization_id = p_organization_id AND user_id = p_target_user_id
  ) INTO v_target_is_member;
  IF p_action = 'revoke' AND NOT v_target_is_member THEN
    RAISE EXCEPTION 'El usuario no pertenece a esta organización';
  END IF;

  SELECT count(*)::integer INTO v_existing_admin_count
  FROM public.organization_members om
  JOIN public.roles r ON r.id = om.role_id
  WHERE om.organization_id = p_organization_id AND r.name = 'admin';

  SELECT EXISTS (
    SELECT 1
    FROM public.organization_members om
    JOIN public.roles r ON r.id = om.role_id
    WHERE om.organization_id = p_organization_id AND om.user_id = p_target_user_id AND r.name = 'admin'
  ) INTO v_target_is_admin;

  IF p_action = 'set' THEN
    SELECT EXISTS (
      SELECT 1 FROM pg_catalog.unnest(p_role_ids) AS requested(role_id)
      JOIN public.roles r ON r.id = requested.role_id
      WHERE r.name = 'admin'
    ) INTO v_requested_admin;
  END IF;

  v_resulting_admin_count := v_existing_admin_count;
  IF v_target_is_admin THEN v_resulting_admin_count := v_resulting_admin_count - 1; END IF;
  IF v_requested_admin THEN v_resulting_admin_count := v_resulting_admin_count + 1; END IF;
  IF v_resulting_admin_count < 1 THEN
    RAISE EXCEPTION 'La organización debe conservar al menos un administrador';
  END IF;

  SELECT COALESCE(pg_catalog.jsonb_agg(om.role_id ORDER BY om.role_id), '[]'::jsonb)
  INTO v_old_role_ids
  FROM public.organization_members om
  WHERE om.organization_id = p_organization_id AND om.user_id = p_target_user_id;

  DELETE FROM public.organization_members
  WHERE organization_id = p_organization_id AND user_id = p_target_user_id;

  IF p_action = 'set' THEN
    INSERT INTO public.organization_members (organization_id, user_id, role_id, is_default)
    SELECT p_organization_id, p_target_user_id, requested.role_id, requested.ordinality = 1
    FROM pg_catalog.unnest(p_role_ids) WITH ORDINALITY AS requested(role_id, ordinality);
  END IF;

  SELECT COALESCE(pg_catalog.jsonb_agg(om.role_id ORDER BY om.role_id), '[]'::jsonb)
  INTO v_new_role_ids
  FROM public.organization_members om
  WHERE om.organization_id = p_organization_id AND om.user_id = p_target_user_id;

  INSERT INTO public.platform_audit_logs (
    actor_user_id, action, auditable_type, auditable_id, old_values, new_values
  ) VALUES (
    p_actor_user_id,
    'membership_' || p_action,
    'organization_members',
    p_target_user_id,
    pg_catalog.jsonb_build_object('organization_id', p_organization_id, 'role_ids', v_old_role_ids),
    pg_catalog.jsonb_build_object('organization_id', p_organization_id, 'role_ids', v_new_role_ids)
  );

  v_response := pg_catalog.jsonb_build_object(
    'data', pg_catalog.jsonb_build_object(
      'organizationId', p_organization_id,
      'userId', p_target_user_id,
      'roleIds', v_new_role_ids,
      'action', p_action
    )
  );
  UPDATE public.platform_membership_action_requests
  SET status = 'completed', response = v_response, updated_at = pg_catalog.now()
  WHERE idempotency_key = p_idempotency_key;
  RETURN v_response;
END;
$$;

REVOKE ALL ON FUNCTION public.apply_platform_user_action(uuid, uuid, text, text, text) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.apply_platform_membership_action(uuid, uuid, uuid, text, uuid[], text, text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.apply_platform_user_action(uuid, uuid, text, text, text) TO service_role;
GRANT EXECUTE ON FUNCTION public.apply_platform_membership_action(uuid, uuid, uuid, text, uuid[], text, text) TO service_role;
