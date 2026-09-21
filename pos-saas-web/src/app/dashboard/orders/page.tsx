"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { Toast } from "@/components/ui/Toast";
import { apiFetch, createIdempotencyKey } from "@/lib/api/client";

type Product = { id: string; name: string; price: number; is_available: boolean; categories?: { name: string } | null };
type Table = { id: string; name: string; capacity: number; status: string };
type Order = {
  id: string;
  status: string;
  total_amount: number;
  guests: number;
  created_at: string;
  table: { name: string } | null;
  order_items: { id: string; quantity: number; product: { name: string } | null }[];
};
type CartItem = { productId: string; name: string; price: number; quantity: number };

const statusLabels: Record<string, string> = {
  pending: "Pendiente",
  confirmed: "Confirmado",
  preparing: "En cocina",
  ready: "Listo",
  served: "Servido",
  paid: "Pagado",
  cancelled: "Cancelado",
};

export default function OrdersPage() {
  const router = useRouter();
  const [products, setProducts] = useState<Product[]>([]);
  const [tables, setTables] = useState<Table[]>([]);
  const [orders, setOrders] = useState<Order[]>([]);
  const [cart, setCart] = useState<CartItem[]>([]);
  const [tableId, setTableId] = useState("");
  const [guests, setGuests] = useState("1");
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [toast, setToast] = useState<{ message: string; tone: "error" | "success" } | null>(null);
  const [cancelTarget, setCancelTarget] = useState<Order | null>(null);
  const [cancelBusy, setCancelBusy] = useState(false);

  const loadData = useCallback(async () => {
    try {
      const [productResponse, tableResponse, orderResponse] = await Promise.all([
        apiFetch<{ data: Product[] }>("/api/v1/products?available=true&limit=100"),
        apiFetch<{ data: Table[] }>("/api/v1/tables"),
        apiFetch<{ data: Order[] }>("/api/v1/orders"),
      ]);
      setProducts(productResponse.data);
      setTables(tableResponse.data);
      setOrders(orderResponse.data);
      setError(null);
    } catch (cause) {
      const message = cause instanceof Error ? cause.message : "No se pudo cargar pedidos";
      if (message === "No autenticado") router.replace("/login");
      else setError(message);
    } finally {
      setLoading(false);
    }
  }, [router]);

  useEffect(() => {
    void loadData();
  }, [loadData]);

  const filteredProducts = useMemo(
    () => products.filter((product) => product.name.toLowerCase().includes(search.toLowerCase())),
    [products, search],
  );
  const total = cart.reduce((sum, item) => sum + item.price * item.quantity, 0);

  function addProduct(product: Product) {
    setCart((current) => {
      const existing = current.find((item) => item.productId === product.id);
      if (existing)
        return current.map((item) => (item.productId === product.id ? { ...item, quantity: item.quantity + 1 } : item));
      return [...current, { productId: product.id, name: product.name, price: Number(product.price), quantity: 1 }];
    });
  }

  function changeQuantity(productId: string, amount: number) {
    setCart((current) =>
      current
        .map((item) => (item.productId === productId ? { ...item, quantity: item.quantity + amount } : item))
        .filter((item) => item.quantity > 0),
    );
  }

  async function createOrder() {
    if (cart.length === 0) return;
    setSaving(true);
    try {
      await apiFetch("/api/v1/orders", {
        method: "POST",
        headers: { "Idempotency-Key": createIdempotencyKey() },
        body: JSON.stringify({
          tableId: tableId || null,
          guests: Number(guests),
          items: cart.map((item) => ({ productId: item.productId, quantity: item.quantity })),
        }),
      });
      setCart([]);
      setTableId("");
      await loadData();
      setToast({ message: "Pedido enviado a cocina", tone: "success" });
    } catch (cause) {
      setToast({ message: cause instanceof Error ? cause.message : "No se pudo crear el pedido", tone: "error" });
    } finally {
      setSaving(false);
    }
  }

  async function confirmCancelOrder() {
    if (!cancelTarget) return;
    setCancelBusy(true);
    try {
      await apiFetch(`/api/v1/orders/${cancelTarget.id}/status`, {
        method: "PATCH",
        body: JSON.stringify({ status: "cancelled" }),
      });
      setCancelTarget(null);
      await loadData();
      setToast({ message: "Pedido cancelado", tone: "success" });
    } catch (cause) {
      setToast({ message: cause instanceof Error ? cause.message : "No se pudo cancelar", tone: "error" });
    } finally {
      setCancelBusy(false);
    }
  }

  return (
    <main className="shell orders-shell">
      <nav className="nav compact-nav">
        <Link className="brand" href="/dashboard">
          ← Panel
        </Link>
        <div className="nav-actions">
          <strong>Pedidos</strong>
          <Link className="button button-small" href="/dashboard">
            Volver
          </Link>
        </div>
      </nav>
      <div className="module-page-heading">
        <div>
          <div className="eyebrow">Mesas y atención</div>
          <h1>Pedidos</h1>
        </div>
        <button className="button button-small" onClick={() => void loadData()} type="button">
          Actualizar
        </button>
      </div>
      {toast && <Toast message={toast.message} tone={toast.tone} onClose={() => setToast(null)} />}
      {error && (
        <p className="form-error" role="alert">
          {error}
        </p>
      )}
      <div className="orders-layout">
        <section className="order-builder panel-section">
          <div className="section-heading">
            <div>
              <div className="eyebrow">Nuevo pedido</div>
              <h2>Agregar productos</h2>
            </div>
          </div>
          <div className="order-context">
            <label className="sr-only" htmlFor="order-table">
              Mesa
            </label>
            <select id="order-table" value={tableId} onChange={(event) => setTableId(event.target.value)}>
              <option value="">Para llevar / sin mesa</option>
              {tables.map((table) => (
                <option value={table.id} key={table.id}>
                  {table.name} · {table.status === "occupied" ? "Ocupada" : "Disponible"}
                </option>
              ))}
            </select>
            <label className="sr-only" htmlFor="order-guests">
              Comensales
            </label>
            <input
              id="order-guests"
              min="1"
              type="number"
              value={guests}
              onChange={(event) => setGuests(event.target.value)}
            />
          </div>
          <label className="sr-only" htmlFor="order-search">
            Buscar producto
          </label>
          <input
            id="order-search"
            className="order-search"
            placeholder="Buscar producto..."
            value={search}
            onChange={(event) => setSearch(event.target.value)}
          />
          {loading ? (
            <p className="empty-state">Cargando productos...</p>
          ) : (
            <div className="order-product-grid">
              {filteredProducts.map((product) => (
                <button className="order-product" key={product.id} onClick={() => addProduct(product)} type="button">
                  <strong>{product.name}</strong>
                  <small>{product.categories?.name ?? "Sin categoría"}</small>
                  <b>S/ {Number(product.price).toFixed(2)}</b>
                </button>
              ))}
            </div>
          )}
        </section>
        <section className="order-cart panel-section">
          <div className="section-heading">
            <div>
              <div className="eyebrow">Comanda</div>
              <h2>Pedido actual</h2>
            </div>
            <span>{cart.length} productos</span>
          </div>
          {cart.length === 0 ? (
            <p className="empty-state">Selecciona productos para comenzar.</p>
          ) : (
            <div className="cart-list">
              {cart.map((item) => (
                <div className="cart-row" key={item.productId}>
                  <div>
                    <strong>{item.name}</strong>
                    <small>S/ {item.price.toFixed(2)}</small>
                  </div>
                  <div className="quantity-controls">
                    <button
                      aria-label={`Quitar una unidad de ${item.name}`}
                      onClick={() => changeQuantity(item.productId, -1)}
                      type="button"
                    >
                      −
                    </button>
                    <b>{item.quantity}</b>
                    <button
                      aria-label={`Agregar una unidad de ${item.name}`}
                      onClick={() => changeQuantity(item.productId, 1)}
                      type="button"
                    >
                      +
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
          <div className="cart-total">
            <span>Total</span>
            <strong>S/ {total.toFixed(2)}</strong>
          </div>
          <button
            className="button button-primary full-button"
            disabled={saving || cart.length === 0}
            onClick={() => void createOrder()}
            type="button"
          >
            {saving ? "Enviando..." : "Enviar a cocina"}
          </button>
        </section>
      </div>
      <section className="orders-list-section panel-section">
        <div className="section-heading">
          <div>
            <div className="eyebrow">Operación</div>
            <h2>Pedidos recientes</h2>
          </div>
          <span>{orders.length}</span>
        </div>
        {orders.length === 0 ? (
          <p className="empty-state">Todavía no hay pedidos registrados.</p>
        ) : (
          <div className="orders-list">
            {orders.map((order) => (
              <article className="order-row" key={order.id}>
                <div>
                  <strong>{order.table?.name ?? "Para llevar"}</strong>
                  <small>
                    #{order.id.slice(-6).toUpperCase()} · {order.order_items?.length ?? 0} líneas
                  </small>
                </div>
                <span className={`order-status status-${order.status}`}>
                  {statusLabels[order.status] ?? order.status}
                </span>
                <b>S/ {Number(order.total_amount).toFixed(2)}</b>
                {["pending", "confirmed"].includes(order.status) && (
                  <button className="link-button danger" onClick={() => setCancelTarget(order)} type="button">
                    Cancelar
                  </button>
                )}
              </article>
            ))}
          </div>
        )}
      </section>
      <ConfirmDialog
        description={
          cancelTarget ? `El pedido de ${cancelTarget.table?.name ?? "esta venta"} pasará a estado cancelado.` : ""
        }
        busy={cancelBusy}
        confirmLabel="Cancelar pedido"
        danger
        onCancel={() => {
          if (!cancelBusy) setCancelTarget(null);
        }}
        onConfirm={() => void confirmCancelOrder()}
        open={Boolean(cancelTarget)}
        title="¿Cancelar este pedido?"
      />
    </main>
  );
}
