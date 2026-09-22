import { NextRequest, NextResponse } from "next/server";
import { authenticateApiRequest } from "@/lib/auth/api";
import { handleApiError } from "@/lib/api/response";
import { createAdminClient } from "@/lib/supabase/admin";

export async function GET(request: NextRequest) {
  try {
    const auth = await authenticateApiRequest(request, ["admin"]);
    if (auth.response) return auth.response;
    const { data, error } = await createAdminClient().from("roles").select("id, name, display_name").order("name");
    if (error) throw error;
    return NextResponse.json({ data: (data ?? []).filter((role) => role.name !== "platform_admin") });
  } catch (error) {
    return handleApiError(error);
  }
}
