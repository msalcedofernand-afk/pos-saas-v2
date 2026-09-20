import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { authenticateApiRequest } from "@/lib/auth/api";
import { apiError, handleApiError } from "@/lib/api/response";
import { createAdminClient } from "@/lib/supabase/admin";

const bodySchema = z.object({ openingAmount: z.number().finite().min(0).max(99999999) });

export async function POST(request: NextRequest) {
  try {
    const auth = await authenticateApiRequest(request, ["admin", "cashier"]);
    if (auth.response) return auth.response;
    const body = bodySchema.parse(await request.json());
    const db = createAdminClient() as any;
    const { data: existing } = await db.from("shifts").select("id").eq("user_id", auth.user.id).eq("status", "open").maybeSingle();
    if (existing) return apiError("Ya tienes una caja abierta", 409);
    const { data, error } = await db.from("shifts").insert({ user_id: auth.user.id, opening_amount: body.openingAmount, status: "open" }).select("id, opened_at, opening_amount, status").single();
    if (error) throw error;
    return NextResponse.json({ data }, { status: 201 });
  } catch (error) {
    return handleApiError(error);
  }
}
