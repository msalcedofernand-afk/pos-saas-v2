import "server-only";

import { createAdminClient } from "@/lib/supabase/admin";
import type { Database, Json } from "@/types/database";

type ErrorRecord = Database["public"]["Tables"]["platform_operation_errors"]["Insert"];

export async function recordPlatformOperationError(input: {
  actorUserId?: string | null;
  organizationId?: string | null;
  source: string;
  operation: string;
  message: string;
  severity?: "warning" | "error" | "critical";
  details?: Json;
}) {
  const payload: ErrorRecord = {
    actor_user_id: input.actorUserId ?? null,
    organization_id: input.organizationId ?? null,
    source: input.source.slice(0, 80),
    operation: input.operation.slice(0, 120),
    message: input.message.slice(0, 1000),
    severity: input.severity ?? "error",
    details: input.details ?? {},
  };

  const { error } = await createAdminClient().from("platform_operation_errors").insert(payload);
  if (error) console.error("Could not record platform operation error:", error);
}
