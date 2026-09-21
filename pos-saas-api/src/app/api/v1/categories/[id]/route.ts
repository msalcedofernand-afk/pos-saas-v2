import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { authenticateApiRequest } from "@/lib/auth/api";
import { apiError, handleApiError } from "@/lib/api/response";
import { CategoryInUseError } from "@/domain/catalog/category-repository";
import { createSupabaseCategoryRepository } from "@/infrastructure/database/supabase/category-repository";
import { uuid } from "@/lib/validation/rules";

const idSchema = uuid;

export async function DELETE(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const auth = await authenticateApiRequest(request, ["admin"]);
    if (auth.response) return auth.response;

    const id = idSchema.parse((await params).id);
    await createSupabaseCategoryRepository(auth.user.organizationId).remove(id);
    return NextResponse.json({ success: true });
  } catch (error) {
    if (error instanceof CategoryInUseError) return apiError(error.message, 409, { code: error.code });
    if (error instanceof Error && error.message === "Categoría no encontrada") return apiError(error.message, 404);
    return handleApiError(error);
  }
}
