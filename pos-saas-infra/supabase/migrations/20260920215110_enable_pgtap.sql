-- Enable pgTAP so `supabase test db` can execute the database test suite.
CREATE EXTENSION IF NOT EXISTS pgtap WITH SCHEMA extensions;
