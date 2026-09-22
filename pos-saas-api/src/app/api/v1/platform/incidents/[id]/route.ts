import { NextRequest, NextResponse } from "next/server";
import { authenticateApiRequest } from "@/lib/auth/api";
import { handleApiError } from "@/lib/api/response";
import { createAdminClient } from "@/lib/supabase/admin";
import { uuid } from "@/lib/validation/rules";
import { boundedText, writePlatformAudit } from "@/lib/platform/governance";
import type { Database } from "@/types/database";

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const auth = await authenticateApiRequest(request, ["platform_admin", "platform_owner", "security_auditor"]);
    if (auth.response) return auth.response;
    const id = uuid.parse((await params).id);
    const body = (await request.json().catch(() => ({}))) as Record<string, unknown>;
    const patch: Database["public"]["Tables"]["platform_incidents"]["Update"] = {};
    if (body.status !== undefined) {
      if (!["open", "investigating", "mitigated", "resolved", "closed"].includes(String(body.status)))
        throw new Error("Estado inválido");
      patch.status = String(body.status);
      if (["resolved", "closed"].includes(String(body.status))) patch.resolved_at = new Date().toISOString();
    }
    if (body.severity !== undefined) {
      if (!["minor", "major", "critical"].includes(String(body.severity))) throw new Error("Severidad inválida");
      patch.severity = String(body.severity);
    }
    if (body.title !== undefined) patch.title = boundedText(body.title, 160, 3);
    if (body.summary !== undefined) patch.summary = boundedText(body.summary, 5000, 3);
    if (!Object.keys(patch).length) return NextResponse.json({ error: "No hay cambios" }, { status: 400 });
    const { data, error } = await createAdminClient()
      .from("platform_incidents")
      .update(patch)
      .eq("id", id)
      .select("*")
      .maybeSingle();
    if (error) throw error;
    if (!data) return NextResponse.json({ error: "Incidente no encontrado" }, { status: 404 });
    await writePlatformAudit(auth.user.id, "platform_incident_updated", "platform_incidents", id, patch);
    return NextResponse.json({ data });
  } catch (error) {
    return handleApiError(error);
  }
}
