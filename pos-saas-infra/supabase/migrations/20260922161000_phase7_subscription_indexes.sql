-- Cover the plan foreign key used by global subscription administration.
CREATE INDEX IF NOT EXISTS organization_subscriptions_plan_idx
  ON public.organization_subscriptions (plan_id);
