import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { apiError, handleApiError, rpcApiError } from "@/lib/api/response";

// This endpoint deliberately accepts a verified Auth account without a tenant.
export async function POST(request: NextRequest) {
  try {
    const db = createAdminClient();
    const token = request.headers.get("authorization")?.match(/^Bearer (\S+)$/i)?.[1];
    const { data, error } = token ? await db.auth.getUser(token) : await (await createClient()).auth.getUser();
    if (error || !data.user) return apiError("No autenticado", 401);
    if (!data.user.email_confirmed_at) return apiError("Confirma tu correo para continuar", 403);
    const body = z
      .object({ name: z.string().trim().min(2).max(120) })
      .strict()
      .parse(await request.json());
    const rpc = db as unknown as {
      rpc(
        name: string,
        args: Record<string, unknown>,
      ): Promise<{ data: unknown; error: { code?: string; message?: string } | null }>;
    };
    const result = await rpc.rpc("register_restaurant", { p_user_id: data.user.id, p_name: body.name });
    if (result.error) return rpcApiError(result.error, "No se pudo registrar el restaurante");
    return NextResponse.json({ data: { organizationId: result.data, status: "pending" } });
  } catch (error) {
    return handleApiError(error);
  }
}
