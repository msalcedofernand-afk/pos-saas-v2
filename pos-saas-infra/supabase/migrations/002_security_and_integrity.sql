-- Security tables used by the application but missing from the initial schema.

CREATE TABLE IF NOT EXISTS public.user_security (
  user_id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  failed_login_attempts integer NOT NULL DEFAULT 0 CHECK (failed_login_attempts >= 0),
  is_locked boolean NOT NULL DEFAULT false,
  locked_at timestamptz,
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.passkeys (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  credential_id text NOT NULL UNIQUE,
  public_key bytea NOT NULL,
  counter bigint NOT NULL DEFAULT 0 CHECK (counter >= 0),
  device_type text,
  backed_up boolean NOT NULL DEFAULT false,
  transports jsonb NOT NULL DEFAULT '[]'::jsonb,
  last_used timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_passkeys_user_id ON public.passkeys(user_id);

ALTER TABLE public.user_security ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.passkeys ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS user_security_select ON public.user_security;
CREATE POLICY user_security_select ON public.user_security
  FOR SELECT TO authenticated
  USING (user_id = (select auth.uid()) OR public.has_role('admin'));

DROP POLICY IF EXISTS user_security_update ON public.user_security;
CREATE POLICY user_security_update ON public.user_security
  FOR UPDATE TO authenticated
  USING (public.has_role('admin'))
  WITH CHECK (public.has_role('admin'));

DROP POLICY IF EXISTS passkeys_select_own ON public.passkeys;
CREATE POLICY passkeys_select_own ON public.passkeys
  FOR SELECT TO authenticated
  USING (user_id = (select auth.uid()) OR public.has_role('admin'));

DROP POLICY IF EXISTS passkeys_insert_own ON public.passkeys;
CREATE POLICY passkeys_insert_own ON public.passkeys
  FOR INSERT TO authenticated
  WITH CHECK (user_id = (select auth.uid()));

DROP POLICY IF EXISTS passkeys_update_own ON public.passkeys;
CREATE POLICY passkeys_update_own ON public.passkeys
  FOR UPDATE TO authenticated
  USING (user_id = (select auth.uid()))
  WITH CHECK (user_id = (select auth.uid()));

DROP POLICY IF EXISTS passkeys_delete_own ON public.passkeys;
CREATE POLICY passkeys_delete_own ON public.passkeys
  FOR DELETE TO authenticated
  USING (user_id = (select auth.uid()) OR public.has_role('admin'));

GRANT SELECT, UPDATE ON public.user_security TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.passkeys TO authenticated;

-- Pin the search path on security-definer helpers so callers cannot influence
-- name resolution while those functions run with elevated privileges.
CREATE OR REPLACE FUNCTION public.has_role(role_name text)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.user_roles ur
    JOIN public.roles r ON r.id = ur.role_id
    WHERE ur.user_id = (select auth.uid())
      AND r.name = role_name
  );
$$;

CREATE OR REPLACE FUNCTION public.get_user_roles()
RETURNS SETOF text
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT r.name
  FROM public.user_roles ur
  JOIN public.roles r ON r.id = ur.role_id
  WHERE ur.user_id = (select auth.uid());
$$;

REVOKE EXECUTE ON FUNCTION public.has_role(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.has_role(text) TO authenticated;
REVOKE EXECUTE ON FUNCTION public.get_user_roles() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_user_roles() TO authenticated;

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  INSERT INTO public.users (id, email, name, password_hash)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'name', split_part(NEW.email, '@', 1)),
    NULL
  );
  RETURN NEW;
END;
$$;

-- Restrict direct browser updates to role-authorized users and protect the
-- session/device settings stored in the settings table.
DROP POLICY IF EXISTS users_update_own ON public.users;
CREATE POLICY users_update_own ON public.users
  FOR UPDATE TO authenticated
  USING (id = (select auth.uid()) OR public.has_role('admin'))
  WITH CHECK (id = (select auth.uid()) OR public.has_role('admin'));

DROP POLICY IF EXISTS tables_update ON public.tables_restaurant;
CREATE POLICY tables_update ON public.tables_restaurant
  FOR UPDATE TO authenticated
  USING (public.has_role('admin') OR public.has_role('waiter'))
  WITH CHECK (public.has_role('admin') OR public.has_role('waiter'));

DROP POLICY IF EXISTS orders_update ON public.orders;
CREATE POLICY orders_update ON public.orders
  FOR UPDATE TO authenticated
  USING (
    public.has_role('admin') OR public.has_role('waiter') OR
    public.has_role('kitchen') OR public.has_role('cashier')
  )
  WITH CHECK (
    public.has_role('admin') OR public.has_role('waiter') OR
    public.has_role('kitchen') OR public.has_role('cashier')
  );

DROP POLICY IF EXISTS order_items_update ON public.order_items;
CREATE POLICY order_items_update ON public.order_items
  FOR UPDATE TO authenticated
  USING (
    public.has_role('admin') OR public.has_role('waiter') OR
    public.has_role('kitchen') OR public.has_role('cashier')
  )
  WITH CHECK (
    public.has_role('admin') OR public.has_role('waiter') OR
    public.has_role('kitchen') OR public.has_role('cashier')
  );

DROP POLICY IF EXISTS audit_logs_insert ON public.audit_logs;
CREATE POLICY audit_logs_insert ON public.audit_logs
  FOR INSERT TO authenticated
  WITH CHECK (user_id = (select auth.uid()) OR public.has_role('admin'));

DROP POLICY IF EXISTS settings_select ON public.settings;
CREATE POLICY settings_select ON public.settings
  FOR SELECT TO authenticated
  USING (
    (key NOT LIKE 'sessions_%' AND key NOT LIKE 'max_devices_%') OR
    public.has_role('admin')
  );
