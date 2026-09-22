-- Organization lifecycle for the global administration panel.
-- Keep is_active as a compatibility flag for existing operational queries;
-- status is the controlled lifecycle state exposed by the platform API.
ALTER TABLE public.organizations
  ADD COLUMN IF NOT EXISTS status text,
  ADD COLUMN IF NOT EXISTS suspended_at timestamptz,
  ADD COLUMN IF NOT EXISTS suspended_by uuid REFERENCES public.users(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS suspension_reason text,
  ADD COLUMN IF NOT EXISTS owner_user_id uuid REFERENCES public.users(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS last_activity_at timestamptz;

UPDATE public.organizations
SET status = CASE WHEN is_active THEN 'active' ELSE 'suspended' END
WHERE status IS NULL;

UPDATE public.organizations organization
SET owner_user_id = owner.user_id
FROM (
  SELECT DISTINCT ON (om.organization_id)
    om.organization_id,
    om.user_id
  FROM public.organization_members om
  JOIN public.roles role ON role.id = om.role_id
  WHERE role.name = 'admin'
  ORDER BY om.organization_id, om.created_at ASC
) owner
WHERE organization.id = owner.organization_id
  AND organization.owner_user_id IS NULL;

ALTER TABLE public.organizations
  ALTER COLUMN status SET DEFAULT 'active',
  ALTER COLUMN status SET NOT NULL;

ALTER TABLE public.organizations
  ADD CONSTRAINT organizations_status_check
    CHECK (status IN ('active', 'suspended', 'pending', 'archived')),
  ADD CONSTRAINT organizations_status_active_consistency_check
    CHECK (is_active = (status = 'active')),
  ADD CONSTRAINT organizations_suspension_reason_length_check
    CHECK (suspension_reason IS NULL OR length(suspension_reason) BETWEEN 3 AND 500);

CREATE INDEX organizations_status_idx ON public.organizations (status, created_at DESC);
CREATE INDEX organizations_activity_idx ON public.organizations (last_activity_at DESC NULLS LAST);

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_trigger
    WHERE tgrelid = 'public.organizations'::regclass
      AND tgname = 'trg_organizations_updated_at'
  ) THEN
    CREATE TRIGGER trg_organizations_updated_at
      BEFORE UPDATE ON public.organizations
      FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
  END IF;
END;
$$;

-- Platform mutations use this server-only table to make browser retries safe
-- and to ensure repeated clicks do not create duplicate audit events.
CREATE TABLE public.platform_organization_action_requests (
  idempotency_key text PRIMARY KEY CHECK (length(idempotency_key) BETWEEN 16 AND 128),
  actor_user_id uuid NOT NULL REFERENCES public.users(id) ON DELETE RESTRICT,
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE RESTRICT,
  action text NOT NULL CHECK (action IN ('update', 'suspend', 'reactivate')),
  request_hash text NOT NULL CHECK (length(request_hash) = 64),
  status text NOT NULL CHECK (status IN ('processing', 'completed')),
  response jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX platform_organization_action_actor_idx
  ON public.platform_organization_action_requests (actor_user_id, created_at DESC);

ALTER TABLE public.platform_organization_action_requests ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.platform_organization_action_requests FROM PUBLIC, anon, authenticated;
GRANT ALL ON TABLE public.platform_organization_action_requests TO service_role;
