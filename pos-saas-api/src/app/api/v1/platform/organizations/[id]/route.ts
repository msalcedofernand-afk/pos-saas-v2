import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { authenticateApiRequest } from "@/lib/auth/api";
import { apiError, handleApiError } from "@/lib/api/response";
import { createAdminClient } from "@/lib/supabase/admin";
import { runPlatformOrganizationAction } from "@/lib/platform/organization-actions";
import { boundedText, uuid } from "@/lib/validation/rules";

const updateOrganizationSchema = z.object({
  name: boundedText(120, 2),
});

async function loadOrganizationDetails(organizationId: string) {
  const db = createAdminClient();
  const { data: organization, error: organizationError } = await db
    .from("organizations")
    .select(
      "id, name, slug, is_active, status, suspended_at, suspended_by, suspension_reason, owner_user_id, last_activity_at, created_at, updated_at",
    )
    .eq("id", organizationId)
    .maybeSingle();
  if (organizationError) throw organizationError;
  if (!organization) return null;

  const [
    membersResult,
    productCountResult,
    orderCountResult,
    recentOrdersResult,
    tenantActivityResult,
    platformActivityResult,
    ownerResult,
  ] = await Promise.all([
    db.from("organization_members").select("user_id").eq("organization_id", organizationId),
    db.from("products").select("id", { count: "exact", head: true }).eq("organization_id", organizationId),
    db.from("orders").select("id", { count: "exact", head: true }).eq("organization_id", organizationId),
    db
      .from("orders")
      .select("id, status, total_amount, created_at")
      .eq("organization_id", organizationId)
      .order("created_at", { ascending: false })
      .limit(10),
    db
      .from("audit_logs")
      .select("id, action, auditable_type, auditable_id, created_at, user_id")
      .eq("organization_id", organizationId)
      .order("created_at", { ascending: false })
      .limit(10),
    db
      .from("platform_audit_logs")
      .select("id, action, auditable_type, auditable_id, created_at, actor_user_id")
      .eq("auditable_type", "organizations")
      .eq("auditable_id", organizationId)
      .order("created_at", { ascending: false })
      .limit(10),
    organization.owner_user_id
      ? db
          .from("users")
          .select("id, email, name, is_blocked, created_at")
          .eq("id", organization.owner_user_id)
          .maybeSingle()
      : Promise.resolve({ data: null, error: null }),
  ]);

  const firstError = [
    membersResult.error,
    productCountResult.error,
    orderCountResult.error,
    recentOrdersResult.error,
    tenantActivityResult.error,
    platformActivityResult.error,
    ownerResult.error,
  ].find(Boolean);
  if (firstError) throw firstError;

  const userIds = [...new Set((membersResult.data ?? []).map((member) => member.user_id))];
  const activity = [
    ...(tenantActivityResult.data ?? []).map((entry) => ({ ...entry, scope: "organization" })),
    ...(platformActivityResult.data ?? []).map((entry) => ({ ...entry, scope: "platform" })),
  ]
    .sort((left, right) => right.created_at.localeCompare(left.created_at))
    .slice(0, 10);

  return {
    organization,
    owner: ownerResult.data,
    metrics: {
      users: userIds.length,
      products: productCountResult.count ?? 0,
      orders: orderCountResult.count ?? 0,
    },
    recentOrders: recentOrdersResult.data ?? [],
    activity,
  };
}

export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const auth = await authenticateApiRequest(request, ["platform_admin"]);
    if (auth.response) return auth.response;
    const organizationId = uuid.parse((await params).id);
    const data = await loadOrganizationDetails(organizationId);
    if (!data) return apiError("Organización no encontrada", 404);
    return NextResponse.json({ data });
  } catch (error) {
    return handleApiError(error);
  }
}

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const body = updateOrganizationSchema.parse(await request.json().catch(() => ({})));
    return runPlatformOrganizationAction(request, (await params).id, "update", { name: body.name });
  } catch (error) {
    return handleApiError(error);
  }
}
