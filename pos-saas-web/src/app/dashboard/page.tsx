"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { apiFetch } from "@/lib/api/client";
import { businessDate } from "@/lib/date/business-date";

type User = { email?: string; roles: string[] };
type SessionResponse = { data: { user: User } };
type ProductResponse = { data: { id: string }[]; meta?: { total?: number } };
type CategoryResponse = { data: { id: string }[] };
type Order = { status: string };
type KitchenOrder = { id: string };
type CashResponse = { data: { shift: { id: string } | null } };
type ReportResponse = { data: { sales: number; paidOrders: number } };
type InventoryResponse = { data: { current_stock: number; minimum_stock: number }[] };

type DashboardMetrics = {
  sales: number | null;
  activeOrders: number | null;
  kitchenOrders: number | null;
  cashOpen: boolean | null;
  lowStock: number | null;
  averageTicket: number | null;
  productCount: number | null;
  categoryCount: number | null;
};

const moduleRules = [
  { label: "Cocina", description: "Comandas y estados", href: "/dashboard/kitchen", roles: ["admin", "kitchen", "staff"], icon: "CO" },
  { label: "Productos", description: "Carta y disponibilidad", href: "/dashboard/products", roles: ["admin", "cashier", "staff"], icon: "PR" },
  { label: "Pedidos", description: "Mesas y pedidos", href: "/dashboard/orders", roles: ["admin", "cashier", "waiter"], icon: "PE" },
  { label: "Caja", description: "Cobros y turnos", href: "/dashboard/cash", roles: ["admin", "cashier"], icon: "CA" },
  { label: "Inventario", description: "Stock y movimientos", href: "/dashboard/inventory", roles: ["admin", "staff"], icon: "IN" },
  { label: "Reportes", description: "Ventas e indicadores", href: "/dashboard/reports", roles: ["admin", "cashier"], icon: "RE" },
  { label: "Configuración", description: "Usuarios y reglas", href: "/dashboard/settings", roles: ["admin"], icon: "CF" },
];

async function optionalFetch<T>(path: string) {
  try {
    return await apiFetch<T>(path);
  } catch {
    return null;
  }
}

export default function DashboardPage() {
  const router = useRouter();
  const [session, setSession] = useState<User | null>(null);
  const [metrics, setMetrics] = useState<DashboardMetrics>({
    sales: null,
    activeOrders: null,
    kitchenOrders: null,
    cashOpen: null,
    lowStock: null,
    averageTicket: null,
    productCount: null,
    categoryCount: null,
  });
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;

    async function loadDashboard() {
      try {
        const currentSession = await apiFetch<SessionResponse>("/api/v1/auth/me");
        if (!active) return;
        const user = currentSession.data.user;
        setSession(user);

        const roles = user.roles;
        const canCatalog = roles.some((role) => ["admin", "cashier", "staff"].includes(role));
        const canKitchen = roles.some((role) => ["admin", "kitchen", "staff"].includes(role));
        const canCash = roles.some((role) => ["admin", "cashier"].includes(role));
        const canOrders = roles.some((role) => ["admin", "cashier", "waiter", "kitchen", "staff"].includes(role));

        const [products, categories, orders, kitchenOrders, cash, report, inventory] = await Promise.all([
          canCatalog ? optionalFetch<ProductResponse>("/api/v1/products?limit=1") : Promise.resolve(null),
          canCatalog ? optionalFetch<CategoryResponse>("/api/v1/categories") : Promise.resolve(null),
          canOrders ? optionalFetch<{ data: Order[] }>("/api/v1/orders") : Promise.resolve(null),
          canKitchen ? optionalFetch<{ data: KitchenOrder[] }>("/api/v1/kitchen/orders") : Promise.resolve(null),
          canCash ? optionalFetch<CashResponse>("/api/v1/cash/summary") : Promise.resolve(null),
          canCash ? optionalFetch<ReportResponse>(`/api/v1/reports/summary?date=${businessDate()}`) : Promise.resolve(null),
          canKitchen ? optionalFetch<InventoryResponse>("/api/v1/inventory") : Promise.resolve(null),
        ]);

        if (!active) return;
        const activeStatuses = new Set(["pending", "confirmed", "preparing", "ready"]);
        const activeOrders = orders?.data.filter((order) => activeStatuses.has(order.status)).length ?? null;
        const paidOrders = report?.data.paidOrders ?? 0;
        setMetrics({
          sales: report?.data.sales ?? null,
          activeOrders,
          kitchenOrders: kitchenOrders?.data.length ?? null,
          cashOpen: cash ? Boolean(cash.data.shift) : null,
          lowStock: inventory?.data.filter((item) => Number(item.current_stock) <= Number(item.minimum_stock)).length ?? null,
          averageTicket: report && paidOrders > 0 ? report.data.sales / paidOrders : report ? 0 : null,
          productCount: products?.meta?.total ?? products?.data.length ?? null,
          categoryCount: categories?.data.length ?? null,
        });
      } catch (cause) {
        if (!active) return;
        const message = cause instanceof Error ? cause.message : "No se pudo cargar el panel";
        if (message === "No autenticado") router.replace("/login");
        else setError(message);
      }
    }

    void loadDashboard();
    return () => { active = false; };
  }, [router]);

  async function logout() {
    await apiFetch("/api/v1/auth/logout", { method: "POST" });
    router.replace("/login");
    router.refresh();
  }

  if (error) return <main className="shell"><p className="form-error">{error}</p></main>;

  const visibleModules = moduleRules.filter((module) => session?.roles.some((role) => module.roles.includes(role)));
  const isKitchenUser = session?.roles.includes("kitchen") ?? false;
  const canCreateOrder = session?.roles.some((role) => ["admin", "cashier", "waiter"].includes(role)) ?? false;
  const canOpenCash = session?.roles.some((role) => ["admin", "cashier"].includes(role)) ?? false;
  const emailName = session?.email?.split("@")[0] ?? "usuario";

  const cards = [
    { label: "Ventas de hoy", value: metrics.sales === null ? "—" : `S/ ${metrics.sales.toFixed(2)}`, detail: "Pedidos pagados" },
    { label: "Pedidos activos", value: metrics.activeOrders ?? "—", detail: "En operación" },
    { label: "En cocina", value: metrics.kitchenOrders ?? "—", detail: "Comandas activas" },
    { label: "Caja", value: metrics.cashOpen === null ? "—" : metrics.cashOpen ? "Abierta" : "Cerrada", detail: "Estado del turno" },
    { label: "Bajo stock", value: metrics.lowStock ?? "—", detail: "Insumos por revisar" },
    { label: "Ticket promedio", value: metrics.averageTicket === null ? "—" : `S/ ${metrics.averageTicket.toFixed(2)}`, detail: "Pedidos pagados" },
  ];

  return (
    <main className="shell dashboard-shell">
      <nav className="dashboard-topbar">
        <Link className="brand" href="/">POS SaaS</Link>
        <div className="dashboard-account"><span>{session?.email ?? "Cargando..."}</span><button className="button button-small" onClick={logout} type="button">Salir</button></div>
      </nav>

      <section className="dashboard-welcome">
        <div><div className="eyebrow">Panel operativo</div><h1>Hola, {emailName}</h1><p>{isKitchenUser ? "Entra a tu pantalla de trabajo." : "Este es el pulso de tu negocio hoy."}</p></div>
        <span className="dashboard-role">{session?.roles.join(" · ") ?? ""}</span>
      </section>

      <section className="dashboard-actions" aria-label="Acciones principales">
        {canCreateOrder && <Link className="button button-primary" href="/dashboard/orders">+ Nuevo pedido</Link>}
        {canOpenCash && <Link className="button button-secondary" href="/dashboard/cash">Abrir caja</Link>}
      </section>

      <section className="dashboard-metrics" aria-label="Resumen operativo">
        {cards.map((card) => <article className="dashboard-metric" key={card.label}><span>{card.label}</span><strong>{card.value}</strong><small>{card.detail}</small></article>)}
      </section>

      <section className="dashboard-modules" aria-label="Módulos disponibles">
        {visibleModules.map((module) => <Link className="dashboard-module active" href={module.href} key={module.label}><span className="module-icon">{module.icon}</span><span><strong>{module.label}</strong><small>{module.description}</small></span><b>›</b></Link>)}
      </section>

      <section className="dashboard-summary" aria-label="Recursos del sistema">
        <div><span>Productos</span><strong>{metrics.productCount ?? "—"}</strong></div>
        <div><span>Categorías</span><strong>{metrics.categoryCount ?? "—"}</strong></div>
        <div><span>Roles activos</span><strong>{session?.roles.length ?? "—"}</strong></div>
      </section>
    </main>
  );
}
