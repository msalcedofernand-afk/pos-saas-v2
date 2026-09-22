import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { authenticateApiRequest } from "@/lib/auth/api";
import { apiError, handleApiError, rpcApiError } from "@/lib/api/response";
import { createAdminClient } from "@/lib/supabase/admin";

export async function POST(request: NextRequest) {
  try {
    const auth = await authenticateApiRequest(request, ["admin"], { requireOrganization: true });
    if (auth.response) return auth.response;
    // Actual tenant membership is required even for platform accounts.
    const db = createAdminClient();
    const { data: membership, error: membershipError } = await db
      .from("organization_members")
      .select("roles(name)")
      .eq("organization_id", auth.user.organizationId)
      .eq("user_id", auth.user.id);
    if (membershipError) throw membershipError;
    if (
      !membership?.some((m) => {
        const roles = m.roles as unknown as { name: string } | { name: string }[];
        return (Array.isArray(roles) ? roles : [roles]).some((r) => r?.name === "admin");
      })
    )
      return apiError("Solo el administrador de este restaurante puede invitar", 403);
    const body = z
      .object({
        name: z.string().trim().min(2).max(120),
        email: z.email().max(254),
        role: z.enum(["manager", "cashier", "kitchen", "waiter", "staff"]),
      })
      .strict()
      .parse(await request.json());
    const email = body.email.trim().toLowerCase();
    const { data: existing, error: lookupError } = await db.from("users").select("id").eq("email", email).maybeSingle();
    if (lookupError) throw lookupError;
    // Do not attach an existing account by email without its consent.
    if (existing)
      return apiError(
        "El correo ya tiene cuenta. Solicita al propietario gestionar su incorporación o reenviar la invitación",
        409,
      );
    const origin = process.env.WEB_ORIGIN?.replace(/\/$/, "");
    if (!origin) return apiError("La URL de invitación no está configurada", 503);
    const { data: invited, error: inviteError } = await db.auth.admin.inviteUserByEmail(email, {
      data: { name: body.name },
      redirectTo: `${origin}/auth/update-password`,
    });
    if (inviteError || !invited.user) return apiError("No se pudo enviar la invitación. Intenta más tarde", 400);
    const rpc = db as unknown as {
      rpc(name: string, args: Record<string, unknown>): Promise<{ error: { code?: string; message?: string } | null }>;
    };
    const result = await rpc.rpc("add_restaurant_worker", {
      p_actor: auth.user.id,
      p_organization: auth.user.organizationId,
      p_target: invited.user.id,
      p_role: body.role,
    });
    if (result.error)
      return rpcApiError(
        result.error,
        "Se envió el correo, pero falta asignar el acceso. Contacta al propietario para completar la incorporación",
      );
    return NextResponse.json({ data: { invitationSent: true } }, { status: 201 });
  } catch (error) {
    return handleApiError(error);
  }
}
