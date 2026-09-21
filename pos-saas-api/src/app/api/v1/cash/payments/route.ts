import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { authenticateApiRequest } from "@/lib/auth/api";
import { apiError, handleApiError, rpcApiError } from "@/lib/api/response";
import { createAdminClient } from "@/lib/supabase/admin";

const bodySchema = z.object({
  orderId: z.string().uuid(),
  method: z.enum(["cash", "card", "yape", "plin", "transfer", "qr"]),
  amount: z.number().finite().positive(),
  receivedAmount: z.number().finite().positive().optional(),
  reference: z.string().trim().max(200).nullable().optional(),
});

export async function POST(request: NextRequest) {
  try {
    const auth = await authenticateApiRequest(request, ["admin", "cashier"]);
    if (auth.response) return auth.response;
    const body = bodySchema.parse(await request.json());
    const db = createAdminClient() as any;
    const { data, error } = await db.rpc("register_payment_transaction", {
      p_order_id: body.orderId,
      p_user_id: auth.user.id,
      p_method: body.method,
      p_amount: body.amount,
      p_received_amount: body.receivedAmount ?? body.amount,
      p_reference: body.reference ?? null,
    });
    if (error) return rpcApiError(error, "No se pudo registrar el pago");
    const payment = Array.isArray(data) ? data[0] : data;
    if (!payment) return apiError("No se pudo registrar el pago", 500);
    return NextResponse.json({ data: payment }, { status: 201 });
  } catch (error) {
    return handleApiError(error);
  }
}
