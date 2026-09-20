import { NextRequest, NextResponse } from "next/server";
import { authenticateApiRequest } from "@/lib/auth/api";
import { handleApiError } from "@/lib/api/response";
import { createAdminClient } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  try {
    const auth = await authenticateApiRequest(request, ["admin", "cashier"]);
    if (auth.response) return auth.response;
    const db = createAdminClient() as any;
    const { data: shifts, error: shiftError } = await db.from("shifts").select("id, user_id, opened_at, opening_amount, closing_amount, status").eq("status", "open").order("opened_at", { ascending: false }).limit(10);
    if (shiftError) throw shiftError;
    const shift = (shifts ?? []).find((item: any) => item.user_id === auth.user.id) ?? (auth.user.roles.includes("admin") ? shifts?.[0] : null);
    const { data: orders, error: orderError } = await db.from("orders").select("id, table_id, status, total_amount, created_at, table:tables_restaurant(name)").eq("status", "served").order("created_at", { ascending: true });
    if (orderError) throw orderError;
    const { data: payments, error: paymentError } = await db.from("payments").select("id, order_id, method, amount, change_amount, created_at").order("created_at", { ascending: false }).limit(100);
    if (paymentError) throw paymentError;
    const totalPaid = (payments ?? []).reduce((sum: number, payment: any) => sum + Number(payment.amount ?? 0), 0);
    return NextResponse.json({ data: { shift: shift ?? null, pendingOrders: orders ?? [], payments: payments ?? [], totalPaid } });
  } catch (error) {
    return handleApiError(error);
  }
}
