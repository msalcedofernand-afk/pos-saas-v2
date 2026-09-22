import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { authenticateApiRequest } from "@/lib/auth/api";
import { apiError, handleApiError, rpcApiError } from "@/lib/api/response";
import { createAdminClient } from "@/lib/supabase/admin";
import { limits, strictQueryInteger, uuid } from "@/lib/validation/rules";

const auditPageSize = strictQueryInteger(1, limits.limit, 25);
const auditPage = strictQueryInteger(1, limits.page, 1);
const auditRpc = "list_platform_audit_logs";

type AuditRpcResult = {
  items: Array<Record<string, unknown>>;
  total: number;
  page: number;
  pageSize: number;
  pageCount: number;
};

type RpcClient = {
  rpc: (
    functionName: string,
    args: Record<string, unknown>,
  ) => Promise<{ data: unknown; error: { code?: string; message?: string; details?: string; hint?: string } | null }>;
};

function parseDate(value: string | null, field: string) {
  if (!value) return null;
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime()))
    throw new z.ZodError([{ code: "custom", path: [field], message: "Fecha inválida" }]);
  return parsed.toISOString();
}

export async function GET(request: NextRequest) {
  try {
    const auth = await authenticateApiRequest(request, ["platform_admin"]);
    if (auth.response) return auth.response;

    const params = request.nextUrl.searchParams;
    const page = auditPage.parse(params.get("page") ?? undefined);
    const pageSize = auditPageSize.parse(params.get("pageSize") ?? undefined);
    const actorFilterValue = params.get("actorUserId")?.trim() ?? "";
    const organizationIdValue = params.get("organizationId")?.trim() ?? "";
    const actorFilter = actorFilterValue ? uuid.parse(actorFilterValue) : null;
    const organizationId = organizationIdValue ? uuid.parse(organizationIdValue) : null;
    const action = params.get("action")?.trim().slice(0, 120) || null;
    const auditableType = params.get("auditableType")?.trim().slice(0, 80) || null;
    const from = parseDate(params.get("from"), "from");
    const to = parseDate(params.get("to"), "to");
    if (from && to && from >= to) return apiError("El rango de fechas es inválido", 400);

    const { data, error } = await (createAdminClient() as unknown as RpcClient).rpc(auditRpc, {
      p_actor_user_id: auth.user.id,
      p_actor_filter: actorFilter,
      p_organization_id: organizationId,
      p_action: action,
      p_auditable_type: auditableType,
      p_from: from,
      p_to: to,
      p_page: page,
      p_page_size: pageSize,
    });
    if (error) return rpcApiError(error, "No se pudo consultar la auditoría global");
    if (!data || typeof data !== "object") return apiError("Respuesta de auditoría inválida", 500);
    return NextResponse.json({ data: data as AuditRpcResult });
  } catch (error) {
    return handleApiError(error);
  }
}
