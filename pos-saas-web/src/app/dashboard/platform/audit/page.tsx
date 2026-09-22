"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { apiFetch, clearOrganizationContext } from "@/lib/api/client";

type Organization = { id: string; name: string; slug: string; status: string };
type Actor = { id: string; email: string; name: string | null };
type AuditEvent = {
  id: string;
  actor_user_id: string;
  actor_email: string;
  actor_name: string | null;
  action: string;
  auditable_type: string;
  auditable_id: string | null;
  organization_id: string | null;
  old_values: unknown;
  new_values: unknown;
  created_at: string;
};
type AuditResponse = {
  data: { items: AuditEvent[]; total: number; page: number; pageSize: number; pageCount: number };
};
type DetailResponse = { data: AuditEvent & { actor: Actor | null; organizationId: string | null } };

const actions = [
  "organization_provisioned",
  "organization_provisioning_failed",
  "organization_updated",
  "organization_suspended",
  "organization_reactivated",
  "user_block",
  "user_unblock",
  "user_invitation_resent",
  "membership_set",
  "membership_revoke",
  "platform_admin_bootstrap",
  "platform_admin_bootstrap_manual",
  "platform_organization_context_selected",
];

function formatDate(value: string) {
  return new Intl.DateTimeFormat("es-PE", { dateStyle: "medium", timeStyle: "short" }).format(new Date(value));
}

function actionLabel(action: string) {
  return action.replaceAll("_", " ");
}

export default function PlatformAuditPage() {
  const router = useRouter();
  const [events, setEvents] = useState<AuditEvent[]>([]);
  const [actors, setActors] = useState<Actor[]>([]);
  const [organizations, setOrganizations] = useState<Organization[]>([]);
  const [selected, setSelected] = useState<
    (AuditEvent & { actor?: Actor | null; organizationId?: string | null }) | null
  >(null);
  const [actorUserId, setActorUserId] = useState("");
  const [organizationId, setOrganizationId] = useState("");
  const [action, setAction] = useState("");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [page, setPage] = useState(1);
  const [pageCount, setPageCount] = useState(0);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const query = useMemo(() => {
    const params = new URLSearchParams({ page: String(page), pageSize: "25" });
    if (actorUserId) params.set("actorUserId", actorUserId);
    if (organizationId) params.set("organizationId", organizationId);
    if (action) params.set("action", action);
    if (from) params.set("from", `${from}T00:00:00.000Z`);
    if (to) {
      const end = new Date(`${to}T00:00:00.000Z`);
      end.setUTCDate(end.getUTCDate() + 1);
      params.set("to", end.toISOString());
    }
    return params.toString();
  }, [action, actorUserId, from, organizationId, page, to]);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [auditResponse, usersResponse, organizationsResponse] = await Promise.all([
        apiFetch<AuditResponse>(`/api/v1/platform/audit?${query}`),
        apiFetch<{ data: Actor[] }>("/api/v1/platform/users"),
        apiFetch<{ data: Organization[] }>("/api/v1/platform/organizations"),
      ]);
      setEvents(auditResponse.data.items);
      setPageCount(auditResponse.data.pageCount);
      setTotal(auditResponse.data.total);
      setActors(usersResponse.data);
      setOrganizations(organizationsResponse.data);
      setError(null);
    } catch (cause) {
      const status = (cause as Error & { status?: number }).status;
      if (status === 401) router.replace("/login");
      else setError(cause instanceof Error ? cause.message : "No se pudo cargar la auditoría global");
    } finally {
      setLoading(false);
    }
  }, [query, router]);

  useEffect(() => {
    clearOrganizationContext();
    void load();
  }, [load]);

  async function openDetail(event: AuditEvent) {
    try {
      const response = await apiFetch<DetailResponse>(`/api/v1/platform/audit/${event.id}`);
      setSelected(response.data);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "No se pudo cargar el detalle del evento");
    }
  }

  function resetFilters() {
    setActorUserId("");
    setOrganizationId("");
    setAction("");
    setFrom("");
    setTo("");
    setPage(1);
  }

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
          <Link className="button button-small" href="/dashboard/platform">
            Restaurantes
          </Link>
          <Link className="button button-small" href="/dashboard/platform/metrics">
            Métricas
          </Link>
          <Link className="button button-small" href="/dashboard/platform/support">
            Soporte
          </Link>
        </div>
      </nav>

      <div className="module-page-heading">
        <div>
          <div className="eyebrow">Gobierno administrativo</div>
          <h1>Auditoría global</h1>
        </div>
        <button className="button button-small" onClick={() => void load()} type="button">
          Actualizar
        </button>
      </div>
      <p className="platform-intro">
        Consulta quién realizó cada cambio sobre organizaciones, usuarios, roles y membresías. Esta vista está reservada
        para administradores globales.
      </p>
      {error && <p className="form-error">{error}</p>}

      <section className="panel-section audit-filters">
        <div className="eyebrow">Filtros</div>
        <div className="audit-filter-grid">
          <label>
            Usuario
            <select
              value={actorUserId}
              onChange={(event) => {
                setActorUserId(event.target.value);
                setPage(1);
              }}
            >
              <option value="">Todos los usuarios</option>
              {actors.map((actor) => (
                <option key={actor.id} value={actor.id}>
                  {actor.name || actor.email}
                </option>
              ))}
            </select>
          </label>
          <label>
            Organización
            <select
              value={organizationId}
              onChange={(event) => {
                setOrganizationId(event.target.value);
                setPage(1);
              }}
            >
              <option value="">Todas las organizaciones</option>
              {organizations.map((organization) => (
                <option key={organization.id} value={organization.id}>
                  {organization.name}
                </option>
              ))}
            </select>
          </label>
          <label>
            Acción
            <select
              value={action}
              onChange={(event) => {
                setAction(event.target.value);
                setPage(1);
              }}
            >
              <option value="">Todas las acciones</option>
              {actions.map((item) => (
                <option key={item} value={item}>
                  {actionLabel(item)}
                </option>
              ))}
            </select>
          </label>
          <label>
            Desde
            <input
              type="date"
              value={from}
              onChange={(event) => {
                setFrom(event.target.value);
                setPage(1);
              }}
            />
          </label>
          <label>
            Hasta
            <input
              type="date"
              value={to}
              onChange={(event) => {
                setTo(event.target.value);
                setPage(1);
              }}
            />
          </label>
          <button className="button button-secondary audit-reset" onClick={resetFilters} type="button">
            Limpiar filtros
          </button>
        </div>
      </section>

      <section className="audit-layout">
        <div className="panel-section">
          <div className="section-heading">
            <div>
              <div className="eyebrow">Registro protegido</div>
              <h2>{total} eventos</h2>
            </div>
            <span className="muted-copy">
              Página {page} de {pageCount || 1}
            </span>
          </div>
          <div className="audit-list">
            {loading && <p className="empty-state">Cargando eventos...</p>}
            {!loading && events.length === 0 && <p className="empty-state">No hay eventos para estos filtros.</p>}
            {!loading &&
              events.map((event) => (
                <button
                  className={selected?.id === event.id ? "audit-event selected" : "audit-event"}
                  key={event.id}
                  onClick={() => void openDetail(event)}
                  type="button"
                >
                  <span className="audit-event-main">
                    <strong>{actionLabel(event.action)}</strong>
                    <small>
                      {event.actor_name || event.actor_email} · {formatDate(event.created_at)}
                    </small>
                  </span>
                  <span className="audit-event-type">{event.auditable_type}</span>
                </button>
              ))}
          </div>
          <div className="audit-pagination">
            <button
              className="button button-small"
              disabled={page <= 1 || loading}
              onClick={() => setPage((value) => value - 1)}
              type="button"
            >
              Anterior
            </button>
            <span>
              {page} / {pageCount || 1}
            </span>
            <button
              className="button button-small"
              disabled={pageCount === 0 || page >= pageCount || loading}
              onClick={() => setPage((value) => value + 1)}
              type="button"
            >
              Siguiente
            </button>
          </div>
        </div>

        <aside className="panel-section audit-detail">
          <div className="eyebrow">Detalle del evento</div>
          {selected ? (
            <>
              <h2>{actionLabel(selected.action)}</h2>
              <dl className="audit-facts">
                <div>
                  <dt>Fecha</dt>
                  <dd>{formatDate(selected.created_at)}</dd>
                </div>
                <div>
                  <dt>Actor</dt>
                  <dd>{selected.actor?.name || selected.actor?.email || selected.actor_email}</dd>
                </div>
                <div>
                  <dt>Tipo</dt>
                  <dd>{selected.auditable_type}</dd>
                </div>
                <div>
                  <dt>ID objetivo</dt>
                  <dd>{selected.auditable_id || "—"}</dd>
                </div>
                <div>
                  <dt>Organización</dt>
                  <dd>{selected.organizationId || selected.organization_id || "Global"}</dd>
                </div>
              </dl>
              <h3>Antes</h3>
              <pre>{JSON.stringify(selected.old_values ?? {}, null, 2)}</pre>
              <h3>Después</h3>
              <pre>{JSON.stringify(selected.new_values ?? {}, null, 2)}</pre>
            </>
          ) : (
            <p className="empty-state">Selecciona un evento para inspeccionar sus cambios.</p>
          )}
        </aside>
      </section>
    </main>
  );
}
