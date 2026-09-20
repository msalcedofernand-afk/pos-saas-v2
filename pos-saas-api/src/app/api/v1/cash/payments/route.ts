import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { authenticateApiRequest } from "@/lib/auth/api";
import { apiError, handleApiError } from "@/lib/api/response";
import { createAdminClient } from "@/lib/supabase/admin";

const bodySchema = z.object({ orderId: z.string().uuid(), method: z.enum(["cash", "card", "yape", "plin", "transfer", "qr"]), amount: z.number().finite().positive(), changeAmount: z.number().finite().min(0).default(0), reference: z.string().trim().max(200).nullable().optional() });

export async function POST(request: NextRequest) {
  try {
    const auth = await authenticateApiRequest(request, ["admin", "cashier"]);
    if (auth.response) return auth.response;
    const body = bodySchema.parse(await request.json());
    const db = createAdminClient() as any;
    const { data: order, error: orderError } = await db.from("orders").select("id, status, total_amount").eq("id", body.orderId).maybeSingle();
    if (orderError) throw orderError;
    if (!order) return apiError("Pedido no encontrado", 404);
    if (!["served", "paid"].includes(order.status)) return apiError("El pedido todavía no está listo para cobrar", 409);
    if (order.status === "paid") return apiError("El pedido ya está pagado", 409);
    const { data: shift } = await db.from("shifts").select("id").eq("user_id", auth.user.id).eq("status", "open").maybeSingle();
    if (!shift) return apiError("Abre una caja antes de registrar pagos", 409);
    const { data: payment, error: paymentError } = await db.from("payments").insert({ order_id: body.orderId, user_id: auth.user.id, method: body.method, amount: body.amount, change_amount: body.changeAmount, shift_id: shift.id, reference: body.reference ?? null }).select("id, order_id, method, amount, change_amount, created_at").single();
    if (paymentError) throw paymentError;
    const { error: updateError } = await db.from("orders").update({ status: "paid", updated_at: new Date().toISOString() }).eq("id", body.orderId);
    if (updateError) throw updateError;
    await db.from("cash_movements").insert({ shift_id: shift.id, type: "sale", amount: body.amount, description: `Pedido ${body.orderId.slice(-6)}`, user_id: auth.user.id });
    return NextResponse.json({ data: payment }, { status: 201 });
  } catch (error) {
    return handleApiError(error);
  }
}
