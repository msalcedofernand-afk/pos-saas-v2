import { NextRequest, NextResponse } from "next/server";
import { authenticateApiRequest } from "@/lib/auth/api";
import { handleApiError } from "@/lib/api/response";
import { createAdminClient } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";

const activeStatuses = ["pending", "confirmed", "preparing", "ready"] as const;

export async function GET(request: NextRequest) {
  try {
    const auth = await authenticateApiRequest(request, ["admin", "kitchen", "staff"]);
    if (auth.response) return auth.response;

    const supabase = createAdminClient();
    const { data, error } = await (supabase as any)
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
      .order("created_at", { ascending: true });

    if (error) throw error;
    return NextResponse.json({ data: data ?? [] });
  } catch (error) {
    return handleApiError(error);
  }
}
