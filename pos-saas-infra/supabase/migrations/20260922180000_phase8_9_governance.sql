-- Phase 8/9 foundation: provider-neutral billing events and platform governance.
-- Real payment provider integration remains intentionally disabled until commercial decisions are approved.

INSERT INTO public.roles (name, display_name)
VALUES
  ('platform_owner', 'Propietario de plataforma'),
  ('support_agent', 'Agente de soporte'),
  ('billing_admin', 'Administrador de facturación'),
  ('security_auditor', 'Auditor de seguridad')
ON CONFLICT (name) DO UPDATE SET display_name = EXCLUDED.display_name;

CREATE TABLE public.platform_tickets (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid REFERENCES public.organizations(id) ON DELETE SET NULL,
  requester_user_id uuid NOT NULL REFERENCES public.users(id),
  assigned_user_id uuid REFERENCES public.users(id),
  subject text NOT NULL CHECK (length(subject) BETWEEN 3 AND 160),
  description text NOT NULL CHECK (length(description) BETWEEN 3 AND 5000),
  priority text NOT NULL DEFAULT 'normal' CHECK (priority IN ('low', 'normal', 'high', 'urgent')),
  status text NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'in_progress', 'waiting_customer', 'resolved', 'closed')),
  created_at timestamptz NOT NULL DEFAULT pg_catalog.now(),
  updated_at timestamptz NOT NULL DEFAULT pg_catalog.now(),
  resolved_at timestamptz
);

CREATE TABLE public.platform_ticket_comments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  ticket_id uuid NOT NULL REFERENCES public.platform_tickets(id) ON DELETE CASCADE,
  author_user_id uuid NOT NULL REFERENCES public.users(id),
  body text NOT NULL CHECK (length(body) BETWEEN 1 AND 5000),
  internal boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT pg_catalog.now()
);

CREATE TABLE public.platform_incidents (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid REFERENCES public.organizations(id) ON DELETE SET NULL,
  opened_by uuid NOT NULL REFERENCES public.users(id),
  title text NOT NULL CHECK (length(title) BETWEEN 3 AND 160),
  summary text NOT NULL CHECK (length(summary) BETWEEN 3 AND 5000),
  severity text NOT NULL DEFAULT 'minor' CHECK (severity IN ('minor', 'major', 'critical')),
  status text NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'investigating', 'mitigated', 'resolved', 'closed')),
  started_at timestamptz NOT NULL DEFAULT pg_catalog.now(),
  resolved_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT pg_catalog.now(),
  updated_at timestamptz NOT NULL DEFAULT pg_catalog.now()
);

CREATE TABLE public.platform_billing_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  provider text NOT NULL DEFAULT 'manual' CHECK (provider IN ('manual', 'stripe', 'other')),
  external_event_id text NOT NULL,
  event_type text NOT NULL CHECK (length(event_type) BETWEEN 3 AND 120),
  organization_id uuid REFERENCES public.organizations(id) ON DELETE SET NULL,
  payload jsonb NOT NULL DEFAULT '{}'::jsonb CHECK (jsonb_typeof(payload) = 'object'),
  status text NOT NULL DEFAULT 'received' CHECK (status IN ('received', 'processed', 'ignored', 'failed')),
  received_at timestamptz NOT NULL DEFAULT pg_catalog.now(),
  processed_at timestamptz,
  error_message text
);

CREATE UNIQUE INDEX platform_billing_events_provider_external_idx
  ON public.platform_billing_events(provider, external_event_id);
CREATE INDEX platform_tickets_status_priority_idx ON public.platform_tickets(status, priority, updated_at DESC);
CREATE INDEX platform_tickets_org_idx ON public.platform_tickets(organization_id, created_at DESC);
CREATE INDEX platform_ticket_comments_ticket_idx ON public.platform_ticket_comments(ticket_id, created_at);
CREATE INDEX platform_incidents_status_idx ON public.platform_incidents(status, severity, updated_at DESC);

ALTER TABLE public.platform_tickets ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.platform_ticket_comments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.platform_incidents ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.platform_billing_events ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.platform_tickets, public.platform_ticket_comments, public.platform_incidents, public.platform_billing_events FROM anon, authenticated;
GRANT ALL ON TABLE public.platform_tickets, public.platform_ticket_comments, public.platform_incidents, public.platform_billing_events TO service_role;

DROP TRIGGER IF EXISTS platform_tickets_updated_at ON public.platform_tickets;
CREATE TRIGGER platform_tickets_updated_at BEFORE UPDATE ON public.platform_tickets
FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
DROP TRIGGER IF EXISTS platform_incidents_updated_at ON public.platform_incidents;
CREATE TRIGGER platform_incidents_updated_at BEFORE UPDATE ON public.platform_incidents
FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE OR REPLACE FUNCTION public.process_platform_billing_event(
  p_provider text,
  p_external_event_id text,
  p_event_type text,
  p_organization_id uuid,
  p_payload jsonb
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE v_event public.platform_billing_events%ROWTYPE;
BEGIN
  IF p_provider NOT IN ('manual', 'stripe', 'other') THEN RAISE EXCEPTION 'Proveedor inválido' USING ERRCODE = '22023'; END IF;
  INSERT INTO public.platform_billing_events(provider, external_event_id, event_type, organization_id, payload)
  VALUES (p_provider, p_external_event_id, p_event_type, p_organization_id, p_payload)
  ON CONFLICT (provider, external_event_id) DO NOTHING
  RETURNING * INTO v_event;
  IF v_event.id IS NULL THEN
    SELECT * INTO v_event FROM public.platform_billing_events WHERE provider = p_provider AND external_event_id = p_external_event_id;
    RETURN pg_catalog.jsonb_build_object('duplicate', true, 'id', v_event.id, 'status', v_event.status);
  END IF;
  UPDATE public.platform_billing_events SET status = 'processed', processed_at = pg_catalog.now() WHERE id = v_event.id RETURNING * INTO v_event;
  RETURN pg_catalog.jsonb_build_object('duplicate', false, 'id', v_event.id, 'status', v_event.status);
END;
$$;
REVOKE ALL ON FUNCTION public.process_platform_billing_event(text, text, text, uuid, jsonb) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.process_platform_billing_event(text, text, text, uuid, jsonb) TO service_role;

INSERT INTO public.platform_audit_logs(actor_user_id, action, auditable_type, auditable_id, new_values)
SELECT u.id, 'phase8_9_governance_initialized', 'platform', u.id, jsonb_build_object('roles', true, 'tickets', true, 'incidents', true, 'billingEvents', true)
FROM public.users u
JOIN public.user_roles ur ON ur.user_id = u.id
JOIN public.roles r ON r.id = ur.role_id AND r.name = 'platform_admin'
LIMIT 1;
