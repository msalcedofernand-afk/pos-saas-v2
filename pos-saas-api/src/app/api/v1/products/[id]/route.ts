import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { authenticateApiRequest } from "@/lib/auth/api";
import { apiError, handleApiError } from "@/lib/api/response";
import { createSupabaseProductRepository } from "@/infrastructure/database/supabase/product-repository";
import { boundedText, limits, money, strictInteger, uuid } from "@/lib/validation/rules";

const idSchema = uuid;
const updateSchema = z
  .object({
    categoryId: uuid.optional(),
    name: boundedText(limits.productName, 1).optional(),
    price: money(999999.99).optional(),
    description: boundedText(limits.description).nullable().optional(),
    isAvailable: z.boolean().optional(),
    prepTimeMinutes: strictInteger(0, limits.prepTimeMinutes).optional(),
  })
  .refine((value) => Object.keys(value).length > 0, "Debe enviar al menos un campo");

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const auth = await authenticateApiRequest(request, ["admin", "cashier"]);
    if (auth.response) return auth.response;

    const id = idSchema.parse((await params).id);
    const body = updateSchema.parse(await request.json());
    const repository = createSupabaseProductRepository(auth.user.organizationId);
    const product = await repository.update(id, {
      category_id: body.categoryId,
      name: body.name,
      price: body.price,
      description: body.description,
      is_available: body.isAvailable,
      prep_time_minutes: body.prepTimeMinutes,
    });

    return NextResponse.json({ data: product });
  } catch (error: any) {
    if (error?.code === "PGRST116") return apiError("Producto no encontrado", 404);
    return handleApiError(error);
  }
}

export async function DELETE(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const auth = await authenticateApiRequest(request, ["admin"]);
    if (auth.response) return auth.response;

    const id = idSchema.parse((await params).id);
    const repository = createSupabaseProductRepository(auth.user.organizationId);
    await repository.remove(id);
    return NextResponse.json({ success: true });
  } catch (error) {
    return handleApiError(error);
  }
}
