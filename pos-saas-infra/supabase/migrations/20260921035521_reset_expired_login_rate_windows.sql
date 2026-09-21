CREATE OR REPLACE FUNCTION public.check_login_rate_limit(
  p_rate_key text,
  p_max_attempts integer DEFAULT 5,
  p_window_seconds integer DEFAULT 900,
  p_lock_seconds integer DEFAULT 900
)
RETURNS TABLE (allowed boolean, retry_after_seconds integer)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_limit public.auth_login_rate_limits%ROWTYPE;
  v_now timestamptz := pg_catalog.now();
  v_retry integer;
  v_window_expired boolean;
BEGIN
  IF p_rate_key IS NULL OR pg_catalog.length(p_rate_key) < 8 THEN
    RAISE EXCEPTION 'Invalid login rate-limit key';
  END IF;
  IF p_max_attempts < 1 OR p_window_seconds < 1 OR p_lock_seconds < 1 THEN
    RAISE EXCEPTION 'Invalid login rate-limit configuration';
  END IF;

  INSERT INTO public.auth_login_rate_limits (rate_key)
  VALUES (p_rate_key)
  ON CONFLICT (rate_key) DO NOTHING;

  SELECT * INTO v_limit
  FROM public.auth_login_rate_limits
  WHERE public.auth_login_rate_limits.rate_key = p_rate_key
  FOR UPDATE;

  IF v_limit.blocked_until IS NOT NULL AND v_limit.blocked_until > v_now THEN
    v_retry := pg_catalog.ceil(EXTRACT(EPOCH FROM (v_limit.blocked_until - v_now)))::integer;
    IF v_retry < 1 THEN v_retry := 1; END IF;
    RETURN QUERY SELECT false, v_retry;
    RETURN;
  END IF;

  v_window_expired := v_limit.window_started_at <= v_now - pg_catalog.make_interval(secs => p_window_seconds);
  IF v_window_expired THEN
    UPDATE public.auth_login_rate_limits
    SET failed_attempts = 0,
        window_started_at = v_now,
        blocked_until = NULL,
        updated_at = v_now
    WHERE public.auth_login_rate_limits.rate_key = p_rate_key;
    RETURN QUERY SELECT true, NULL::integer;
    RETURN;
  END IF;

  IF v_limit.failed_attempts >= p_max_attempts THEN
    UPDATE public.auth_login_rate_limits
    SET blocked_until = v_now + pg_catalog.make_interval(secs => p_lock_seconds),
        updated_at = v_now
    WHERE public.auth_login_rate_limits.rate_key = p_rate_key;
    RETURN QUERY SELECT false, p_lock_seconds;
    RETURN;
  END IF;

  RETURN QUERY SELECT true, NULL::integer;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.check_login_rate_limit(text, integer, integer, integer) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.check_login_rate_limit(text, integer, integer, integer) TO service_role;
