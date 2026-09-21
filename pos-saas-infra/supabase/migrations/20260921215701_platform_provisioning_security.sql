-- Administrative actions are not tenant audit events: they may target a new
-- organization that has no operational rows yet. Keep them in a separate
-- server-only audit table instead of weakening audit_logs.organization_id.
CREATE TABLE public.platform_audit_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  actor_user_id uuid NOT NULL REFERENCES public.users(id) ON DELETE RESTRICT,
  action text NOT NULL,
  auditable_type text NOT NULL,
  auditable_id uuid,
  old_values jsonb,
  new_values jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX platform_audit_logs_actor_created_idx
  ON public.platform_audit_logs (actor_user_id, created_at DESC);
CREATE INDEX platform_audit_logs_target_idx
  ON public.platform_audit_logs (auditable_type, auditable_id);

ALTER TABLE public.platform_audit_logs ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.platform_audit_logs FROM anon, authenticated;
GRANT ALL ON TABLE public.platform_audit_logs TO service_role;

-- Claim requests make the onboarding endpoint safe to retry from a browser
-- and prevent double-clicks from creating duplicate Auth users or tenants.
CREATE TABLE public.platform_provisioning_requests (
  idempotency_key text PRIMARY KEY CHECK (length(idempotency_key) BETWEEN 16 AND 128),
  actor_user_id uuid NOT NULL REFERENCES public.users(id) ON DELETE RESTRICT,
  request_hash text NOT NULL,
  status text NOT NULL CHECK (status IN ('processing', 'completed')),
  organization_id uuid REFERENCES public.organizations(id) ON DELETE SET NULL,
  response jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX platform_provisioning_requests_actor_idx
  ON public.platform_provisioning_requests (actor_user_id, created_at DESC);

ALTER TABLE public.platform_provisioning_requests ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.platform_provisioning_requests FROM anon, authenticated;
GRANT ALL ON TABLE public.platform_provisioning_requests TO service_role;
