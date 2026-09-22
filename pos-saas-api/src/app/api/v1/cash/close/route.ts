import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { authenticateApiRequest } from "@/lib/auth/api";
import { apiError, handleApiError, rpcApiError } from "@/lib/api/response";
import { getIdempotencyKey, hashIdempotencyPayload, parseIdempotentResult } from "@/lib/idempotency";
import { createAdminClient } from "@/lib/supabase/admin";
import { boundedText, limits, money } from "@/lib/validation/rules";

const bodySchema = z.object({
  closingAmount: money(),
  differenceReason: boundedText(limits.differenceReason).optional(),
});

export async function POST(request: NextRequest) {
  try {
    const auth = await authenticateApiRequest(request, ["admin", "cashier"], { requireOrganization: true });
    if (auth.response) return auth.response;
    const body = bodySchema.parse(await request.json());
    const idempotencyKey = getIdempotencyKey(request);
    if (!idempotencyKey) return apiError("Falta el header Idempotency-Key", 400);
    const db = createAdminClient();
    const { data: rawResult, error } = await db.rpc("close_cash_shift_idempotent", {
      p_user_id: auth.user.id,
      p_closing_amount: body.closingAmount,
      p_difference_reason: body.differenceReason ?? "",
      p_idempotency_key: idempotencyKey,
      p_request_hash: hashIdempotencyPayload(body),
    });
    if (error) return rpcApiError(error, "No se pudo cerrar caja");
    const result = parseIdempotentResult<{ shift?: Record<string, unknown>; replayed?: boolean }>(rawResult);
    const shift = result.shift;
    if (!shift) return apiError("No se pudo cerrar caja", 500);
    return NextResponse.json({ data: shift, meta: { replayed: result.replayed === true } });
  } catch (error) {
    return handleApiError(error);
  }
}
