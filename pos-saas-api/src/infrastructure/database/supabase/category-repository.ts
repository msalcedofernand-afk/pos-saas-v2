import "server-only";

import { createAdminClient } from "@/lib/supabase/admin";
import { CategoryInUseError } from "@/domain/catalog/category-repository";
import type { CategoryInput, CategoryRecord, CategoryRepository } from "@/domain/catalog/category-repository";

export function createSupabaseCategoryRepository(organizationId: string): CategoryRepository {
  const db = createAdminClient();

  return {
    async list({ page, limit }) {
      const from = (page - 1) * limit;
      const { data, count, error } = await db
        .from("categories")
        .select("*", { count: "exact" })
        .eq("organization_id", organizationId)
        .order("sort_order", { ascending: true })
        .order("name", { ascending: true })
        .range(from, from + limit - 1);

      if (error) throw error;
      return { data: (data ?? []) as CategoryRecord[], total: count };
    },

    async create(input: CategoryInput) {
      const { data, error } = await db
        .from("categories")
        .insert({ ...input, organization_id: organizationId })
        .select("*")
        .single();

      if (error) throw error;
      return data as CategoryRecord;
    },

    async remove(id: string) {
      const { count, error: countError } = await db
        .from("products")
        .select("id", { count: "exact", head: true })
        .eq("organization_id", organizationId)
        .eq("category_id", id);

      if (countError) throw countError;
      if ((count ?? 0) > 0) throw new CategoryInUseError();

      const { data, error } = await db
        .from("categories")
        .delete()
        .eq("id", id)
        .eq("organization_id", organizationId)
        .select("id")
        .maybeSingle();

      if (error) throw error;
      if (!data) {
        const notFound = new Error("Categoría no encontrada");
        Object.assign(notFound, { code: "CATEGORY_NOT_FOUND" });
        throw notFound;
      }
    },
  };
}
