import "server-only";

import { createSupabaseContext } from "@supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { apiError } from "@/lib/api/response";
import type { Database } from "@/types/database";

export interface ApiUser {
  id: string;
  email: string | undefined;
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

export async function getUserRoles(userId: string) {
  const adminClient = createAdminClient();
  const { data: roleRows, error: roleError } = await (adminClient as any)
    .from("user_roles")
    .select("roles(name)")
    .eq("user_id", userId);

  if (roleError) throw roleError;

  return (roleRows ?? [])
    .map((row: any) => row.roles?.name)
    .filter(Boolean) as string[];
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

  const roles = await getUserRoles(user.id);

  if (allowedRoles && !roles.some((role) => allowedRoles.includes(role))) {
    return { user: null, response: apiError("Permisos insuficientes", 403) } as const;
  }

  return {
    user: { id: user.id, email: user.email, roles } satisfies ApiUser,
    response: null,
  } as const;
}
