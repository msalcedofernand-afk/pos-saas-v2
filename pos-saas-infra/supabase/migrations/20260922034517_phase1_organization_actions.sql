-- Keep organization lifecycle mutations atomic: state, idempotency and audit
-- are committed together and a failed request rolls back its claim.
CREATE OR REPLACE FUNCTION public.apply_platform_organization_action(
  p_actor_user_id uuid,
  p_organization_id uuid,
  p_action text,
  p_idempotency_key text,
  p_request_hash text,
  p_name text DEFAULT NULL,
  p_reason text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_existing public.platform_organization_action_requests%ROWTYPE;
  v_organization public.organizations%ROWTYPE;
  v_old_values jsonb;
  v_new_values jsonb;
  v_response jsonb;
  v_audit_action text;
  v_changed boolean := false;
  v_final_name text;
  v_final_status text;
  v_final_is_active boolean;
  v_final_suspended_at timestamptz;
  v_final_suspension_reason text;
BEGIN
  IF p_action NOT IN ('update', 'suspend', 'reactivate') THEN
    RAISE EXCEPTION USING errcode = 'P0001', message = 'Acción de organización inválida';
  END IF;

  SELECT * INTO v_existing
  FROM public.platform_organization_action_requests
  WHERE idempotency_key = p_idempotency_key
  FOR UPDATE;

  IF FOUND THEN
    IF v_existing.actor_user_id <> p_actor_user_id
       OR v_existing.organization_id <> p_organization_id
       OR v_existing.action <> p_action
       OR v_existing.request_hash <> p_request_hash THEN
      RAISE EXCEPTION USING errcode = 'P0001', message = 'La clave de idempotencia ya fue usada para otra acción';
    END IF;
    IF v_existing.status = 'completed' AND v_existing.response IS NOT NULL THEN
      RETURN v_existing.response || jsonb_build_object('meta', jsonb_build_object('replayed', true));
    END IF;
    RAISE EXCEPTION USING errcode = 'P0001', message = 'La acción ya se está procesando';
  END IF;

  INSERT INTO public.platform_organization_action_requests (
    idempotency_key, actor_user_id, organization_id, action, request_hash, status
  ) VALUES (
    p_idempotency_key, p_actor_user_id, p_organization_id, p_action, p_request_hash, 'processing'
  );

  SELECT * INTO v_organization
  FROM public.organizations
  WHERE id = p_organization_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION USING errcode = 'P0001', message = 'Organización no encontrada';
  END IF;

  v_final_name := v_organization.name;
  v_final_status := v_organization.status;
  v_final_is_active := v_organization.is_active;
  v_final_suspended_at := v_organization.suspended_at;
  v_final_suspension_reason := v_organization.suspension_reason;

  v_old_values := jsonb_build_object(
    'name', v_organization.name,
    'slug', v_organization.slug,
    'status', v_organization.status,
    'is_active', v_organization.is_active,
    'suspended_at', v_organization.suspended_at,
    'suspended_by', v_organization.suspended_by,
    'suspension_reason', v_organization.suspension_reason
  );

  IF p_action = 'update' THEN
    IF p_name IS NULL OR length(btrim(p_name)) < 2 OR length(btrim(p_name)) > 120 THEN
      RAISE EXCEPTION USING errcode = 'P0001', message = 'El nombre de la organización no es válido';
    END IF;
    v_final_name := btrim(p_name);
    v_changed := v_organization.name IS DISTINCT FROM v_final_name;
    IF v_changed THEN
      UPDATE public.organizations
      SET name = v_final_name, last_activity_at = now()
      WHERE id = p_organization_id;
    END IF;
    v_audit_action := 'organization_updated';
  ELSIF p_action = 'suspend' THEN
    IF p_reason IS NULL OR length(btrim(p_reason)) < 3 OR length(btrim(p_reason)) > 500 THEN
      RAISE EXCEPTION USING errcode = 'P0001', message = 'Debes indicar un motivo de suspensión';
    END IF;
    v_final_status := 'suspended';
    v_final_is_active := false;
    v_final_suspension_reason := btrim(p_reason);
    v_changed := v_organization.status <> 'suspended' OR v_organization.is_active;
    IF v_changed THEN
      v_final_suspended_at := now();
      UPDATE public.organizations
      SET status = v_final_status,
          is_active = v_final_is_active,
          suspended_at = v_final_suspended_at,
          suspended_by = p_actor_user_id,
          suspension_reason = v_final_suspension_reason,
          last_activity_at = now()
      WHERE id = p_organization_id;
    END IF;
    v_audit_action := 'organization_suspended';
  ELSE
    v_final_status := 'active';
    v_final_is_active := true;
    v_final_suspended_at := NULL;
    v_final_suspension_reason := NULL;
    v_changed := v_organization.status <> 'active' OR NOT v_organization.is_active;
    IF v_changed THEN
      UPDATE public.organizations
      SET status = v_final_status,
          is_active = v_final_is_active,
          suspended_at = NULL,
          suspended_by = NULL,
          suspension_reason = NULL,
          last_activity_at = now()
      WHERE id = p_organization_id;
    END IF;
    v_audit_action := 'organization_reactivated';
  END IF;

  v_new_values := jsonb_build_object(
    'name', v_final_name,
    'slug', v_organization.slug,
    'status', v_final_status,
    'is_active', v_final_is_active,
    'suspended_at', v_final_suspended_at,
    'suspension_reason', v_final_suspension_reason
  );

  IF v_changed THEN
    INSERT INTO public.platform_audit_logs (
      actor_user_id, action, auditable_type, auditable_id, old_values, new_values
    ) VALUES (
      p_actor_user_id, v_audit_action, 'organizations', p_organization_id, v_old_values, v_new_values
    );
  END IF;

  v_response := jsonb_build_object(
    'data', jsonb_build_object(
      'organization', jsonb_build_object(
        'id', v_organization.id,
        'name', v_final_name,
        'slug', v_organization.slug,
        'status', v_final_status,
        'is_active', v_final_is_active,
        'suspended_at', v_final_suspended_at,
        'suspension_reason', v_final_suspension_reason
      ),
      'changed', v_changed
    )
  );

  UPDATE public.platform_organization_action_requests
  SET status = 'completed', response = v_response, updated_at = now()
  WHERE idempotency_key = p_idempotency_key;

  RETURN v_response;
END;
$$;

REVOKE ALL ON FUNCTION public.apply_platform_organization_action(uuid, uuid, text, text, text, text, text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.apply_platform_organization_action(uuid, uuid, text, text, text, text, text) TO service_role;
