import { NextRequest, NextResponse } from "next/server";
import { authenticateApiRequest } from "@/lib/auth/api";
import { handleApiError } from "@/lib/api/response";
import { createAdminClient } from "@/lib/supabase/admin";
import { uuid } from "@/lib/validation/rules";
import { boundedText, writePlatformAudit } from "@/lib/platform/governance";

export async function GET(request: NextRequest) {
  try {
    const auth = await authenticateApiRequest(request, [
      "platform_admin",
      "platform_owner",
      "support_agent",
      "security_auditor",
    ]);
    if (auth.response) return auth.response;
    const status = request.nextUrl.searchParams.get("status");
    let query = createAdminClient()
      .from("platform_incidents")
      .select("*")
      .order("updated_at", { ascending: false })
      .limit(100);
    if (status) query = query.eq("status", status);
    const { data, error } = await query;
    if (error) throw error;
    return NextResponse.json({ data: data ?? [] });
  } catch (error) {
    return handleApiError(error);
  }
}

export async function POST(request: NextRequest) {
  try {
    const auth = await authenticateApiRequest(request, ["platform_admin", "platform_owner", "security_auditor"]);
    if (auth.response) return auth.response;
    const body = (await request.json().catch(() => ({}))) as Record<string, unknown>;
    const title = boundedText(body.title, 160, 3);
    const summary = boundedText(body.summary, 5000, 3);
    const severity = String(body.severity ?? "minor");
    if (!["minor", "major", "critical"].includes(severity)) throw new Error("Severidad inválida");
    const organizationId = body.organizationId ? uuid.parse(String(body.organizationId)) : null;
    const { data, error } = await createAdminClient()
      .from("platform_incidents")
      .insert({ title, summary, severity, organization_id: organizationId, opened_by: auth.user.id })
      .select("*")
      .single();
    if (error) throw error;
    await writePlatformAudit(auth.user.id, "platform_incident_created", "platform_incidents", data.id, {
      severity,
      organizationId,
    });
    return NextResponse.json({ data }, { status: 201 });
  } catch (error) {
    return handleApiError(error);
  }
}
