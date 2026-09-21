import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { authenticateApiRequest } from "@/lib/auth/api";
import { apiError, handleApiError, rpcApiError } from "@/lib/api/response";
import { getIdempotencyKey, hashIdempotencyPayload, parseIdempotentResult } from "@/lib/idempotency";
import { createAdminClient } from "@/lib/supabase/admin";
import { boundedText, limits, strictInteger, strictQueryInteger, uuid } from "@/lib/validation/rules";

export const dynamic = "force-dynamic";

const itemSchema = z.object({
  productId: uuid,
  quantity: strictInteger(1, limits.quantity),
  notes: boundedText(limits.itemNotes).optional(),
});
const createSchema = z.object({
  tableId: uuid.nullable().optional(),
  guests: strictInteger(1, limits.guests).default(1),
  notes: boundedText(limits.orderNotes).nullable().optional(),
  items: z.array(itemSchema).min(1),
});
const statusSchema = z.enum(["pending", "confirmed", "preparing", "ready", "served", "paid", "cancelled"]);
const listSchema = z.object({
  status: statusSchema.optional(),
  page: strictQueryInteger(1, limits.page, 1),
  limit: strictQueryInteger(1, limits.limit, 50),
});
const orderSelect =
  "id, table_id, user_id, status, total_amount, notes, guests, created_at, updated_at, table:tables_restaurant(name), order_items(id, quantity, unit_price, subtotal, status, notes, product:products(id, name))";

function rpcConflict(error: { message?: string }) {
  return rpcApiError(error, "No se pudo completar el pedido");
}

export async function GET(request: NextRequest) {
  try {
    const auth = await authenticateApiRequest(request, ["admin", "cashier", "waiter", "kitchen", "staff"]);
    if (auth.response) return auth.response;
    const queryParams = listSchema.parse(Object.fromEntries(request.nextUrl.searchParams));
    const from = (queryParams.page - 1) * queryParams.limit;
    const to = from + queryParams.limit - 1;
    let query = createAdminClient()
      .from("orders")
      .select(orderSelect, { count: "exact" })
      .eq("organization_id", auth.user.organizationId)
      .order("created_at", { ascending: false })
      .range(from, to);
    if (queryParams.status) query = query.eq("status", queryParams.status);
    const { data, error, count } = await query;
    if (error) throw error;
    return NextResponse.json({
      data: data ?? [],
      meta: { page: queryParams.page, limit: queryParams.limit, total: count ?? 0, hasMore: (count ?? 0) > to + 1 },
    });
  } catch (error) {
    return handleApiError(error);
  }
}

export async function POST(request: NextRequest) {
  try {
    const auth = await authenticateApiRequest(request, ["admin", "waiter", "cashier"]);
    if (auth.response) return auth.response;
    const body = createSchema.parse(await request.json());
    const idempotencyKey = getIdempotencyKey(request);
    if (!idempotencyKey) return apiError("Falta el header Idempotency-Key", 400);
    const db = createAdminClient();
    const { data: rawResult, error: transactionError } = await db.rpc("create_order_transaction_idempotent", {
      p_organization_id: auth.user.organizationId,
      p_user_id: auth.user.id,
      p_table_id: body.tableId ?? null,
      p_guests: body.guests,
      p_notes: body.notes ?? "",
      p_items: body.items.map((item) => ({
        product_id: item.productId,
        quantity: item.quantity,
        notes: item.notes ?? null,
      })),
      p_idempotency_key: idempotencyKey,
      p_request_hash: hashIdempotencyPayload(body),
    });
    if (transactionError) return rpcConflict(transactionError);
    const result = parseIdempotentResult<{ orderId?: string; replayed?: boolean }>(rawResult);
    const orderId = result.orderId;
    if (!orderId) return apiError("No se pudo crear el pedido", 500);

    const { data: order, error: orderError } = await db
      .from("orders")
      .select(orderSelect)
      .eq("id", orderId)
      .eq("organization_id", auth.user.organizationId)
      .single();
    if (orderError) throw orderError;
    return NextResponse.json(
      { data: order, meta: { replayed: result.replayed === true } },
      { status: result.replayed ? 200 : 201 },
    );
  } catch (error) {
    return handleApiError(error);
  }
}
