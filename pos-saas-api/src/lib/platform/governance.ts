import { createAdminClient } from "@/lib/supabase/admin";
import type { Json } from "@/types/database";

export const platformGovernanceRoles = [
  "platform_owner",
  "platform_admin",
  "support_agent",
  "billing_admin",
  "security_auditor",
] as const;

export function hasGovernanceRole(roles: string[], allowed: readonly string[]) {
  return roles.some((role) => role === "platform_owner" || role === "platform_admin" || allowed.includes(role));
}

export async function writePlatformAudit(
  actorUserId: string,
  action: string,
  type: string,
  id: string,
  values: Record<string, unknown>,
) {
  const { error } = await createAdminClient()
    .from("platform_audit_logs")
    .insert({
      actor_user_id: actorUserId,
      action,
      auditable_type: type,
      auditable_id: id,
      new_values: values as Json,
    });
  if (error) throw error;
}

export function boundedText(value: unknown, max: number, min = 1) {
  if (typeof value !== "string") throw new Error("Texto inválido");
  const text = value.trim();
  if (text.length < min || text.length > max) throw new Error("Texto fuera de rango");
  return text;
}
