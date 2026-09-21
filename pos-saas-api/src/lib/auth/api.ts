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

export async function getUserAccess(userId: string) {
  const adminClient = createAdminClient();
  const { data: profile, error: profileError } = await (adminClient as any)
    .from("users")
    .select("id, is_blocked")
    .eq("id", userId)
    .maybeSingle();

  if (profileError) throw profileError;
  return profile as { id: string; is_blocked: boolean } | null;
}

export async function getUserMembership(userId: string) {
  const adminClient = createAdminClient();
  const { data: membershipRows, error: membershipError } = await (adminClient as any)
    .from("organization_members")
    .select("organization_id, roles(name), organizations!inner(is_active), is_default, created_at")
    .eq("user_id", userId)
    .eq("organizations.is_active", true)
    .order("is_default", { ascending: false })
    .order("created_at", { ascending: true });

  if (membershipError) throw membershipError;
  const organizationId = membershipRows?.[0]?.organization_id as string | undefined;
  if (!organizationId) return null;

  const roles = (membershipRows ?? [])
    .filter((row: any) => row.organization_id === organizationId)
    .map((row: any) => row.roles?.name)
    .filter(Boolean) as string[];

  return { organizationId, roles };
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
    const publishableKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ?? process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
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
        jwks: new URL(
          process.env.SUPABASE_JWKS_URL ?? `${url}/auth/v1/.well-known/jwks.json`,
        ),
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

  const membership = await getUserMembership(user.id);
  if (!membership) {
    return { user: null, response: apiError("Usuario sin organización asignada", 403) } as const;
  }

  const roles = membership.roles;

  if (allowedRoles && !roles.some((role) => allowedRoles.includes(role))) {
    return { user: null, response: apiError("Permisos insuficientes", 403) } as const;
  }

  return {
    user: { id: user.id, email: user.email, organizationId: membership.organizationId, roles } satisfies ApiUser,
    response: null,
  } as const;
}
