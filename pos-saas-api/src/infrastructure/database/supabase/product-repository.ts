import "server-only";

import { createAdminClient } from "@/lib/supabase/admin";
import type { ProductInput, ProductRecord, ProductRepository } from "@/domain/catalog/product-repository";

export function createSupabaseProductRepository(): ProductRepository {
  const db = createAdminClient();

  return {
    async list({ search, categoryId, available, page, limit }) {
      let query = (db as any)
        .from("products")
        .select("*, categories(name)", { count: "exact" });

      const safeSearch = search?.replace(/[\\%_,()]/g, " ").trim();
      if (safeSearch) query = query.or(`name.ilike.%${safeSearch}%,description.ilike.%${safeSearch}%`);
      if (categoryId) query = query.eq("category_id", categoryId);
      if (available !== undefined) query = query.eq("is_available", available);

      const from = (page - 1) * limit;
      const { data, count, error } = await query
        .order("name", { ascending: true })
        .range(from, from + limit - 1);

      if (error) throw error;
      return { data: (data ?? []) as ProductRecord[], total: count };
    },

    async create(input: ProductInput) {
      const { data, error } = await (db as any)
        .from("products")
        .insert(input)
        .select("*, categories(name)")
        .single();
      if (error) throw error;
      return data as ProductRecord;
    },

    async update(id: string, input: Partial<ProductInput>) {
      const { data, error } = await (db as any)
        .from("products")
        .update({ ...input, updated_at: new Date().toISOString() })
        .eq("id", id)
        .select("*, categories(name)")
        .single();
      if (error) throw error;
      return data as ProductRecord;
    },

    async remove(id: string) {
      const { error } = await (db as any).from("products").delete().eq("id", id);
      if (error) throw error;
    },
  };
}
