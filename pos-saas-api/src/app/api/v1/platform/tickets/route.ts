import { NextRequest, NextResponse } from "next/server";
import { authenticateApiRequest } from "@/lib/auth/api";
import { handleApiError } from "@/lib/api/response";
import { createAdminClient } from "@/lib/supabase/admin";
import { uuid } from "@/lib/validation/rules";
import { boundedText, writePlatformAudit } from "@/lib/platform/governance";
import type { Database } from "@/types/database";

export async function GET(request: NextRequest) {
  try {
    const auth = await authenticateApiRequest(request, ["platform_admin", "platform_owner", "support_agent"]);
    if (auth.response) return auth.response;
    const status = request.nextUrl.searchParams.get("status");
    const db = createAdminClient();
    let query = db
      .from("platform_tickets")
      .select(
        "id, organization_id, requester_user_id, assigned_user_id, subject, description, priority, status, created_at, updated_at, resolved_at",
      )
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
    const auth = await authenticateApiRequest(request, ["platform_admin", "platform_owner", "support_agent"]);
    if (auth.response) return auth.response;
    const body = (await request.json().catch(() => ({}))) as Record<string, unknown>;
    const subject = boundedText(body.subject, 160, 3);
    const description = boundedText(body.description, 5000, 3);
    const priority = body.priority ?? "normal";
    if (!["low", "normal", "high", "urgent"].includes(String(priority))) throw new Error("Prioridad inválida");
    const organizationId = body.organizationId ? uuid.parse(String(body.organizationId)) : null;
    const { data, error } = await createAdminClient()
      .from("platform_tickets")
      .insert({
        organization_id: organizationId,
        requester_user_id: auth.user.id,
        subject,
        description,
        priority: String(priority),
      })
      .select("*")
      .single();
    if (error) throw error;
    await writePlatformAudit(auth.user.id, "platform_ticket_created", "platform_tickets", data.id, {
      priority,
      organizationId,
    });
    return NextResponse.json({ data }, { status: 201 });
  } catch (error) {
    return handleApiError(error);
  }
}
