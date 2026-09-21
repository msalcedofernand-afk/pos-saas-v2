import { NextRequest, NextResponse } from "next/server";
import { authenticateApiRequest } from "@/lib/auth/api";
import { handleApiError } from "@/lib/api/response";
import { createAdminClient } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  try {
    const auth = await authenticateApiRequest(request, ["admin", "cashier", "waiter", "staff"]);
    if (auth.response) return auth.response;
    const { data, error } = await (createAdminClient() as any)
      .from("tables_restaurant")
      .select("id, name, capacity, status")
      .eq("organization_id", auth.user.organizationId)
      .order("name", { ascending: true });
    if (error) throw error;
    return NextResponse.json({ data: data ?? [] });
  } catch (error) {
    return handleApiError(error);
  }
}
