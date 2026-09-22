import { NextRequest, NextResponse } from "next/server";
import { authenticateApiRequest } from "@/lib/auth/api";
import { handleApiError } from "@/lib/api/response";
import { createAdminClient } from "@/lib/supabase/admin";
import { uuid } from "@/lib/validation/rules";
import { boundedText, writePlatformAudit } from "@/lib/platform/governance";
import type { Database } from "@/types/database";

export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const auth = await authenticateApiRequest(request, ["platform_admin", "platform_owner", "support_agent"]);
    if (auth.response) return auth.response;
    const id = uuid.parse((await params).id);
    const db = createAdminClient();
    const [{ data: ticket, error }, { data: comments, error: commentsError }] = await Promise.all([
      db.from("platform_tickets").select("*").eq("id", id).maybeSingle(),
      db.from("platform_ticket_comments").select("*").eq("ticket_id", id).order("created_at"),
    ]);
    if (error) throw error;
    if (commentsError) throw commentsError;
    if (!ticket) return NextResponse.json({ error: "Ticket no encontrado" }, { status: 404 });
    return NextResponse.json({ data: { ...ticket, comments: comments ?? [] } });
  } catch (error) {
    return handleApiError(error);
  }
}

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const auth = await authenticateApiRequest(request, ["platform_admin", "platform_owner", "support_agent"]);
    if (auth.response) return auth.response;
    const id = uuid.parse((await params).id);
    const body = (await request.json().catch(() => ({}))) as Record<string, unknown>;
    const patch: Database["public"]["Tables"]["platform_tickets"]["Update"] = {};
    if (body.status !== undefined) {
      if (!["open", "in_progress", "waiting_customer", "resolved", "closed"].includes(String(body.status)))
        throw new Error("Estado inválido");
      patch.status = String(body.status);
      if (["resolved", "closed"].includes(String(body.status))) patch.resolved_at = new Date().toISOString();
    }
    if (body.priority !== undefined) {
      if (!["low", "normal", "high", "urgent"].includes(String(body.priority))) throw new Error("Prioridad inválida");
      patch.priority = String(body.priority);
    }
    if (body.assignedUserId !== undefined)
      patch.assigned_user_id = body.assignedUserId ? uuid.parse(String(body.assignedUserId)) : null;
    if (body.subject !== undefined) patch.subject = boundedText(body.subject, 160, 3);
    if (body.description !== undefined) patch.description = boundedText(body.description, 5000, 3);
    if (!Object.keys(patch).length) return NextResponse.json({ error: "No hay cambios" }, { status: 400 });
    const { data, error } = await createAdminClient()
      .from("platform_tickets")
      .update(patch)
      .eq("id", id)
      .select("*")
      .maybeSingle();
    if (error) throw error;
    if (!data) return NextResponse.json({ error: "Ticket no encontrado" }, { status: 404 });
    await writePlatformAudit(auth.user.id, "platform_ticket_updated", "platform_tickets", id, patch);
    return NextResponse.json({ data });
  } catch (error) {
    return handleApiError(error);
  }
}

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const auth = await authenticateApiRequest(request, ["platform_admin", "platform_owner", "support_agent"]);
    if (auth.response) return auth.response;
    const id = uuid.parse((await params).id);
    const body = (await request.json().catch(() => ({}))) as Record<string, unknown>;
    const bodyText = boundedText(body.body, 5000);
    const internal = Boolean(body.internal);
    const { data, error } = await createAdminClient()
      .from("platform_ticket_comments")
      .insert({ ticket_id: id, author_user_id: auth.user.id, body: bodyText, internal })
      .select("*")
      .single();
    if (error) throw error;
    await writePlatformAudit(auth.user.id, "platform_ticket_commented", "platform_tickets", id, { internal });
    return NextResponse.json({ data }, { status: 201 });
  } catch (error) {
    return handleApiError(error);
  }
}
