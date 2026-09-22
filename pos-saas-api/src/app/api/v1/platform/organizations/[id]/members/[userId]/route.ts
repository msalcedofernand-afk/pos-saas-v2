import { NextRequest } from "next/server";
import { z } from "zod";
import { handleApiError } from "@/lib/api/response";
import { runPlatformMembershipAction } from "@/lib/platform/user-actions";
import { uuid } from "@/lib/validation/rules";

const rolesSchema = z.object({ roleIds: z.array(uuid).min(1).max(20) });

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string; userId: string }> }) {
  try {
    const routeParams = await params;
    const body = rolesSchema.parse(await request.json());
    return runPlatformMembershipAction(request, routeParams.id, routeParams.userId, "set", body.roleIds);
  } catch (error) {
    return handleApiError(error);
  }
}

export async function DELETE(request: NextRequest, { params }: { params: Promise<{ id: string; userId: string }> }) {
  try {
    const routeParams = await params;
    return runPlatformMembershipAction(request, routeParams.id, routeParams.userId, "revoke", []);
  } catch (error) {
    return handleApiError(error);
  }
}
