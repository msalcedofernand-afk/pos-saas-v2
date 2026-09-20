"use client";

import Link from "next/link";
import { FormEvent, useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { Toast } from "@/components/ui/Toast";
import { apiFetch } from "@/lib/api/client";

type Product = { id: string; category_id: string; name: string; price: number; description: string | null; is_available: boolean; prep_time_minutes: number; categories?: { name: string } | null };
type Category = { id: string; name: string };
type Session = { data: { user: { roles: string[] } } };
type ProductResponse = { data: Product[]; meta: { total: number } };
type CategoryResponse = { data: Category[] };
type ProductForm = { categoryId: string; name: string; price: string; description: string; isAvailable: boolean; prepTimeMinutes: string };

const emptyForm: ProductForm = { categoryId: "", name: "", price: "", description: "", isAvailable: true, prepTimeMinutes: "0" };

export default function ProductsPage() {
  const router = useRouter();
  const [products, setProducts] = useState<Product[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [roles, setRoles] = useState<string[]>([]);
  const [search, setSearch] = useState("");
  const [categoryId, setCategoryId] = useState("");
  const [availability, setAvailability] = useState("all");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [formError, setFormError] = useState<string | null>(null);
  const [toast, setToast] = useState<{ message: string; tone: "error" | "success" } | null>(null);
  const [editing, setEditing] = useState<Product | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<Product | null>(null);
  const [deleteBusy, setDeleteBusy] = useState(false);
  const [modalOpen, setModalOpen] = useState(false);
  const [categoryModalOpen, setCategoryModalOpen] = useState(false);
  const [categoryName, setCategoryName] = useState("");
  const [form, setForm] = useState<ProductForm>(emptyForm);
  const [saving, setSaving] = useState(false);

  const canManage = roles.some((role) => ["admin", "cashier"].includes(role));
  const canDelete = roles.includes("admin");

  const loadProducts = useCallback(async () => {
    try {
      const params = new URLSearchParams({ limit: "100" });
      if (search.trim()) params.set("search", search.trim());
      if (categoryId) params.set("categoryId", categoryId);
      if (availability !== "all") params.set("available", availability);
      const response = await apiFetch<ProductResponse>(`/api/v1/products?${params.toString()}`);
      setProducts(response.data);
      setError(null);
    } catch (cause) {
      const message = cause instanceof Error ? cause.message : "No se pudieron cargar los productos";
      if (message === "No autenticado") router.replace("/login");
      else setError(message);
    } finally {
      setLoading(false);
    }
  }, [availability, categoryId, router, search]);

  useEffect(() => {
    async function loadInitialData() {
      try {
        const [session, categoryResponse] = await Promise.all([apiFetch<Session>("/api/v1/auth/me"), apiFetch<CategoryResponse>("/api/v1/categories")]);
        setRoles(session.data.user.roles);
        setCategories(categoryResponse.data);
      } catch (cause) {
        const message = cause instanceof Error ? cause.message : "No se pudo cargar el módulo";
        if (message === "No autenticado") router.replace("/login");
        else setError(message);
      }
    }
    void loadInitialData();
  }, [router]);

  useEffect(() => { void loadProducts(); }, [loadProducts]);

  const availableCount = useMemo(() => products.filter((product) => product.is_available).length, [products]);

  function openCreate() {
    setEditing(null);
    setForm({ ...emptyForm, categoryId: categories[0]?.id ?? "" });
    setFormError(null);
    setModalOpen(true);
  }

  function openEdit(product: Product) {
    setEditing(product);
    setForm({ categoryId: product.category_id, name: product.name, price: String(product.price), description: product.description ?? "", isAvailable: product.is_available, prepTimeMinutes: String(product.prep_time_minutes ?? 0) });
    setFormError(null);
    setModalOpen(true);
  }

  async function saveProduct(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSaving(true);
    setFormError(null);
    try {
      await apiFetch(editing ? `/api/v1/products/${editing.id}` : "/api/v1/products", { method: editing ? "PATCH" : "POST", body: JSON.stringify({ categoryId: form.categoryId, name: form.name, price: Number(form.price), description: form.description || null, isAvailable: form.isAvailable, prepTimeMinutes: Number(form.prepTimeMinutes || 0) }) });
      setEditing(null);
      setModalOpen(false);
      await loadProducts();
      setToast({ message: editing ? "Producto actualizado" : "Producto creado", tone: "success" });
    } catch (cause) {
      setFormError(cause instanceof Error ? cause.message : "No se pudo guardar el producto");
    } finally {
      setSaving(false);
    }
  }

  async function confirmRemoveProduct() {
    if (!deleteTarget) return;
    setDeleteBusy(true);
    try {
      await apiFetch(`/api/v1/products/${deleteTarget.id}`, { method: "DELETE" });
      setDeleteTarget(null);
      await loadProducts();
      setToast({ message: "Producto eliminado", tone: "success" });
    } catch (cause) {
      setToast({ message: cause instanceof Error ? cause.message : "No se pudo eliminar el producto", tone: "error" });
    } finally {
      setDeleteBusy(false);
    }
  }

  async function createCategory() {
    const name = categoryName.trim();
    if (!name) return;
    try {
      const response = await apiFetch<{ data: Category }>("/api/v1/categories", { method: "POST", body: JSON.stringify({ name, sortOrder: categories.length }) });
      setCategories((current) => [...current, response.data].sort((a, b) => a.name.localeCompare(b.name)));
      setCategoryId(response.data.id);
      setCategoryName("");
      setCategoryModalOpen(false);
      setToast({ message: "Categoría creada", tone: "success" });
    } catch (cause) {
      setToast({ message: cause instanceof Error ? cause.message : "No se pudo crear la categoría", tone: "error" });
    }
  }

  return (
    <main className="shell catalog-shell">
      <nav className="nav catalog-nav"><Link className="brand" href="/dashboard">← Panel</Link><div className="nav-actions"><strong>Productos</strong><Link className="button button-small" href="/dashboard">Volver</Link></div></nav>
      <div className="catalog-heading"><div><div className="eyebrow">Carta y disponibilidad</div><h1>Productos</h1><p className="lead">Administra lo que aparece en la carta y controla qué puede venderse hoy.</p></div>{canManage && <button className="button button-primary" onClick={openCreate} type="button">+ Nuevo producto</button>}</div>
      <section className="catalog-stats"><div><strong>{products.length}</strong><span>Mostrados</span></div><div><strong>{availableCount}</strong><span>Disponibles</span></div><div><strong>{products.length - availableCount}</strong><span>No disponibles</span></div></section>
      <section className="catalog-toolbar"><label className="sr-only" htmlFor="product-search">Buscar producto</label><input id="product-search" value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Buscar producto..." /><div className="category-filter"><label className="sr-only" htmlFor="category-filter">Filtrar por categoría</label><select id="category-filter" value={categoryId} onChange={(event) => setCategoryId(event.target.value)}><option value="">Todas las categorías</option>{categories.map((category) => <option value={category.id} key={category.id}>{category.name}</option>)}</select>{canManage && <button className="link-button" onClick={() => setCategoryModalOpen(true)} type="button">+ Categoría</button>}</div><label className="sr-only" htmlFor="availability-filter">Filtrar disponibilidad</label><select id="availability-filter" value={availability} onChange={(event) => setAvailability(event.target.value)}><option value="all">Todos</option><option value="true">Disponibles</option><option value="false">No disponibles</option></select></section>
      {toast && <Toast message={toast.message} tone={toast.tone} onClose={() => setToast(null)} />}
      {error && <p className="form-error" role="alert">{error}</p>}
      <section className="product-table-section">{loading ? <p className="empty-state">Cargando productos...</p> : products.length === 0 ? <p className="empty-state">No hay productos con estos filtros.</p> : <div className="product-table-wrap"><table className="product-table"><thead><tr><th>Producto</th><th>Categoría</th><th>Precio</th><th>Preparación</th><th>Estado</th><th>Acciones</th></tr></thead><tbody>{products.map((product) => <tr key={product.id}><td><strong>{product.name}</strong>{product.description && <small>{product.description}</small>}</td><td>{product.categories?.name ?? "Sin categoría"}</td><td>S/ {Number(product.price).toFixed(2)}</td><td>{product.prep_time_minutes || 0} min</td><td><span className={product.is_available ? "status-pill available" : "status-pill unavailable"}>{product.is_available ? "Disponible" : "Agotado"}</span></td><td><div className="row-actions">{canManage && <button className="link-button" onClick={() => openEdit(product)} type="button">Editar</button>}{canDelete && <button className="link-button danger" onClick={() => setDeleteTarget(product)} type="button">Eliminar</button>}</div></td></tr>)}</tbody></table></div>}</section>
      {modalOpen && <div className="modal-backdrop"><form aria-labelledby="product-dialog-title" className="product-modal" onSubmit={saveProduct} role="dialog"><div className="modal-heading"><div><div className="eyebrow">{editing ? "Editar producto" : "Nuevo producto"}</div><h2 id="product-dialog-title">{editing ? editing.name : "Agregar a la carta"}</h2></div><button aria-label="Cerrar producto" type="button" className="modal-close" onClick={() => setModalOpen(false)}>×</button></div>{formError && <p className="form-error" role="alert">{formError}</p>}<label>Nombre<input autoFocus required value={form.name} onChange={(event) => setForm({ ...form, name: event.target.value })} /></label><label>Categoría<select required value={form.categoryId} onChange={(event) => setForm({ ...form, categoryId: event.target.value })}><option value="">Seleccionar categoría</option>{categories.map((category) => <option value={category.id} key={category.id}>{category.name}</option>)}</select></label><div className="form-two-col"><label>Precio<input required min="0" step="0.01" type="number" value={form.price} onChange={(event) => setForm({ ...form, price: event.target.value })} /></label><label>Preparación (min)<input min="0" type="number" value={form.prepTimeMinutes} onChange={(event) => setForm({ ...form, prepTimeMinutes: event.target.value })} /></label></div><label>Descripción<textarea rows={3} value={form.description} onChange={(event) => setForm({ ...form, description: event.target.value })} /></label><label className="checkbox-label"><input type="checkbox" checked={form.isAvailable} onChange={(event) => setForm({ ...form, isAvailable: event.target.checked })} /> Disponible para vender</label><div className="modal-actions"><button type="button" className="button button-secondary" onClick={() => setModalOpen(false)}>Cancelar</button><button className="button button-primary" disabled={saving}>{saving ? "Guardando..." : "Guardar producto"}</button></div></form></div>}
      {categoryModalOpen && <div className="modal-backdrop"><form aria-labelledby="category-dialog-title" className="product-modal" onSubmit={(event) => { event.preventDefault(); void createCategory(); }} role="dialog"><div className="modal-heading"><div><div className="eyebrow">Carta</div><h2 id="category-dialog-title">Nueva categoría</h2></div><button aria-label="Cerrar categoría" type="button" className="modal-close" onClick={() => setCategoryModalOpen(false)}>×</button></div><label>Nombre<input autoFocus required value={categoryName} onChange={(event) => setCategoryName(event.target.value)} /></label><div className="modal-actions"><button type="button" className="button button-secondary" onClick={() => setCategoryModalOpen(false)}>Cancelar</button><button className="button button-primary">Guardar categoría</button></div></form></div>}
      <ConfirmDialog description={deleteTarget ? `Se eliminará ${deleteTarget.name} de la carta.` : ""} busy={deleteBusy} confirmLabel="Eliminar producto" danger onCancel={() => { if (!deleteBusy) setDeleteTarget(null); }} onConfirm={() => void confirmRemoveProduct()} open={Boolean(deleteTarget)} title="¿Eliminar este producto?" />
    </main>
  );
}
