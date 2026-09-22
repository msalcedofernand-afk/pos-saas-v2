import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { ensureConfiguredPlatformAdmin, getGlobalUserRoles, getUserAccess, getUserMembership } from "@/lib/auth/api";
import { apiError, handleApiError } from "@/lib/api/response";
import { checkLoginSecurity, recordLoginFailure, resetLoginSecurity } from "@/lib/auth/login-security";
import { getOrCreateCsrfToken, setCsrfCookie } from "@/lib/security/csrf";
import { isGlobalRole } from "@/lib/auth/roles";

export const dynamic = "force-dynamic";

const loginSchema = z.object({
  email: z.string().trim().email().max(254),
  password: z.string().min(8).max(128),
});

export async function POST(request: NextRequest) {
  try {
    const body = loginSchema.parse(await request.json());
    const securityContext = await checkLoginSecurity(request, body.email);
    if (securityContext.blocked) {
      const response = apiError("Demasiados intentos. Intenta nuevamente más tarde", 429);
      if (securityContext.retryAfter) response.headers.set("Retry-After", String(securityContext.retryAfter));
      return response;
    }

    const supabase = await createClient();
    const { data, error } = await supabase.auth.signInWithPassword({
      email: body.email,
      password: body.password,
    });

    if (error || !data.user) {
      const failure = await recordLoginFailure(securityContext);
      if (failure.blocked) {
        const response = apiError("Demasiados intentos. Intenta nuevamente más tarde", 429);
        if (failure.retryAfter) response.headers.set("Retry-After", String(failure.retryAfter));
        return response;
      }
      return apiError("Credenciales inválidas", 401);
    }

    const profile = await getUserAccess(data.user.id);
    if (!profile || profile.is_blocked) {
      await supabase.auth.signOut();
      return apiError("Usuario bloqueado o sin perfil operativo", 403);
    }

    await ensureConfiguredPlatformAdmin(data.user.id, data.user.email);
    const globalRoles = await getGlobalUserRoles(data.user.id);
    const membership = await getUserMembership(data.user.id);
    if (!membership && !globalRoles.some(isGlobalRole)) {
      await resetLoginSecurity(securityContext);
      const csrfToken = getOrCreateCsrfToken(request);
      return setCsrfCookie(NextResponse.json({ data: { roles: globalRoles, onboarding: true, csrfToken } }), csrfToken);
    }
    await resetLoginSecurity(securityContext);
    const csrfToken = getOrCreateCsrfToken(request);
    const response = NextResponse.json({
      data: {
        user: { id: data.user.id, email: data.user.email, organizationId: membership?.organizationId ?? null },
        roles: [...new Set([...globalRoles, ...(membership?.roles ?? [])])],
        csrfToken,
      },
    });
    return setCsrfCookie(response, csrfToken);
  } catch (error) {
    return handleApiError(error);
  }
}
