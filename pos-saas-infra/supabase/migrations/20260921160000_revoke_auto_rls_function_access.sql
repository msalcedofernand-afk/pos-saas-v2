-- Supabase may create this helper when automatic RLS is enabled at project level.
-- The event trigger does not need Data API callers to execute it.
DO $$
BEGIN
  IF pg_catalog.to_regprocedure('public.rls_auto_enable()') IS NOT NULL THEN
    EXECUTE 'REVOKE EXECUTE ON FUNCTION public.rls_auto_enable() FROM anon, authenticated';
  END IF;
END;
$$;
