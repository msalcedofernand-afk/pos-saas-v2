export interface ProductRecord {
  id: string;
  category_id: string;
  name: string;
  price: number;
  description: string | null;
  image_url: string | null;
  is_available: boolean;
  prep_time_minutes: number;
  created_at: string;
  updated_at: string;
  categories?: { name: string } | null;
}

export interface ProductInput {
  category_id: string;
  name: string;
  price: number;
  description?: string | null;
  is_available?: boolean;
  prep_time_minutes?: number;
}

export interface ProductRepository {
  list(filters: { search?: string; categoryId?: string; available?: boolean; page: number; limit: number }): Promise<{ data: ProductRecord[]; total: number | null }>;
  create(input: ProductInput): Promise<ProductRecord>;
  update(id: string, input: Partial<ProductInput>): Promise<ProductRecord>;
  remove(id: string): Promise<void>;
}
