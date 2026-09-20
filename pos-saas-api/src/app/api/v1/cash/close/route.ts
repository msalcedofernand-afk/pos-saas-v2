import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { authenticateApiRequest } from "@/lib/auth/api";
import { apiError, handleApiError } from "@/lib/api/response";
import { createAdminClient } from "@/lib/supabase/admin";

const bodySchema = z.object({ closingAmount: z.number().finite().min(0).max(99999999) });

export async function POST(request: NextRequest) {
  try {
    const auth = await authenticateApiRequest(request, ["admin", "cashier"]);
    if (auth.response) return auth.response;
    const body = bodySchema.parse(await request.json());
    const db = createAdminClient() as any;
    const { data: shift, error: shiftError } = await db.from("shifts").select("id").eq("user_id", auth.user.id).eq("status", "open").maybeSingle();
    if (shiftError) throw shiftError;
    if (!shift) return apiError("No tienes una caja abierta", 409);
    const { count, error: orderError } = await db.from("orders").select("id", { count: "exact", head: true }).eq("status", "served");
    if (orderError) throw orderError;
    if ((count ?? 0) > 0) return apiError("Hay pedidos servidos pendientes de cobro", 409);
    const { data, error } = await db.from("shifts").update({ closing_amount: body.closingAmount, closed_at: new Date().toISOString(), status: "closed" }).eq("id", shift.id).select("id, closed_at, closing_amount, status").single();
    if (error) throw error;
    return NextResponse.json({ data });
  } catch (error) {
    return handleApiError(error);
  }
}
