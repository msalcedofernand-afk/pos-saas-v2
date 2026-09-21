import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { authenticateApiRequest } from "@/lib/auth/api";
import { apiError, handleApiError, rpcApiError } from "@/lib/api/response";
import { createAdminClient } from "@/lib/supabase/admin";
import { boundedText, money, stockQuantity, uuid } from "@/lib/validation/rules";

const bodySchema = z.object({
  inventoryItemId: uuid,
  type: z.enum(["in", "out", "adjustment"]),
  quantity: stockQuantity,
  unitCost: money().default(0),
  description: boundedText(300).optional(),
});

export async function POST(request: NextRequest) {
  try {
    const auth = await authenticateApiRequest(request, ["admin", "staff"]);
    if (auth.response) return auth.response;
    const body = bodySchema.parse(await request.json());
    const db = createAdminClient();
    const { data, error } = await db.rpc("register_inventory_movement", {
      p_inventory_item_id: body.inventoryItemId,
      p_user_id: auth.user.id,
      p_type: body.type,
      p_quantity: body.quantity,
      p_unit_cost: body.unitCost,
      p_description: body.description ?? "",
    });
    if (error) return rpcApiError(error, "No se pudo registrar el movimiento");
    const item = Array.isArray(data) ? data[0] : data;
    if (!item) return apiError("No se pudo registrar el movimiento", 500);
    return NextResponse.json({ data: item }, { status: 201 });
  } catch (error) {
    return handleApiError(error);
  }
}
