"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { apiFetch, clearOrganizationContext } from "@/lib/api/client";

type OrganizationMetric = {
  organizationId: string;
  name: string;
  slug: string;
  status: string;
  activeUsers: number;
  recentlyActiveUsers: number;
  orders: number;
  paidOrders: number;
  sales: number | string;
  pendingInvitations: number;
  lastActivityAt: string | null;
};

type OperationalMetrics = {
  range: { since: string; until: string };
  organizations: { total: number; active: number; suspended: number; pending: number; archived: number };
  users: { total: number; active: number; recentlyActive: number };
  orders: { total: number; paid: number; sales: number | string };
  pendingInvitations: number;
  lastActivityAt: string | null;
  recentErrors: Array<{
    id: string;
    occurredAt: string;
    severity: string;
    source: string;
    operation: string;
    organizationId: string | null;
    message: string;
  }>;
  organizationMetrics: OrganizationMetric[];
};

function money(value: number | string) {
  return `S/ ${Number(value ?? 0).toFixed(2)}`;
}

function date(value: string | null) {
  if (!value) return "Sin actividad registrada";
  return new Intl.DateTimeFormat("es-PE", { dateStyle: "medium", timeStyle: "short" }).format(new Date(value));
}

export default function PlatformMetricsPage() {
  const router = useRouter();
  const [metrics, setMetrics] = useState<OperationalMetrics | null>(null);
  const [organizationId, setOrganizationId] = useState("");
  const [days, setDays] = useState("30");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const query = useMemo(() => {
    const params = new URLSearchParams({ days });
    if (organizationId) params.set("organizationId", organizationId);
    return params.toString();
  }, [days, organizationId]);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const response = await apiFetch<{ data: OperationalMetrics }>(`/api/v1/platform/metrics?${query}`);
      setMetrics(response.data);
      setError(null);
    } catch (cause) {
      const status = (cause as Error & { status?: number }).status;
      if (status === 401) router.replace("/login");
      else setError(cause instanceof Error ? cause.message : "No se pudieron cargar las métricas");
    } finally {
      setLoading(false);
    }
  }, [query, router]);

  useEffect(() => {
    clearOrganizationContext();
    void load();
  }, [load]);

  const selectedOrganization = metrics?.organizationMetrics.find((item) => item.organizationId === organizationId);

  return (
    <main className="shell module-shell">
      <nav className="nav compact-nav">
        <Link className="brand" href="/dashboard/platform">
          ← Plataforma
        </Link>
        <div className="nav-actions">
          <Link className="button button-small" href="/dashboard/platform/users">
            Usuarios
          </Link>
          <Link className="button button-small" href="/dashboard/platform/audit">
            Auditoría
          </Link>
          <Link className="button button-small" href="/dashboard/platform/support">
            Soporte
          </Link>
        </div>
      </nav>

      <div className="module-page-heading">
        <div>
          <div className="eyebrow">Operación SaaS</div>
          <h1>Métricas y salud</h1>
        </div>
        <button className="button button-small" onClick={() => void load()} type="button">
          Actualizar
        </button>
      </div>
      <p className="platform-intro">
        Vista global de adopción, actividad, ventas, invitaciones y errores operativos. Los datos están reservados para
        administradores globales.
      </p>
      {error && <p className="form-error">{error}</p>}

      <section className="panel-section metrics-controls">
        <label>
          Restaurante
          <select value={organizationId} onChange={(event) => setOrganizationId(event.target.value)}>
            <option value="">Todas las organizaciones</option>
            {metrics?.organizationMetrics.map((organization) => (
              <option key={organization.organizationId} value={organization.organizationId}>
                {organization.name}
              </option>
            ))}
          </select>
        </label>
        <label>
          Periodo
          <select value={days} onChange={(event) => setDays(event.target.value)}>
            <option value="7">Últimos 7 días</option>
            <option value="30">Últimos 30 días</option>
            <option value="90">Últimos 90 días</option>
          </select>
        </label>
      </section>

      {loading && <p className="empty-state">Cargando métricas...</p>}
      {!loading && metrics && (
        <>
          <section className="metrics-grid">
            <article className="metric-card">
              <span>Organizaciones</span>
              <strong>{selectedOrganization ? selectedOrganization.name : metrics.organizations.total}</strong>
              <small>
                {selectedOrganization ? selectedOrganization.status : `${metrics.organizations.active} activas`}
              </small>
            </article>
            <article className="metric-card">
              <span>Usuarios activos</span>
              <strong>{selectedOrganization ? selectedOrganization.activeUsers : metrics.users.active}</strong>
              <small>
                {selectedOrganization ? selectedOrganization.recentlyActiveUsers : metrics.users.recentlyActive} con
                actividad reciente
              </small>
            </article>
            <article className="metric-card">
              <span>Pedidos</span>
              <strong>{selectedOrganization ? selectedOrganization.orders : metrics.orders.total}</strong>
              <small>{selectedOrganization ? selectedOrganization.paidOrders : metrics.orders.paid} pagados</small>
            </article>
            <article className="metric-card">
              <span>Ventas agregadas</span>
              <strong>{money(selectedOrganization ? selectedOrganization.sales : metrics.orders.sales)}</strong>
              <small>{selectedOrganization ? "Restaurante seleccionado" : "Todas las organizaciones"}</small>
            </article>
            <article className="metric-card">
              <span>Invitaciones pendientes</span>
              <strong>
                {selectedOrganization ? selectedOrganization.pendingInvitations : metrics.pendingInvitations}
              </strong>
              <small>Requieren completar acceso</small>
            </article>
            <article className="metric-card">
              <span>Última actividad</span>
              <strong className="metric-date">
                {date(selectedOrganization?.lastActivityAt ?? metrics.lastActivityAt)}
              </strong>
              <small>Rango consultado: {days} días</small>
            </article>
          </section>

          {!selectedOrganization && (
            <section className="panel-section">
              <div className="section-heading">
                <div>
                  <div className="eyebrow">Aislamiento por entidad</div>
                  <h2>Métricas por restaurante</h2>
                </div>
                <span className="muted-copy">Selecciona una fila para filtrar</span>
              </div>
              <div className="metrics-org-list">
                {metrics.organizationMetrics.map((organization) => (
                  <button
                    className="metrics-org-row"
                    key={organization.organizationId}
                    onClick={() => setOrganizationId(organization.organizationId)}
                    type="button"
                  >
                    <span>
                      <strong>{organization.name}</strong>
                      <small>
                        {organization.slug} · {organization.status}
                      </small>
                    </span>
                    <span>{organization.activeUsers} usuarios</span>
                    <span>{organization.orders} pedidos</span>
                    <span>{money(organization.sales)}</span>
                    <span>{organization.pendingInvitations} invitaciones</span>
                  </button>
                ))}
              </div>
            </section>
          )}

          <section className="panel-section">
            <div className="section-heading">
              <div>
                <div className="eyebrow">Alertas operativas</div>
                <h2>Errores recientes</h2>
              </div>
              <span className="muted-copy">{metrics.recentErrors.length} registrados</span>
            </div>
            {metrics.recentErrors.length === 0 ? (
              <p className="empty-state">No hay fallos recientes en el periodo seleccionado.</p>
            ) : (
              <div className="metrics-errors">
                {metrics.recentErrors.map((item) => (
                  <article className="metrics-error-row" key={item.id}>
                    <span className={`status-pill ${item.severity === "critical" ? "unavailable" : "available"}`}>
                      {item.severity}
                    </span>
                    <div>
                      <strong>{item.operation}</strong>
                      <small>
                        {item.source} · {date(item.occurredAt)}
                      </small>
                      <p>{item.message}</p>
                    </div>
                  </article>
                ))}
              </div>
            )}
          </section>
        </>
      )}
    </main>
  );
}
