import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { authenticateApiRequest } from "@/lib/auth/api";
import { apiError, handleApiError, rpcApiError } from "@/lib/api/response";
import { createAdminClient } from "@/lib/supabase/admin";

const bodySchema = z.object({ inventoryItemId: z.string().uuid(), type: z.enum(["in", "out", "adjustment"]), quantity: z.number().finite().positive(), unitCost: z.number().finite().min(0).default(0), description: z.string().trim().max(300).optional() });

export async function POST(request: NextRequest) {
  try {
    const auth = await authenticateApiRequest(request, ["admin", "staff"]);
    if (auth.response) return auth.response;
    const body = bodySchema.parse(await request.json());
    const db = createAdminClient() as any;
    const { data, error } = await db.rpc("register_inventory_movement", {
      p_inventory_item_id: body.inventoryItemId,
      p_user_id: auth.user.id,
      p_type: body.type,
      p_quantity: body.quantity,
      p_unit_cost: body.unitCost,
      p_description: body.description ?? null,
    });
    if (error) return rpcApiError(error, "No se pudo registrar el movimiento");
    const item = Array.isArray(data) ? data[0] : data;
    if (!item) return apiError("No se pudo registrar el movimiento", 500);
    return NextResponse.json({ data: item }, { status: 201 });
  } catch (error) {
    return handleApiError(error);
  }
}
