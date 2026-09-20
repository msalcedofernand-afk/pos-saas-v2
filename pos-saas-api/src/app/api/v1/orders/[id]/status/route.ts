import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { authenticateApiRequest } from "@/lib/auth/api";
import { apiError, handleApiError } from "@/lib/api/response";
import { createAdminClient } from "@/lib/supabase/admin";

const bodySchema = z.object({ status: z.enum(["confirmed", "cancelled"]) });
const idSchema = z.string().uuid();

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const auth = await authenticateApiRequest(request, ["admin", "waiter", "cashier"]);
    if (auth.response) return auth.response;
    const id = idSchema.parse((await params).id);
    const body = bodySchema.parse(await request.json());
    const db = createAdminClient() as any;
    const { data: order, error: readError } = await db.from("orders").select("id, status, table_id").eq("id", id).maybeSingle();
    if (readError) throw readError;
    if (!order) return apiError("Pedido no encontrado", 404);
    if (body.status === "cancelled" && !["pending", "confirmed"].includes(order.status)) return apiError("Este pedido ya está en preparación y no puede cancelarse desde pedidos", 409);
    const { data, error } = await db.from("orders").update({ status: body.status, updated_at: new Date().toISOString() }).eq("id", id).select("id, status, table_id, updated_at").single();
    if (error) throw error;
    if (body.status === "cancelled") {
      await db.from("order_items").update({ status: "cancelled", updated_at: new Date().toISOString() }).eq("order_id", id);
      if (order.table_id) await db.from("tables_restaurant").update({ status: "available" }).eq("id", order.table_id);
    }
    await db.from("audit_logs").insert({ user_id: auth.user.id, action: `order_${body.status}`, auditable_type: "orders", auditable_id: id, old_values: { status: order.status }, new_values: { status: body.status } });
    return NextResponse.json({ data });
  } catch (error) {
    return handleApiError(error);
  }
}
