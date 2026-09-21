import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { authenticateApiRequest } from "@/lib/auth/api";
import { handleApiError } from "@/lib/api/response";
import { createSupabaseCategoryRepository } from "@/infrastructure/database/supabase/category-repository";

export const dynamic = "force-dynamic";

const categorySchema = z.object({
  name: z.string().trim().min(1).max(100),
  sortOrder: z.coerce.number().int().min(0).max(999999).default(0),
});
const querySchema = z.object({
  page: z.coerce.number().int().min(1).max(10000).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(100),
});

export async function GET(request: NextRequest) {
  try {
    const auth = await authenticateApiRequest(request);
    if (auth.response) return auth.response;

    const query = querySchema.parse(Object.fromEntries(request.nextUrl.searchParams));
    const result = await createSupabaseCategoryRepository(auth.user.organizationId).list(query);
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

    const body = categorySchema.parse(await request.json());
    const category = await createSupabaseCategoryRepository(auth.user.organizationId).create({
      name: body.name,
      sort_order: body.sortOrder,
    });

    return NextResponse.json({ data: category }, { status: 201 });
  } catch (error) {
    return handleApiError(error);
  }
}
