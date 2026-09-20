export interface CategoryRecord {
  id: string;
  name: string;
  sort_order: number;
  created_at: string;
}

export interface CategoryInput {
  name: string;
  sort_order?: number;
}

export class CategoryInUseError extends Error {
  readonly code = "CATEGORY_IN_USE";

  constructor() {
    super("No se puede eliminar una categoría que tiene productos asociados");
    this.name = "CategoryInUseError";
  }
}

export interface CategoryRepository {
  list(): Promise<CategoryRecord[]>;
  create(input: CategoryInput): Promise<CategoryRecord>;
  remove(id: string): Promise<void>;
}
