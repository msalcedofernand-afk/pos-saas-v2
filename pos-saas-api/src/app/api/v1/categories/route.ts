import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { authenticateApiRequest } from "@/lib/auth/api";
import { handleApiError } from "@/lib/api/response";
import { createSupabaseCategoryRepository } from "@/infrastructure/database/supabase/category-repository";
import { boundedText, limits, strictInteger, strictQueryInteger } from "@/lib/validation/rules";

export const dynamic = "force-dynamic";

const categorySchema = z.object({
  name: boundedText(limits.categoryName, 1),
  sortOrder: strictInteger(0, limits.sortOrder).default(0),
});
const querySchema = z.object({
  page: strictQueryInteger(1, limits.page, 1),
  limit: strictQueryInteger(1, limits.limit, 100),
});

export async function GET(request: NextRequest) {
  try {
    const auth = await authenticateApiRequest(request, undefined, { requireOrganization: true });
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
    const auth = await authenticateApiRequest(request, ["admin", "cashier"], { requireOrganization: true });
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
