"use client";

import Link from "next/link";
import { FormEvent, useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { apiFetch, clearOrganizationContext, setPlatformOrganizationContext } from "@/lib/api/client";

type Organization = {
  id: string;
  name: string;
  slug: string;
  is_active: boolean;
  created_at: string;
};

function slugify(value: string) {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 80);
}

export default function PlatformPage() {
  const router = useRouter();
  const [organizations, setOrganizations] = useState<Organization[]>([]);
  const [name, setName] = useState("");
  const [slug, setSlug] = useState("");
  const [adminName, setAdminName] = useState("");
  const [adminEmail, setAdminEmail] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [contextLoadingId, setContextLoadingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const loadOrganizations = useCallback(async () => {
    try {
      const response = await apiFetch<{ data: Organization[] }>("/api/v1/platform/organizations");
      setOrganizations(response.data);
      setError(null);
    } catch (cause) {
      const status = (cause as Error & { status?: number }).status;
      if (status === 401) router.replace("/login");
      else setError(cause instanceof Error ? cause.message : "No se pudieron cargar las organizaciones");
    } finally {
      setLoading(false);
    }
  }, [router]);

  useEffect(() => {
    clearOrganizationContext();
    void loadOrganizations();
  }, [loadOrganizations]);

  function updateName(value: string) {
    setName(value);
    if (!slug) setSlug(slugify(value));
  }

  async function createOrganization(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSaving(true);
    setError(null);
    setSuccess(null);
    try {
      await apiFetch("/api/v1/platform/organizations", {
        method: "POST",
        headers: { "Idempotency-Key": crypto.randomUUID() },
        body: JSON.stringify({ name, slug, adminName, adminEmail }),
      });
      setName("");
      setSlug("");
      setAdminName("");
      setAdminEmail("");
      setSuccess("Restaurante registrado y se envió una invitación al administrador.");
      await loadOrganizations();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "No se pudo registrar el restaurante");
    } finally {
      setSaving(false);
    }
  }

  async function logout() {
    await apiFetch("/api/v1/auth/logout", { method: "POST" });
    clearOrganizationContext();
    router.replace("/login");
    router.refresh();
  }

  async function openOrganization(organization: Organization) {
    setContextLoadingId(organization.id);
    setError(null);
    try {
      const response = await apiFetch<{ data: Pick<Organization, "id" | "name" | "slug"> }>(
        "/api/v1/platform/context",
        { method: "POST", body: JSON.stringify({ organizationId: organization.id }) },
      );
      setPlatformOrganizationContext(response.data);
      router.push("/dashboard/orders");
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "No se pudo abrir el contexto operativo");
    } finally {
      setContextLoadingId(null);
    }
  }

  return (
    <main className="shell module-shell">
      <nav className="nav compact-nav">
        <Link className="brand" href="/">
          Mesa Clara
        </Link>
        <div className="nav-actions">
          <span className="nav-link">Administración SaaS</span>
          <button className="button button-small" onClick={() => void logout()} type="button">
            Salir
          </button>
        </div>
      </nav>

      <div className="module-page-heading">
        <div>
          <div className="eyebrow">Control global</div>
          <h1>Administración de plataforma</h1>
        </div>
        <button className="button button-small" onClick={() => void loadOrganizations()} type="button">
          Actualizar
        </button>
      </div>

      <p className="platform-intro">
        Registra restaurantes, crea su primera cuenta administradora y controla las entidades activas del SaaS desde un
        único acceso.
      </p>
      {error && <p className="form-error">{error}</p>}
      {success && <p className="form-success">{success}</p>}

      <section className="platform-layout">
        <form className="panel-section platform-form" onSubmit={createOrganization}>
          <div className="eyebrow">Nueva entidad</div>
          <h2>Registrar restaurante</h2>
          <p className="muted-copy">
            Se creará un espacio aislado y el administrador recibirá un enlace para configurar su contraseña.
          </p>
          <label>
            Nombre del restaurante
            <input value={name} onChange={(event) => updateName(event.target.value)} required />
          </label>
          <label>
            Identificador
            <input value={slug} onChange={(event) => setSlug(slugify(event.target.value))} required />
          </label>
          <div className="form-two-col">
            <label>
              Nombre del administrador
              <input value={adminName} onChange={(event) => setAdminName(event.target.value)} required />
            </label>
            <label>
              Correo del administrador
              <input type="email" value={adminEmail} onChange={(event) => setAdminEmail(event.target.value)} required />
            </label>
          </div>
          <button className="button button-primary" disabled={saving} type="submit">
            {saving ? "Registrando..." : "Registrar restaurante"}
          </button>
        </form>

        <section className="panel-section">
          <div className="section-heading">
            <div>
              <div className="eyebrow">Entidades</div>
              <h2>Restaurantes registrados</h2>
            </div>
            <strong>{organizations.length}</strong>
          </div>
          {loading ? (
            <p className="empty-state">Cargando organizaciones...</p>
          ) : organizations.length === 0 ? (
            <p className="empty-state">Todavía no hay restaurantes registrados.</p>
          ) : (
            <div className="platform-organizations">
              {organizations.map((organization) => (
                <article className="platform-organization" key={organization.id}>
                  <div>
                    <strong>{organization.name}</strong>
                    <small>{organization.slug}</small>
                  </div>
                  <div className="platform-organization-actions">
                    <span className="status-pill available">Activa</span>
                    <button
                      className="button button-small button-secondary"
                      disabled={contextLoadingId !== null}
                      onClick={() => void openOrganization(organization)}
                      type="button"
                    >
                      {contextLoadingId === organization.id ? "Abriendo..." : "Abrir operación"}
                    </button>
                  </div>
                </article>
              ))}
            </div>
          )}
        </section>
      </section>
    </main>
  );
}
