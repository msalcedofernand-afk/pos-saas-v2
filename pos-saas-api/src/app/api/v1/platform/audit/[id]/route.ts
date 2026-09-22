import { NextRequest, NextResponse } from "next/server";
import { authenticateApiRequest } from "@/lib/auth/api";
import { apiError, handleApiError } from "@/lib/api/response";
import { createAdminClient } from "@/lib/supabase/admin";
import { uuid } from "@/lib/validation/rules";

function organizationIdFromAudit(row: {
  auditable_type: string;
  auditable_id: string | null;
  old_values: unknown;
  new_values: unknown;
}) {
  if (row.auditable_type === "organizations") return row.auditable_id;
  for (const values of [row.new_values, row.old_values]) {
    if (!values || typeof values !== "object" || Array.isArray(values)) continue;
    const record = values as Record<string, unknown>;
    if (typeof record.organization_id === "string") return record.organization_id;
    if (record.organization && typeof record.organization === "object" && !Array.isArray(record.organization)) {
      const organization = record.organization as Record<string, unknown>;
      if (typeof organization.id === "string") return organization.id;
    }
  }
  return null;
}

export async function GET(request: NextRequest, context: { params: Promise<{ id: string }> }) {
  try {
    const auth = await authenticateApiRequest(request, ["platform_admin"]);
    if (auth.response) return auth.response;
    const { id } = await context.params;
    const auditId = uuid.parse(id);
    const db = createAdminClient();
    const { data: row, error } = await db
      .from("platform_audit_logs")
      .select("id, actor_user_id, action, auditable_type, auditable_id, old_values, new_values, created_at")
      .eq("id", auditId)
      .maybeSingle();
    if (error) throw error;
    if (!row) return apiError("Evento de auditoría no encontrado", 404);

    const { data: actor, error: actorError } = await db
      .from("users")
      .select("id, email, name")
      .eq("id", row.actor_user_id)
      .maybeSingle();
    if (actorError) throw actorError;
    return NextResponse.json({
      data: {
        ...row,
        actor: actor ?? null,
        organizationId: organizationIdFromAudit(row),
      },
    });
  } catch (error) {
    return handleApiError(error);
  }
}
