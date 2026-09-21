import { NextRequest, NextResponse } from "next/server";
import { authenticateApiRequest } from "@/lib/auth/api";
import { handleApiError } from "@/lib/api/response";
import { createAdminClient } from "@/lib/supabase/admin";
import { limits, strictQueryInteger } from "@/lib/validation/rules";
import { z } from "zod";

export const dynamic = "force-dynamic";

const querySchema = z.object({
  page: strictQueryInteger(1, limits.page, 1),
  limit: strictQueryInteger(1, limits.limit, 50),
});

export async function GET(request: NextRequest) {
  try {
    const auth = await authenticateApiRequest(request, ["admin", "staff", "kitchen"]);
    if (auth.response) return auth.response;
    const query = querySchema.parse(Object.fromEntries(request.nextUrl.searchParams));
    const from = (query.page - 1) * query.limit;
    const { data, count, error } = await createAdminClient()
      .from("inventory_items")
      .select(
        "id, name, unit, current_stock, minimum_stock, cost_per_unit, inventory_categories(name), suppliers(name)",
        { count: "exact" },
      )
      .eq("organization_id", auth.user.organizationId)
      .order("name", { ascending: true })
      .range(from, from + query.limit - 1);
    if (error) throw error;
    return NextResponse.json({ data: data ?? [], meta: { page: query.page, limit: query.limit, total: count } });
  } catch (error) {
    return handleApiError(error);
  }
}
