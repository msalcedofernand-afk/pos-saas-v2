import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { authenticateApiRequest } from "@/lib/auth/api";
import { apiError, handleApiError, rpcApiError } from "@/lib/api/response";
import { createAdminClient } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";

const itemSchema = z.object({ productId: z.string().uuid(), quantity: z.number().int().min(1).max(999), notes: z.string().trim().max(500).optional() });
const createSchema = z.object({ tableId: z.string().uuid().nullable().optional(), guests: z.number().int().min(1).max(999).default(1), notes: z.string().trim().max(1000).nullable().optional(), items: z.array(itemSchema).min(1) });
const orderSelect = "id, table_id, user_id, status, total_amount, notes, guests, created_at, updated_at, table:tables_restaurant(name), order_items(id, quantity, unit_price, subtotal, status, notes, product:products(id, name))";

function rpcConflict(error: { message?: string }) {
  return rpcApiError(error, "No se pudo completar el pedido");
}

export async function GET(request: NextRequest) {
  try {
    const auth = await authenticateApiRequest(request, ["admin", "cashier", "waiter", "kitchen", "staff"]);
    if (auth.response) return auth.response;
    const status = request.nextUrl.searchParams.get("status");
    let query = (createAdminClient() as any).from("orders").select(orderSelect).eq("organization_id", auth.user.organizationId).order("created_at", { ascending: false }).limit(100);
    if (status) query = query.eq("status", status);
    const { data, error } = await query;
    if (error) throw error;
    return NextResponse.json({ data: data ?? [] });
  } catch (error) {
    return handleApiError(error);
  }
}

export async function POST(request: NextRequest) {
  try {
    const auth = await authenticateApiRequest(request, ["admin", "waiter", "cashier"]);
    if (auth.response) return auth.response;
    const body = createSchema.parse(await request.json());
    const db = createAdminClient() as any;
    const { data: orderId, error: transactionError } = await db.rpc("create_order_transaction", {
      p_user_id: auth.user.id,
      p_table_id: body.tableId ?? null,
      p_guests: body.guests,
      p_notes: body.notes ?? null,
      p_items: body.items.map((item) => ({ product_id: item.productId, quantity: item.quantity, notes: item.notes ?? null })),
    });
    if (transactionError) return rpcConflict(transactionError);
    if (!orderId) return apiError("No se pudo crear el pedido", 500);

    const { data: order, error: orderError } = await db.from("orders").select(orderSelect).eq("id", orderId).eq("organization_id", auth.user.organizationId).single();
    if (orderError) throw orderError;
    return NextResponse.json({ data: order }, { status: 201 });
  } catch (error) {
    return handleApiError(error);
  }
}
