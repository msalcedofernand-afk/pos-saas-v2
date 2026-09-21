import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { authenticateApiRequest } from "@/lib/auth/api";
import { apiError, handleApiError, rpcApiError } from "@/lib/api/response";
import { getIdempotencyKey, hashIdempotencyPayload, parseIdempotentResult } from "@/lib/idempotency";
import { createAdminClient } from "@/lib/supabase/admin";
import { boundedText, limits, positiveMoney, uuid } from "@/lib/validation/rules";

const bodySchema = z.object({
  orderId: uuid,
  method: z.enum(["cash", "card", "yape", "plin", "transfer", "qr"]),
  amount: positiveMoney(),
  receivedAmount: positiveMoney().optional(),
  reference: boundedText(limits.paymentReference).nullable().optional(),
});

export async function POST(request: NextRequest) {
  try {
    const auth = await authenticateApiRequest(request, ["admin", "cashier"]);
    if (auth.response) return auth.response;
    const body = bodySchema.parse(await request.json());
    const idempotencyKey = getIdempotencyKey(request);
    if (!idempotencyKey) return apiError("Falta el header Idempotency-Key", 400);
    const db = createAdminClient();
    const { data: rawResult, error } = await db.rpc("register_payment_transaction_idempotent", {
      p_order_id: body.orderId,
      p_user_id: auth.user.id,
      p_method: body.method,
      p_amount: body.amount,
      p_received_amount: body.receivedAmount ?? body.amount,
      p_reference: body.reference ?? "",
      p_idempotency_key: idempotencyKey,
      p_request_hash: hashIdempotencyPayload(body),
    });
    if (error) return rpcApiError(error, "No se pudo registrar el pago");
    const result = parseIdempotentResult<{ payment?: Record<string, unknown>; replayed?: boolean }>(rawResult);
    const payment = result.payment;
    if (!payment) return apiError("No se pudo registrar el pago", 500);
    return NextResponse.json(
      { data: payment, meta: { replayed: result.replayed === true } },
      { status: result.replayed ? 200 : 201 },
    );
  } catch (error) {
    return handleApiError(error);
  }
}
