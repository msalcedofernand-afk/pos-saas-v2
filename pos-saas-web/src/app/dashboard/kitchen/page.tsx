"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { apiFetch } from "@/lib/api/client";

type KitchenItem = {
  id: string;
  quantity: number;
  notes: string | null;
  product: { id: string; name: string; categories: { id: string; name: string } | null } | null;
};

type KitchenOrder = {
  id: string;
  status: "pending" | "confirmed" | "preparing" | "ready";
  notes: string | null;
  created_at: string;
  updated_at: string;
  table: { id: string; name: string } | null;
  order_items: KitchenItem[];
};

type Summary = { date: string; orders: number; served: number; cancelled: number; sales: number };
type OrdersResponse = { data: KitchenOrder[] };
type SummaryResponse = { data: Summary };

const columns: { key: string; label: string; statuses: KitchenOrder["status"][] }[] = [
  { key: "new", label: "Nuevos", statuses: ["pending", "confirmed"] },
  { key: "preparing", label: "Preparando", statuses: ["preparing"] },
  { key: "ready", label: "Listos", statuses: ["ready"] },
];

function localDate(offsetDays = 0) {
  const date = new Date();
  date.setDate(date.getDate() + offsetDays);
  return date.toISOString().slice(0, 10);
}

function elapsedSince(order: KitchenOrder, now: number) {
  const start = order.status === "preparing" ? order.updated_at : order.created_at;
  const seconds = Math.max(0, Math.floor((now - new Date(start).getTime()) / 1000));
  return `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, "0")}`;
}

function isWarning(order: KitchenOrder, now: number) {
  const start = order.status === "preparing" ? order.updated_at : order.created_at;
  return (now - new Date(start).getTime()) / 60000 >= 12;
}

export default function KitchenPage() {
  const router = useRouter();
  const today = localDate();
  const yesterday = localDate(-1);
  const [isOpen, setIsOpen] = useState(false);
  const [orders, setOrders] = useState<KitchenOrder[]>([]);
  const [summary, setSummary] = useState<Summary | null>(null);
  const [station, setStation] = useState("all");
  const [loading, setLoading] = useState(true);
  const [updatingId, setUpdatingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [now, setNow] = useState(() => Date.now());
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [cancelOrder, setCancelOrder] = useState<KitchenOrder | null>(null);
  const [cancelReason, setCancelReason] = useState("");

  const loadSummary = useCallback(async () => {
    try {
      const response = await apiFetch<SummaryResponse>(`/api/v1/kitchen/summary?date=${yesterday}`);
      setSummary(response.data);
    } catch (cause) {
      const message = cause instanceof Error ? cause.message : "No se pudo cargar el resumen";
      if (message === "No autenticado") router.replace("/login");
      else setError(message);
    }
  }, [router, yesterday]);

  const loadOrders = useCallback(async () => {
    try {
      const response = await apiFetch<OrdersResponse>("/api/v1/kitchen/orders");
      setOrders(response.data);
      setError(null);
    } catch (cause) {
      const message = cause instanceof Error ? cause.message : "No se pudieron cargar las comandas";
      if (message === "No autenticado") router.replace("/login");
      else setError(message);
    } finally {
      setLoading(false);
    }
  }, [router]);

  useEffect(() => {
    const stored = window.localStorage.getItem(`pos-kitchen-open-${today}`);
    setIsOpen(stored === "true");
    void loadSummary();
    const clock = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(clock);
  }, [loadSummary, today]);

  useEffect(() => {
    if (!isOpen) {
      setLoading(false);
      return;
    }
    void loadOrders();
    const refresh = window.setInterval(() => void loadOrders(), 15000);
    return () => window.clearInterval(refresh);
  }, [isOpen, loadOrders]);

  useEffect(() => {
    const onFullscreenChange = () => setIsFullscreen(Boolean(document.fullscreenElement));
    document.addEventListener("fullscreenchange", onFullscreenChange);
    return () => document.removeEventListener("fullscreenchange", onFullscreenChange);
  }, []);

  useEffect(() => {
    function handleFullscreenShortcut(event: KeyboardEvent) {
      if (document.fullscreenElement && event.ctrlKey && event.shiftKey && event.key.toLowerCase() === "f") {
        event.preventDefault();
        void document.exitFullscreen();
      }
    }

    document.addEventListener("keydown", handleFullscreenShortcut);
    return () => document.removeEventListener("keydown", handleFullscreenShortcut);
  }, []);

  const stations = useMemo(() => {
    const names = new Set<string>();
    orders.forEach((order) => order.order_items.forEach((item) => {
      if (item.product?.categories?.name) names.add(item.product.categories.name);
    }));
    return [...names].sort();
  }, [orders]);

  function openKitchen() {
    window.localStorage.setItem(`pos-kitchen-open-${today}`, "true");
    setIsOpen(true);
  }

  function closeKitchen() {
    window.localStorage.removeItem(`pos-kitchen-open-${today}`);
    setIsOpen(false);
    setOrders([]);
    void loadSummary();
  }

  async function toggleFullscreen() {
    if (document.fullscreenElement) {
      await document.exitFullscreen();
      return;
    }
    await document.documentElement.requestFullscreen();
  }

  async function updateStatus(order: KitchenOrder, status: "preparing" | "ready" | "served" | "cancelled", reason?: string) {
    if (status === "cancelled" && !reason?.trim()) return;
    setUpdatingId(order.id);
    try {
      await apiFetch(`/api/v1/kitchen/orders/${order.id}/status`, {
        method: "PATCH",
        body: JSON.stringify({ status, reason }),
      });
      await loadOrders();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "No se pudo cambiar el estado");
    } finally {
      setUpdatingId(null);
    }
  }

  function visibleItems(order: KitchenOrder) {
    if (station === "all") return order.order_items;
    return order.order_items.filter((item) => item.product?.categories?.name === station);
  }

  return (
    <main className={`shell kitchen-shell ${isFullscreen ? "kitchen-fullscreen" : ""}`}>
      {!isFullscreen && <nav className="kitchen-topbar">
        <Link className="kitchen-back" href="/dashboard">← Panel</Link>
        <strong>Cocina</strong>
        <span className={isOpen ? "kitchen-status open" : "kitchen-status"}>{isOpen ? "Abierta" : "Cerrada"}</span>
      </nav>}

      {!isOpen ? (
        <section className="kitchen-opening">
          <div className="eyebrow">Inicio de jornada · {today}</div>
          <h1>Resumen anterior</h1>
          <p>Revisa el turno anterior y abre la cocina cuando estés listo para recibir comandas.</p>
          <div className="kitchen-summary-grid">
            <div><strong>{summary?.orders ?? 0}</strong><span>Pedidos</span></div>
            <div><strong>{summary?.served ?? 0}</strong><span>Atendidos</span></div>
            <div><strong>{summary?.cancelled ?? 0}</strong><span>Cancelados</span></div>
          </div>
          <small className="kitchen-summary-date">Resumen del {summary?.date ?? yesterday}</small>
          <button className="button button-primary kitchen-open-button" onClick={openKitchen}>Abrir cocina</button>
        </section>
      ) : (
        <>
          {!isFullscreen && <div className="kitchen-live-heading">
            <div><div className="eyebrow">Jornada actual · {today}</div><h1>Comandas</h1></div>
            <div className="kitchen-live-actions"><span>Actualización cada 15 s</span><button className="button button-small" onClick={() => void loadOrders()}>Actualizar</button><button className="button button-small" onClick={() => void toggleFullscreen()}>{isFullscreen ? "Salir" : "Pantalla completa"}</button><button className="button button-small" onClick={closeKitchen}>Cerrar</button></div>
          </div>}
          {!isFullscreen && <div className="kitchen-filters">
            <button className={station === "all" ? "kitchen-filter active" : "kitchen-filter"} onClick={() => setStation("all")}>Todas</button>
            {stations.map((name) => <button className={station === name ? "kitchen-filter active" : "kitchen-filter"} key={name} onClick={() => setStation(name)}>{name}</button>)}
          </div>}
          {error && <p className="form-error">{error}</p>}
          {loading ? <p className="empty-state">Cargando comandas...</p> : (
            <div className="kitchen-board">
              {columns.map((column) => {
                const columnOrders = orders.filter((order) => column.statuses.includes(order.status) && visibleItems(order).length > 0);
                return <section className="kitchen-column" key={column.key}><div className="kitchen-column-heading"><h2>{column.label}</h2><span>{columnOrders.length}</span></div><div className="kitchen-column-body">
                  {columnOrders.length === 0 ? <div className="kitchen-empty">No hay pedidos</div> : columnOrders.map((order) => {
                    const busy = updatingId === order.id;
                    return <article className={isWarning(order, now) ? "kitchen-card warning" : "kitchen-card"} key={order.id}>
                      <header className="kitchen-card-header"><div><strong>{order.table?.name ?? "Para llevar"}</strong><small>#{order.id.slice(-6).toUpperCase()}</small></div><span className="kitchen-timer">{elapsedSince(order, now)}</span></header>
                      {order.notes && <p className="kitchen-note">{order.notes}</p>}
                      <ul className="kitchen-items">{visibleItems(order).map((item) => <li key={item.id}><div><strong>{item.product?.name ?? "Producto"}</strong>{item.notes && <small>{item.notes}</small>}</div><b>x{item.quantity}</b></li>)}</ul>
                      <div className="kitchen-actions">{column.key === "new" && <><button className="button button-primary" disabled={busy} onClick={() => void updateStatus(order, "preparing")}>Empezar</button><button className="button button-danger" disabled={busy} onClick={() => { setCancelOrder(order); setCancelReason(""); }}>Rechazar</button></>}{column.key === "preparing" && <button className="button button-primary" disabled={busy} onClick={() => void updateStatus(order, "ready")}>{busy ? "Guardando..." : "Marcar listo"}</button>}{column.key === "ready" && <button className="button button-success" disabled={busy} onClick={() => void updateStatus(order, "served")}>{busy ? "Guardando..." : "Entregar"}</button>}</div>
                    </article>;
                  })}
                </div></section>;
              })}
            </div>
          )}
          {cancelOrder && <div className="modal-backdrop"><section className="product-modal"><div className="modal-heading"><div><div className="eyebrow">Incidencia</div><h2>Rechazar pedido</h2></div><button className="modal-close" onClick={() => setCancelOrder(null)}>×</button></div><p className="empty-state">Indica por qué no se puede preparar el pedido.</p><label>Motivo<textarea autoFocus rows={3} value={cancelReason} onChange={(event) => setCancelReason(event.target.value)} /></label><div className="modal-actions"><button className="button button-secondary" onClick={() => setCancelOrder(null)}>Cancelar</button><button className="button button-danger" disabled={!cancelReason.trim() || updatingId === cancelOrder.id} onClick={() => { void updateStatus(cancelOrder, "cancelled", cancelReason.trim()); setCancelOrder(null); }}>Rechazar pedido</button></div></section></div>}
        </>
      )}
    </main>
  );
}
