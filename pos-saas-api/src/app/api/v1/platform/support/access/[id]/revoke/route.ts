import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { authenticateApiRequest } from "@/lib/auth/api";
import { handleApiError, rpcApiError } from "@/lib/api/response";
import { getIdempotencyKey, hashIdempotencyPayload, parseIdempotentResult } from "@/lib/idempotency";
import { createAdminClient } from "@/lib/supabase/admin";
import { uuid } from "@/lib/validation/rules";

const revokeSchema = z.object({ reason: z.string().trim().min(5).max(500) });

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const auth = await authenticateApiRequest(request, ["platform_admin"]);
    if (auth.response) return auth.response;
    const idempotencyKey = getIdempotencyKey(request);
    if (!idempotencyKey || idempotencyKey.length < 16) {
      return Response.json(
        { error: { code: "REQUEST_ERROR", message: "Falta un header Idempotency-Key válido" } },
        { status: 400 },
      );
    }
    const accessId = uuid.parse((await params).id);
    const body = revokeSchema.parse(await request.json());
    const { data, error } = await (
      createAdminClient() as unknown as {
        rpc: (
          name: string,
          args: Record<string, unknown>,
        ) => Promise<{ data: unknown; error: { code?: string; message?: string } | null }>;
      }
    ).rpc("revoke_platform_support_access", {
      p_actor_user_id: auth.user.id,
      p_access_id: accessId,
      p_reason: body.reason,
      p_idempotency_key: idempotencyKey,
      p_request_hash: hashIdempotencyPayload({ accessId, reason: body.reason }),
    });
    if (error) return rpcApiError(error, "No se pudo revocar el acceso temporal");
    return NextResponse.json(parseIdempotentResult(data));
  } catch (error) {
    return handleApiError(error);
  }
}
