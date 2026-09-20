import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { authenticateApiRequest } from "@/lib/auth/api";
import { handleApiError } from "@/lib/api/response";
import { createAdminClient } from "@/lib/supabase/admin";
import { businessDateOffset, businessDayRange } from "@/lib/date/business-date";

export const dynamic = "force-dynamic";

const querySchema = z.object({
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
});

export async function GET(request: NextRequest) {
  try {
    const auth = await authenticateApiRequest(request, ["admin", "kitchen", "staff"]);
    if (auth.response) return auth.response;

    const { date } = querySchema.parse(Object.fromEntries(request.nextUrl.searchParams));
    const targetDate = date ?? businessDateOffset(-1);
    const { start, end } = businessDayRange(targetDate);

    const supabase = createAdminClient();
    const { data, error } = await (supabase as any)
      .from("orders")
      .select("status, total_amount")
      .gte("created_at", start.toISOString())
      .lt("created_at", end.toISOString());

    if (error) throw error;

    const orders = data ?? [];
    const served = orders.filter((order: any) => ["served", "paid"].includes(order.status)).length;
    const cancelled = orders.filter((order: any) => order.status === "cancelled").length;
    const sales = orders
      .filter((order: any) => order.status === "paid")
      .reduce((total: number, order: any) => total + Number(order.total_amount ?? 0), 0);

    return NextResponse.json({ data: { date: targetDate, orders: orders.length, served, cancelled, sales } });
  } catch (error) {
    return handleApiError(error);
  }
}
