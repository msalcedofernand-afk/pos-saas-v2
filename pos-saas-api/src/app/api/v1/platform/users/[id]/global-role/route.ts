import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { authenticateApiRequest } from "@/lib/auth/api";
import { createAdminClient } from "@/lib/supabase/admin";
import { handleApiError, rpcApiError } from "@/lib/api/response";
export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const auth = await authenticateApiRequest(request, ["platform_owner"]);
    if (auth.response) return auth.response;
    const id = z.uuid().parse((await params).id);
    const body = z
      .object({
        role: z.enum(["platform_admin", "support_agent", "billing_admin", "security_auditor"]),
        grant: z.boolean(),
      })
      .strict()
      .parse(await request.json());
    const db = createAdminClient() as unknown as {
      rpc(name: string, args: Record<string, unknown>): Promise<{ error: { code?: string; message?: string } | null }>;
    };
    const { error } = await db.rpc("set_platform_role", {
      p_actor: auth.user.id,
      p_target: id,
      p_role: body.role,
      p_grant: body.grant,
    });
    if (error) return rpcApiError(error, "No se pudo cambiar el rol global");
    return NextResponse.json({ data: { updated: true } });
  } catch (error) {
    return handleApiError(error);
  }
}
