"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { apiFetch } from "@/lib/api/client";

type Product = { id: string; name: string; price: number; is_available: boolean; categories?: { name: string } | null };
type Table = { id: string; name: string; capacity: number; status: string };
type Order = { id: string; status: string; total_amount: number; guests: number; created_at: string; table: { name: string } | null; order_items: { id: string; quantity: number; product: { name: string } | null }[] };
type CartItem = { productId: string; name: string; price: number; quantity: number };

const statusLabels: Record<string, string> = { pending: "Pendiente", confirmed: "Confirmado", preparing: "En cocina", ready: "Listo", served: "Servido", paid: "Pagado", cancelled: "Cancelado" };

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

  async function loadData() {
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
  }

  useEffect(() => { void loadData(); }, []);

  const filteredProducts = useMemo(() => products.filter((product) => product.name.toLowerCase().includes(search.toLowerCase())), [products, search]);
  const total = cart.reduce((sum, item) => sum + item.price * item.quantity, 0);

  function addProduct(product: Product) {
    setCart((current) => {
      const existing = current.find((item) => item.productId === product.id);
      if (existing) return current.map((item) => item.productId === product.id ? { ...item, quantity: item.quantity + 1 } : item);
      return [...current, { productId: product.id, name: product.name, price: Number(product.price), quantity: 1 }];
    });
  }

  function changeQuantity(productId: string, amount: number) {
    setCart((current) => current.map((item) => item.productId === productId ? { ...item, quantity: item.quantity + amount } : item).filter((item) => item.quantity > 0));
  }

  async function createOrder() {
    if (cart.length === 0) return;
    setSaving(true);
    try {
      await apiFetch("/api/v1/orders", { method: "POST", body: JSON.stringify({ tableId: tableId || null, guests: Number(guests), items: cart.map((item) => ({ productId: item.productId, quantity: item.quantity })) }) });
      setCart([]);
      setTableId("");
      await loadData();
    } catch (cause) {
      window.alert(cause instanceof Error ? cause.message : "No se pudo crear el pedido");
    } finally {
      setSaving(false);
    }
  }

  async function cancelOrder(order: Order) {
    if (!window.confirm("¿Cancelar este pedido?")) return;
    try {
      await apiFetch(`/api/v1/orders/${order.id}/status`, { method: "PATCH", body: JSON.stringify({ status: "cancelled" }) });
      await loadData();
    } catch (cause) {
      window.alert(cause instanceof Error ? cause.message : "No se pudo cancelar");
    }
  }

  return (
    <main className="shell orders-shell">
      <nav className="nav compact-nav"><Link className="brand" href="/dashboard">← Panel</Link><div className="nav-actions"><strong>Pedidos</strong><Link className="button button-small" href="/dashboard">Volver</Link></div></nav>
      <div className="module-page-heading"><div><div className="eyebrow">Mesas y atención</div><h1>Pedidos</h1></div><button className="button button-small" onClick={() => void loadData()}>Actualizar</button></div>
      {error && <p className="form-error">{error}</p>}
      <div className="orders-layout">
        <section className="order-builder panel-section"><div className="section-heading"><div><div className="eyebrow">Nuevo pedido</div><h2>Agregar productos</h2></div></div><div className="order-context"><select value={tableId} onChange={(event) => setTableId(event.target.value)}><option value="">Para llevar / sin mesa</option>{tables.map((table) => <option value={table.id} key={table.id}>{table.name} · {table.status === "occupied" ? "Ocupada" : "Disponible"}</option>)}</select><input min="1" type="number" value={guests} onChange={(event) => setGuests(event.target.value)} aria-label="Comensales" /></div><input className="order-search" placeholder="Buscar producto..." value={search} onChange={(event) => setSearch(event.target.value)} />{loading ? <p className="empty-state">Cargando productos...</p> : <div className="order-product-grid">{filteredProducts.map((product) => <button className="order-product" key={product.id} onClick={() => addProduct(product)}><strong>{product.name}</strong><small>{product.categories?.name ?? "Sin categoría"}</small><b>S/ {Number(product.price).toFixed(2)}</b></button>)}</div>}</section>
        <section className="order-cart panel-section"><div className="section-heading"><div><div className="eyebrow">Comanda</div><h2>Pedido actual</h2></div><span>{cart.length} productos</span></div>{cart.length === 0 ? <p className="empty-state">Selecciona productos para comenzar.</p> : <div className="cart-list">{cart.map((item) => <div className="cart-row" key={item.productId}><div><strong>{item.name}</strong><small>S/ {item.price.toFixed(2)}</small></div><div className="quantity-controls"><button onClick={() => changeQuantity(item.productId, -1)}>−</button><b>{item.quantity}</b><button onClick={() => changeQuantity(item.productId, 1)}>+</button></div></div>)}</div>}<div className="cart-total"><span>Total</span><strong>S/ {total.toFixed(2)}</strong></div><button className="button button-primary full-button" disabled={saving || cart.length === 0} onClick={() => void createOrder()}>{saving ? "Enviando..." : "Enviar a cocina"}</button></section>
      </div>
      <section className="orders-list-section panel-section"><div className="section-heading"><div><div className="eyebrow">Operación</div><h2>Pedidos recientes</h2></div><span>{orders.length}</span></div>{orders.length === 0 ? <p className="empty-state">Todavía no hay pedidos registrados.</p> : <div className="orders-list">{orders.map((order) => <article className="order-row" key={order.id}><div><strong>{order.table?.name ?? "Para llevar"}</strong><small>#{order.id.slice(-6).toUpperCase()} · {order.order_items?.length ?? 0} líneas</small></div><span className={`order-status status-${order.status}`}>{statusLabels[order.status] ?? order.status}</span><b>S/ {Number(order.total_amount).toFixed(2)}</b>{["pending", "confirmed"].includes(order.status) && <button className="link-button danger" onClick={() => void cancelOrder(order)}>Cancelar</button>}</article>)}</div>}</section>
    </main>
  );
}
