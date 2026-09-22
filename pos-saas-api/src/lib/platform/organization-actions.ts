import { NextRequest, NextResponse } from "next/server";
import { authenticateApiRequest } from "@/lib/auth/api";
import { apiError, handleApiError, rpcApiError } from "@/lib/api/response";
import { getIdempotencyKey, hashIdempotencyPayload, parseIdempotentResult } from "@/lib/idempotency";
import { createAdminClient } from "@/lib/supabase/admin";
import { uuid } from "@/lib/validation/rules";

export type PlatformOrganizationAction = "update" | "suspend" | "reactivate";

export async function runPlatformOrganizationAction(
  request: NextRequest,
  organizationId: string,
  action: PlatformOrganizationAction,
  payload: { name?: string; reason?: string },
) {
  try {
    const auth = await authenticateApiRequest(request, ["platform_admin"]);
    if (auth.response) return auth.response;

    const idempotencyKey = getIdempotencyKey(request);
    if (!idempotencyKey || idempotencyKey.length < 16) {
      return apiError("Falta un header Idempotency-Key válido", 400);
    }

    const id = uuid.parse(organizationId);
    const db = createAdminClient();
    const { data, error } = await db.rpc("apply_platform_organization_action", {
      p_action: action,
      p_actor_user_id: auth.user.id,
      p_idempotency_key: idempotencyKey,
      p_name: payload.name ?? null,
      p_organization_id: id,
      p_reason: payload.reason ?? null,
      p_request_hash: hashIdempotencyPayload({ action, ...payload }),
    });
    if (error) return rpcApiError(error, "No se pudo actualizar la organización");

    const response = parseIdempotentResult<{ meta?: { replayed?: boolean } }>(data);
    return NextResponse.json(response, { status: 200 });
  } catch (error) {
    return handleApiError(error);
  }
}
