-- Global SaaS administration is intentionally separate from the tenant-scoped
-- `admin` role. The role is stored in the server-only legacy pivot so it does
-- not become selectable from an organization settings screen.
INSERT INTO public.roles (name, display_name)
VALUES ('platform_admin', 'Administrador de plataforma')
ON CONFLICT (name) DO UPDATE SET display_name = EXCLUDED.display_name;

-- The API is the only component that can assign this role. Existing users can
-- be bootstrapped safely by setting PLATFORM_ADMIN_EMAIL on the API and having
-- that user sign in once; the API then inserts the role only when no platform
-- administrator exists yet.
REVOKE ALL ON TABLE public.user_roles FROM anon, authenticated;
GRANT ALL ON TABLE public.user_roles TO service_role;
