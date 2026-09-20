import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { authenticateApiRequest } from "@/lib/auth/api";
import { apiError, handleApiError } from "@/lib/api/response";
import { createAdminClient } from "@/lib/supabase/admin";

const bodySchema = z.object({ inventoryItemId: z.string().uuid(), type: z.enum(["in", "out", "adjustment"]), quantity: z.number().finite().positive(), unitCost: z.number().finite().min(0).default(0), description: z.string().trim().max(300).optional() });

export async function POST(request: NextRequest) {
  try {
    const auth = await authenticateApiRequest(request, ["admin", "staff"]);
    if (auth.response) return auth.response;
    const body = bodySchema.parse(await request.json());
    const db = createAdminClient() as any;
    const { data: item, error: readError } = await db.from("inventory_items").select("id, current_stock").eq("id", body.inventoryItemId).maybeSingle();
    if (readError) throw readError;
    if (!item) return apiError("Insumo no encontrado", 404);
    const current = Number(item.current_stock ?? 0);
    const next = body.type === "in" ? current + body.quantity : body.type === "out" ? current - body.quantity : body.quantity;
    if (next < 0) return apiError("El stock no puede quedar negativo", 409);
    const { error: movementError } = await db.from("stock_movements").insert({ inventory_item_id: body.inventoryItemId, type: body.type, quantity: body.quantity, unit_cost: body.unitCost, description: body.description ?? null, user_id: auth.user.id });
    if (movementError) throw movementError;
    const { data, error } = await db.from("inventory_items").update({ current_stock: next, updated_at: new Date().toISOString() }).eq("id", body.inventoryItemId).select("id, name, current_stock, minimum_stock, unit").single();
    if (error) throw error;
    return NextResponse.json({ data });
  } catch (error) {
    return handleApiError(error);
  }
}
