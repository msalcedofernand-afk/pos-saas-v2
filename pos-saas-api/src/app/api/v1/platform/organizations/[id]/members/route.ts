import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { authenticateApiRequest } from "@/lib/auth/api";
import { apiError, handleApiError } from "@/lib/api/response";
import { runPlatformMembershipAction } from "@/lib/platform/user-actions";
import { createAdminClient } from "@/lib/supabase/admin";
import { uuid } from "@/lib/validation/rules";

const addMemberSchema = z.object({
  userId: uuid.optional(),
  email: z.string().trim().email().max(254).optional(),
  name: z.string().trim().min(2).max(120).optional(),
  roleIds: z.array(uuid).min(1).max(20),
});

type MemberRole = { id: string; name: string; display_name: string };
type MemberRow = {
  user_id: string;
  is_default: boolean;
  created_at: string;
  roles: MemberRole | MemberRole[] | null;
  users:
    | { id: string; email: string; name: string | null; is_blocked: boolean }
    | { id: string; email: string; name: string | null; is_blocked: boolean }[]
    | null;
};

export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const auth = await authenticateApiRequest(request, ["platform_admin"]);
    if (auth.response) return auth.response;
    const organizationId = uuid.parse((await params).id);
    const { data, error } = await createAdminClient()
      .from("organization_members")
      .select("user_id, is_default, created_at, roles(id, name, display_name), users(id, email, name, is_blocked)")
      .eq("organization_id", organizationId)
      .order("created_at");
    if (error) throw error;
    const rows = (data ?? []) as unknown as MemberRow[];
    const members = new Map<
      string,
      { user: MemberRow["users"]; isDefault: boolean; createdAt: string; roles: MemberRole[] }
    >();
    for (const row of rows) {
      const user = Array.isArray(row.users) ? (row.users[0] ?? null) : row.users;
      if (!user) continue;
      const role = Array.isArray(row.roles) ? (row.roles[0] ?? null) : row.roles;
      const current = members.get(row.user_id) ?? {
        user,
        isDefault: row.is_default,
        createdAt: row.created_at,
        roles: [],
      };
      if (role) current.roles.push(role);
      current.isDefault ||= row.is_default;
      members.set(row.user_id, current);
    }
    return NextResponse.json({ data: [...members.values()] });
  } catch (error) {
    return handleApiError(error);
  }
}

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  let createdUserId: string | null = null;
  let db: ReturnType<typeof createAdminClient> | null = null;
  try {
    const auth = await authenticateApiRequest(request, ["platform_admin"]);
    if (auth.response) return auth.response;
    const organizationId = uuid.parse((await params).id);
    const idempotencyKey = request.headers.get("Idempotency-Key")?.trim() ?? "";
    if (idempotencyKey.length < 16 || idempotencyKey.length > 128)
      return apiError("Falta un header Idempotency-Key válido", 400);
    const body = addMemberSchema.parse(await request.json());
    db = createAdminClient();

    let userId = body.userId;
    let userEmail = body.email;
    if (userId) {
      const { data: existing, error } = await db.from("users").select("id, email").eq("id", userId).maybeSingle();
      if (error) throw error;
      if (!existing) return apiError("Usuario no encontrado", 404);
      userEmail = existing.email;
    } else if (userEmail) {
      const { data: existing, error } = await db
        .from("users")
        .select("id, email")
        .ilike("email", userEmail)
        .maybeSingle();
      if (error) throw error;
      if (existing) {
        userId = existing.id;
        userEmail = existing.email;
      } else {
        const webOrigin = (process.env.WEB_ORIGIN ?? process.env.NEXT_PUBLIC_SITE_URL ?? "").trim().replace(/\/+$/, "");
        if (!webOrigin) return apiError("La URL pública de la web no está configurada", 503);
        const { data: invited, error: inviteError } = await db.auth.admin.inviteUserByEmail(userEmail, {
          data: { name: body.name ?? userEmail.split("@")[0] },
          redirectTo: `${webOrigin}/auth/update-password`,
        });
        if (inviteError || !invited.user) return apiError("No se pudo enviar la invitación", 400);
        userId = invited.user.id;
        createdUserId = userId;
      }
    }
    if (!userId) return apiError("Debes indicar un usuario o correo", 400);

    const result = await runPlatformMembershipAction(request, organizationId, userId, "set", body.roleIds);
    if (result.status >= 400 && createdUserId && db) await db.auth.admin.deleteUser(createdUserId);
    if (result.status < 400) {
      const response = await result.clone().json();
      return NextResponse.json(
        { ...response, data: { ...response.data, invitationSent: Boolean(createdUserId), email: userEmail } },
        { status: result.status },
      );
    }
    return result;
  } catch (error) {
    if (createdUserId && db) await db.auth.admin.deleteUser(createdUserId);
    return handleApiError(error);
  }
}
