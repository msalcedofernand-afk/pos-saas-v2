import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { authenticateApiRequest } from "@/lib/auth/api";
import { handleApiError } from "@/lib/api/response";
import { createAdminClient } from "@/lib/supabase/admin";
import { businessDate, businessDayRange, isValidBusinessDate } from "@/lib/date/business-date";

export const dynamic = "force-dynamic";

const querySchema = z.object({
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
}).refine(({ date }) => !date || isValidBusinessDate(date), {
  path: ["date"],
  message: "La fecha no existe",
});

export async function GET(request: NextRequest) {
  try {
    const auth = await authenticateApiRequest(request, ["admin", "cashier"]);
    if (auth.response) return auth.response;
    const { date } = querySchema.parse(Object.fromEntries(request.nextUrl.searchParams));
    const targetDate = date ?? businessDate();
    const { start, end } = businessDayRange(targetDate);
    const db = createAdminClient() as any;
    const { data, error } = await db.rpc("get_report_summary", {
      p_organization_id: auth.user.organizationId,
      p_start: start.toISOString(),
      p_end: end.toISOString(),
    });
    if (error) throw error;
    return NextResponse.json({ data: { date: targetDate, ...(data ?? {}) } });
  } catch (error) {
    return handleApiError(error);
  }
}
