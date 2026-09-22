"use client";

import Link from "next/link";
import { useSearchParams, useRouter } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import { apiFetch, clearOrganizationContext, setPlatformOrganizationContext } from "@/lib/api/client";

type Organization = { id: string; name: string; slug: string; status: string };
type SupportAccess = {
  id: string;
  actor_user_id: string;
  organization_id: string;
  reason: string;
  duration_minutes: number;
  mode: "read_only" | "write";
  status: "active" | "revoked" | "expired";
  requested_at: string;
  starts_at: string;
  expires_at: string;
  entered_at: string | null;
  write_enabled_at: string | null;
  revoked_at: string | null;
  revoke_reason: string | null;
  organizations: Organization | Organization[] | null;
};

function organizationValue(access: SupportAccess) {
  return Array.isArray(access.organizations) ? (access.organizations[0] ?? null) : access.organizations;
}

function formatDate(value: string) {
  return new Intl.DateTimeFormat("es-PE", { dateStyle: "medium", timeStyle: "short" }).format(new Date(value));
}

export default function PlatformSupportPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [organizations, setOrganizations] = useState<Organization[]>([]);
  const [accesses, setAccesses] = useState<SupportAccess[]>([]);
  const [organizationId, setOrganizationId] = useState(searchParams.get("organizationId") ?? "");
  const [reason, setReason] = useState("");
  const [durationMinutes, setDurationMinutes] = useState("60");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const [organizationsResponse, accessesResponse] = await Promise.all([
        apiFetch<{ data: Organization[] }>("/api/v1/platform/organizations"),
        apiFetch<{ data: SupportAccess[] }>("/api/v1/platform/support/access"),
      ]);
      setOrganizations(organizationsResponse.data);
      setAccesses(accessesResponse.data);
      setError(null);
    } catch (cause) {
      const status = (cause as Error & { status?: number }).status;
      if (status === 401) router.replace("/login");
      else setError(cause instanceof Error ? cause.message : "No se pudo cargar el soporte temporal");
    }
  }, [router]);

  useEffect(() => {
    clearOrganizationContext();
    void load();
  }, [load]);

  async function requestAccess(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setError(null);
    setSuccess(null);
    try {
      await apiFetch("/api/v1/platform/support/access", {
        method: "POST",
        headers: { "Idempotency-Key": crypto.randomUUID() },
        body: JSON.stringify({ organizationId, reason, durationMinutes: Number(durationMinutes) }),
      });
      setReason("");
      setSuccess("Acceso temporal creado en modo solo lectura.");
      await load();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "No se pudo solicitar el acceso");
    } finally {
      setBusy(false);
    }
  }

  function enter(access: SupportAccess) {
    const organization = organizationValue(access);
    if (!organization) return;
    setPlatformOrganizationContext({
      id: organization.id,
      name: organization.name,
      slug: organization.slug,
      supportAccessId: access.id,
      supportMode: access.mode,
      expiresAt: access.expires_at,
    });
    router.push("/dashboard");
  }

  async function enableWrite(access: SupportAccess) {
    if (!window.confirm("El acceso de escritura permite modificar datos del restaurante. ¿Deseas continuar?")) return;
    setBusy(true);
    setError(null);
    try {
      await apiFetch(`/api/v1/platform/support/access/${access.id}/write`, {
        method: "POST",
        headers: { "Idempotency-Key": crypto.randomUUID() },
        body: JSON.stringify({ confirmation: "CONFIRMAR_ACCESO_ESCRITURA" }),
      });
      setSuccess("Escritura habilitada y auditada.");
      await load();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "No se pudo habilitar escritura");
    } finally {
      setBusy(false);
    }
  }

  async function revoke(access: SupportAccess) {
    const revokeReason = window.prompt("Motivo de revocación", "Atención finalizada")?.trim();
    if (!revokeReason) return;
    setBusy(true);
    setError(null);
    try {
      await apiFetch(`/api/v1/platform/support/access/${access.id}/revoke`, {
        method: "POST",
        headers: { "Idempotency-Key": crypto.randomUUID() },
        body: JSON.stringify({ reason: revokeReason }),
      });
      setSuccess("Acceso revocado.");
      await load();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "No se pudo revocar el acceso");
    } finally {
      setBusy(false);
    }
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
          <Link className="button button-small" href="/dashboard/platform/audit">
            Auditoría
          </Link>
        </div>
      </nav>
      <div className="module-page-heading">
        <div>
          <div className="eyebrow">Soporte seguro</div>
          <h1>Acceso temporal</h1>
        </div>
        <button className="button button-small" onClick={() => void load()} type="button">
          Actualizar
        </button>
      </div>
      <p className="platform-intro">
        Entra a un restaurante solo durante el tiempo necesario. Cada sesión inicia en solo lectura, expira
        automáticamente y deja una trazabilidad global.
      </p>
      {error && <p className="form-error">{error}</p>}
      {success && <p className="form-success">{success}</p>}

      <section className="support-layout">
        <form className="panel-section support-form" onSubmit={requestAccess}>
          <div className="eyebrow">Nueva solicitud</div>
          <h2>Solicitar acceso a restaurante</h2>
          <label>
            Restaurante
            <select required value={organizationId} onChange={(event) => setOrganizationId(event.target.value)}>
              <option value="">Selecciona un restaurante</option>
              {organizations
                .filter((organization) => organization.status === "active")
                .map((organization) => (
                  <option key={organization.id} value={organization.id}>
                    {organization.name}
                  </option>
                ))}
            </select>
          </label>
          <label>
            Motivo obligatorio
            <textarea
              minLength={10}
              maxLength={1000}
              required
              value={reason}
              onChange={(event) => setReason(event.target.value)}
            />
          </label>
          <label>
            Duración
            <select value={durationMinutes} onChange={(event) => setDurationMinutes(event.target.value)}>
              <option value="15">15 minutos</option>
              <option value="30">30 minutos</option>
              <option value="60">1 hora</option>
              <option value="120">2 horas</option>
              <option value="240">4 horas</option>
              <option value="480">8 horas</option>
            </select>
          </label>
          <div className="support-mode-note">
            <strong>Modo inicial: solo lectura</strong>
            <span>La escritura requiere una confirmación separada y explícita.</span>
          </div>
          <button className="button button-primary" disabled={busy} type="submit">
            {busy ? "Procesando..." : "Crear acceso temporal"}
          </button>
        </form>

        <section className="panel-section">
          <div className="section-heading">
            <div>
              <div className="eyebrow">Trazabilidad</div>
              <h2>Sesiones de soporte</h2>
            </div>
            <strong>{accesses.filter((access) => access.status === "active").length} activas</strong>
          </div>
          <div className="support-access-list">
            {accesses.length === 0 && <p className="empty-state">Todavía no hay solicitudes de soporte.</p>}
            {accesses.map((access) => {
              const organization = organizationValue(access);
              return (
                <article className="support-access-card" key={access.id}>
                  <div className="support-access-heading">
                    <div>
                      <strong>{organization?.name ?? access.organization_id}</strong>
                      <small>{access.reason}</small>
                    </div>
                    <span className={`status-pill ${access.status === "active" ? "available" : "unavailable"}`}>
                      {access.status === "active"
                        ? access.mode === "write"
                          ? "Escritura"
                          : "Solo lectura"
                        : access.status}
                    </span>
                  </div>
                  <small>
                    Vigencia: {formatDate(access.starts_at)} — {formatDate(access.expires_at)}
                  </small>
                  <div className="support-access-actions">
                    {access.status === "active" && (
                      <button
                        className="button button-small button-secondary"
                        disabled={busy}
                        onClick={() => enter(access)}
                        type="button"
                      >
                        Entrar
                      </button>
                    )}
                    {access.status === "active" && access.mode === "read_only" && (
                      <button
                        className="button button-small button-secondary"
                        disabled={busy}
                        onClick={() => void enableWrite(access)}
                        type="button"
                      >
                        Habilitar escritura
                      </button>
                    )}
                    {access.status === "active" && (
                      <button
                        className="button button-small button-danger"
                        disabled={busy}
                        onClick={() => void revoke(access)}
                        type="button"
                      >
                        Revocar
                      </button>
                    )}
                  </div>
                </article>
              );
            })}
          </div>
        </section>
      </section>
    </main>
  );
}
