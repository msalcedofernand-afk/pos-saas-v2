import { NextRequest, NextResponse } from "next/server";
import { authenticateApiRequest } from "@/lib/auth/api";
import { apiError, handleApiError } from "@/lib/api/response";
import { createAdminClient } from "@/lib/supabase/admin";
import { uuid } from "@/lib/validation/rules";

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const auth = await authenticateApiRequest(request, ["platform_admin"]);
    if (auth.response) return auth.response;
    const userId = uuid.parse((await params).id);
    const db = createAdminClient();
    const { data: user, error: userError } = await db
      .from("users")
      .select("id, email, name")
      .eq("id", userId)
      .maybeSingle();
    if (userError) throw userError;
    if (!user) return apiError("Usuario no encontrado", 404);
    const webOrigin = (process.env.WEB_ORIGIN ?? process.env.NEXT_PUBLIC_SITE_URL ?? "").trim().replace(/\/+$/, "");
    if (!webOrigin) return apiError("La URL pública de la web no está configurada", 503);
    const { data, error } = await db.auth.admin.inviteUserByEmail(user.email, {
      data: { name: user.name },
      redirectTo: `${webOrigin}/auth/update-password`,
    });
    if (error || !data.user) return apiError("No se pudo reenviar la invitación", 400);
    const { error: auditError } = await db.from("platform_audit_logs").insert({
      actor_user_id: auth.user.id,
      action: "user_invitation_resent",
      auditable_type: "users",
      auditable_id: userId,
      new_values: { email: user.email },
    });
    if (auditError) throw auditError;
    return NextResponse.json({ data: { userId, email: user.email, invitationSent: true } });
  } catch (error) {
    return handleApiError(error);
  }
}
