-- Keep browser access to role lookup disabled after the multi-tenant migration.
-- RLS policies use public.has_role(text); get_user_roles() is server-only.
REVOKE ALL ON FUNCTION public.get_user_roles() FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.get_user_roles() FROM anon, authenticated;
