import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { authenticateApiRequest } from "@/lib/auth/api";
import { apiError, handleApiError } from "@/lib/api/response";
import { getIdempotencyKey, hashIdempotencyPayload, parseIdempotentResult } from "@/lib/idempotency";
import { createAdminClient } from "@/lib/supabase/admin";
import { money } from "@/lib/validation/rules";

const bodySchema = z.object({ openingAmount: money() });

export async function POST(request: NextRequest) {
  try {
    const auth = await authenticateApiRequest(request, ["admin", "cashier"]);
    if (auth.response) return auth.response;
    const body = bodySchema.parse(await request.json());
    const idempotencyKey = getIdempotencyKey(request);
    if (!idempotencyKey) return apiError("Falta el header Idempotency-Key", 400);
    const db = createAdminClient();
    const { data: rawResult, error } = await db.rpc("open_cash_shift_idempotent", {
      p_user_id: auth.user.id,
      p_opening_amount: body.openingAmount,
      p_idempotency_key: idempotencyKey,
      p_request_hash: hashIdempotencyPayload(body),
    });
    if (error)
      return apiError(
        error.code === "23505" ? "Ya tienes una caja abierta" : "No se pudo abrir caja",
        error.code === "23505" ? 409 : 409,
      );
    const result = parseIdempotentResult<{ shift?: Record<string, unknown>; replayed?: boolean }>(rawResult);
    if (!result.shift) return apiError("No se pudo abrir caja", 500);
    return NextResponse.json(
      { data: result.shift, meta: { replayed: result.replayed === true } },
      { status: result.replayed ? 200 : 201 },
    );
  } catch (error) {
    return handleApiError(error);
  }
}
