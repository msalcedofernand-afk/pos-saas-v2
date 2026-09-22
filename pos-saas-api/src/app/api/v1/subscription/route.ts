import { NextRequest, NextResponse } from "next/server";
import { authenticateApiRequest } from "@/lib/auth/api";
import { handleApiError, rpcApiError } from "@/lib/api/response";
import { createAdminClient } from "@/lib/supabase/admin";

type RpcClient = {
  rpc: (
    functionName: string,
    args: Record<string, unknown>,
  ) => Promise<{ data: unknown; error: { code?: string; message?: string; details?: string; hint?: string } | null }>;
};

export async function GET(request: NextRequest) {
  try {
    const auth = await authenticateApiRequest(request, undefined, { requireOrganization: true });
    if (auth.response) return auth.response;
    const { data, error } = await (createAdminClient() as unknown as RpcClient).rpc("get_organization_plan_usage", {
      p_organization_id: auth.user.organizationId,
    });
    if (error) return rpcApiError(error, "No se pudo cargar el plan de tu organización");
    return NextResponse.json({ data });
  } catch (error) {
    return handleApiError(error);
  }
}
