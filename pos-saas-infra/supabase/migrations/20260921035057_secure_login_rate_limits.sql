ALTER TABLE public.user_security
  ADD COLUMN IF NOT EXISTS locked_until timestamptz,
  ADD COLUMN IF NOT EXISTS last_failed_login_at timestamptz,
  ADD COLUMN IF NOT EXISTS last_failed_login_ip text;

CREATE TABLE IF NOT EXISTS public.auth_login_rate_limits (
  rate_key text PRIMARY KEY,
  failed_attempts integer NOT NULL DEFAULT 0 CHECK (failed_attempts >= 0),
  window_started_at timestamptz NOT NULL DEFAULT pg_catalog.now(),
  blocked_until timestamptz,
  updated_at timestamptz NOT NULL DEFAULT pg_catalog.now()
);

ALTER TABLE public.auth_login_rate_limits ENABLE ROW LEVEL SECURITY;
REVOKE ALL PRIVILEGES ON TABLE public.auth_login_rate_limits
  FROM PUBLIC, anon, authenticated;

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

  IF v_limit.window_started_at <= v_now - pg_catalog.make_interval(secs => p_window_seconds) THEN
    UPDATE public.auth_login_rate_limits
    SET failed_attempts = 0,
        window_started_at = v_now,
        blocked_until = NULL,
        updated_at = v_now
    WHERE public.auth_login_rate_limits.rate_key = p_rate_key;
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

CREATE OR REPLACE FUNCTION public.record_login_failure(
  p_rate_key text,
  p_max_attempts integer DEFAULT 5,
  p_window_seconds integer DEFAULT 900,
  p_lock_seconds integer DEFAULT 900
)
RETURNS TABLE (blocked boolean, retry_after_seconds integer)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_limit public.auth_login_rate_limits%ROWTYPE;
  v_now timestamptz := pg_catalog.now();
  v_attempts integer;
  v_blocked_until timestamptz;
  v_retry integer;
BEGIN
  IF p_rate_key IS NULL OR pg_catalog.length(p_rate_key) < 8 THEN
    RAISE EXCEPTION 'Invalid login rate-limit key';
  END IF;

  INSERT INTO public.auth_login_rate_limits (rate_key)
  VALUES (p_rate_key)
  ON CONFLICT (rate_key) DO NOTHING;

  SELECT * INTO v_limit
  FROM public.auth_login_rate_limits
  WHERE public.auth_login_rate_limits.rate_key = p_rate_key
  FOR UPDATE;

  IF v_limit.window_started_at <= v_now - pg_catalog.make_interval(secs => p_window_seconds) THEN
    v_attempts := 0;
  ELSE
    v_attempts := v_limit.failed_attempts;
  END IF;
  v_attempts := v_attempts + 1;
  v_blocked_until := CASE
    WHEN v_attempts >= p_max_attempts THEN v_now + pg_catalog.make_interval(secs => p_lock_seconds)
    ELSE NULL
  END;

  UPDATE public.auth_login_rate_limits
  SET failed_attempts = v_attempts,
      window_started_at = CASE
        WHEN v_limit.window_started_at <= v_now - pg_catalog.make_interval(secs => p_window_seconds)
          THEN v_now
        ELSE v_limit.window_started_at
      END,
      blocked_until = v_blocked_until,
      updated_at = v_now
  WHERE public.auth_login_rate_limits.rate_key = p_rate_key;

  IF v_blocked_until IS NULL THEN
    RETURN QUERY SELECT false, NULL::integer;
  ELSE
    v_retry := pg_catalog.ceil(EXTRACT(EPOCH FROM (v_blocked_until - v_now)))::integer;
    IF v_retry < 1 THEN v_retry := 1; END IF;
    RETURN QUERY SELECT true, v_retry;
  END IF;
END;
$$;

CREATE OR REPLACE FUNCTION public.reset_login_rate_limit(p_rate_key text)
RETURNS void
LANGUAGE sql
SECURITY DEFINER
SET search_path = ''
AS $$
  DELETE FROM public.auth_login_rate_limits
  WHERE public.auth_login_rate_limits.rate_key = p_rate_key;
$$;

CREATE OR REPLACE FUNCTION public.check_user_login_lock(p_user_id uuid)
RETURNS TABLE (locked boolean, retry_after_seconds integer)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_security public.user_security%ROWTYPE;
  v_now timestamptz := pg_catalog.now();
  v_retry integer;
BEGIN
  INSERT INTO public.user_security (user_id)
  VALUES (p_user_id)
  ON CONFLICT (user_id) DO NOTHING;

  SELECT * INTO v_security
  FROM public.user_security
  WHERE public.user_security.user_id = p_user_id
  FOR UPDATE;

  IF v_security.is_locked AND (v_security.locked_until IS NULL OR v_security.locked_until > v_now) THEN
    IF v_security.locked_until IS NULL THEN
      RETURN QUERY SELECT true, NULL::integer;
    ELSE
      v_retry := pg_catalog.ceil(EXTRACT(EPOCH FROM (v_security.locked_until - v_now)))::integer;
      IF v_retry < 1 THEN v_retry := 1; END IF;
      RETURN QUERY SELECT true, v_retry;
    END IF;
    RETURN;
  END IF;

  IF v_security.is_locked THEN
    UPDATE public.user_security
    SET failed_login_attempts = 0,
        is_locked = false,
        locked_at = NULL,
        locked_until = NULL,
        updated_at = v_now
    WHERE public.user_security.user_id = p_user_id;
  END IF;
  RETURN QUERY SELECT false, NULL::integer;
END;
$$;

CREATE OR REPLACE FUNCTION public.record_user_login_failure(
  p_user_id uuid,
  p_ip text DEFAULT NULL,
  p_max_attempts integer DEFAULT 5,
  p_lock_seconds integer DEFAULT 900
)
RETURNS TABLE (blocked boolean, retry_after_seconds integer)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_security public.user_security%ROWTYPE;
  v_now timestamptz := pg_catalog.now();
  v_attempts integer;
  v_locked_until timestamptz;
  v_retry integer;
BEGIN
  INSERT INTO public.user_security (user_id)
  VALUES (p_user_id)
  ON CONFLICT (user_id) DO NOTHING;

  SELECT * INTO v_security
  FROM public.user_security
  WHERE public.user_security.user_id = p_user_id
  FOR UPDATE;

  v_attempts := v_security.failed_login_attempts + 1;
  v_locked_until := CASE
    WHEN v_attempts >= p_max_attempts THEN v_now + pg_catalog.make_interval(secs => p_lock_seconds)
    ELSE NULL
  END;

  UPDATE public.user_security
  SET failed_login_attempts = v_attempts,
      is_locked = v_locked_until IS NOT NULL,
      locked_at = CASE WHEN v_locked_until IS NOT NULL THEN v_now ELSE locked_at END,
      locked_until = v_locked_until,
      last_failed_login_at = v_now,
      last_failed_login_ip = p_ip,
      updated_at = v_now
  WHERE public.user_security.user_id = p_user_id;

  IF v_locked_until IS NULL THEN
    RETURN QUERY SELECT false, NULL::integer;
  ELSE
    v_retry := pg_catalog.ceil(EXTRACT(EPOCH FROM (v_locked_until - v_now)))::integer;
    IF v_retry < 1 THEN v_retry := 1; END IF;
    RETURN QUERY SELECT true, v_retry;
  END IF;
END;
$$;

CREATE OR REPLACE FUNCTION public.reset_user_login_security(p_user_id uuid)
RETURNS void
LANGUAGE sql
SECURITY DEFINER
SET search_path = ''
AS $$
  UPDATE public.user_security
  SET failed_login_attempts = 0,
      is_locked = false,
      locked_at = NULL,
      locked_until = NULL,
      last_failed_login_at = NULL,
      last_failed_login_ip = NULL,
      updated_at = pg_catalog.now()
  WHERE public.user_security.user_id = p_user_id;
$$;

REVOKE EXECUTE ON FUNCTION public.check_login_rate_limit(text, integer, integer, integer) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.record_login_failure(text, integer, integer, integer) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.reset_login_rate_limit(text) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.check_user_login_lock(uuid) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.record_user_login_failure(uuid, text, integer, integer) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.reset_user_login_security(uuid) FROM PUBLIC, anon, authenticated;

GRANT EXECUTE ON FUNCTION public.check_login_rate_limit(text, integer, integer, integer) TO service_role;
GRANT EXECUTE ON FUNCTION public.record_login_failure(text, integer, integer, integer) TO service_role;
GRANT EXECUTE ON FUNCTION public.reset_login_rate_limit(text) TO service_role;
GRANT EXECUTE ON FUNCTION public.check_user_login_lock(uuid) TO service_role;
GRANT EXECUTE ON FUNCTION public.record_user_login_failure(uuid, text, integer, integer) TO service_role;
GRANT EXECUTE ON FUNCTION public.reset_user_login_security(uuid) TO service_role;
