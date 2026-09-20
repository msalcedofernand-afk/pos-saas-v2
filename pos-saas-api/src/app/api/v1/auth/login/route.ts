import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { getUserAccess, getUserRoles } from "@/lib/auth/api";
import { apiError, handleApiError } from "@/lib/api/response";

export const dynamic = "force-dynamic";

const loginSchema = z.object({
  email: z.string().trim().email().max(254),
  password: z.string().min(8).max(128),
});

export async function POST(request: NextRequest) {
  try {
    const body = loginSchema.parse(await request.json());
    const supabase = await createClient();
    const { data, error } = await supabase.auth.signInWithPassword({
      email: body.email,
      password: body.password,
    });

    if (error || !data.user) {
      return apiError("Credenciales inválidas", 401);
    }

    const profile = await getUserAccess(data.user.id);
    if (!profile || profile.is_blocked) {
      await supabase.auth.signOut();
      return apiError("Usuario bloqueado o sin perfil operativo", 403);
    }

    const roles = await getUserRoles(data.user.id);
    return NextResponse.json({
      data: {
        user: { id: data.user.id, email: data.user.email },
        roles,
      },
    });
  } catch (error) {
    return handleApiError(error);
  }
}
