import "server-only";

import { createSupabaseContext } from "@supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { apiError } from "@/lib/api/response";
import type { Database } from "@/types/database";

export interface ApiUser {
  id: string;
  email: string | undefined;
  organizationId: string;
  roles: string[];
}

type MembershipRow = {
  organization_id: string;
  is_default: boolean;
  created_at: string;
  roles: { name: string } | { name: string }[] | null;
};

export async function getUserAccess(userId: string) {
  const adminClient = createAdminClient();
  const { data: profile, error: profileError } = await adminClient
    .from("users")
    .select("id, is_blocked")
    .eq("id", userId)
    .maybeSingle();

  if (profileError) throw profileError;
  return profile as { id: string; is_blocked: boolean } | null;
}

export async function getGlobalUserRoles(userId: string) {
  const { data, error } = await createAdminClient().from("user_roles").select("roles(name)").eq("user_id", userId);

  if (error) throw error;
  return ((data ?? []) as unknown as Array<{ roles: { name: string } | { name: string }[] | null }>)
    .flatMap((row) => (Array.isArray(row.roles) ? row.roles : row.roles ? [row.roles] : []))
    .map((role) => role.name)
    .filter(Boolean);
}

/**
 * One-time bootstrap for the first platform administrator.
 * The email is server configuration, never client input. Once a platform
 * administrator exists, this path cannot promote another account.
 */
export async function ensureConfiguredPlatformAdmin(userId: string, email?: string) {
  const configuredEmail = process.env.PLATFORM_ADMIN_EMAIL?.trim().toLowerCase();
  if (!configuredEmail || !email || email.trim().toLowerCase() !== configuredEmail) return false;

  const db = createAdminClient();
  const { data: platformRole, error: roleError } = await db
    .from("roles")
    .select("id")
    .eq("name", "platform_admin")
    .maybeSingle();
  if (roleError) throw roleError;
  if (!platformRole) return false;

  const { count, error: countError } = await db
    .from("user_roles")
    .select("user_id", { count: "exact", head: true })
    .eq("role_id", platformRole.id);
  if (countError) throw countError;
  if ((count ?? 0) > 0) return false;

  const { error: insertError } = await db.from("user_roles").insert({ user_id: userId, role_id: platformRole.id });
  if (insertError && insertError.code !== "23505") throw insertError;
  if (!insertError) {
    const { error: auditError } = await db.from("platform_audit_logs").insert({
      actor_user_id: userId,
      action: "platform_admin_bootstrap",
      auditable_type: "users",
      auditable_id: userId,
      new_values: { role: "platform_admin", source: "PLATFORM_ADMIN_EMAIL" },
    });
    if (auditError) throw auditError;
  }
  return true;
}

export async function getUserMembership(userId: string, requestedOrganizationId?: string) {
  const adminClient = createAdminClient();
  let query = adminClient
    .from("organization_members")
    .select("organization_id, roles(name), organizations!inner(is_active), is_default, created_at")
    .eq("user_id", userId)
    .eq("organizations.is_active", true)
    .order("is_default", { ascending: false })
    .order("created_at", { ascending: true });

  if (requestedOrganizationId) query = query.eq("organization_id", requestedOrganizationId);

  const { data, error: membershipError } = await query;

  if (membershipError) throw membershipError;
  const membershipRows = (data ?? []) as unknown as MembershipRow[];
  const organizationId = membershipRows?.[0]?.organization_id as string | undefined;
  if (!organizationId) return null;

  const roles = (membershipRows ?? [])
    .filter((row) => row.organization_id === organizationId)
    .flatMap((row) => (Array.isArray(row.roles) ? row.roles : row.roles ? [row.roles] : []))
    .map((role) => role.name)
    .filter(Boolean) as string[];

  return { organizationId, roles };
}

export async function getUserMemberships(userId: string) {
  const adminClient = createAdminClient();
  const { data, error } = await adminClient
    .from("organization_members")
    .select("organization_id, is_default, created_at, organizations!inner(id, name, slug, is_active)")
    .eq("user_id", userId)
    .eq("organizations.is_active", true)
    .order("is_default", { ascending: false })
    .order("created_at", { ascending: true });

  if (error) throw error;
  const rows = (data ?? []) as unknown as Array<{
    organization_id: string;
    is_default: boolean;
    organizations: { id: string; name: string; slug: string; is_active: boolean };
  }>;
  const organizations = new Map<string, { id: string; name: string; slug: string; isDefault: boolean }>();
  for (const row of rows) {
    if (!organizations.has(row.organizations.id)) {
      organizations.set(row.organizations.id, {
        id: row.organizations.id,
        name: row.organizations.name,
        slug: row.organizations.slug,
        isDefault: row.is_default,
      });
    }
  }
  return [...organizations.values()];
}

export async function getUserRoles(userId: string) {
  const membership = await getUserMembership(userId);
  return membership?.roles ?? [];
}

export async function authenticateApiRequest(request: Request, allowedRoles?: readonly string[]) {
  const authorization = request.headers.get("authorization");
  let user: { id: string; email?: string } | null = null;

  if (authorization?.match(/^Bearer\s+\S+$/i)) {
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const publishableKey =
      process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ?? process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
    const secretKey = process.env.SUPABASE_SECRET_KEY ?? process.env.SUPABASE_SERVICE_ROLE_KEY;

    if (!url || !publishableKey || !secretKey) {
      return { user: null, response: apiError("La API no está configurada", 503) } as const;
    }

    const { data: context, error: authError } = await createSupabaseContext<Database>(request, {
      auth: "user",
      env: {
        url,
        publishableKeys: { default: publishableKey },
        secretKeys: { default: secretKey },
        jwks: new URL(process.env.SUPABASE_JWKS_URL ?? `${url}/auth/v1/.well-known/jwks.json`),
      },
    });

    if (authError || !context?.userClaims) {
      return { user: null, response: apiError("No autenticado", 401) } as const;
    }

    user = {
      id: context.userClaims.id,
      email: context.userClaims.email,
    };
  } else {
    const supabase = await createClient();
    const { data: authData, error: authError } = await supabase.auth.getUser();
    user = authData.user ? { id: authData.user.id, email: authData.user.email } : null;

    if (authError || !user) {
      return { user: null, response: apiError("No autenticado", 401) } as const;
    }
  }

  const profile = await getUserAccess(user.id);
  if (!profile || profile.is_blocked) {
    return { user: null, response: apiError("Usuario bloqueado o sin perfil operativo", 403) } as const;
  }

  const requestedOrganizationId = request.headers.get("x-organization-id")?.trim();
  if (requestedOrganizationId && !/^[0-9a-f-]{36}$/i.test(requestedOrganizationId)) {
    return { user: null, response: apiError("Organización inválida", 400) } as const;
  }

  const globalRoles = await getGlobalUserRoles(user.id);
  let membership = await getUserMembership(user.id, requestedOrganizationId);
  const isPlatformAdmin = globalRoles.includes("platform_admin");

  if (!membership && isPlatformAdmin) {
    const db = createAdminClient();
    let organizationQuery = db
      .from("organizations")
      .select("id")
      .eq("is_active", true)
      .order("created_at", { ascending: true })
      .limit(1);
    if (requestedOrganizationId) organizationQuery = organizationQuery.eq("id", requestedOrganizationId);
    const { data: organization, error: organizationError } = await organizationQuery.maybeSingle();
    if (organizationError) throw organizationError;
    if (organization) membership = { organizationId: organization.id, roles: [] };
  }

  if (!membership && !isPlatformAdmin) {
    return { user: null, response: apiError("Usuario sin organización asignada", 403) } as const;
  }
  if (!membership) {
    return { user: null, response: apiError("No hay una organización activa disponible", 503) } as const;
  }

  const roles = [...new Set([...globalRoles, ...(membership?.roles ?? [])])];

  if (allowedRoles && !roles.some((role) => allowedRoles.includes(role) || role === "platform_admin")) {
    return { user: null, response: apiError("Permisos insuficientes", 403) } as const;
  }

  return {
    user: { id: user.id, email: user.email, organizationId: membership.organizationId, roles } satisfies ApiUser,
    response: null,
  } as const;
}
