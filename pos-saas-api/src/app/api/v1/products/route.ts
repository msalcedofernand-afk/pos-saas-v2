import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { authenticateApiRequest } from "@/lib/auth/api";
import { handleApiError } from "@/lib/api/response";
import { createSupabaseProductRepository } from "@/infrastructure/database/supabase/product-repository";
import { boundedText, limits, money, strictInteger, strictQueryInteger, uuid } from "@/lib/validation/rules";

export const dynamic = "force-dynamic";

const querySchema = z.object({
  search: z.string().trim().max(100).optional(),
  categoryId: uuid.optional(),
  available: z
    .enum(["true", "false"])
    .transform((value) => value === "true")
    .optional(),
  page: strictQueryInteger(1, limits.page, 1),
  limit: strictQueryInteger(1, limits.limit, 25),
});

const productSchema = z.object({
  categoryId: uuid,
  name: boundedText(limits.productName, 1),
  price: money(999999.99),
  description: boundedText(limits.description).nullable().optional(),
  isAvailable: z.boolean().default(true),
  prepTimeMinutes: strictInteger(0, limits.prepTimeMinutes).default(0),
});

export async function GET(request: NextRequest) {
  try {
    const auth = await authenticateApiRequest(request, undefined, { requireOrganization: true });
    if (auth.response) return auth.response;

    const query = querySchema.parse(Object.fromEntries(request.nextUrl.searchParams));
    const repository = createSupabaseProductRepository(auth.user.organizationId);
    const result = await repository.list(query);

    return NextResponse.json({
      data: result.data,
      meta: { page: query.page, limit: query.limit, total: result.total },
    });
  } catch (error) {
    return handleApiError(error);
  }
}

export async function POST(request: NextRequest) {
  try {
    const auth = await authenticateApiRequest(request, ["admin", "cashier"], { requireOrganization: true });
    if (auth.response) return auth.response;

    const body = productSchema.parse(await request.json());
    const repository = createSupabaseProductRepository(auth.user.organizationId);
    const product = await repository.create({
      category_id: body.categoryId,
      name: body.name,
      price: body.price,
      description: body.description ?? null,
      is_available: body.isAvailable,
      prep_time_minutes: body.prepTimeMinutes,
    });

    return NextResponse.json({ data: product }, { status: 201 });
  } catch (error) {
    return handleApiError(error);
  }
}
