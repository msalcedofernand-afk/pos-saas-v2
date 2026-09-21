"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { apiFetch } from "@/lib/api/client";

type InventoryItem = {
  id: string;
  name: string;
  unit: string;
  current_stock: number;
  minimum_stock: number;
  cost_per_unit: number;
  inventory_categories: { name: string } | null;
  suppliers: { name: string } | null;
};

export default function InventoryPage() {
  const router = useRouter();
  const [items, setItems] = useState<InventoryItem[]>([]);
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState("all");
  const [movementItem, setMovementItem] = useState<InventoryItem | null>(null);
  const [movementType, setMovementType] = useState("in");
  const [movementQuantity, setMovementQuantity] = useState("1");
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      setItems((await apiFetch<{ data: InventoryItem[] }>("/api/v1/inventory")).data);
      setError(null);
    } catch (cause) {
      const message = cause instanceof Error ? cause.message : "No se pudo cargar inventario";
      if (message === "No autenticado") router.replace("/login");
      else setError(message);
    }
  }, [router]);
  useEffect(() => {
    void load();
  }, [load]);
  const visible = useMemo(
    () =>
      items
        .filter((item) => item.name.toLowerCase().includes(search.toLowerCase()))
        .filter(
          (item) =>
            filter === "all" ||
            (filter === "low"
              ? Number(item.current_stock) <= Number(item.minimum_stock)
              : Number(item.current_stock) > Number(item.minimum_stock)),
        ),
    [filter, items, search],
  );

  function movement(item: InventoryItem) {
    setMovementItem(item);
    setMovementType("in");
    setMovementQuantity("1");
  }

  async function submitMovement() {
    if (!movementItem) return;
    const quantity = Number(movementQuantity);
    if (!quantity || quantity <= 0) {
      setError("Ingresa una cantidad válida");
      return;
    }
    try {
      await apiFetch("/api/v1/inventory/movements", {
        method: "POST",
        body: JSON.stringify({
          inventoryItemId: movementItem.id,
          type: movementType,
          quantity,
          unitCost: Number(movementItem.cost_per_unit),
        }),
      });
      setMovementItem(null);
      await load();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "No se pudo registrar el movimiento");
    }
  }

  const lowCount = items.filter((item) => Number(item.current_stock) <= Number(item.minimum_stock)).length;
  return (
    <main className="shell module-shell">
      <nav className="nav compact-nav">
        <Link className="brand" href="/dashboard">
          ← Panel
        </Link>
        <div className="nav-actions">
          <strong>Inventario</strong>
          <Link className="button button-small" href="/dashboard">
            Volver
          </Link>
        </div>
      </nav>
      <div className="module-page-heading">
        <div>
          <div className="eyebrow">Stock y movimientos</div>
          <h1>Inventario</h1>
        </div>
        <button className="button button-small" onClick={() => void load()}>
          Actualizar
        </button>
      </div>
      {error && <p className="form-error">{error}</p>}
      <section className="catalog-stats">
        <div>
          <strong>{items.length}</strong>
          <span>Insumos</span>
        </div>
        <div>
          <strong>{lowCount}</strong>
          <span>Bajo stock</span>
        </div>
        <div>
          <strong>{items.filter((item) => Number(item.current_stock) > Number(item.minimum_stock)).length}</strong>
          <span>Normal</span>
        </div>
      </section>
      <section className="catalog-toolbar">
        <input placeholder="Buscar insumo..." value={search} onChange={(event) => setSearch(event.target.value)} />
        <select value={filter} onChange={(event) => setFilter(event.target.value)}>
          <option value="all">Todos</option>
          <option value="low">Bajo stock</option>
          <option value="normal">Stock normal</option>
        </select>
      </section>
      <section className="product-table-section">
        {visible.length === 0 ? (
          <p className="empty-state">No hay insumos registrados con este filtro.</p>
        ) : (
          <div className="product-table-wrap">
            <table className="product-table">
              <thead>
                <tr>
                  <th>Insumo</th>
                  <th>Categoría</th>
                  <th>Stock</th>
                  <th>Mínimo</th>
                  <th>Proveedor</th>
                  <th>Acción</th>
                </tr>
              </thead>
              <tbody>
                {visible.map((item) => {
                  const low = Number(item.current_stock) <= Number(item.minimum_stock);
                  return (
                    <tr key={item.id}>
                      <td>
                        <strong>{item.name}</strong>
                        <small>{item.unit}</small>
                      </td>
                      <td>{item.inventory_categories?.name ?? "Sin categoría"}</td>
                      <td>
                        <span className={low ? "status-pill unavailable" : "status-pill available"}>
                          {Number(item.current_stock)} {item.unit}
                        </span>
                      </td>
                      <td>
                        {Number(item.minimum_stock)} {item.unit}
                      </td>
                      <td>{item.suppliers?.name ?? "Sin proveedor"}</td>
                      <td>
                        <button className="link-button" onClick={() => movement(item)}>
                          Movimiento
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </section>
      {movementItem && (
        <div className="modal-backdrop">
          <section className="product-modal">
            <div className="modal-heading">
              <div>
                <div className="eyebrow">Movimiento de stock</div>
                <h2>{movementItem.name}</h2>
              </div>
              <button className="modal-close" onClick={() => setMovementItem(null)}>
                ×
              </button>
            </div>
            <label>
              Tipo
              <select value={movementType} onChange={(event) => setMovementType(event.target.value)}>
                <option value="in">Entrada</option>
                <option value="out">Salida</option>
                <option value="adjustment">Ajuste</option>
              </select>
            </label>
            <label>
              Cantidad ({movementItem.unit})
              <input
                autoFocus
                type="number"
                min="0.01"
                step="0.01"
                value={movementQuantity}
                onChange={(event) => setMovementQuantity(event.target.value)}
              />
            </label>
            <div className="modal-actions">
              <button className="button button-secondary" onClick={() => setMovementItem(null)}>
                Cancelar
              </button>
              <button className="button button-primary" onClick={() => void submitMovement()}>
                Guardar movimiento
              </button>
            </div>
          </section>
        </div>
      )}
    </main>
  );
}
