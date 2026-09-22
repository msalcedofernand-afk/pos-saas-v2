"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { apiFetch } from "@/lib/api/client";

type Organization = {
  id: string;
  name: string;
  slug: string;
  is_active: boolean;
  status: "active" | "suspended" | "pending" | "archived";
  suspended_at: string | null;
  suspension_reason: string | null;
  owner_user_id: string | null;
  last_activity_at: string | null;
  created_at: string;
  updated_at: string;
};

type OrganizationDetail = {
  organization: Organization;
  owner: { id: string; email: string; name: string | null; is_blocked: boolean; created_at: string } | null;
  metrics: { users: number; products: number; orders: number };
  recentOrders: Array<{ id: string; status: string; total_amount: number; created_at: string }>;
  activity: Array<{
    id: string;
    action: string;
    auditable_type: string;
    auditable_id: string | null;
    created_at: string;
    scope: string;
  }>;
};

function formatDate(value: string | null) {
  if (!value) return "Sin actividad registrada";
  return new Intl.DateTimeFormat("es-PE", { dateStyle: "medium", timeStyle: "short" }).format(new Date(value));
}

export default function OrganizationDetailPage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const [detail, setDetail] = useState<OrganizationDetail | null>(null);
  const [name, setName] = useState("");
  const [reason, setReason] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const response = await apiFetch<{ data: OrganizationDetail }>(`/api/v1/platform/organizations/${params.id}`);
      setDetail(response.data);
      setName(response.data.organization.name);
      setError(null);
    } catch (cause) {
      const status = (cause as Error & { status?: number }).status;
      if (status === 401) router.replace("/login");
      else setError(cause instanceof Error ? cause.message : "No se pudo cargar la organización");
    } finally {
      setLoading(false);
    }
  }, [params.id, router]);

  useEffect(() => {
    void load();
  }, [load]);

  async function updateName() {
    if (!detail || name.trim() === detail.organization.name) return;
    setSaving(true);
    setError(null);
    setSuccess(null);
    try {
      await apiFetch(`/api/v1/platform/organizations/${detail.organization.id}`, {
        method: "PATCH",
        headers: { "Idempotency-Key": crypto.randomUUID() },
        body: JSON.stringify({ name }),
      });
      setSuccess("Nombre actualizado y registrado en auditoría.");
      await load();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "No se pudo actualizar el nombre");
    } finally {
      setSaving(false);
    }
  }

  async function changeStatus(action: "suspend" | "reactivate") {
    if (!detail) return;
    if (action === "suspend") {
      if (reason.trim().length < 3) {
        setError("Indica un motivo de suspensión de al menos 3 caracteres.");
        return;
      }
      if (
        !window.confirm(`¿Suspender ${detail.organization.name}? Se bloqueará su operación, pero no se borrarán datos.`)
      ) {
        return;
      }
    } else if (!window.confirm(`¿Reactivar ${detail.organization.name} y devolver su acceso operativo?`)) {
      return;
    }

    setSaving(true);
    setError(null);
    setSuccess(null);
    try {
      await apiFetch(`/api/v1/platform/organizations/${detail.organization.id}/${action}`, {
        method: "POST",
        headers: { "Idempotency-Key": crypto.randomUUID() },
        body: JSON.stringify(action === "suspend" ? { reason } : {}),
      });
      setReason("");
      setSuccess(action === "suspend" ? "Organización suspendida." : "Organización reactivada.");
      await load();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "No se pudo cambiar el estado");
    } finally {
      setSaving(false);
    }
  }

  if (loading)
    return (
      <main className="shell">
        <p className="empty-state">Cargando organización...</p>
      </main>
    );
  if (!detail)
    return (
      <main className="shell">
        <p className="form-error">{error ?? "Organización no encontrada"}</p>
      </main>
    );

  const { organization } = detail;
  return (
    <main className="shell module-shell">
      <nav className="nav compact-nav">
        <Link className="brand" href="/dashboard/platform">
          ← Panel global
        </Link>
        <Link className="button button-small" href="/dashboard/platform">
          Organizaciones
        </Link>
        <Link className="button button-small" href={`/dashboard/platform/plans?organizationId=${organization.id}`}>
          Plan y límites
        </Link>
      </nav>

      <div className="module-page-heading">
        <div>
          <div className="eyebrow">Detalle de organización</div>
          <h1>{organization.name}</h1>
          <p className="muted-copy">{organization.slug}</p>
        </div>
        <span className={`status-pill ${organization.status === "active" ? "available" : "unavailable"}`}>
          {organization.status === "active" ? "Activa" : organization.status}
        </span>
      </div>

      {error && <p className="form-error">{error}</p>}
      {success && <p className="form-success">{success}</p>}

      <section className="organization-detail-grid">
        <section className="panel-section">
          <div className="eyebrow">Identidad</div>
          <h2>Datos principales</h2>
          <div className="organization-detail-form">
            <label>
              Nombre visible
              <input value={name} onChange={(event) => setName(event.target.value)} />
            </label>
            <button className="button button-primary" disabled={saving} onClick={() => void updateName()} type="button">
              Guardar nombre
            </button>
          </div>
          <dl className="organization-facts">
            <div>
              <dt>Creada</dt>
              <dd>{formatDate(organization.created_at)}</dd>
            </div>
            <div>
              <dt>Última actividad</dt>
              <dd>{formatDate(organization.last_activity_at)}</dd>
            </div>
            <div>
              <dt>Administrador principal</dt>
              <dd>{detail.owner?.email ?? "Sin asignar"}</dd>
            </div>
          </dl>
        </section>

        <section className="panel-section">
          <div className="eyebrow">Estado operativo</div>
          <h2>
            {organization.status === "pending"
              ? "Solicitud pendiente de aprobación"
              : organization.status === "active"
                ? "Organización disponible"
                : "Operación suspendida"}
          </h2>
          <p className="muted-copy">
            {organization.status === "pending"
              ? "Revisa la solicitud para habilitar el acceso de este restaurante al piloto gratuito."
              : organization.status === "active"
                ? "Los usuarios pueden iniciar sesión y operar pedidos, cocina, caja e inventario."
                : `Suspendida ${formatDate(organization.suspended_at)}. ${organization.suspension_reason ?? ""}`}
          </p>
          {organization.status === "active" ? (
            <div className="organization-action-form">
              <label>
                Motivo de suspensión
                <textarea value={reason} onChange={(event) => setReason(event.target.value)} maxLength={500} rows={3} />
              </label>
              <button
                className="button button-danger"
                disabled={saving}
                onClick={() => void changeStatus("suspend")}
                type="button"
              >
                Suspender organización
              </button>
            </div>
          ) : (
            <button
              className="button button-primary"
              disabled={saving}
              onClick={() => void changeStatus("reactivate")}
              type="button"
            >
              {organization.status === "pending" ? "Aprobar restaurante" : "Reactivar organización"}
            </button>
          )}
        </section>
      </section>

      <section className="organization-metrics" aria-label="Métricas resumidas">
        <div>
          <span>Usuarios</span>
          <strong>{detail.metrics.users}</strong>
        </div>
        <div>
          <span>Productos</span>
          <strong>{detail.metrics.products}</strong>
        </div>
        <div>
          <span>Pedidos</span>
          <strong>{detail.metrics.orders}</strong>
        </div>
      </section>

      <section className="organization-detail-grid">
        <section className="panel-section">
          <div className="eyebrow">Pedidos recientes</div>
          <h2>Última operación</h2>
          {detail.recentOrders.length === 0 ? (
            <p className="empty-state">No hay pedidos registrados.</p>
          ) : (
            <div className="organization-list">
              {detail.recentOrders.map((order) => (
                <div key={order.id}>
                  <strong>{order.status}</strong>
                  <span>
                    S/ {Number(order.total_amount).toFixed(2)} · {formatDate(order.created_at)}
                  </span>
                </div>
              ))}
            </div>
          )}
        </section>
        <section className="panel-section">
          <div className="eyebrow">Actividad reciente</div>
          <h2>Auditoría resumida</h2>
          {detail.activity.length === 0 ? (
            <p className="empty-state">No hay actividad registrada.</p>
          ) : (
            <div className="organization-list">
              {detail.activity.map((entry) => (
                <div key={`${entry.scope}-${entry.id}`}>
                  <strong>{entry.action}</strong>
                  <span>{formatDate(entry.created_at)}</span>
                </div>
              ))}
            </div>
          )}
        </section>
      </section>
    </main>
  );
}
