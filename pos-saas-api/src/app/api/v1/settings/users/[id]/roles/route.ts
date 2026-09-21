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
    const { error: membershipDeleteError } = await db.from("organization_members").delete().eq("organization_id", auth.user.organizationId).eq("user_id", userId);
    if (membershipDeleteError) throw membershipDeleteError;
    if (body.roleIds.length > 0) {
      const { error: membershipInsertError } = await db.from("organization_members").insert(body.roleIds.map((roleId, index) => ({ organization_id: auth.user.organizationId, user_id: userId, role_id: roleId, is_default: index === 0 })));
      if (membershipInsertError) throw membershipInsertError;
    }
    await db.from("audit_logs").insert({ organization_id: auth.user.organizationId, user_id: auth.user.id, action: "update_user_roles", auditable_type: "users", auditable_id: userId, new_values: { role_ids: body.roleIds } });
    return NextResponse.json({ data: { userId, roleIds: body.roleIds } });
  } catch (error) {
    return handleApiError(error);
  }
}
