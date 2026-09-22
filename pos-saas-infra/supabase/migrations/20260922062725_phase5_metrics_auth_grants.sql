-- The metrics RPC runs as service_role from the API and only reads these
-- operational fields from auth.users. Keep this grant server-side; the
-- service_role key must never be exposed to browsers.
GRANT SELECT ON TABLE auth.users TO service_role;
