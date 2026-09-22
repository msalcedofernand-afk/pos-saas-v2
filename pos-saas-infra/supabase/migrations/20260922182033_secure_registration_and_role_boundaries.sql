-- Prevent tenant membership rows from ever conferring global permissions.
CREATE FUNCTION public.enforce_tenant_role_boundary() RETURNS trigger
LANGUAGE plpgsql SECURITY INVOKER SET search_path = '' AS $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM public.roles WHERE id = NEW.role_id AND name IN ('admin','manager','cashier','kitchen','waiter','staff')) THEN
    RAISE EXCEPTION 'Solo se permiten roles internos del restaurante' USING ERRCODE = '23514';
  END IF;
  RETURN NEW;
END; $$;

CREATE FUNCTION public.add_restaurant_worker(p_actor uuid,p_organization uuid,p_target uuid,p_role text) RETURNS void
LANGUAGE plpgsql SECURITY INVOKER SET search_path = '' AS $$
DECLARE v_role uuid;
BEGIN
  PERFORM 1 FROM public.organizations WHERE id=p_organization AND is_active FOR UPDATE;
  IF NOT FOUND OR NOT EXISTS(SELECT 1 FROM public.organization_members m JOIN public.roles r ON r.id=m.role_id WHERE m.user_id=p_actor AND m.organization_id=p_organization AND r.name='admin') THEN
    RAISE EXCEPTION 'No autorizado' USING ERRCODE='42501';
  END IF;
  IF p_role IS NULL OR p_role NOT IN ('manager','cashier','kitchen','waiter','staff') THEN RAISE EXCEPTION 'Rol inválido' USING ERRCODE='22023'; END IF;
  PERFORM 1 FROM public.users WHERE id=p_target AND NOT is_blocked FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Usuario no disponible' USING ERRCODE='42501'; END IF;
  IF EXISTS(SELECT 1 FROM public.user_roles ur JOIN public.roles r ON r.id=ur.role_id WHERE ur.user_id=p_target AND r.name IN ('platform_owner','platform_admin','support_agent','billing_admin','security_auditor')) THEN
    RAISE EXCEPTION 'No se puede invitar una cuenta global como trabajador' USING ERRCODE='42501';
  END IF;
  IF EXISTS(SELECT 1 FROM public.organization_members WHERE user_id=p_target AND organization_id<>p_organization) THEN
    RAISE EXCEPTION 'La cuenta ya pertenece a otro restaurante' USING ERRCODE='42501';
  END IF;
  IF EXISTS(SELECT 1 FROM public.organization_members WHERE user_id=p_target AND organization_id=p_organization) THEN RETURN; END IF;
  SELECT id INTO STRICT v_role FROM public.roles WHERE name=p_role;
  INSERT INTO public.organization_members(organization_id,user_id,role_id,is_default) VALUES(p_organization,p_target,v_role,true);
  INSERT INTO public.audit_logs(organization_id,user_id,action,auditable_type,auditable_id,new_values)
  VALUES(p_organization,p_actor,'worker_invited','users',p_target,jsonb_build_object('role',p_role));
END; $$;
REVOKE ALL ON FUNCTION public.add_restaurant_worker(uuid,uuid,uuid,text) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.add_restaurant_worker(uuid,uuid,uuid,text) TO service_role;
REVOKE ALL ON FUNCTION public.enforce_tenant_role_boundary() FROM PUBLIC, anon, authenticated;
CREATE TRIGGER tenant_role_boundary BEFORE INSERT OR UPDATE OF role_id ON public.organization_members
FOR EACH ROW EXECUTE FUNCTION public.enforce_tenant_role_boundary();

-- One self-service restaurant per verified account; retries return the same result.
CREATE TABLE public.restaurant_registrations (
  user_id uuid PRIMARY KEY REFERENCES public.users(id),
  organization_id uuid NOT NULL UNIQUE REFERENCES public.organizations(id),
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.restaurant_registrations ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.restaurant_registrations FROM anon, authenticated;
GRANT ALL ON public.restaurant_registrations TO service_role;

CREATE FUNCTION public.register_restaurant(p_user_id uuid, p_name text) RETURNS uuid
LANGUAGE plpgsql SECURITY INVOKER SET search_path = '' AS $$
DECLARE v_id uuid; v_role uuid;
BEGIN
  PERFORM 1 FROM public.users WHERE id = p_user_id AND NOT is_blocked FOR UPDATE;
  IF NOT FOUND OR NOT EXISTS (SELECT 1 FROM auth.users WHERE id = p_user_id AND email_confirmed_at IS NOT NULL) THEN
    RAISE EXCEPTION 'Confirma tu correo para continuar' USING ERRCODE = '42501';
  END IF;
  SELECT organization_id INTO v_id FROM public.restaurant_registrations WHERE user_id = p_user_id;
  IF FOUND THEN RETURN v_id; END IF;
  IF EXISTS (SELECT 1 FROM public.organization_members WHERE user_id = p_user_id)
     OR EXISTS (SELECT 1 FROM public.user_roles ur JOIN public.roles r ON r.id = ur.role_id WHERE ur.user_id = p_user_id AND r.name IN ('platform_owner','platform_admin','support_agent','billing_admin','security_auditor')) THEN
    RAISE EXCEPTION 'Esta cuenta ya tiene un acceso asignado' USING ERRCODE = 'P0001';
  END IF;
  IF p_name IS NULL OR length(btrim(p_name)) NOT BETWEEN 2 AND 120 THEN
    RAISE EXCEPTION 'Nombre inválido' USING ERRCODE = '22023';
  END IF;
  SELECT id INTO STRICT v_role FROM public.roles WHERE name = 'admin';
  INSERT INTO public.organizations(name, slug, owner_user_id, status, is_active)
  VALUES (btrim(p_name), 'rest-' || p_user_id::text, p_user_id, 'pending', false) RETURNING id INTO v_id;
  INSERT INTO public.organization_members(organization_id,user_id,role_id,is_default) VALUES(v_id,p_user_id,v_role,true);
  INSERT INTO public.restaurant_registrations(user_id,organization_id) VALUES(p_user_id,v_id);
  INSERT INTO public.platform_audit_logs(actor_user_id,action,auditable_type,auditable_id,new_values)
  VALUES(p_user_id,'restaurant_registration_requested','organizations',v_id,jsonb_build_object('status','pending'));
  RETURN v_id;
END; $$;
REVOKE ALL ON FUNCTION public.register_restaurant(uuid,text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.register_restaurant(uuid,text) TO service_role;

INSERT INTO public.roles(name,display_name) VALUES('manager','Encargado') ON CONFLICT(name) DO NOTHING;

CREATE FUNCTION public.set_platform_role(p_actor uuid,p_target uuid,p_role text,p_grant boolean) RETURNS void
LANGUAGE plpgsql SECURITY INVOKER SET search_path = '' AS $$
DECLARE v_role uuid;
BEGIN
  -- Serialize global role mutations, including concurrent revocations.
  LOCK TABLE public.user_roles IN SHARE ROW EXCLUSIVE MODE;
  IF NOT EXISTS(SELECT 1 FROM public.user_roles ur JOIN public.roles r ON r.id=ur.role_id JOIN public.users u ON u.id=ur.user_id WHERE ur.user_id=p_actor AND r.name='platform_owner' AND NOT u.is_blocked) THEN
    RAISE EXCEPTION 'Solo el propietario puede gestionar roles globales' USING ERRCODE='42501';
  END IF;
  IF p_actor = p_target OR p_role IS NULL OR p_role NOT IN ('platform_admin','support_agent','billing_admin','security_auditor') THEN
    RAISE EXCEPTION 'Cambio de rol no permitido' USING ERRCODE='22023';
  END IF;
  IF EXISTS(SELECT 1 FROM public.user_roles ur JOIN public.roles r ON r.id=ur.role_id WHERE ur.user_id=p_target AND r.name='platform_owner') THEN
    RAISE EXCEPTION 'No se puede modificar al propietario' USING ERRCODE='42501';
  END IF;
  SELECT id INTO STRICT v_role FROM public.roles WHERE name=p_role;
  IF p_grant THEN INSERT INTO public.user_roles(user_id,role_id) VALUES(p_target,v_role) ON CONFLICT DO NOTHING;
  ELSE DELETE FROM public.user_roles WHERE user_id=p_target AND role_id=v_role; END IF;
  INSERT INTO public.platform_audit_logs(actor_user_id,action,auditable_type,auditable_id,new_values)
  VALUES(p_actor,'global_role_changed','users',p_target,jsonb_build_object('role',p_role,'granted',p_grant));
END; $$;
REVOKE ALL ON FUNCTION public.set_platform_role(uuid,uuid,text,boolean) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.set_platform_role(uuid,uuid,text,boolean) TO service_role;

-- Extend only the existing explicit administrator predicates; preserve the
-- transactional implementation, signatures, ACLs and audit behavior.
DO $$
DECLARE f record; definition text;
BEGIN
  FOR f IN SELECT p.oid, p.proname FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace
    WHERE n.nspname='public' AND p.proname IN ('set_organization_subscription','get_platform_operational_metrics','list_platform_audit_logs','enable_platform_support_write','create_platform_support_access','revoke_platform_support_access','apply_platform_user_action')
  LOOP
    definition := pg_get_functiondef(f.oid);
    IF f.proname IN ('create_platform_support_access','revoke_platform_support_access') THEN
      definition := replace(definition, 'r.name = ''platform_admin''', 'r.name IN (''platform_admin'',''platform_owner'',''support_agent'')');
    ELSE
      definition := replace(definition, 'r.name = ''platform_admin''', 'r.name IN (''platform_admin'',''platform_owner'')');
    END IF;
    IF f.proname='revoke_platform_support_access' THEN
      definition := replace(definition, 'IF v_access.revoke_idempotency_key = p_idempotency_key THEN',
        'IF v_access.actor_user_id <> p_actor_user_id AND NOT EXISTS(SELECT 1 FROM public.user_roles ur JOIN public.roles r ON r.id=ur.role_id WHERE ur.user_id=p_actor_user_id AND r.name IN (''platform_owner'',''platform_admin'')) THEN RAISE EXCEPTION ''No autorizado'' USING ERRCODE=''42501''; END IF; IF v_access.revoke_idempotency_key = p_idempotency_key THEN');
    END IF;
    EXECUTE definition;
  END LOOP;
END; $$;
