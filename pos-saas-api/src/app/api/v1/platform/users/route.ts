import { NextRequest, NextResponse } from "next/server";
import { authenticateApiRequest } from "@/lib/auth/api";
import { handleApiError } from "@/lib/api/response";
import { createAdminClient } from "@/lib/supabase/admin";
import { uuid } from "@/lib/validation/rules";

type Role = { id: string; name: string; display_name: string };
type Membership = {
  user_id: string;
  organization_id: string;
  is_default: boolean;
  created_at: string;
  roles: Role | Role[] | null;
  organizations:
    | { id: string; name: string; slug: string; status: string }
    | { id: string; name: string; slug: string; status: string }[]
    | null;
};

export async function GET(request: NextRequest) {
  try {
    const auth = await authenticateApiRequest(request, ["platform_admin"]);
    if (auth.response) return auth.response;
    const search = request.nextUrl.searchParams.get("search")?.trim().slice(0, 80) ?? "";
    const organizationId = request.nextUrl.searchParams.get("organizationId")?.trim() ?? "";
    const blocked = request.nextUrl.searchParams.get("blocked");
    if (organizationId) uuid.parse(organizationId);

    const db = createAdminClient();
    let userQuery = db.from("users").select("id, email, name, is_blocked, created_at").order("email");
    const safeSearch = search.replace(/[^\p{L}\p{N}@._+\s-]/gu, " ").trim();
    if (safeSearch) userQuery = userQuery.or(`email.ilike.%${safeSearch}%,name.ilike.%${safeSearch}%`);
    if (blocked === "true") userQuery = userQuery.eq("is_blocked", true);
    if (blocked === "false") userQuery = userQuery.eq("is_blocked", false);

    const [
      { data: users, error: usersError },
      { data: memberships, error: membershipsError },
      { data: globalRoles, error: rolesError },
    ] = await Promise.all([
      userQuery,
      db
        .from("organization_members")
        .select(
          "user_id, organization_id, is_default, created_at, roles(id, name, display_name), organizations(id, name, slug, status)",
        ),
      db.from("user_roles").select("user_id, roles(id, name, display_name)"),
    ]);
    if (usersError) throw usersError;
    if (membershipsError) throw membershipsError;
    if (rolesError) throw rolesError;

    const membershipRows = (memberships ?? []) as unknown as Membership[];
    const roleRows = (globalRoles ?? []) as unknown as Array<{ user_id: string; roles: Role | Role[] | null }>;
    const selectedUserIds = organizationId
      ? new Set(membershipRows.filter((row) => row.organization_id === organizationId).map((row) => row.user_id))
      : null;
    const data = (users ?? [])
      .filter((user) => !selectedUserIds || selectedUserIds.has(user.id))
      .map((user) => ({
        ...user,
        globalRoles: roleRows
          .filter((row) => row.user_id === user.id)
          .flatMap((row) => (Array.isArray(row.roles) ? row.roles : row.roles ? [row.roles] : [])),
        memberships: membershipRows
          .filter((row) => row.user_id === user.id)
          .reduce<
            Array<{
              organizationId: string;
              isDefault: boolean;
              createdAt: string;
              roles: Role[];
              organization: Membership["organizations"];
            }>
          >((result, row) => {
            const organization = Array.isArray(row.organizations) ? (row.organizations[0] ?? null) : row.organizations;
            const role = Array.isArray(row.roles) ? (row.roles[0] ?? null) : row.roles;
            const current = result.find((membership) => membership.organizationId === row.organization_id);
            if (current) {
              if (role && !current.roles.some((item) => item.id === role.id)) current.roles.push(role);
              current.isDefault ||= row.is_default;
            } else {
              result.push({
                organizationId: row.organization_id,
                isDefault: row.is_default,
                createdAt: row.created_at,
                roles: role ? [role] : [],
                organization,
              });
            }
            return result;
          }, []),
      }));
    return NextResponse.json({ data });
  } catch (error) {
    return handleApiError(error);
  }
}
