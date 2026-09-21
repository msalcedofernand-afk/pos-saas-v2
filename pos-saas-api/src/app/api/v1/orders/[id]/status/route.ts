import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { authenticateApiRequest } from "@/lib/auth/api";
import { apiError, handleApiError, rpcApiError } from "@/lib/api/response";
import { createAdminClient } from "@/lib/supabase/admin";

const bodySchema = z.object({
  status: z.enum(["confirmed", "cancelled"]),
  reason: z.string().trim().max(500).optional(),
});
const idSchema = z.string().uuid();

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const auth = await authenticateApiRequest(request, ["admin", "waiter", "cashier"]);
    if (auth.response) return auth.response;
    const id = idSchema.parse((await params).id);
    const body = bodySchema.parse(await request.json());
    const db = createAdminClient();
    const { data, error } = await db.rpc("transition_order_status_transaction", {
      p_order_id: id,
      p_user_id: auth.user.id,
      p_status: body.status,
      p_reason: body.reason,
    });
    if (error) {
      return rpcApiError(error, "No se pudo actualizar el pedido");
    }
    const order = Array.isArray(data) ? data[0] : data;
    if (!order) return apiError("No se pudo actualizar el pedido", 500);
    return NextResponse.json({ data: order });
  } catch (error) {
    return handleApiError(error);
  }
}
