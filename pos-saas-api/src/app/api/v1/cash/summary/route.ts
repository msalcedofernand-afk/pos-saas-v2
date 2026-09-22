import { NextRequest, NextResponse } from "next/server";
import { authenticateApiRequest } from "@/lib/auth/api";
import { handleApiError } from "@/lib/api/response";
import { createAdminClient } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  try {
    const auth = await authenticateApiRequest(request, ["admin", "cashier"], { requireOrganization: true });
    if (auth.response) return auth.response;
    const db = createAdminClient();
    const { data: shifts, error: shiftError } = await db
      .from("shifts")
      .select("id, user_id, opened_at, opening_amount, closing_amount, status")
      .eq("organization_id", auth.user.organizationId)
      .eq("status", "open")
      .order("opened_at", { ascending: false })
      .limit(10);
    if (shiftError) throw shiftError;
    const shift =
      (shifts ?? []).find((item) => item.user_id === auth.user.id) ??
      (auth.user.roles.includes("admin") ? shifts?.[0] : null);
    const { data: orders, error: orderError } = await db
      .from("orders")
      .select("id, table_id, status, total_amount, created_at, table:tables_restaurant(name)")
      .eq("organization_id", auth.user.organizationId)
      .eq("status", "served")
      .order("created_at", { ascending: true });
    if (orderError) throw orderError;
    const orderIds = (orders ?? []).map((order) => order.id);
    const { data: orderPayments, error: orderPaymentError } =
      orderIds.length === 0
        ? { data: [], error: null }
        : await db
            .from("payments")
            .select("order_id, amount")
            .eq("organization_id", auth.user.organizationId)
            .in("order_id", orderIds);
    if (orderPaymentError) throw orderPaymentError;
    const paidByOrder = new Map<string, number>();
    for (const payment of orderPayments ?? [])
      paidByOrder.set(payment.order_id, (paidByOrder.get(payment.order_id) ?? 0) + Number(payment.amount ?? 0));
    const pendingOrders = (orders ?? []).map((order) => ({
      ...order,
      paid_amount: paidByOrder.get(order.id) ?? 0,
      remaining_amount: Math.max(0, Number(order.total_amount) - (paidByOrder.get(order.id) ?? 0)),
    }));
    const { data: payments, error: paymentError } = shift
      ? await db
          .from("payments")
          .select("id, order_id, method, amount, change_amount, created_at")
          .eq("organization_id", auth.user.organizationId)
          .eq("shift_id", shift.id)
          .order("created_at", { ascending: false })
          .limit(100)
      : { data: [], error: null };
    if (paymentError) throw paymentError;
    const totalPaid = (payments ?? []).reduce((sum, payment) => sum + Number(payment.amount ?? 0), 0);
    return NextResponse.json({ data: { shift: shift ?? null, pendingOrders, payments: payments ?? [], totalPaid } });
  } catch (error) {
    return handleApiError(error);
  }
}
