"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { apiFetch } from "@/lib/api/client";
import { brand } from "@/config/brand";
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
type MetricState = "loading" | "ok" | "forbidden" | "error";

type MetricResult<T> = { data: T | null; state: MetricState };
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
type DashboardMetricKey = keyof DashboardMetrics;

const moduleRules = [
  {
    label: "Cocina",
    description: "Comandas y estados",
    href: "/dashboard/kitchen",
    roles: ["admin", "kitchen", "staff"],
    icon: "CO",
  },
  {
    label: "Productos",
    description: "Carta y disponibilidad",
    href: "/dashboard/products",
    roles: ["admin", "cashier", "staff"],
    icon: "PR",
  },
  {
    label: "Pedidos",
    description: "Mesas y pedidos",
    href: "/dashboard/orders",
    roles: ["admin", "cashier", "waiter"],
    icon: "PE",
  },
  { label: "Caja", description: "Cobros y turnos", href: "/dashboard/cash", roles: ["admin", "cashier"], icon: "CA" },
  {
    label: "Inventario",
    description: "Stock y movimientos",
    href: "/dashboard/inventory",
    roles: ["admin", "staff"],
    icon: "IN",
  },
  {
    label: "Reportes",
    description: "Ventas e indicadores",
    href: "/dashboard/reports",
    roles: ["admin", "cashier"],
    icon: "RE",
  },
  {
    label: "Configuración",
    description: "Usuarios y reglas",
    href: "/dashboard/settings",
    roles: ["admin"],
    icon: "CF",
  },
];

async function fetchMetric<T>(path: string): Promise<MetricResult<T>> {
  try {
    return { data: await apiFetch<T>(path), state: "ok" };
  } catch (cause) {
    const status = (cause as Error & { status?: number }).status;
    return { data: null, state: status === 403 ? "forbidden" : "error" };
  }
}

function forbiddenMetric<T>(): MetricResult<T> {
  return { data: null, state: "forbidden" };
}

function displayMetric<T>(value: T | null, state: MetricState, format: (value: T) => string = String) {
  if (state === "loading") return "Cargando…";
  if (state === "forbidden") return "Sin permisos";
  if (state === "error") return "No disponible";
  if (value === null) return "Sin datos";
  return format(value);
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
  const [metricStates, setMetricStates] = useState<Record<DashboardMetricKey, MetricState>>({
    sales: "loading",
    activeOrders: "loading",
    kitchenOrders: "loading",
    cashOpen: "loading",
    lowStock: "loading",
    averageTicket: "loading",
    productCount: "loading",
    categoryCount: "loading",
  });
  const [metricsWarning, setMetricsWarning] = useState(false);
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
          canCatalog
            ? fetchMetric<ProductResponse>("/api/v1/products?limit=1")
            : Promise.resolve(forbiddenMetric<ProductResponse>()),
          canCatalog
            ? fetchMetric<CategoryResponse>("/api/v1/categories")
            : Promise.resolve(forbiddenMetric<CategoryResponse>()),
          canOrders
            ? fetchMetric<{ data: Order[] }>("/api/v1/orders")
            : Promise.resolve(forbiddenMetric<{ data: Order[] }>()),
          canKitchen
            ? fetchMetric<{ data: KitchenOrder[] }>("/api/v1/kitchen/orders")
            : Promise.resolve(forbiddenMetric<{ data: KitchenOrder[] }>()),
          canCash
            ? fetchMetric<CashResponse>("/api/v1/cash/summary")
            : Promise.resolve(forbiddenMetric<CashResponse>()),
          canCash
            ? fetchMetric<ReportResponse>(`/api/v1/reports/summary?date=${businessDate()}`)
            : Promise.resolve(forbiddenMetric<ReportResponse>()),
          canKitchen
            ? fetchMetric<InventoryResponse>("/api/v1/inventory")
            : Promise.resolve(forbiddenMetric<InventoryResponse>()),
        ]);

        if (!active) return;
        const activeStatuses = new Set(["pending", "confirmed", "preparing", "ready"]);
        const activeOrders = orders.data?.data.filter((order) => activeStatuses.has(order.status)).length ?? null;
        const paidOrders = report.data?.data.paidOrders ?? 0;
        const states: Record<DashboardMetricKey, MetricState> = {
          sales: report.state,
          activeOrders: orders.state,
          kitchenOrders: kitchenOrders.state,
          cashOpen: cash.state,
          lowStock: inventory.state,
          averageTicket: report.state,
          productCount: products.state,
          categoryCount: categories.state,
        };
        setMetricStates(states);
        setMetricsWarning(Object.values(states).some((state) => state === "error"));
        setMetrics({
          sales: report.data?.data.sales ?? null,
          activeOrders,
          kitchenOrders: kitchenOrders.data?.data.length ?? null,
          cashOpen: cash.data ? Boolean(cash.data.data.shift) : null,
          lowStock:
            inventory.data?.data.filter((item) => Number(item.current_stock) <= Number(item.minimum_stock)).length ??
            null,
          averageTicket: report.data && paidOrders > 0 ? report.data.data.sales / paidOrders : report.data ? 0 : null,
          productCount: products.data?.meta?.total ?? products.data?.data.length ?? null,
          categoryCount: categories.data?.data.length ?? null,
        });
      } catch (cause) {
        if (!active) return;
        const message = cause instanceof Error ? cause.message : "No se pudo cargar el panel";
        if (message === "No autenticado") router.replace("/login");
        else setError(message);
      }
    }

    void loadDashboard();
    return () => {
      active = false;
    };
  }, [router]);

  async function logout() {
    await apiFetch("/api/v1/auth/logout", { method: "POST" });
    router.replace("/login");
    router.refresh();
  }

  if (error)
    return (
      <main className="shell">
        <p className="form-error">{error}</p>
      </main>
    );

  const visibleModules = moduleRules.filter((module) => session?.roles.some((role) => module.roles.includes(role)));
  const isKitchenUser = session?.roles.includes("kitchen") ?? false;
  const canCreateOrder = session?.roles.some((role) => ["admin", "cashier", "waiter"].includes(role)) ?? false;
  const canOpenCash = session?.roles.some((role) => ["admin", "cashier"].includes(role)) ?? false;
  const emailName = session?.email?.split("@")[0] ?? "usuario";
  const cards = [
    {
      label: "Ventas de hoy",
      value: displayMetric(metrics.sales, metricStates.sales, (value) => `S/ ${value.toFixed(2)}`),
      detail: "Pedidos pagados",
    },
    {
      label: "Pedidos activos",
      value: displayMetric(metrics.activeOrders, metricStates.activeOrders),
      detail: "En operación",
    },
    {
      label: "En cocina",
      value: displayMetric(metrics.kitchenOrders, metricStates.kitchenOrders),
      detail: "Comandas activas",
    },
    {
      label: "Caja",
      value: displayMetric(metrics.cashOpen, metricStates.cashOpen, (value) => (value ? "Abierta" : "Cerrada")),
      detail: "Estado del turno",
    },
    {
      label: "Bajo stock",
      value: displayMetric(metrics.lowStock, metricStates.lowStock),
      detail: "Insumos por revisar",
    },
    {
      label: "Ticket promedio",
      value: displayMetric(metrics.averageTicket, metricStates.averageTicket, (value) => `S/ ${value.toFixed(2)}`),
      detail: "Pedidos pagados",
    },
  ];

  return (
    <main className="shell dashboard-shell">
      <nav className="dashboard-topbar">
        <Link className="brand" href="/">
          {brand.name}
        </Link>
        <div className="dashboard-account">
          <span>{session?.email ?? "Cargando..."}</span>
          <button className="button button-small" onClick={logout} type="button">
            Salir
          </button>
        </div>
      </nav>
      <section className="dashboard-welcome">
        <div>
          <div className="eyebrow">Panel operativo</div>
          <h1>Hola, {emailName}</h1>
          <p>{isKitchenUser ? "Entra a tu pantalla de trabajo." : "Este es el pulso de tu negocio hoy."}</p>
        </div>
        <span className="dashboard-role">{session?.roles.join(" · ") ?? ""}</span>
      </section>
      {metricsWarning && (
        <p className="dashboard-warning" role="status">
          Algunas métricas no pudieron actualizarse. Revisa la conexión o los permisos.
        </p>
      )}
      <section className="dashboard-actions" aria-label="Acciones principales">
        {canCreateOrder && (
          <Link className="button button-primary" href="/dashboard/orders">
            + Nuevo pedido
          </Link>
        )}
        {canOpenCash && (
          <Link className="button button-secondary" href="/dashboard/cash">
            Abrir caja
          </Link>
        )}
      </section>
      <section className="dashboard-metrics" aria-label="Resumen operativo">
        {cards.map((card) => (
          <article className="dashboard-metric" key={card.label}>
            <span>{card.label}</span>
            <strong>{card.value}</strong>
            <small>{card.detail}</small>
          </article>
        ))}
      </section>
      <section className="dashboard-modules" aria-label="Módulos disponibles">
        {visibleModules.map((module) => (
          <Link className="dashboard-module active" href={module.href} key={module.label}>
            <span className="module-icon">{module.icon}</span>
            <span>
              <strong>{module.label}</strong>
              <small>{module.description}</small>
            </span>
            <b>›</b>
          </Link>
        ))}
      </section>
      <section className="dashboard-summary" aria-label="Recursos del sistema">
        <div>
          <span>Productos</span>
          <strong>{displayMetric(metrics.productCount, metricStates.productCount)}</strong>
        </div>
        <div>
          <span>Categorías</span>
          <strong>{displayMetric(metrics.categoryCount, metricStates.categoryCount)}</strong>
        </div>
        <div>
          <span>Roles activos</span>
          <strong>{session?.roles.length ?? "—"}</strong>
        </div>
      </section>
    </main>
  );
}
