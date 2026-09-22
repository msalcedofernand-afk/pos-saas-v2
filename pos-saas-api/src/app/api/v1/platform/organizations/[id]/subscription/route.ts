import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { authenticateApiRequest } from "@/lib/auth/api";
import { handleApiError, rpcApiError } from "@/lib/api/response";
import { createAdminClient } from "@/lib/supabase/admin";
import { uuid } from "@/lib/validation/rules";

const subscriptionSchema = z.object({
  planCode: z.string().regex(/^[a-z][a-z0-9_-]{1,40}$/),
  status: z.enum(["trial", "active", "past_due", "suspended", "cancelled", "expired"]).default("active"),
  reason: z.string().trim().max(500).optional().nullable(),
});

type RpcClient = {
  rpc: (
    functionName: string,
    args: Record<string, unknown>,
  ) => Promise<{ data: unknown; error: { code?: string; message?: string; details?: string; hint?: string } | null }>;
};

export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const auth = await authenticateApiRequest(request, ["platform_admin"]);
    if (auth.response) return auth.response;
    const organizationId = uuid.parse((await params).id);
    const { data, error } = await (createAdminClient() as unknown as RpcClient).rpc("get_organization_plan_usage", {
      p_organization_id: organizationId,
    });
    if (error) return rpcApiError(error, "No se pudo cargar el plan de la organización");
    return NextResponse.json({ data });
  } catch (error) {
    return handleApiError(error);
  }
}

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const auth = await authenticateApiRequest(request, ["platform_admin"]);
    if (auth.response) return auth.response;
    const organizationId = uuid.parse((await params).id);
    const body = subscriptionSchema.parse(await request.json().catch(() => ({})));
    const { data, error } = await (createAdminClient() as unknown as RpcClient).rpc("set_organization_subscription", {
      p_actor_user_id: auth.user.id,
      p_organization_id: organizationId,
      p_plan_code: body.planCode,
      p_status: body.status,
      p_reason: body.reason ?? null,
    });
    if (error) return rpcApiError(error, "No se pudo actualizar el plan de la organización");
    return NextResponse.json({ data });
  } catch (error) {
    return handleApiError(error);
  }
}
