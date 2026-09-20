import "server-only";

import { createAdminClient } from "@/lib/supabase/admin";
import { CategoryInUseError } from "@/domain/catalog/category-repository";
import type { CategoryInput, CategoryRecord, CategoryRepository } from "@/domain/catalog/category-repository";

export function createSupabaseCategoryRepository(): CategoryRepository {
  const db = createAdminClient();

  return {
    async list() {
      const { data, error } = await (db as any)
        .from("categories")
        .select("*")
        .order("sort_order", { ascending: true })
        .order("name", { ascending: true });

      if (error) throw error;
      return (data ?? []) as CategoryRecord[];
    },

    async create(input: CategoryInput) {
      const { data, error } = await (db as any)
        .from("categories")
        .insert(input)
        .select("*")
        .single();

      if (error) throw error;
      return data as CategoryRecord;
    },

    async remove(id: string) {
      const { count, error: countError } = await (db as any)
        .from("products")
        .select("id", { count: "exact", head: true })
        .eq("category_id", id);

      if (countError) throw countError;
      if ((count ?? 0) > 0) throw new CategoryInUseError();

      const { data, error } = await (db as any)
        .from("categories")
        .delete()
        .eq("id", id)
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
