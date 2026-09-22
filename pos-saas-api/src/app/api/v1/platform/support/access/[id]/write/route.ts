import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { authenticateApiRequest } from "@/lib/auth/api";
import { handleApiError, rpcApiError } from "@/lib/api/response";
import { getIdempotencyKey, hashIdempotencyPayload, parseIdempotentResult } from "@/lib/idempotency";
import { createAdminClient } from "@/lib/supabase/admin";
import { uuid } from "@/lib/validation/rules";

const confirmationSchema = z.object({ confirmation: z.literal("CONFIRMAR_ACCESO_ESCRITURA") });

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
    const body = confirmationSchema.parse(await request.json());
    const { data, error } = await (
      createAdminClient() as unknown as {
        rpc: (
          name: string,
          args: Record<string, unknown>,
        ) => Promise<{ data: unknown; error: { code?: string; message?: string } | null }>;
      }
    ).rpc("enable_platform_support_write", {
      p_actor_user_id: auth.user.id,
      p_access_id: accessId,
      p_confirmation: body.confirmation,
      p_idempotency_key: idempotencyKey,
      p_request_hash: hashIdempotencyPayload({ accessId, confirmation: body.confirmation }),
    });
    if (error) return rpcApiError(error, "No se pudo habilitar el acceso de escritura");
    return NextResponse.json(parseIdempotentResult(data));
  } catch (error) {
    return handleApiError(error);
  }
}
