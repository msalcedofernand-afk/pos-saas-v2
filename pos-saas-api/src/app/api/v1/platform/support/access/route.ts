import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { authenticateApiRequest } from "@/lib/auth/api";
import { apiError, handleApiError, rpcApiError } from "@/lib/api/response";
import { getIdempotencyKey, hashIdempotencyPayload, parseIdempotentResult } from "@/lib/idempotency";
import { expireSupportAccessSessions } from "@/lib/platform/support-access";
import { createAdminClient } from "@/lib/supabase/admin";
import { uuid } from "@/lib/validation/rules";

const supportRequestSchema = z.object({
  organizationId: uuid,
  reason: z.string().trim().min(10).max(1000),
  durationMinutes: z.number().int().min(15).max(480).default(60),
});

const rpcClient = createAdminClient as unknown as () => {
  rpc: (
    name: string,
    args: Record<string, unknown>,
  ) => Promise<{ data: unknown; error: { code?: string; message?: string } | null }>;
};

export async function GET(request: NextRequest) {
  try {
    const auth = await authenticateApiRequest(request, ["platform_admin"]);
    if (auth.response) return auth.response;
    await expireSupportAccessSessions();
    const { data, error } = await createAdminClient()
      .from("platform_support_access_requests")
      .select(
        "id, actor_user_id, organization_id, reason, duration_minutes, mode, status, requested_at, starts_at, expires_at, entered_at, write_enabled_at, revoked_at, revoke_reason, organizations(id, name, slug, status)",
      )
      .order("created_at", { ascending: false })
      .limit(100);
    if (error) throw error;
    return NextResponse.json({ data: data ?? [] });
  } catch (error) {
    return handleApiError(error);
  }
}

export async function POST(request: NextRequest) {
  try {
    const auth = await authenticateApiRequest(request, ["platform_admin"]);
    if (auth.response) return auth.response;
    const idempotencyKey = getIdempotencyKey(request);
    if (!idempotencyKey || idempotencyKey.length < 16) return apiError("Falta un header Idempotency-Key válido", 400);
    const body = supportRequestSchema.parse(await request.json());
    const requestHash = hashIdempotencyPayload(body);
    const { data, error } = await rpcClient().rpc("create_platform_support_access", {
      p_actor_user_id: auth.user.id,
      p_organization_id: body.organizationId,
      p_reason: body.reason,
      p_duration_minutes: body.durationMinutes,
      p_idempotency_key: idempotencyKey,
      p_request_hash: requestHash,
    });
    if (error) return rpcApiError(error, "No se pudo crear el acceso temporal");
    return NextResponse.json(parseIdempotentResult(data), { status: 201 });
  } catch (error) {
    return handleApiError(error);
  }
}
