import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { authenticateApiRequest } from "@/lib/auth/api";
import { apiError, handleApiError } from "@/lib/api/response";
import { createAdminClient } from "@/lib/supabase/admin";

const contextSchema = z.object({ organizationId: z.string().uuid() });

export async function POST(request: NextRequest) {
  try {
    const auth = await authenticateApiRequest(request, ["platform_admin"]);
    if (auth.response) return auth.response;

    const { organizationId } = contextSchema.parse(await request.json());
    const db = createAdminClient();
    const { data: organization, error: organizationError } = await db
      .from("organizations")
      .select("id, name, slug, is_active")
      .eq("id", organizationId)
      .eq("is_active", true)
      .maybeSingle();
    if (organizationError) throw organizationError;
    if (!organization) return apiError("Organización no disponible", 404);

    const { error: auditError } = await db.from("platform_audit_logs").insert({
      actor_user_id: auth.user.id,
      action: "platform_organization_context_selected",
      auditable_type: "organizations",
      auditable_id: organization.id,
      new_values: { organization: { id: organization.id, name: organization.name, slug: organization.slug } },
    });
    if (auditError) throw auditError;

    return NextResponse.json({ data: organization });
  } catch (error) {
    return handleApiError(error);
  }
}
