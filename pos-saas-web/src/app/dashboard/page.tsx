"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { apiFetch, setActiveOrganizationId } from "@/lib/api/client";
import { brand } from "@/config/brand";
import { useDashboardMetrics } from "@/hooks/useDashboardMetrics";
import { useApiHealth } from "@/hooks/useApiHealth";

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

function displayMetric<T>(
  value: T | null,
  state: "loading" | "ok" | "forbidden" | "error",
  format: (value: T) => string = String,
) {
  if (state === "loading") return "Cargando…";
  if (state === "forbidden") return "Sin permisos";
  if (state === "error") return "No disponible";
  if (value === null) return "Sin datos";
  return format(value);
}

export default function DashboardPage() {
  const router = useRouter();
  const { session, metrics, metricStates, metricsWarning, error, updatedAt, refresh } = useDashboardMetrics();
  const { health, refresh: refreshHealth } = useApiHealth();
  const [organizations, setOrganizations] = useState<Array<{ id: string; name: string }>>([]);
  const [organizationsLoading, setOrganizationsLoading] = useState(true);
  const [organizationsError, setOrganizationsError] = useState<string | null>(null);

  const loadOrganizations = useCallback(async () => {
    setOrganizationsLoading(true);
    try {
      const response = await apiFetch<{
        data: Array<{ id: string; name: string; slug: string; isDefault: boolean }>;
        activeOrganizationId: string;
      }>("/api/v1/organizations");
      setOrganizations(response.data);
      setActiveOrganizationId(response.activeOrganizationId);
      setOrganizationsError(null);
    } catch (cause) {
      const status = (cause as Error & { status?: number }).status;
      if (status === 401) {
        router.replace("/login");
        return;
      }
      setOrganizationsError(cause instanceof Error ? cause.message : "No se pudieron cargar las organizaciones");
    } finally {
      setOrganizationsLoading(false);
    }
  }, [router]);

  useEffect(() => {
    void loadOrganizations();
  }, [loadOrganizations]);

  function switchOrganization(organizationId: string) {
    setActiveOrganizationId(organizationId);
    window.location.reload();
  }

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
  const isAdmin = session?.roles.includes("admin") ?? false;
  const emailName = session?.email?.split("@")[0] ?? "usuario";
  const refreshedLabel = updatedAt?.toLocaleTimeString("es-PE", { hour: "2-digit", minute: "2-digit" });
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
          {organizations.length > 1 && (
            <label>
              <span className="sr-only">Organización activa</span>
              <select
                aria-label="Organización activa"
                defaultValue={organizations.find((organization) => organization.id === session?.organizationId)?.id}
                onChange={(event) => switchOrganization(event.target.value)}
              >
                {organizations.map((organization) => (
                  <option key={organization.id} value={organization.id}>
                    {organization.name}
                  </option>
                ))}
              </select>
            </label>
          )}
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
      {organizationsError && (
        <p className="dashboard-warning" role="alert">
          No se pudieron cargar tus organizaciones. {organizationsError}
          <button className="button button-small" onClick={() => void loadOrganizations()} type="button">
            Reintentar
          </button>
        </p>
      )}
      {organizationsLoading && <p className="dashboard-warning">Cargando organizaciones…</p>}
      <section
        className={`dashboard-health health-${health.status}`}
        aria-label="Estado de la plataforma"
        aria-live="polite"
      >
        <span className="status-dot" />
        <div>
          <strong>
            {health.status === "online"
              ? "Plataforma operativa"
              : health.status === "offline"
                ? "Problemas de conexión"
                : "Verificando plataforma"}
          </strong>
          <small>
            API: {health.apiStatus ?? "—"} · Base de datos: {health.supabaseStatus ?? "—"}
            {health.latencyMs !== null ? ` · ${health.latencyMs} ms` : ""}
          </small>
        </div>
        <button
          className="button button-small"
          onClick={() => {
            refresh();
            void refreshHealth();
          }}
          type="button"
        >
          Actualizar
        </button>
      </section>
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
      {isAdmin && (
        <section className="dashboard-admin-summary" aria-label="Resumen administrativo">
          <div className="section-heading">
            <div>
              <div className="eyebrow">Control administrativo</div>
              <h2>
                Resumen de{" "}
                {organizations.find((organization) => organization.id === session?.organizationId)?.name ??
                  "tu negocio"}
              </h2>
            </div>
            <small>{refreshedLabel ? `Actualizado ${refreshedLabel}` : "Actualizando…"}</small>
          </div>
          <div className="admin-summary-grid">
            <div>
              <span>Ventas del día</span>
              <strong>{displayMetric(metrics.sales, metricStates.sales, (value) => `S/ ${value.toFixed(2)}`)}</strong>
            </div>
            <div>
              <span>Pedidos activos</span>
              <strong>{displayMetric(metrics.activeOrders, metricStates.activeOrders)}</strong>
            </div>
            <div>
              <span>Estado de caja</span>
              <strong>
                {displayMetric(metrics.cashOpen, metricStates.cashOpen, (value) => (value ? "Abierta" : "Cerrada"))}
              </strong>
            </div>
            <div>
              <span>Alertas de stock</span>
              <strong>{displayMetric(metrics.lowStock, metricStates.lowStock)}</strong>
            </div>
          </div>
          <div className="admin-summary-links">
            <Link href="/dashboard/reports">Ver reportes</Link>
            <Link href="/dashboard/settings">Administrar usuarios y roles</Link>
          </div>
        </section>
      )}
    </main>
  );
}
