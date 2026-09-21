import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { authenticateApiRequest } from "@/lib/auth/api";
import { apiError, handleApiError, rpcApiError } from "@/lib/api/response";
import { createAdminClient } from "@/lib/supabase/admin";

const idSchema = z.string().uuid();
const bodySchema = z.object({
  status: z.enum(["preparing", "ready", "served", "cancelled"]),
  reason: z.string().trim().max(500).optional(),
});

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const auth = await authenticateApiRequest(request, ["admin", "kitchen"]);
    if (auth.response) return auth.response;

    const orderId = idSchema.parse((await params).id);
    const body = bodySchema.parse(await request.json());
    if (body.status === "cancelled" && !body.reason) {
      return apiError("Debe indicar el motivo de rechazo o cancelación", 400);
    }
    const supabase = createAdminClient() as any;
    const { data, error } = await supabase.rpc("transition_kitchen_order_transaction", {
      p_order_id: orderId,
      p_user_id: auth.user.id,
      p_status: body.status,
      p_reason: body.reason ?? null,
    });
    if (error) {
      return rpcApiError(error, "No se pudo actualizar el pedido de cocina");
    }
    const updatedOrder = Array.isArray(data) ? data[0] : data;
    if (!updatedOrder) return apiError("No se pudo actualizar el pedido de cocina", 500);
    return NextResponse.json({ data: updatedOrder });
  } catch (error) {
    return handleApiError(error);
  }
}
