-- User profiles and role assignments are server-managed data. The API uses
-- the service-role client after validating the organization and permission;
-- browser clients must not query or mutate these tables through PostgREST.
ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

DO $$
DECLARE
  policy_row record;
BEGIN
  FOR policy_row IN
    SELECT schemaname, tablename, policyname
    FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename IN ('users', 'user_roles')
  LOOP
    EXECUTE format(
      'DROP POLICY IF EXISTS %I ON %I.%I',
      policy_row.policyname,
      policy_row.schemaname,
      policy_row.tablename
    );
  END LOOP;
END;
$$;

REVOKE ALL PRIVILEGES ON TABLE public.users, public.user_roles
  FROM PUBLIC, anon, authenticated;
