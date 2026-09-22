-- Phase 7: plans, organization limits and usage counters.
-- Billing providers are intentionally out of scope for this phase.

CREATE TABLE public.plans (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  code text NOT NULL UNIQUE CHECK (code ~ '^[a-z][a-z0-9_-]{1,40}$'),
  name text NOT NULL CHECK (length(name) BETWEEN 2 AND 120),
  description text NOT NULL DEFAULT '' CHECK (length(description) <= 500),
  monthly_price numeric(12, 2) CHECK (monthly_price IS NULL OR monthly_price >= 0),
  currency text NOT NULL DEFAULT 'PEN' CHECK (currency ~ '^[A-Z]{3}$'),
  max_users integer CHECK (max_users IS NULL OR max_users > 0),
  max_branches integer CHECK (max_branches IS NULL OR max_branches > 0),
  max_products integer CHECK (max_products IS NULL OR max_products > 0),
  max_monthly_orders integer CHECK (max_monthly_orders IS NULL OR max_monthly_orders > 0),
  max_storage_bytes bigint CHECK (max_storage_bytes IS NULL OR max_storage_bytes > 0),
  features jsonb NOT NULL DEFAULT '{}'::jsonb CHECK (jsonb_typeof(features) = 'object'),
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT pg_catalog.now(),
  updated_at timestamptz NOT NULL DEFAULT pg_catalog.now()
);

CREATE TABLE public.organization_subscriptions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL UNIQUE REFERENCES public.organizations(id) ON DELETE CASCADE,
  plan_id uuid NOT NULL REFERENCES public.plans(id),
  status text NOT NULL DEFAULT 'trial'
    CHECK (status IN ('trial', 'active', 'past_due', 'suspended', 'cancelled', 'expired')),
  starts_at timestamptz NOT NULL DEFAULT pg_catalog.now(),
  current_period_start timestamptz NOT NULL DEFAULT pg_catalog.now(),
  current_period_end timestamptz,
  trial_ends_at timestamptz,
  cancelled_at timestamptz,
  suspended_at timestamptz,
  suspension_reason text CHECK (suspension_reason IS NULL OR length(suspension_reason) BETWEEN 3 AND 500),
  provider text NOT NULL DEFAULT 'manual' CHECK (provider IN ('manual', 'stripe', 'other')),
  provider_customer_id text,
  provider_subscription_id text,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb CHECK (jsonb_typeof(metadata) = 'object'),
  created_at timestamptz NOT NULL DEFAULT pg_catalog.now(),
  updated_at timestamptz NOT NULL DEFAULT pg_catalog.now(),
  CHECK (current_period_end IS NULL OR current_period_end > current_period_start),
  CHECK (trial_ends_at IS NULL OR trial_ends_at >= starts_at)
);

CREATE TABLE public.organization_limits (
  organization_id uuid PRIMARY KEY REFERENCES public.organizations(id) ON DELETE CASCADE,
  plan_id uuid NOT NULL REFERENCES public.plans(id),
  max_users integer CHECK (max_users IS NULL OR max_users > 0),
  max_branches integer CHECK (max_branches IS NULL OR max_branches > 0),
  max_products integer CHECK (max_products IS NULL OR max_products > 0),
  max_monthly_orders integer CHECK (max_monthly_orders IS NULL OR max_monthly_orders > 0),
  max_storage_bytes bigint CHECK (max_storage_bytes IS NULL OR max_storage_bytes > 0),
  features jsonb NOT NULL DEFAULT '{}'::jsonb CHECK (jsonb_typeof(features) = 'object'),
  updated_at timestamptz NOT NULL DEFAULT pg_catalog.now()
);

CREATE TABLE public.usage_counters (
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  period_start date NOT NULL,
  period_end date NOT NULL,
  users_count integer NOT NULL DEFAULT 0 CHECK (users_count >= 0),
  branches_count integer NOT NULL DEFAULT 1 CHECK (branches_count >= 0),
  products_count integer NOT NULL DEFAULT 0 CHECK (products_count >= 0),
  monthly_orders_count integer NOT NULL DEFAULT 0 CHECK (monthly_orders_count >= 0),
  storage_bytes bigint NOT NULL DEFAULT 0 CHECK (storage_bytes >= 0),
  updated_at timestamptz NOT NULL DEFAULT pg_catalog.now(),
  PRIMARY KEY (organization_id, period_start),
  CHECK (period_end > period_start)
);

CREATE INDEX organization_subscriptions_status_idx
  ON public.organization_subscriptions (status, current_period_end);
CREATE INDEX organization_limits_plan_idx
  ON public.organization_limits (plan_id);
CREATE INDEX usage_counters_period_idx
  ON public.usage_counters (period_start, period_end);

ALTER TABLE public.plans ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.organization_subscriptions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.organization_limits ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.usage_counters ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON TABLE public.plans, public.organization_subscriptions, public.organization_limits, public.usage_counters
  FROM anon, authenticated;
GRANT ALL ON TABLE public.plans, public.organization_subscriptions, public.organization_limits, public.usage_counters
  TO service_role;

INSERT INTO public.plans (
  code, name, description, monthly_price, max_users, max_branches, max_products,
  max_monthly_orders, max_storage_bytes, features
)
VALUES
  ('trial', 'Prueba', 'Capacidad inicial para validar Mesa Clara.', 0, 3, 1, 50, 500, 1073741824,
    '{"reports": true, "support": "standard"}'::jsonb),
  ('starter', 'Inicial', 'Para un restaurante en operación.', NULL, 5, 1, 200, 1000, 2147483648,
    '{"reports": true, "support": "standard"}'::jsonb),
  ('growth', 'Crecimiento', 'Para restaurantes con mayor volumen.', NULL, 15, 3, 1000, 5000, 10737418240,
    '{"reports": true, "support": "priority"}'::jsonb),
  ('enterprise', 'Personalizado', 'Capacidad y módulos definidos con la plataforma.', NULL, NULL, NULL, NULL, NULL, NULL,
    '{"reports": true, "support": "dedicated"}'::jsonb)
ON CONFLICT (code) DO UPDATE SET
  name = EXCLUDED.name,
  description = EXCLUDED.description,
  max_users = EXCLUDED.max_users,
  max_branches = EXCLUDED.max_branches,
  max_products = EXCLUDED.max_products,
  max_monthly_orders = EXCLUDED.max_monthly_orders,
  max_storage_bytes = EXCLUDED.max_storage_bytes,
  features = EXCLUDED.features,
  updated_at = pg_catalog.now();

INSERT INTO public.organization_subscriptions (
  organization_id, plan_id, status, starts_at, current_period_start, current_period_end, trial_ends_at
)
SELECT o.id, p.id, 'trial', pg_catalog.now(), pg_catalog.now(), pg_catalog.now() + interval '14 days',
  pg_catalog.now() + interval '14 days'
FROM public.organizations o
JOIN public.plans p ON p.code = 'trial'
ON CONFLICT (organization_id) DO NOTHING;

INSERT INTO public.organization_limits (
  organization_id, plan_id, max_users, max_branches, max_products, max_monthly_orders, max_storage_bytes, features
)
SELECT s.organization_id, p.id, p.max_users, p.max_branches, p.max_products, p.max_monthly_orders,
  p.max_storage_bytes, p.features
FROM public.organization_subscriptions s
JOIN public.plans p ON p.id = s.plan_id
ON CONFLICT (organization_id) DO NOTHING;

CREATE OR REPLACE FUNCTION public.initialize_organization_plan()
RETURNS trigger
LANGUAGE plpgsql
VOLATILE
SECURITY INVOKER
SET search_path = ''
AS $$
DECLARE
  v_plan public.plans%ROWTYPE;
BEGIN
  SELECT * INTO v_plan FROM public.plans WHERE code = 'trial' AND is_active;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Plan de prueba no configurado' USING ERRCODE = 'P0001';
  END IF;

  INSERT INTO public.organization_subscriptions (
    organization_id, plan_id, status, starts_at, current_period_start, current_period_end, trial_ends_at
  )
  VALUES (
    NEW.id, v_plan.id, 'trial', pg_catalog.now(), pg_catalog.now(),
    pg_catalog.now() + interval '14 days', pg_catalog.now() + interval '14 days'
  )
  ON CONFLICT (organization_id) DO NOTHING;

  INSERT INTO public.organization_limits (
    organization_id, plan_id, max_users, max_branches, max_products,
    max_monthly_orders, max_storage_bytes, features
  )
  VALUES (
    NEW.id, v_plan.id, v_plan.max_users, v_plan.max_branches, v_plan.max_products,
    v_plan.max_monthly_orders, v_plan.max_storage_bytes, v_plan.features
  )
  ON CONFLICT (organization_id) DO NOTHING;
  RETURN NEW;
END;
$$;

CREATE TRIGGER organizations_default_plan
  AFTER INSERT ON public.organizations
  FOR EACH ROW EXECUTE FUNCTION public.initialize_organization_plan();

CREATE OR REPLACE FUNCTION public.get_organization_plan_usage(
  p_organization_id uuid,
  p_period_start date DEFAULT pg_catalog.date_trunc('month', pg_catalog.now())::date
)
RETURNS jsonb
LANGUAGE plpgsql
VOLATILE
SECURITY INVOKER
SET search_path = ''
AS $$
DECLARE
  v_period_end date := (p_period_start + interval '1 month')::date;
  v_subscription record;
  v_limits record;
  v_users integer;
  v_products integer;
  v_orders integer;
BEGIN
  SELECT s.status, s.current_period_start, s.current_period_end, s.trial_ends_at,
    p.id AS plan_id, p.code AS plan_code, p.name AS plan_name, p.monthly_price, p.currency,
    p.features, p.max_users, p.max_branches, p.max_products, p.max_monthly_orders, p.max_storage_bytes
  INTO v_subscription
  FROM public.organization_subscriptions s
  JOIN public.plans p ON p.id = s.plan_id
  WHERE s.organization_id = p_organization_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Suscripción no encontrada' USING ERRCODE = 'P0001';
  END IF;

  SELECT ol.max_users, ol.max_branches, ol.max_products, ol.max_monthly_orders,
    ol.max_storage_bytes, ol.features
  INTO v_limits
  FROM public.organization_limits ol
  WHERE ol.organization_id = p_organization_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Límites no encontrados' USING ERRCODE = 'P0001';
  END IF;

  SELECT count(*)::integer INTO v_users
  FROM public.organization_members om
  WHERE om.organization_id = p_organization_id;

  SELECT count(*)::integer INTO v_products
  FROM public.products p
  WHERE p.organization_id = p_organization_id;

  SELECT count(*)::integer INTO v_orders
  FROM public.orders o
  WHERE o.organization_id = p_organization_id
    AND o.created_at >= p_period_start
    AND o.created_at < v_period_end;

  INSERT INTO public.usage_counters (
    organization_id, period_start, period_end, users_count, branches_count,
    products_count, monthly_orders_count, storage_bytes, updated_at
  )
  VALUES (p_organization_id, p_period_start, v_period_end, v_users, 1, v_products, v_orders, 0, pg_catalog.now())
  ON CONFLICT (organization_id, period_start) DO UPDATE SET
    period_end = EXCLUDED.period_end,
    users_count = EXCLUDED.users_count,
    branches_count = EXCLUDED.branches_count,
    products_count = EXCLUDED.products_count,
    monthly_orders_count = EXCLUDED.monthly_orders_count,
    storage_bytes = EXCLUDED.storage_bytes,
    updated_at = EXCLUDED.updated_at;

  RETURN pg_catalog.jsonb_build_object(
    'subscription', pg_catalog.jsonb_build_object(
      'status', v_subscription.status,
      'startsAt', v_subscription.current_period_start,
      'currentPeriodEnd', v_subscription.current_period_end,
      'trialEndsAt', v_subscription.trial_ends_at
    ),
    'plan', pg_catalog.jsonb_build_object(
      'id', v_subscription.plan_id,
      'code', v_subscription.plan_code,
      'name', v_subscription.plan_name,
      'monthlyPrice', v_subscription.monthly_price,
      'currency', v_subscription.currency,
      'features', v_subscription.features
    ),
    'limits', pg_catalog.jsonb_build_object(
      'users', v_limits.max_users,
      'branches', v_limits.max_branches,
      'products', v_limits.max_products,
      'monthlyOrders', v_limits.max_monthly_orders,
      'storageBytes', v_limits.max_storage_bytes,
      'features', v_limits.features
    ),
    'usage', pg_catalog.jsonb_build_object(
      'users', v_users,
      'branches', 1,
      'products', v_products,
      'monthlyOrders', v_orders,
      'storageBytes', 0,
      'periodStart', p_period_start,
      'periodEnd', v_period_end
    )
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.set_organization_subscription(
  p_actor_user_id uuid,
  p_organization_id uuid,
  p_plan_code text,
  p_status text DEFAULT 'active',
  p_reason text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
VOLATILE
SECURITY INVOKER
SET search_path = ''
AS $$
DECLARE
  v_plan public.plans%ROWTYPE;
  v_subscription public.organization_subscriptions%ROWTYPE;
  v_old_values jsonb;
  v_new_values jsonb;
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM public.user_roles ur
    JOIN public.roles r ON r.id = ur.role_id
    WHERE ur.user_id = p_actor_user_id AND r.name = 'platform_admin'
  ) THEN
    RAISE EXCEPTION 'No autorizado' USING ERRCODE = '42501';
  END IF;

  IF p_status NOT IN ('trial', 'active', 'past_due', 'suspended', 'cancelled', 'expired') THEN
    RAISE EXCEPTION 'Estado de suscripción inválido' USING ERRCODE = '22023';
  END IF;

  SELECT * INTO v_plan FROM public.plans WHERE code = p_plan_code AND is_active;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Plan no encontrado' USING ERRCODE = 'P0001';
  END IF;

  IF NOT EXISTS (SELECT 1 FROM public.organizations WHERE id = p_organization_id) THEN
    RAISE EXCEPTION 'Organización no encontrada' USING ERRCODE = 'P0001';
  END IF;

  SELECT * INTO v_subscription
  FROM public.organization_subscriptions
  WHERE organization_id = p_organization_id
  FOR UPDATE;

  IF FOUND THEN
    v_old_values := pg_catalog.jsonb_build_object('planCode', (SELECT code FROM public.plans WHERE id = v_subscription.plan_id), 'status', v_subscription.status);
    UPDATE public.organization_subscriptions
    SET plan_id = v_plan.id,
        status = p_status,
        current_period_end = CASE WHEN p_status IN ('cancelled', 'expired') THEN current_period_end ELSE pg_catalog.now() + interval '30 days' END,
        trial_ends_at = CASE WHEN p_status = 'trial' THEN coalesce(trial_ends_at, pg_catalog.now() + interval '14 days') ELSE trial_ends_at END,
        cancelled_at = CASE WHEN p_status = 'cancelled' THEN pg_catalog.now() ELSE NULL END,
        suspended_at = CASE WHEN p_status = 'suspended' THEN pg_catalog.now() ELSE NULL END,
        suspension_reason = CASE WHEN p_status = 'suspended' THEN p_reason ELSE NULL END,
        updated_at = pg_catalog.now()
    WHERE organization_id = p_organization_id
    RETURNING * INTO v_subscription;
  ELSE
    INSERT INTO public.organization_subscriptions (
      organization_id, plan_id, status, current_period_start, current_period_end,
      trial_ends_at, cancelled_at, suspended_at, suspension_reason
    )
    VALUES (
      p_organization_id, v_plan.id, p_status, pg_catalog.now(), pg_catalog.now() + interval '30 days',
      CASE WHEN p_status = 'trial' THEN pg_catalog.now() + interval '14 days' ELSE NULL END,
      CASE WHEN p_status = 'cancelled' THEN pg_catalog.now() ELSE NULL END,
      CASE WHEN p_status = 'suspended' THEN pg_catalog.now() ELSE NULL END,
      CASE WHEN p_status = 'suspended' THEN p_reason ELSE NULL END
    )
    RETURNING * INTO v_subscription;
    v_old_values := '{}'::jsonb;
  END IF;

  INSERT INTO public.organization_limits (
    organization_id, plan_id, max_users, max_branches, max_products,
    max_monthly_orders, max_storage_bytes, features, updated_at
  )
  VALUES (
    p_organization_id, v_plan.id, v_plan.max_users, v_plan.max_branches, v_plan.max_products,
    v_plan.max_monthly_orders, v_plan.max_storage_bytes, v_plan.features, pg_catalog.now()
  )
  ON CONFLICT (organization_id) DO UPDATE SET
    plan_id = EXCLUDED.plan_id,
    max_users = EXCLUDED.max_users,
    max_branches = EXCLUDED.max_branches,
    max_products = EXCLUDED.max_products,
    max_monthly_orders = EXCLUDED.max_monthly_orders,
    max_storage_bytes = EXCLUDED.max_storage_bytes,
    features = EXCLUDED.features,
    updated_at = EXCLUDED.updated_at;

  v_new_values := pg_catalog.jsonb_build_object('planCode', v_plan.code, 'status', p_status, 'reason', p_reason);
  INSERT INTO public.platform_audit_logs (
    actor_user_id, action, auditable_type, auditable_id, old_values, new_values
  )
  VALUES (
    p_actor_user_id, 'subscription_updated', 'organizations', p_organization_id,
    v_old_values, v_new_values
  );

  RETURN public.get_organization_plan_usage(p_organization_id);
END;
$$;

CREATE OR REPLACE FUNCTION public.enforce_organization_plan_limit()
RETURNS trigger
LANGUAGE plpgsql
VOLATILE
SECURITY INVOKER
SET search_path = ''
AS $$
DECLARE
  v_organization_id uuid;
  v_resource text;
  v_limit bigint;
  v_used bigint;
  v_status text;
BEGIN
  IF TG_OP <> 'INSERT' THEN RETURN NEW; END IF;

  v_organization_id := COALESCE(NEW.organization_id, NULL);
  IF v_organization_id IS NULL THEN RETURN NEW; END IF;

  IF TG_TABLE_NAME = 'organization_members' THEN v_resource := 'users';
  ELSIF TG_TABLE_NAME = 'products' THEN v_resource := 'products';
  ELSIF TG_TABLE_NAME = 'orders' THEN v_resource := 'monthly_orders';
  ELSE RETURN NEW;
  END IF;

  SELECT s.status, CASE v_resource
    WHEN 'users' THEN ol.max_users
    WHEN 'products' THEN ol.max_products
    WHEN 'monthly_orders' THEN ol.max_monthly_orders
  END
  INTO v_status, v_limit
  FROM public.organization_subscriptions s
  JOIN public.organization_limits ol ON ol.organization_id = s.organization_id
  WHERE s.organization_id = v_organization_id;

  IF v_status IS NULL THEN
    RAISE EXCEPTION 'La organización no tiene un plan configurado' USING ERRCODE = 'P0001';
  END IF;
  IF v_status IN ('suspended', 'cancelled', 'expired') THEN
    RAISE EXCEPTION 'La suscripción no permite nuevas operaciones' USING ERRCODE = 'P0001';
  END IF;
  IF v_limit IS NULL THEN RETURN NEW; END IF;

  IF v_resource = 'users' THEN
    SELECT count(*) INTO v_used FROM public.organization_members WHERE organization_id = v_organization_id;
  ELSIF v_resource = 'products' THEN
    SELECT count(*) INTO v_used FROM public.products WHERE organization_id = v_organization_id;
  ELSE
    SELECT count(*) INTO v_used FROM public.orders
    WHERE organization_id = v_organization_id
      AND created_at >= pg_catalog.date_trunc('month', pg_catalog.now());
  END IF;

  IF v_used >= v_limit THEN
    RAISE EXCEPTION 'Límite de % alcanzado', v_resource USING ERRCODE = 'P0001';
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER organization_members_plan_limit
  BEFORE INSERT ON public.organization_members
  FOR EACH ROW EXECUTE FUNCTION public.enforce_organization_plan_limit();
CREATE TRIGGER products_plan_limit
  BEFORE INSERT ON public.products
  FOR EACH ROW EXECUTE FUNCTION public.enforce_organization_plan_limit();
CREATE TRIGGER orders_plan_limit
  BEFORE INSERT ON public.orders
  FOR EACH ROW EXECUTE FUNCTION public.enforce_organization_plan_limit();

REVOKE ALL ON FUNCTION public.get_organization_plan_usage(uuid, date) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.set_organization_subscription(uuid, uuid, text, text, text) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.initialize_organization_plan() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.enforce_organization_plan_limit() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.get_organization_plan_usage(uuid, date) TO service_role;
GRANT EXECUTE ON FUNCTION public.set_organization_subscription(uuid, uuid, text, text, text) TO service_role;
GRANT EXECUTE ON FUNCTION public.initialize_organization_plan() TO service_role;
GRANT EXECUTE ON FUNCTION public.enforce_organization_plan_limit() TO service_role;
