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

export async function GET(request: NextRequest) {
  try {
    const auth = await authenticateApiRequest(request);
    if (auth.response) return auth.response;

    const categories = await createSupabaseCategoryRepository(auth.user.organizationId).list();
    return NextResponse.json({ data: categories });
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
