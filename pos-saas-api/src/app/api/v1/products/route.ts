import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { authenticateApiRequest } from "@/lib/auth/api";
import { handleApiError } from "@/lib/api/response";
import { createSupabaseProductRepository } from "@/infrastructure/database/supabase/product-repository";

export const dynamic = "force-dynamic";

const querySchema = z.object({
  search: z.string().trim().max(100).optional(),
  categoryId: z.string().uuid().optional(),
  available: z
    .enum(["true", "false"])
    .transform((value) => value === "true")
    .optional(),
  page: z.coerce.number().int().min(1).max(10000).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(25),
});

const productSchema = z.object({
  categoryId: z.string().uuid(),
  name: z.string().trim().min(1).max(150),
  price: z.coerce.number().finite().min(0).max(999999.99),
  description: z.string().trim().max(1000).nullable().optional(),
  isAvailable: z.boolean().default(true),
  prepTimeMinutes: z.number().int().min(0).max(1440).default(0),
});

export async function GET(request: NextRequest) {
  try {
    const auth = await authenticateApiRequest(request);
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
    const auth = await authenticateApiRequest(request, ["admin", "cashier"]);
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
