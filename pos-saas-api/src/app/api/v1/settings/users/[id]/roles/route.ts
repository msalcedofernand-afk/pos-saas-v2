import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { authenticateApiRequest } from "@/lib/auth/api";
import { handleApiError } from "@/lib/api/response";
import { createAdminClient } from "@/lib/supabase/admin";

const idSchema = z.string().uuid();
const bodySchema = z.object({ roleIds: z.array(z.string().uuid()).max(20) });

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const auth = await authenticateApiRequest(request, ["admin"]);
    if (auth.response) return auth.response;
    const userId = idSchema.parse((await params).id);
    const body = bodySchema.parse(await request.json());
    const db = createAdminClient() as any;
    const { error: deleteError } = await db.from("user_roles").delete().eq("user_id", userId);
    if (deleteError) throw deleteError;
    if (body.roleIds.length > 0) {
      const { error } = await db.from("user_roles").insert(body.roleIds.map((roleId) => ({ user_id: userId, role_id: roleId })));
      if (error) throw error;
    }
    await db.from("audit_logs").insert({ user_id: auth.user.id, action: "update_user_roles", auditable_type: "users", auditable_id: userId, new_values: { role_ids: body.roleIds } });
    return NextResponse.json({ data: { userId, roleIds: body.roleIds } });
  } catch (error) {
    return handleApiError(error);
  }
}
