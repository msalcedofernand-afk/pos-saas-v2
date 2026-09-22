import { createHmac, timingSafeEqual } from "node:crypto";
import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import type { Json } from "@/types/database";

function validSignature(raw: string, signature: string | null) {
  const secret = process.env.BILLING_WEBHOOK_SECRET;
  if (!secret || !signature) return false;
  const expected = createHmac("sha256", secret).update(raw).digest("hex");
  const provided = signature.replace(/^sha256=/, "");
  if (provided.length !== expected.length) return false;
  return timingSafeEqual(Buffer.from(provided), Buffer.from(expected));
}

export async function POST(request: NextRequest) {
  const raw = await request.text();
  if (!validSignature(raw, request.headers.get("x-billing-signature"))) {
    return NextResponse.json({ error: "Firma inválida" }, { status: 401 });
  }
  try {
    const body = JSON.parse(raw) as Record<string, unknown>;
    const eventId = typeof body.id === "string" ? body.id : "";
    const eventType = typeof body.type === "string" ? body.type : "";
    if (!eventId || !eventType) return NextResponse.json({ error: "Evento inválido" }, { status: 400 });
    const organizationId = typeof body.organizationId === "string" ? body.organizationId : null;
    const { data, error } = await createAdminClient().rpc("process_platform_billing_event", {
      p_provider: typeof body.provider === "string" ? body.provider : "other",
      p_external_event_id: eventId,
      p_event_type: eventType,
      p_organization_id: organizationId,
      p_payload: body as Json,
    });
    if (error) throw error;
    return NextResponse.json({ data });
  } catch {
    return NextResponse.json({ error: "No se pudo procesar el evento" }, { status: 500 });
  }
}
