import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { authenticateApiRequest } from "@/lib/auth/api";
import { handleApiError } from "@/lib/api/response";
import { createAdminClient } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";

const activeStatuses = ["pending", "confirmed", "preparing", "ready"] as const;
const querySchema = z.object({
  page: z.coerce.number().int().min(1).max(10000).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(50),
});

export async function GET(request: NextRequest) {
  try {
    const auth = await authenticateApiRequest(request, ["admin", "kitchen", "staff"]);
    if (auth.response) return auth.response;
    const queryParams = querySchema.parse(Object.fromEntries(request.nextUrl.searchParams));
    const from = (queryParams.page - 1) * queryParams.limit;
    const to = from + queryParams.limit - 1;

    const supabase = createAdminClient();
    const { data, error, count } = await supabase
      .from("orders")
      .select(`
        id,
        table_id,
        status,
        notes,
        guests,
        created_at,
        updated_at,
        table:tables_restaurant(id, name),
        order_items(
          id,
          quantity,
          status,
          notes,
          product:products(
            id,
            name,
            categories(id, name)
          )
        )
      `)
      .eq("organization_id", auth.user.organizationId)
      .in("status", activeStatuses)
      .order("created_at", { ascending: true })
      .range(from, to);

    if (error) throw error;
    return NextResponse.json({ data: data ?? [], meta: { page: queryParams.page, limit: queryParams.limit, total: count ?? 0, hasMore: (count ?? 0) > to + 1 } });
  } catch (error) {
    return handleApiError(error);
  }
}
