CREATE INDEX IF NOT EXISTS api_idempotency_keys_user_idx
  ON public.api_idempotency_keys (user_id);
