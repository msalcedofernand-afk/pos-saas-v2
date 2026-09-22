BEGIN;
SET LOCAL search_path = public, extensions;
SELECT plan(1);
DO $$
DECLARE
  applicant uuid := gen_random_uuid();
  unconfirmed uuid := gen_random_uuid();
  owner_id uuid := gen_random_uuid();
  supporter uuid := gen_random_uuid();
  org uuid;
  repeated uuid;
BEGIN
  INSERT INTO auth.users(id,email,aud,role,email_confirmed_at) VALUES
    (applicant,applicant::text||'@example.test','authenticated','authenticated',now()),
    (unconfirmed,unconfirmed::text||'@example.test','authenticated','authenticated',NULL),
    (owner_id,owner_id::text||'@example.test','authenticated','authenticated',now()),
    (supporter,supporter::text||'@example.test','authenticated','authenticated',now());
  INSERT INTO public.user_roles(user_id,role_id) SELECT owner_id,id FROM public.roles WHERE name='platform_owner';
  EXECUTE 'SET LOCAL ROLE service_role';
  BEGIN
    PERFORM public.register_restaurant(unconfirmed,'Unconfirmed restaurant');
    RAISE EXCEPTION 'Unconfirmed registration was accepted';
  EXCEPTION WHEN insufficient_privilege THEN NULL;
  END;
  org := public.register_restaurant(applicant,'Registration test');
  repeated := public.register_restaurant(applicant,'Registration retry');
  IF org IS DISTINCT FROM repeated THEN RAISE EXCEPTION 'Registration retry created a second restaurant'; END IF;
  IF NOT EXISTS(SELECT 1 FROM public.organizations WHERE id=org AND status='pending' AND NOT is_active) THEN RAISE EXCEPTION 'Restaurant was activated without approval'; END IF;
  BEGIN
    INSERT INTO public.organization_members(organization_id,user_id,role_id)
    SELECT org,applicant,id FROM public.roles WHERE name='platform_owner';
    RAISE EXCEPTION 'Global role accepted inside a tenant';
  EXCEPTION WHEN check_violation THEN NULL;
  END;
  PERFORM public.set_platform_role(owner_id,supporter,'support_agent',true);
  BEGIN
    PERFORM public.set_platform_role(supporter,applicant,'platform_admin',true);
    RAISE EXCEPTION 'Support privilege escalation was accepted';
  EXCEPTION WHEN insufficient_privilege THEN NULL;
  END;
  BEGIN
    PERFORM public.set_platform_role(owner_id,supporter,'platform_owner',true);
    RAISE EXCEPTION 'Owner role was exposed through ordinary role management';
  EXCEPTION WHEN invalid_parameter_value THEN NULL;
  END;
  PERFORM public.set_platform_role(owner_id,supporter,'support_agent',false);
  IF EXISTS(SELECT 1 FROM public.user_roles WHERE user_id=supporter) THEN RAISE EXCEPTION 'Revocation failed'; END IF;
  IF NOT EXISTS(SELECT 1 FROM public.platform_audit_logs WHERE actor_user_id=owner_id AND action='global_role_changed') THEN RAISE EXCEPTION 'Role change was not audited'; END IF;
  EXECUTE 'RESET ROLE';
END; $$;
SELECT pass('Verified registration, pending status, retries, tenant boundary, owner grants, support denial and revocation');
SELECT * FROM finish();
ROLLBACK;
