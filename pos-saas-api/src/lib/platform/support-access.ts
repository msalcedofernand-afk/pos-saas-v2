import "server-only";

import { createAdminClient } from "@/lib/supabase/admin";

export type SupportAccessMode = "read_only" | "write";

export type ActiveSupportAccess = {
  id: string;
  actor_user_id: string;
  organization_id: string;
  reason: string;
  mode: SupportAccessMode;
  status: "active";
  starts_at: string;
  expires_at: string;
};

export async function expireSupportAccessSessions() {
  const { error } = await createAdminClient().rpc("expire_platform_support_access_sessions");
  if (error) throw error;
}

export async function getActiveSupportAccess(actorUserId: string, organizationId: string, accessId: string) {
  await expireSupportAccessSessions();
  const { data, error } = await createAdminClient()
    .from("platform_support_access_requests")
    .select("id, actor_user_id, organization_id, reason, mode, status, starts_at, expires_at")
    .eq("id", accessId)
    .eq("actor_user_id", actorUserId)
    .eq("organization_id", organizationId)
    .eq("status", "active")
    .gt("starts_at", "1970-01-01T00:00:00.000Z")
    .gt("expires_at", new Date().toISOString())
    .maybeSingle();
  if (error) throw error;
  return data as ActiveSupportAccess | null;
}

export async function markSupportAccessEntered(actorUserId: string, accessId: string, organizationId: string) {
  const { error } = await createAdminClient().rpc("mark_platform_support_access_entered", {
    p_access_id: accessId,
    p_actor_user_id: actorUserId,
    p_organization_id: organizationId,
  });
  if (error) throw error;
}

export async function recordSupportAction(
  actorUserId: string,
  access: Pick<ActiveSupportAccess, "id" | "organization_id" | "mode">,
  request: Request,
) {
  const { error } = await createAdminClient()
    .from("platform_audit_logs")
    .insert({
      actor_user_id: actorUserId,
      action: "support_action_authorized",
      auditable_type: "organizations",
      auditable_id: access.organization_id,
      new_values: {
        support_access_id: access.id,
        support_mode: access.mode,
        method: request.method,
        path: new URL(request.url).pathname,
      },
    });
  if (error) throw error;
}

export async function recordSupportWriteDenied(
  actorUserId: string,
  access: Pick<ActiveSupportAccess, "id" | "organization_id" | "mode">,
  request: Request,
) {
  const { error } = await createAdminClient()
    .from("platform_audit_logs")
    .insert({
      actor_user_id: actorUserId,
      action: "support_write_denied",
      auditable_type: "organizations",
      auditable_id: access.organization_id,
      new_values: {
        support_access_id: access.id,
        support_mode: access.mode,
        method: request.method,
        path: new URL(request.url).pathname,
      },
    });
  if (error) throw error;
}
