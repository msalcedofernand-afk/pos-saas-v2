import { NextRequest, NextResponse } from "next/server";
import { authenticateApiRequest } from "@/lib/auth/api";
import { handleApiError } from "@/lib/api/response";
import { createAdminClient } from "@/lib/supabase/admin";
import { businessDate, businessDayRange } from "@/lib/date/business-date";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  try {
    const auth = await authenticateApiRequest(request, ["admin", "cashier"]);
    if (auth.response) return auth.response;
    const date = request.nextUrl.searchParams.get("date") ?? businessDate();
    const { start, end } = businessDayRange(date);
    const db = createAdminClient() as any;
    const { data: orders, error: orderError } = await db.from("orders").select("id, status, total_amount, created_at").gte("created_at", start.toISOString()).lt("created_at", end.toISOString());
    if (orderError) throw orderError;
    const { data: payments, error: paymentError } = await db.from("payments").select("method, amount, created_at").gte("created_at", start.toISOString()).lt("created_at", end.toISOString());
    if (paymentError) throw paymentError;
    const paidOrders = (orders ?? []).filter((order: any) => order.status === "paid");
    const byMethod = (payments ?? []).reduce((result: Record<string, number>, payment: any) => { result[payment.method] = (result[payment.method] ?? 0) + Number(payment.amount ?? 0); return result; }, {});
    return NextResponse.json({ data: { date, orders: orders?.length ?? 0, paidOrders: paidOrders.length, cancelled: (orders ?? []).filter((order: any) => order.status === "cancelled").length, sales: paidOrders.reduce((sum: number, order: any) => sum + Number(order.total_amount ?? 0), 0), paymentsByMethod: byMethod } });
  } catch (error) {
    return handleApiError(error);
  }
}
