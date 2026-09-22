-- Phase 7 contract checks. Runtime checks are executed against staging by the
-- release workflow; this file documents the database invariants for pgTAP.
BEGIN;

SELECT plan(9);

SELECT has_table('public', 'plans', 'el catálogo de planes existe');
SELECT has_table('public', 'organization_subscriptions', 'las suscripciones por organización existen');
SELECT has_table('public', 'organization_limits', 'los límites por organización existen');
SELECT has_table('public', 'usage_counters', 'los contadores de uso existen');
SELECT has_function('public', 'get_organization_plan_usage', ARRAY['uuid', 'date'], 'existe la función de consumo');
SELECT has_function('public', 'set_organization_subscription', ARRAY['uuid', 'uuid', 'text', 'text', 'text'], 'existe la función de asignación');
SELECT has_function('public', 'enforce_organization_plan_limit', ARRAY[]::text[], 'existe el guard de límites');
SELECT policies_are('public', 'plans', ARRAY[]::text[], 'planes sin acceso directo por RLS');
SELECT policies_are('public', 'organization_subscriptions', ARRAY[]::text[], 'suscripciones sin acceso directo por RLS');

SELECT * FROM finish();
ROLLBACK;
