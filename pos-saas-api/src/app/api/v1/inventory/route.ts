import { NextRequest, NextResponse } from "next/server";
import { authenticateApiRequest } from "@/lib/auth/api";
import { handleApiError } from "@/lib/api/response";
import { createAdminClient } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  try {
    const auth = await authenticateApiRequest(request, ["admin", "staff", "kitchen"]);
    if (auth.response) return auth.response;
    const { data, error } = await createAdminClient()
      .from("inventory_items")
      .select(
        "id, name, unit, current_stock, minimum_stock, cost_per_unit, inventory_categories(name), suppliers(name)",
      )
      .eq("organization_id", auth.user.organizationId)
      .order("name", { ascending: true });
    if (error) throw error;
    return NextResponse.json({ data: data ?? [] });
  } catch (error) {
    return handleApiError(error);
  }
}
