import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { authenticateApiRequest } from "@/lib/auth/api";
import { handleApiError } from "@/lib/api/response";
import { createAdminClient } from "@/lib/supabase/admin";
import { businessDateOffset, businessDayRange, isValidBusinessDate } from "@/lib/date/business-date";

export const dynamic = "force-dynamic";

const querySchema = z
  .object({
    date: z
      .string()
      .regex(/^\d{4}-\d{2}-\d{2}$/)
      .optional(),
  })
  .refine(({ date }) => !date || isValidBusinessDate(date), {
    path: ["date"],
    message: "La fecha no existe",
  });

export async function GET(request: NextRequest) {
  try {
    const auth = await authenticateApiRequest(request, ["admin", "kitchen", "staff"]);
    if (auth.response) return auth.response;

    const { date } = querySchema.parse(Object.fromEntries(request.nextUrl.searchParams));
    const targetDate = date ?? businessDateOffset(-1);
    const { start, end } = businessDayRange(targetDate);

    const { data, error } = await createAdminClient().rpc("get_kitchen_summary", {
      p_organization_id: auth.user.organizationId,
      p_start: start.toISOString(),
      p_end: end.toISOString(),
    });
    if (error) throw error;
    const summary = data && typeof data === "object" && !Array.isArray(data) ? data : {};
    return NextResponse.json({ data: { date: targetDate, ...summary } });
  } catch (error) {
    return handleApiError(error);
  }
}
