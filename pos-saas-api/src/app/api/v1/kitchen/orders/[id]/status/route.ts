import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { authenticateApiRequest } from "@/lib/auth/api";
import { apiError, handleApiError } from "@/lib/api/response";
import { createAdminClient } from "@/lib/supabase/admin";

const idSchema = z.string().uuid();
const bodySchema = z.object({
  status: z.enum(["preparing", "ready", "served", "cancelled"]),
  reason: z.string().trim().max(500).optional(),
});

const transitions: Record<string, string[]> = {
  pending: ["preparing", "cancelled"],
  confirmed: ["preparing", "cancelled"],
  preparing: ["ready", "cancelled"],
  ready: ["served"],
};

const itemStatusByOrderStatus: Record<string, string> = {
  preparing: "preparing",
  ready: "ready",
  served: "served",
  cancelled: "cancelled",
};

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const auth = await authenticateApiRequest(request, ["admin", "kitchen"]);
    if (auth.response) return auth.response;

    const orderId = idSchema.parse((await params).id);
    const body = bodySchema.parse(await request.json());
    const supabase = createAdminClient();

    const { data: order, error: orderError } = await (supabase as any)
      .from("orders")
      .select("id, status, notes")
      .eq("id", orderId)
      .maybeSingle();

    if (orderError) throw orderError;
    if (!order) return apiError("Pedido no encontrado", 404);

    if (!transitions[order.status]?.includes(body.status)) {
      return apiError(`No se puede pasar de ${order.status} a ${body.status}`, 409);
    }

    if (body.status === "cancelled" && !body.reason) {
      return apiError("Debe indicar el motivo de rechazo o cancelación", 400);
    }

    const nextNotes = body.reason
      ? [order.notes, `Incidencia cocina: ${body.reason}`].filter(Boolean).join("\n")
      : order.notes;

    const { data: updatedOrder, error: updateError } = await (supabase as any)
      .from("orders")
      .update({ status: body.status, notes: nextNotes, updated_at: new Date().toISOString() })
      .eq("id", orderId)
      .select("id, status, notes, updated_at")
      .single();

    if (updateError) throw updateError;

    const { error: itemError } = await (supabase as any)
      .from("order_items")
      .update({ status: itemStatusByOrderStatus[body.status], updated_at: new Date().toISOString() })
      .eq("order_id", orderId)
      .neq("status", "cancelled");

    if (itemError) throw itemError;

    await (supabase as any).from("audit_logs").insert({
      user_id: auth.user?.id,
      action: `kitchen_order_${body.status}`,
      auditable_type: "orders",
      auditable_id: orderId,
      old_values: { status: order.status },
      new_values: { status: body.status, reason: body.reason ?? null },
    });

    return NextResponse.json({ data: updatedOrder });
  } catch (error) {
    return handleApiError(error);
  }
}
