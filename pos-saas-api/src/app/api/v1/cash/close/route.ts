import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { authenticateApiRequest } from "@/lib/auth/api";
import { apiError, handleApiError } from "@/lib/api/response";
import { createAdminClient } from "@/lib/supabase/admin";

const bodySchema = z.object({
  closingAmount: z.number().finite().min(0).max(99999999),
  differenceReason: z.string().trim().max(300).optional(),
});

export async function POST(request: NextRequest) {
  try {
    const auth = await authenticateApiRequest(request, ["admin", "cashier"]);
    if (auth.response) return auth.response;
    const body = bodySchema.parse(await request.json());
    const db = createAdminClient() as any;
    const { data, error } = await db.rpc("close_cash_shift", {
      p_user_id: auth.user.id,
      p_closing_amount: body.closingAmount,
      p_difference_reason: body.differenceReason ?? null,
    });
    if (error) return apiError(error.message ?? "No se pudo cerrar caja", 409);
    const shift = Array.isArray(data) ? data[0] : data;
    if (!shift) return apiError("No se pudo cerrar caja", 500);
    return NextResponse.json({ data: shift });
  } catch (error) {
    return handleApiError(error);
  }
}
