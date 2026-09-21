-- Automatic RLS creates this SECURITY DEFINER helper in public. It is an
-- internal event-trigger helper and must not be callable through the Data API.
DO $$
BEGIN
  IF pg_catalog.to_regprocedure('public.rls_auto_enable()') IS NOT NULL THEN
    EXECUTE 'REVOKE EXECUTE ON FUNCTION public.rls_auto_enable() FROM PUBLIC';
    EXECUTE 'REVOKE EXECUTE ON FUNCTION public.rls_auto_enable() FROM anon, authenticated';
  END IF;
END;
$$;
