import { NextRequest, NextResponse } from "next/server";
import { authenticateApiRequest } from "@/lib/auth/api";
import { handleApiError } from "@/lib/api/response";
import { createAdminClient } from "@/lib/supabase/admin";

type UserRole = { id: string; name: string; display_name: string };
type OrganizationMembership = { role_id: string; organization_id: string; roles: UserRole | UserRole[] | null };
type UserRow = {
  id: string;
  email: string;
  name: string | null;
  is_blocked: boolean;
  created_at: string;
  organization_members: OrganizationMembership[];
};

export async function GET(request: NextRequest) {
  try {
    const auth = await authenticateApiRequest(request, ["admin"]);
    if (auth.response) return auth.response;
    const { data, error } = await createAdminClient()
      .from("users")
      .select(
        "id, email, name, is_blocked, created_at, organization_members!inner(role_id, organization_id, roles(id, name, display_name))",
      )
      .eq("organization_members.organization_id", auth.user.organizationId)
      .order("email");
    if (error) throw error;
    const users = (data ?? []) as unknown as UserRow[];
    return NextResponse.json({
      data: users.map(({ organization_members, ...user }) => ({
        ...user,
        user_roles: organization_members.map(({ role_id, roles }) => ({
          role_id,
          roles: Array.isArray(roles) ? (roles[0] ?? null) : roles,
        })),
      })),
    });
  } catch (error) {
    return handleApiError(error);
  }
}
