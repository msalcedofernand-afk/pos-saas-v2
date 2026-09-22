CREATE INDEX platform_user_action_requests_actor_idx
  ON public.platform_user_action_requests (actor_user_id, created_at DESC);

CREATE INDEX platform_membership_action_requests_actor_idx
  ON public.platform_membership_action_requests (actor_user_id, created_at DESC);
