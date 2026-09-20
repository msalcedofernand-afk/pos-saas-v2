CREATE INDEX IF NOT EXISTS idx_order_discounts_user_id
  ON public.order_discounts (user_id);

CREATE INDEX IF NOT EXISTS idx_passkeys_user_id
  ON public.passkeys (user_id);

CREATE INDEX IF NOT EXISTS idx_refunds_user_id
  ON public.refunds (user_id);
