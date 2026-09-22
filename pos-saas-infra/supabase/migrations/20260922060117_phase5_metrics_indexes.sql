CREATE INDEX platform_operation_errors_actor_idx
  ON public.platform_operation_errors (actor_user_id, occurred_at DESC)
  WHERE actor_user_id IS NOT NULL;
