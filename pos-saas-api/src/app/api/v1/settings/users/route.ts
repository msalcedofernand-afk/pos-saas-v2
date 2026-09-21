import { NextRequest, NextResponse } from "next/server";
import { authenticateApiRequest } from "@/lib/auth/api";
import { handleApiError } from "@/lib/api/response";
import { createAdminClient } from "@/lib/supabase/admin";

export async function GET(request: NextRequest) {
  try {
    const auth = await authenticateApiRequest(request, ["admin"]);
    if (auth.response) return auth.response;
    const { data, error } = await (createAdminClient() as any)
      .from("users")
      .select(
        "id, email, name, is_blocked, created_at, organization_members!inner(role_id, organization_id, roles(id, name, display_name))",
      )
      .eq("organization_members.organization_id", auth.user.organizationId)
      .order("email");
    if (error) throw error;
    return NextResponse.json({ data: data ?? [] });
  } catch (error) {
    return handleApiError(error);
  }
}
