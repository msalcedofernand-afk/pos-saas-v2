-- Use an empty search path for elevated helper functions.
-- All application objects referenced by these functions are schema-qualified.

ALTER FUNCTION public.get_user_roles()
  SET search_path = '';

ALTER FUNCTION public.handle_new_user()
  SET search_path = '';

ALTER FUNCTION public.handle_new_user_security()
  SET search_path = '';

ALTER FUNCTION public.has_role(text)
  SET search_path = '';

ALTER FUNCTION public.rls_auto_enable()
  SET search_path = '';

ALTER FUNCTION public.set_updated_at()
  SET search_path = '';
