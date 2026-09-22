"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import type { FormEvent } from "react";
import { useRouter } from "next/navigation";
import { apiFetch, createIdempotencyKey } from "@/lib/api/client";

type Organization = { id: string; name: string; slug: string; status: string };
type Plan = {
  id: string;
  code: string;
  name: string;
  description: string;
  monthly_price: number | null;
  currency: string;
  max_users: number | null;
  max_branches: number | null;
  max_products: number | null;
  max_monthly_orders: number | null;
  max_storage_bytes: number | null;
};
type Usage = {
  subscription: { status: string; currentPeriodEnd: string | null; trialEndsAt: string | null };
  plan: { code: string; name: string; monthlyPrice: number | null; currency: string };
  limits: { users: number | null; branches: number | null; products: number | null; monthlyOrders: number | null };
  usage: { users: number; branches: number; products: number; monthlyOrders: number };
};

const formatLimit = (value: number | null | undefined) =>
  value == null ? "Sin límite" : value.toLocaleString("es-PE");

export default function PlatformPlansPage() {
  const router = useRouter();
  const [organizations, setOrganizations] = useState<Organization[]>([]);
  const [plans, setPlans] = useState<Plan[]>([]);
  const [organizationId, setOrganizationId] = useState("");
  const [planCode, setPlanCode] = useState("");
  const [status, setStatus] = useState("active");
  const [reason, setReason] = useState("");
  const [usage, setUsage] = useState<Usage | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const loadBase = useCallback(async () => {
    try {
      const [organizationsResponse, plansResponse] = await Promise.all([
        apiFetch<{ data: Organization[] }>("/api/v1/platform/organizations"),
        apiFetch<{ data: Plan[] }>("/api/v1/platform/plans"),
      ]);
      setOrganizations(organizationsResponse.data);
      setPlans(plansResponse.data);
      setOrganizationId((current) => current || organizationsResponse.data[0]?.id || "");
      setPlanCode((current) => current || plansResponse.data[0]?.code || "");
      setError(null);
    } catch (cause) {
      const statusCode = (cause as Error & { status?: number }).status;
      if (statusCode === 401 || statusCode === 403) router.replace("/login");
      else setError(cause instanceof Error ? cause.message : "No se pudo cargar planes");
    } finally {
      setLoading(false);
    }
  }, [router]);

  const loadUsage = useCallback(async () => {
    if (!organizationId) {
      setUsage(null);
      return;
    }
    try {
      const response = await apiFetch<{ data: Usage }>(`/api/v1/platform/organizations/${organizationId}/subscription`);
      setUsage(response.data);
      setPlanCode(response.data.plan.code);
      setStatus(response.data.subscription.status);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "No se pudo cargar el consumo");
    }
  }, [organizationId]);

  useEffect(() => {
    void loadBase();
  }, [loadBase]);
  useEffect(() => {
    void loadUsage();
  }, [loadUsage]);

  async function updateSubscription(event: FormEvent) {
    event.preventDefault();
    if (!organizationId || !planCode) return;
    setSaving(true);
    setError(null);
    setSuccess(null);
    try {
      await apiFetch(`/api/v1/platform/organizations/${organizationId}/subscription`, {
        method: "PATCH",
        headers: { "Idempotency-Key": createIdempotencyKey() },
        body: JSON.stringify({ planCode, status, reason: reason.trim() || null }),
      });
      setSuccess("Plan actualizado y registrado en auditoría.");
      await loadUsage();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "No se pudo actualizar el plan");
    } finally {
      setSaving(false);
    }
  }

  const selectedPlan = plans.find((plan) => plan.code === planCode);
  return (
    <main className="shell module-shell">
      <nav className="nav compact-nav">
        <Link className="brand" href="/dashboard/platform">
          ← Panel global
        </Link>
        <div className="nav-actions">
          <Link className="button button-small" href="/dashboard/platform">
            Organizaciones
          </Link>
          <Link className="button button-small" href="/dashboard/platform/metrics">
            Métricas
          </Link>
        </div>
      </nav>
      <div className="module-page-heading">
        <div>
          <div className="eyebrow">Fase 7 · monetización</div>
          <h1>Planes, límites y uso</h1>
        </div>
        <button className="button button-small" onClick={() => void loadBase()} type="button">
          Actualizar
        </button>
      </div>
      <p className="platform-intro">
        Asigna un plan por restaurante y revisa el consumo operativo. Los precios comerciales quedan editables hasta
        definir la oferta final.
      </p>
      {error && <p className="form-error">{error}</p>}
      {success && <p className="form-success">{success}</p>}
      {loading ? (
        <p className="empty-state">Cargando planes…</p>
      ) : (
        <section className="platform-layout">
          <form className="panel-section platform-form" onSubmit={updateSubscription}>
            <div className="eyebrow">Asignación global</div>
            <h2>Plan de un restaurante</h2>
            <label>
              Restaurante
              <select value={organizationId} onChange={(event) => setOrganizationId(event.target.value)}>
                {organizations.map((organization) => (
                  <option key={organization.id} value={organization.id}>
                    {organization.name}
                  </option>
                ))}
              </select>
            </label>
            <label>
              Plan
              <select value={planCode} onChange={(event) => setPlanCode(event.target.value)}>
                {plans.map((plan) => (
                  <option key={plan.code} value={plan.code}>
                    {plan.name} · {plan.code}
                  </option>
                ))}
              </select>
            </label>
            <label>
              Estado
              <select value={status} onChange={(event) => setStatus(event.target.value)}>
                <option value="trial">Prueba</option>
                <option value="active">Activo</option>
                <option value="past_due">Pago pendiente</option>
                <option value="suspended">Suspendido</option>
                <option value="cancelled">Cancelado</option>
                <option value="expired">Vencido</option>
              </select>
            </label>
            <label>
              Motivo o nota de auditoría
              <textarea
                value={reason}
                onChange={(event) => setReason(event.target.value)}
                maxLength={500}
                placeholder="Opcional"
              />
            </label>
            <button className="button button-primary" disabled={saving || !organizationId || !planCode} type="submit">
              {saving ? "Guardando…" : "Guardar asignación"}
            </button>
          </form>
          <section className="panel-section">
            <div className="eyebrow">Catálogo activo</div>
            <h2>Planes disponibles</h2>
            <div className="platform-organizations">
              {plans.map((plan) => (
                <article className="platform-organization" key={plan.id}>
                  <div>
                    <strong>{plan.name}</strong>
                    <small>{plan.description}</small>
                  </div>
                  <div className="platform-organization-actions">
                    <span className="status-pill available">
                      {plan.monthly_price == null ? "Precio por definir" : `${plan.currency} ${plan.monthly_price}`}
                    </span>
                  </div>
                  <small>
                    Usuarios {formatLimit(plan.max_users)} · Productos {formatLimit(plan.max_products)} · Pedidos/mes{" "}
                    {formatLimit(plan.max_monthly_orders)}
                  </small>
                </article>
              ))}
            </div>
          </section>
        </section>
      )}
      {usage && selectedPlan && (
        <section className="panel-section" style={{ marginTop: 14 }}>
          <div className="section-heading">
            <div>
              <div className="eyebrow">Consumo actual</div>
              <h2>
                {usage.plan.name} · {usage.subscription.status}
              </h2>
            </div>
            <span className="status-pill available">{usage.plan.code}</span>
          </div>
          <div className="metrics-grid">
            <div className="metric-card">
              <span>Usuarios</span>
              <strong>
                {usage.usage.users} / {formatLimit(usage.limits.users)}
              </strong>
            </div>
            <div className="metric-card">
              <span>Productos</span>
              <strong>
                {usage.usage.products} / {formatLimit(usage.limits.products)}
              </strong>
            </div>
            <div className="metric-card">
              <span>Pedidos del mes</span>
              <strong>
                {usage.usage.monthlyOrders} / {formatLimit(usage.limits.monthlyOrders)}
              </strong>
            </div>
          </div>
          <p className="muted-copy">
            El control de límites se aplica en la base de datos para evitar que un restaurante supere su plan por
            llamadas simultáneas.
          </p>
        </section>
      )}
    </main>
  );
}
