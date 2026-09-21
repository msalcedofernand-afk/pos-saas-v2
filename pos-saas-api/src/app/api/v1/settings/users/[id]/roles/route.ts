import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { authenticateApiRequest } from "@/lib/auth/api";
import { handleApiError, rpcApiError } from "@/lib/api/response";
import { createAdminClient } from "@/lib/supabase/admin";
import { uuid } from "@/lib/validation/rules";

const idSchema = uuid;
const bodySchema = z.object({ roleIds: z.array(uuid).max(20) });

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const auth = await authenticateApiRequest(request, ["admin"]);
    if (auth.response) return auth.response;
    const userId = idSchema.parse((await params).id);
    const body = bodySchema.parse(await request.json());
    const db = createAdminClient();
    const { data, error } = await db.rpc("update_organization_member_roles_transaction", {
      p_actor_user_id: auth.user.id,
      p_target_user_id: userId,
      p_organization_id: auth.user.organizationId,
      p_role_ids: body.roleIds,
    });
    if (error) return rpcApiError(error, "No se pudieron actualizar los roles");
    return NextResponse.json({ data });
  } catch (error) {
    return handleApiError(error);
  }
}
