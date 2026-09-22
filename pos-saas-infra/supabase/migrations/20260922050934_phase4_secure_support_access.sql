-- Phase 4: temporary, auditable support access for platform administrators.
-- Access is server-only. The API validates the current grant on every
-- organization-scoped request and never trusts browser metadata for access.

CREATE TABLE public.platform_support_access_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  actor_user_id uuid NOT NULL REFERENCES public.users(id) ON DELETE RESTRICT,
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE RESTRICT,
  reason text NOT NULL CHECK (char_length(btrim(reason)) BETWEEN 10 AND 1000),
  duration_minutes integer NOT NULL CHECK (duration_minutes BETWEEN 15 AND 480),
  mode text NOT NULL DEFAULT 'read_only' CHECK (mode IN ('read_only', 'write')),
  status text NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'revoked', 'expired')),
  idempotency_key text NOT NULL,
  request_hash text NOT NULL,
  requested_at timestamptz NOT NULL DEFAULT now(),
  starts_at timestamptz NOT NULL DEFAULT now(),
  expires_at timestamptz NOT NULL,
  entered_at timestamptz,
  write_enabled_at timestamptz,
  write_enabled_by uuid REFERENCES public.users(id) ON DELETE RESTRICT,
  revoked_at timestamptz,
  revoked_by uuid REFERENCES public.users(id) ON DELETE RESTRICT,
  revoke_reason text,
  write_idempotency_key text,
  write_request_hash text,
  write_response jsonb,
  revoke_idempotency_key text,
  revoke_request_hash text,
  revoke_response jsonb,
  response jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (actor_user_id, idempotency_key)
);

CREATE INDEX platform_support_access_actor_status_idx
  ON public.platform_support_access_requests (actor_user_id, status, expires_at DESC);

CREATE INDEX platform_support_access_organization_idx
  ON public.platform_support_access_requests (organization_id, status, expires_at DESC);

ALTER TABLE public.platform_support_access_requests ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.platform_support_access_requests FROM anon, authenticated;
GRANT ALL ON TABLE public.platform_support_access_requests TO service_role;

CREATE OR REPLACE FUNCTION public.expire_platform_support_access_sessions()
RETURNS integer
LANGUAGE plpgsql
VOLATILE
SECURITY INVOKER
SET search_path = ''
AS $$
DECLARE
  v_expired integer := 0;
  v_access record;
BEGIN
  FOR v_access IN
    SELECT id, actor_user_id, organization_id, mode, expires_at
    FROM public.platform_support_access_requests
    WHERE status = 'active'
      AND expires_at <= now()
    FOR UPDATE
  LOOP
    UPDATE public.platform_support_access_requests
    SET status = 'expired', updated_at = now()
    WHERE id = v_access.id;

    INSERT INTO public.platform_audit_logs (
      actor_user_id, action, auditable_type, auditable_id, new_values
    ) VALUES (
      v_access.actor_user_id,
      'support_access_expired',
      'support_access',
      v_access.id,
      jsonb_build_object(
        'organization_id', v_access.organization_id,
        'mode', v_access.mode,
        'expires_at', v_access.expires_at
      )
    );
    v_expired := v_expired + 1;
  END LOOP;
  RETURN v_expired;
END;
$$;

CREATE OR REPLACE FUNCTION public.create_platform_support_access(
  p_actor_user_id uuid,
  p_organization_id uuid,
  p_reason text,
  p_duration_minutes integer,
  p_idempotency_key text,
  p_request_hash text
)
RETURNS jsonb
LANGUAGE plpgsql
VOLATILE
SECURITY INVOKER
SET search_path = ''
AS $$
DECLARE
  v_existing public.platform_support_access_requests%ROWTYPE;
  v_access public.platform_support_access_requests%ROWTYPE;
  v_organization public.organizations%ROWTYPE;
  v_response jsonb;
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM public.user_roles ur
    JOIN public.roles r ON r.id = ur.role_id
    WHERE ur.user_id = p_actor_user_id AND r.name = 'platform_admin'
  ) THEN
    RAISE EXCEPTION 'No autorizado' USING ERRCODE = '42501';
  END IF;
  IF char_length(btrim(coalesce(p_reason, ''))) NOT BETWEEN 10 AND 1000 THEN
    RAISE EXCEPTION 'El motivo debe tener entre 10 y 1000 caracteres' USING ERRCODE = '22023';
  END IF;
  IF p_duration_minutes NOT BETWEEN 15 AND 480 THEN
    RAISE EXCEPTION 'La duración debe estar entre 15 y 480 minutos' USING ERRCODE = '22023';
  END IF;
  IF char_length(btrim(coalesce(p_idempotency_key, ''))) < 16 THEN
    RAISE EXCEPTION 'Falta una clave de idempotencia válida' USING ERRCODE = '22023';
  END IF;

  SELECT * INTO v_existing
  FROM public.platform_support_access_requests
  WHERE actor_user_id = p_actor_user_id AND idempotency_key = p_idempotency_key;
  IF v_existing.id IS NOT NULL THEN
    IF v_existing.request_hash <> p_request_hash THEN
      RAISE EXCEPTION 'La clave de idempotencia ya fue usada para otra solicitud' USING ERRCODE = '23505';
    END IF;
    RETURN v_existing.response;
  END IF;

  SELECT * INTO v_organization
  FROM public.organizations
  WHERE id = p_organization_id AND is_active = true;
  IF v_organization.id IS NULL THEN
    RAISE EXCEPTION 'Organización no disponible' USING ERRCODE = 'P0001';
  END IF;

  INSERT INTO public.platform_support_access_requests (
    actor_user_id, organization_id, reason, duration_minutes, mode,
    idempotency_key, request_hash, expires_at
  ) VALUES (
    p_actor_user_id, p_organization_id, btrim(p_reason), p_duration_minutes, 'read_only',
    p_idempotency_key, p_request_hash, now() + make_interval(mins => p_duration_minutes)
  ) RETURNING * INTO v_access;

  v_response := jsonb_build_object(
    'data', jsonb_build_object(
      'id', v_access.id,
      'organizationId', v_access.organization_id,
      'organizationName', v_organization.name,
      'organizationSlug', v_organization.slug,
      'reason', v_access.reason,
      'durationMinutes', v_access.duration_minutes,
      'mode', v_access.mode,
      'status', v_access.status,
      'startsAt', v_access.starts_at,
      'expiresAt', v_access.expires_at
    )
  );
  UPDATE public.platform_support_access_requests
  SET response = v_response, updated_at = now()
  WHERE id = v_access.id;

  INSERT INTO public.platform_audit_logs (
    actor_user_id, action, auditable_type, auditable_id, new_values
  ) VALUES (
    p_actor_user_id,
    'support_access_requested',
    'support_access',
    v_access.id,
    jsonb_build_object(
      'organization_id', v_access.organization_id,
      'reason', v_access.reason,
      'duration_minutes', v_access.duration_minutes,
      'mode', v_access.mode,
      'expires_at', v_access.expires_at
    )
  );
  RETURN v_response;
END;
$$;

CREATE OR REPLACE FUNCTION public.mark_platform_support_access_entered(
  p_actor_user_id uuid,
  p_access_id uuid,
  p_organization_id uuid
)
RETURNS boolean
LANGUAGE plpgsql
VOLATILE
SECURITY INVOKER
SET search_path = ''
AS $$
DECLARE
  v_access public.platform_support_access_requests%ROWTYPE;
BEGIN
  UPDATE public.platform_support_access_requests
  SET entered_at = now(), updated_at = now()
  WHERE id = p_access_id
    AND actor_user_id = p_actor_user_id
    AND organization_id = p_organization_id
    AND status = 'active'
    AND expires_at > now()
    AND entered_at IS NULL
  RETURNING * INTO v_access;

  IF v_access.id IS NULL THEN RETURN false; END IF;

  INSERT INTO public.platform_audit_logs (
    actor_user_id, action, auditable_type, auditable_id, new_values
  ) VALUES (
    p_actor_user_id,
    'support_access_entered',
    'support_access',
    p_access_id,
    jsonb_build_object(
      'organization_id', p_organization_id,
      'mode', v_access.mode,
      'expires_at', v_access.expires_at
    )
  );
  RETURN true;
END;
$$;

CREATE OR REPLACE FUNCTION public.enable_platform_support_write(
  p_actor_user_id uuid,
  p_access_id uuid,
  p_confirmation text,
  p_idempotency_key text,
  p_request_hash text
)
RETURNS jsonb
LANGUAGE plpgsql
VOLATILE
SECURITY INVOKER
SET search_path = ''
AS $$
DECLARE
  v_access public.platform_support_access_requests%ROWTYPE;
  v_response jsonb;
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM public.user_roles ur
    JOIN public.roles r ON r.id = ur.role_id
    WHERE ur.user_id = p_actor_user_id AND r.name = 'platform_admin'
  ) THEN
    RAISE EXCEPTION 'No autorizado' USING ERRCODE = '42501';
  END IF;
  IF p_confirmation <> 'CONFIRMAR_ACCESO_ESCRITURA' THEN
    RAISE EXCEPTION 'Debes confirmar explícitamente el acceso de escritura' USING ERRCODE = '22023';
  END IF;
  SELECT * INTO v_access FROM public.platform_support_access_requests
  WHERE id = p_access_id AND actor_user_id = p_actor_user_id;
  IF v_access.id IS NULL THEN RAISE EXCEPTION 'Acceso de soporte no encontrado' USING ERRCODE = 'P0001'; END IF;
  IF v_access.write_idempotency_key = p_idempotency_key THEN
    IF v_access.write_request_hash <> p_request_hash THEN
      RAISE EXCEPTION 'La clave de idempotencia ya fue usada para otra solicitud' USING ERRCODE = '23505';
    END IF;
    RETURN v_access.write_response;
  END IF;
  IF v_access.status <> 'active' OR v_access.expires_at <= now() THEN
    RAISE EXCEPTION 'El acceso de soporte ya no está activo' USING ERRCODE = 'P0001';
  END IF;

  UPDATE public.platform_support_access_requests
  SET mode = 'write', write_enabled_at = coalesce(write_enabled_at, now()),
      write_enabled_by = p_actor_user_id, write_idempotency_key = p_idempotency_key,
      write_request_hash = p_request_hash, updated_at = now()
  WHERE id = p_access_id
  RETURNING * INTO v_access;
  v_response := jsonb_build_object('data', jsonb_build_object(
    'id', v_access.id, 'organizationId', v_access.organization_id,
    'mode', v_access.mode, 'status', v_access.status,
    'startsAt', v_access.starts_at, 'expiresAt', v_access.expires_at
  ));
  UPDATE public.platform_support_access_requests SET write_response = v_response WHERE id = v_access.id;
  INSERT INTO public.platform_audit_logs (actor_user_id, action, auditable_type, auditable_id, new_values)
  VALUES (p_actor_user_id, 'support_access_write_enabled', 'support_access', p_access_id,
    jsonb_build_object('organization_id', v_access.organization_id, 'confirmation', 'explicit', 'expires_at', v_access.expires_at));
  RETURN v_response;
END;
$$;

CREATE OR REPLACE FUNCTION public.revoke_platform_support_access(
  p_actor_user_id uuid,
  p_access_id uuid,
  p_reason text,
  p_idempotency_key text,
  p_request_hash text
)
RETURNS jsonb
LANGUAGE plpgsql
VOLATILE
SECURITY INVOKER
SET search_path = ''
AS $$
DECLARE
  v_access public.platform_support_access_requests%ROWTYPE;
  v_response jsonb;
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM public.user_roles ur
    JOIN public.roles r ON r.id = ur.role_id
    WHERE ur.user_id = p_actor_user_id AND r.name = 'platform_admin'
  ) THEN
    RAISE EXCEPTION 'No autorizado' USING ERRCODE = '42501';
  END IF;
  IF char_length(btrim(coalesce(p_reason, ''))) NOT BETWEEN 5 AND 500 THEN
    RAISE EXCEPTION 'El motivo de revocación es obligatorio' USING ERRCODE = '22023';
  END IF;
  SELECT * INTO v_access FROM public.platform_support_access_requests WHERE id = p_access_id;
  IF v_access.id IS NULL THEN RAISE EXCEPTION 'Acceso de soporte no encontrado' USING ERRCODE = 'P0001'; END IF;
  IF v_access.revoke_idempotency_key = p_idempotency_key THEN
    IF v_access.revoke_request_hash <> p_request_hash THEN
      RAISE EXCEPTION 'La clave de idempotencia ya fue usada para otra solicitud' USING ERRCODE = '23505';
    END IF;
    RETURN v_access.revoke_response;
  END IF;

  IF v_access.status = 'active' THEN
    UPDATE public.platform_support_access_requests
    SET status = 'revoked', revoked_at = now(), revoked_by = p_actor_user_id,
        revoke_reason = btrim(p_reason), revoke_idempotency_key = p_idempotency_key,
        revoke_request_hash = p_request_hash, updated_at = now()
    WHERE id = p_access_id
    RETURNING * INTO v_access;
    INSERT INTO public.platform_audit_logs (actor_user_id, action, auditable_type, auditable_id, new_values)
    VALUES (p_actor_user_id, 'support_access_revoked', 'support_access', p_access_id,
      jsonb_build_object('organization_id', v_access.organization_id, 'reason', v_access.revoke_reason));
  ELSE
    UPDATE public.platform_support_access_requests
    SET revoke_idempotency_key = p_idempotency_key, revoke_request_hash = p_request_hash, updated_at = now()
    WHERE id = p_access_id
    RETURNING * INTO v_access;
  END IF;

  v_response := jsonb_build_object('data', jsonb_build_object(
    'id', v_access.id, 'organizationId', v_access.organization_id,
    'mode', v_access.mode, 'status', v_access.status,
    'revokedAt', v_access.revoked_at, 'expiresAt', v_access.expires_at
  ));
  UPDATE public.platform_support_access_requests SET revoke_response = v_response WHERE id = v_access.id;
  RETURN v_response;
END;
$$;

REVOKE ALL ON FUNCTION public.expire_platform_support_access_sessions() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.create_platform_support_access(uuid, uuid, text, integer, text, text) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.mark_platform_support_access_entered(uuid, uuid, uuid) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.enable_platform_support_write(uuid, uuid, text, text, text) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.revoke_platform_support_access(uuid, uuid, text, text, text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.expire_platform_support_access_sessions() TO service_role;
GRANT EXECUTE ON FUNCTION public.create_platform_support_access(uuid, uuid, text, integer, text, text) TO service_role;
GRANT EXECUTE ON FUNCTION public.mark_platform_support_access_entered(uuid, uuid, uuid) TO service_role;
GRANT EXECUTE ON FUNCTION public.enable_platform_support_write(uuid, uuid, text, text, text) TO service_role;
GRANT EXECUTE ON FUNCTION public.revoke_platform_support_access(uuid, uuid, text, text, text) TO service_role;
