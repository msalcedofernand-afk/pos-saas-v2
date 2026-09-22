-- Roles are administered only by the server API. The legacy browser policies
-- below are the final active callers of public.has_role(text), a SECURITY
-- DEFINER helper exposed through the public schema. Keeping neither the table
-- nor the helper callable by signed-in clients removes that RPC surface.
DROP POLICY IF EXISTS roles_insert ON public.roles;
DROP POLICY IF EXISTS roles_update ON public.roles;
DROP POLICY IF EXISTS roles_delete ON public.roles;

REVOKE ALL ON TABLE public.roles FROM anon, authenticated;

REVOKE EXECUTE ON FUNCTION public.has_role(text) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.has_role(text) FROM anon, authenticated;
