import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { authenticateApiRequest } from "@/lib/auth/api";
import { handleApiError, rpcApiError } from "@/lib/api/response";
import { createAdminClient } from "@/lib/supabase/admin";
import { uuid } from "@/lib/validation/rules";

const metricsRpc = "get_platform_operational_metrics";

type RpcClient = {
  rpc: (
    functionName: string,
    args: Record<string, unknown>,
  ) => Promise<{ data: unknown; error: { code?: string; message?: string; details?: string; hint?: string } | null }>;
};

export async function GET(request: NextRequest) {
  try {
    const auth = await authenticateApiRequest(request, ["platform_admin"]);
    if (auth.response) return auth.response;

    const organizationValue = request.nextUrl.searchParams.get("organizationId")?.trim() ?? "";
    const daysValue = request.nextUrl.searchParams.get("days")?.trim() ?? "30";
    const days = z.coerce.number().int().min(1).max(90).parse(daysValue);
    const organizationId = organizationValue ? uuid.parse(organizationValue) : null;
    const until = new Date();
    const since = new Date(until.getTime() - days * 24 * 60 * 60 * 1000);

    const { data, error } = await (createAdminClient() as unknown as RpcClient).rpc(metricsRpc, {
      p_actor_user_id: auth.user.id,
      p_organization_id: organizationId,
      p_since: since.toISOString(),
      p_until: until.toISOString(),
    });
    if (error) return rpcApiError(error, "No se pudieron cargar las métricas operativas");
    if (organizationId && data && typeof data === "object" && !Array.isArray(data)) {
      const scopedData = data as { organizationMetrics?: Array<{ organizationId?: string }> } & Record<string, unknown>;
      return NextResponse.json({
        data: {
          ...scopedData,
          organizationMetrics: (scopedData.organizationMetrics ?? []).filter(
            (item) => item.organizationId === organizationId,
          ),
        },
      });
    }
    return NextResponse.json({ data });
  } catch (error) {
    return handleApiError(error);
  }
}
