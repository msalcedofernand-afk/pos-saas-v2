import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { authenticateApiRequest } from "@/lib/auth/api";
import { apiError, handleApiError } from "@/lib/api/response";
import { createSupabaseProductRepository } from "@/infrastructure/database/supabase/product-repository";

const idSchema = z.string().uuid();
const updateSchema = z.object({
  categoryId: z.string().uuid().optional(),
  name: z.string().trim().min(1).max(150).optional(),
  price: z.coerce.number().finite().min(0).max(999999.99).optional(),
  description: z.string().trim().max(1000).nullable().optional(),
  isAvailable: z.boolean().optional(),
  prepTimeMinutes: z.number().int().min(0).max(1440).optional(),
}).refine((value) => Object.keys(value).length > 0, "Debe enviar al menos un campo");

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const auth = await authenticateApiRequest(request, ["admin", "cashier"]);
    if (auth.response) return auth.response;

    const id = idSchema.parse((await params).id);
    const body = updateSchema.parse(await request.json());
    const repository = createSupabaseProductRepository();
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
    const repository = createSupabaseProductRepository();
    await repository.remove(id);
    return NextResponse.json({ success: true });
  } catch (error) {
    return handleApiError(error);
  }
}
