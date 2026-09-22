import { NextRequest, NextResponse } from "next/server";
import { authenticateApiRequest } from "@/lib/auth/api";
import { apiError, handleApiError, rpcApiError } from "@/lib/api/response";
import { getIdempotencyKey, hashIdempotencyPayload, parseIdempotentResult } from "@/lib/idempotency";
import { createAdminClient } from "@/lib/supabase/admin";
import { uuid } from "@/lib/validation/rules";

type RpcClient = {
  rpc(
    name: string,
    args: Record<string, unknown>,
  ): Promise<{ data: unknown; error: { code?: string; message?: string } | null }>;
};

export type PlatformUserAction = "block" | "unblock";
export type PlatformMembershipAction = "set" | "revoke";

function asRpcClient() {
  return createAdminClient() as unknown as RpcClient;
}

export async function runPlatformUserAction(request: NextRequest, userId: string, action: PlatformUserAction) {
  try {
    const auth = await authenticateApiRequest(request, ["platform_admin"]);
    if (auth.response) return auth.response;
    const idempotencyKey = getIdempotencyKey(request);
    if (!idempotencyKey || idempotencyKey.length < 16) {
      return apiError("Falta un header Idempotency-Key válido", 400);
    }
    const targetUserId = uuid.parse(userId);
    const db = createAdminClient();
    const { data: target, error: targetError } = await db
      .from("users")
      .select("id")
      .eq("id", targetUserId)
      .maybeSingle();
    if (targetError) throw targetError;
    if (!target) return apiError("Usuario no encontrado", 404);

    const { data, error } = await asRpcClient().rpc("apply_platform_user_action", {
      p_action: action,
      p_actor_user_id: auth.user.id,
      p_idempotency_key: idempotencyKey,
      p_request_hash: hashIdempotencyPayload({ action, userId: targetUserId }),
      p_target_user_id: targetUserId,
    });
    if (error) return rpcApiError(error, "No se pudo actualizar el usuario");

    try {
      const { error: authError } = await db.auth.admin.updateUserById(targetUserId, {
        ban_duration: action === "block" ? "876000h" : "none",
      });
      if (authError) throw authError;
    } catch (authError) {
      // Keep the database state and Auth state aligned if Auth Admin rejects the ban.
      await asRpcClient().rpc("apply_platform_user_action", {
        p_action: action === "block" ? "unblock" : "block",
        p_actor_user_id: auth.user.id,
        p_idempotency_key: `${idempotencyKey}-rollback`,
        p_request_hash: hashIdempotencyPayload({
          action: action === "block" ? "unblock" : "block",
          userId: targetUserId,
        }),
        p_target_user_id: targetUserId,
      });
      throw authError;
    }

    return NextResponse.json(parseIdempotentResult(data));
  } catch (error) {
    return handleApiError(error);
  }
}

export async function runPlatformMembershipAction(
  request: NextRequest,
  organizationId: string,
  targetUserId: string,
  action: PlatformMembershipAction,
  roleIds: string[],
) {
  try {
    const auth = await authenticateApiRequest(request, ["platform_admin"]);
    if (auth.response) return auth.response;
    const idempotencyKey = getIdempotencyKey(request);
    if (!idempotencyKey || idempotencyKey.length < 16) {
      return apiError("Falta un header Idempotency-Key válido", 400);
    }
    const organizationUuid = uuid.parse(organizationId);
    const userUuid = uuid.parse(targetUserId);
    const payload = { action, organizationId: organizationUuid, roleIds, targetUserId: userUuid };
    const { data, error } = await asRpcClient().rpc("apply_platform_membership_action", {
      p_action: action,
      p_actor_user_id: auth.user.id,
      p_idempotency_key: idempotencyKey,
      p_organization_id: organizationUuid,
      p_request_hash: hashIdempotencyPayload(payload),
      p_role_ids: roleIds,
      p_target_user_id: userUuid,
    });
    if (error) return rpcApiError(error, "No se pudo actualizar la membresía");
    return NextResponse.json(parseIdempotentResult(data));
  } catch (error) {
    return handleApiError(error);
  }
}
