-- User profiles and legacy global roles are managed exclusively by the server API.
-- Keeping them out of the authenticated Data API prevents an administrator from
-- one organization reading or changing another organization's users directly.
DROP POLICY IF EXISTS "user_roles_select_own" ON public.user_roles;
DROP POLICY IF EXISTS "user_roles_insert" ON public.user_roles;
DROP POLICY IF EXISTS "user_roles_update" ON public.user_roles;
DROP POLICY IF EXISTS "user_roles_delete" ON public.user_roles;
DROP POLICY IF EXISTS "users_select" ON public.users;
DROP POLICY IF EXISTS "users_update_own" ON public.users;
DROP POLICY IF EXISTS "users_insert_own" ON public.users;

REVOKE ALL ON TABLE public.user_roles FROM anon, authenticated;
REVOKE ALL ON TABLE public.users FROM anon, authenticated;

GRANT ALL ON TABLE public.user_roles TO service_role;
GRANT ALL ON TABLE public.users TO service_role;
