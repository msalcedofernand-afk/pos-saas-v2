import { NextRequest, NextResponse } from "next/server";
import { authenticateApiRequest, getUserMemberships } from "@/lib/auth/api";
import { handleApiError } from "@/lib/api/response";
import { createAdminClient } from "@/lib/supabase/admin";

export async function GET(request: NextRequest) {
  try {
    const auth = await authenticateApiRequest(request);
    if (auth.response) return auth.response;
    if (auth.user.roles.includes("platform_admin")) {
      const { data, error } = await createAdminClient()
        .from("organizations")
        .select("id, name, slug, is_active, created_at")
        .eq("is_active", true)
        .order("name");
      if (error) throw error;
      return NextResponse.json({
        data: (data ?? []).map((organization) => ({
          ...organization,
          isDefault: organization.id === auth.user.organizationId,
        })),
        activeOrganizationId: auth.user.organizationId,
      });
    }
    const data = await getUserMemberships(auth.user.id);
    return NextResponse.json({ data, activeOrganizationId: auth.user.organizationId });
  } catch (error) {
    return handleApiError(error);
  }
}
