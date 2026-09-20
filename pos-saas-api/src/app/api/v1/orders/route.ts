import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { authenticateApiRequest } from "@/lib/auth/api";
import { handleApiError } from "@/lib/api/response";
import { createAdminClient } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";

const itemSchema = z.object({ productId: z.string().uuid(), quantity: z.number().int().min(1).max(999), notes: z.string().trim().max(500).optional() });
const createSchema = z.object({ tableId: z.string().uuid().nullable().optional(), guests: z.number().int().min(1).max(999).default(1), notes: z.string().trim().max(1000).nullable().optional(), items: z.array(itemSchema).min(1) });

export async function GET(request: NextRequest) {
  try {
    const auth = await authenticateApiRequest(request, ["admin", "cashier", "waiter", "kitchen", "staff"]);
    if (auth.response) return auth.response;
    const status = request.nextUrl.searchParams.get("status");
    let query = (createAdminClient() as any).from("orders").select("id, table_id, user_id, status, total_amount, notes, guests, created_at, updated_at, table:tables_restaurant(name), order_items(id, quantity, unit_price, subtotal, status, notes, product:products(id, name))").order("created_at", { ascending: false }).limit(100);
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
    const productIds = [...new Set(body.items.map((item) => item.productId))];
    const { data: products, error: productError } = await db.from("products").select("id, price, is_available").in("id", productIds);
    if (productError) throw productError;
    const productMap = new Map<string, any>((products ?? []).map((product: any) => [product.id, product]));
    const orderItems = body.items.map((item) => {
      const product = productMap.get(item.productId);
      if (!product) throw new Error("Producto no encontrado");
      if (!product.is_available) throw new Error("Uno de los productos no está disponible");
      const unitPrice = Number(product.price);
      return { product_id: item.productId, quantity: item.quantity, unit_price: unitPrice, subtotal: unitPrice * item.quantity, status: "pending", notes: item.notes ?? null };
    });
    const total = orderItems.reduce((sum, item) => sum + item.subtotal, 0);
    const { data: order, error: orderError } = await db.from("orders").insert({ table_id: body.tableId ?? null, user_id: auth.user.id, status: "confirmed", total_amount: total, guests: body.guests, notes: body.notes ?? null }).select("id, table_id, status, total_amount, notes, guests, created_at").single();
    if (orderError) throw orderError;
    const { error: itemError } = await db.from("order_items").insert(orderItems.map((item) => ({ ...item, order_id: order.id })));
    if (itemError) {
      await db.from("orders").delete().eq("id", order.id);
      throw itemError;
    }
    if (body.tableId) await db.from("tables_restaurant").update({ status: "occupied" }).eq("id", body.tableId);
    return NextResponse.json({ data: { ...order, items: orderItems } }, { status: 201 });
  } catch (error) {
    return handleApiError(error);
  }
}
