-- Restrict direct execution of internal SECURITY DEFINER helpers.
-- has_role remains available to authenticated sessions because RLS policies use it.

ALTER FUNCTION public.get_user_roles()
  SET search_path = pg_catalog, public;

ALTER FUNCTION public.handle_new_user()
  SET search_path = pg_catalog, public;

ALTER FUNCTION public.handle_new_user_security()
  SET search_path = pg_catalog, public;

ALTER FUNCTION public.has_role(text)
  SET search_path = pg_catalog, public;

ALTER FUNCTION public.rls_auto_enable()
  SET search_path = pg_catalog;

ALTER FUNCTION public.set_updated_at()
  SET search_path = pg_catalog, public;

REVOKE EXECUTE ON FUNCTION public.get_user_roles() FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.handle_new_user() FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.handle_new_user_security() FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.has_role(text) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.rls_auto_enable() FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.set_updated_at() FROM PUBLIC;

GRANT EXECUTE ON FUNCTION public.has_role(text) TO authenticated;
