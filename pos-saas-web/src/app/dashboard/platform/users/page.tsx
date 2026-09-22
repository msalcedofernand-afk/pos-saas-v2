"use client";

import Link from "next/link";
import { FormEvent, useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { apiFetch, clearOrganizationContext } from "@/lib/api/client";

type Role = { id: string; name: string; display_name: string };
type Membership = {
  organizationId: string;
  isDefault: boolean;
  roles: Role[];
  organization: { id: string; name: string; slug: string; status: string } | null;
};
type User = {
  id: string;
  email: string;
  name: string | null;
  is_blocked: boolean;
  globalRoles: Role[];
  memberships: Membership[];
};
type Organization = { id: string; name: string; slug: string; status: string };

export default function PlatformUsersPage() {
  const router = useRouter();
  const [users, setUsers] = useState<User[]>([]);
  const [organizations, setOrganizations] = useState<Organization[]>([]);
  const [roles, setRoles] = useState<Role[]>([]);
  const [selected, setSelected] = useState<User | null>(null);
  const [selectedOrganizationId, setSelectedOrganizationId] = useState("");
  const [selectedRoleIds, setSelectedRoleIds] = useState<string[]>([]);
  const [search, setSearch] = useState("");
  const [organizationFilter, setOrganizationFilter] = useState("");
  const [inviteEmail, setInviteEmail] = useState("");
  const [inviteName, setInviteName] = useState("");
  const [inviteOrganizationId, setInviteOrganizationId] = useState("");
  const [inviteRoleIds, setInviteRoleIds] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const params = new URLSearchParams();
      if (search.trim()) params.set("search", search.trim());
      if (organizationFilter) params.set("organizationId", organizationFilter);
      const [userResponse, organizationResponse, roleResponse] = await Promise.all([
        apiFetch<{ data: User[] }>(`/api/v1/platform/users?${params.toString()}`),
        apiFetch<{ data: Organization[] }>("/api/v1/platform/organizations"),
        apiFetch<{ data: Role[] }>("/api/v1/settings/roles"),
      ]);
      setUsers(userResponse.data);
      setOrganizations(organizationResponse.data);
      setRoles(roleResponse.data);
      setError(null);
    } catch (cause) {
      const status = (cause as Error & { status?: number }).status;
      if (status === 401) router.replace("/login");
      else setError(cause instanceof Error ? cause.message : "No se pudo cargar la administración de usuarios");
    }
  }, [organizationFilter, router, search]);

  useEffect(() => {
    clearOrganizationContext();
    void load();
  }, [load]);

  function selectUser(user: User) {
    setSelected(user);
    const membership = user.memberships[0];
    setSelectedOrganizationId(membership?.organizationId ?? "");
    setSelectedRoleIds(membership?.roles.map((role) => role.id) ?? []);
    setSuccess(null);
  }

  function toggleRole(roleId: string, setter: (value: (current: string[]) => string[]) => void) {
    setter((current) => (current.includes(roleId) ? current.filter((id) => id !== roleId) : [...current, roleId]));
  }

  const selectedMembership = useMemo(
    () => selected?.memberships.find((membership) => membership.organizationId === selectedOrganizationId) ?? null,
    [selected, selectedOrganizationId],
  );

  async function runUserAction(user: User, action: "block" | "unblock" | "invite") {
    setBusy(true);
    setError(null);
    setSuccess(null);
    try {
      const path =
        action === "invite"
          ? `/api/v1/platform/users/${user.id}/invite`
          : `/api/v1/platform/users/${user.id}/${action}`;
      await apiFetch(path, {
        method: "POST",
        ...(action === "invite" ? {} : { headers: { "Idempotency-Key": crypto.randomUUID() } }),
      });
      setSuccess(
        action === "invite"
          ? "Invitación reenviada."
          : action === "block"
            ? "Usuario bloqueado."
            : "Usuario desbloqueado.",
      );
      await load();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "No se pudo completar la acción");
    } finally {
      setBusy(false);
    }
  }

  async function saveMembership() {
    if (!selected || !selectedOrganizationId || selectedRoleIds.length === 0) return;
    setBusy(true);
    setError(null);
    try {
      await apiFetch(`/api/v1/platform/organizations/${selectedOrganizationId}/members/${selected.id}`, {
        method: "PATCH",
        headers: { "Idempotency-Key": crypto.randomUUID() },
        body: JSON.stringify({ roleIds: selectedRoleIds }),
      });
      setSuccess("Roles actualizados y auditados.");
      await load();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "No se pudieron actualizar los roles");
    } finally {
      setBusy(false);
    }
  }

  async function revokeMembership() {
    if (!selected || !selectedMembership) return;
    setBusy(true);
    setError(null);
    try {
      await apiFetch(`/api/v1/platform/organizations/${selectedMembership.organizationId}/members/${selected.id}`, {
        method: "DELETE",
        headers: { "Idempotency-Key": crypto.randomUUID() },
      });
      setSuccess("Membresía revocada.");
      await load();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "No se pudo revocar la membresía");
    } finally {
      setBusy(false);
    }
  }

  async function addMember(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!inviteOrganizationId || inviteRoleIds.length === 0) return;
    setBusy(true);
    setError(null);
    try {
      await apiFetch(`/api/v1/platform/organizations/${inviteOrganizationId}/members`, {
        method: "POST",
        headers: { "Idempotency-Key": crypto.randomUUID() },
        body: JSON.stringify({ email: inviteEmail, name: inviteName || undefined, roleIds: inviteRoleIds }),
      });
      setInviteEmail("");
      setInviteName("");
      setSuccess("Usuario agregado; si era nuevo, recibió una invitación.");
      await load();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "No se pudo agregar el usuario");
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
          <span className="nav-link">Usuarios y membresías</span>
          <Link className="button button-small" href="/dashboard/platform">
            Restaurantes
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
          <div className="eyebrow">Control global</div>
          <h1>Usuarios y membresías</h1>
        </div>
        <button className="button button-small" onClick={() => void load()} type="button">
          Actualizar
        </button>
      </div>
      <p className="platform-intro">
        Administra accesos de todos los restaurantes, reenvía invitaciones y conserva una auditoría de cada cambio.
      </p>
      {error && <p className="form-error">{error}</p>}
      {success && <p className="form-success">{success}</p>}

      <section className="platform-users-toolbar">
        <input
          aria-label="Buscar usuario"
          onChange={(event) => setSearch(event.target.value)}
          placeholder="Buscar por correo o nombre"
          value={search}
        />
        <select
          aria-label="Filtrar por restaurante"
          onChange={(event) => setOrganizationFilter(event.target.value)}
          value={organizationFilter}
        >
          <option value="">Todos los restaurantes</option>
          {organizations.map((organization) => (
            <option key={organization.id} value={organization.id}>
              {organization.name}
            </option>
          ))}
        </select>
      </section>

      <section className="platform-users-layout">
        <div className="panel-section">
          <div className="section-heading">
            <div>
              <div className="eyebrow">Directorio global</div>
              <h2>{users.length} usuarios</h2>
            </div>
          </div>
          <div className="platform-user-list">
            {users.map((user) => (
              <button
                className={selected?.id === user.id ? "platform-user-card selected" : "platform-user-card"}
                key={user.id}
                onClick={() => selectUser(user)}
                type="button"
              >
                <span>
                  <strong>{user.name || user.email}</strong>
                  <small>{user.email}</small>
                </span>
                <span className={user.is_blocked ? "status-pill unavailable" : "status-pill available"}>
                  {user.is_blocked ? "Bloqueado" : "Activo"}
                </span>
              </button>
            ))}
            {users.length === 0 && <p className="empty-state">No hay usuarios que coincidan con el filtro.</p>}
          </div>
        </div>

        <div className="panel-section platform-user-detail">
          <div className="eyebrow">Gestión de acceso</div>
          {selected ? (
            <>
              <h2>{selected.name || selected.email}</h2>
              <p className="muted-copy">{selected.email}</p>
              <div className="platform-user-actions">
                <button
                  className="button button-secondary"
                  disabled={busy}
                  onClick={() => void runUserAction(selected, "invite")}
                  type="button"
                >
                  Reenviar invitación
                </button>
                <button
                  className="button button-secondary"
                  disabled={busy}
                  onClick={() => void runUserAction(selected, selected.is_blocked ? "unblock" : "block")}
                  type="button"
                >
                  {selected.is_blocked ? "Desbloquear" : "Bloquear"}
                </button>
              </div>
              <label>
                Restaurante de la membresía
                <select
                  onChange={(event) => {
                    const value = event.target.value;
                    setSelectedOrganizationId(value);
                    const membership = selected.memberships.find((item) => item.organizationId === value);
                    setSelectedRoleIds(membership?.roles.map((role) => role.id) ?? []);
                  }}
                  value={selectedOrganizationId}
                >
                  <option value="">Selecciona un restaurante</option>
                  {selected.memberships.map((membership) => (
                    <option key={membership.organizationId} value={membership.organizationId}>
                      {membership.organization?.name ?? membership.organizationId}
                    </option>
                  ))}
                </select>
              </label>
              {selectedMembership && (
                <>
                  <div className="role-check-list">
                    {roles.map((role) => (
                      <label key={role.id}>
                        <input
                          checked={selectedRoleIds.includes(role.id)}
                          onChange={() => toggleRole(role.id, setSelectedRoleIds)}
                          type="checkbox"
                        />
                        {role.display_name || role.name}
                      </label>
                    ))}
                  </div>
                  <div className="platform-user-actions">
                    <button
                      className="button button-primary"
                      disabled={busy || selectedRoleIds.length === 0}
                      onClick={() => void saveMembership()}
                      type="button"
                    >
                      Guardar roles
                    </button>
                    <button
                      className="button button-danger"
                      disabled={busy}
                      onClick={() => void revokeMembership()}
                      type="button"
                    >
                      Revocar membresía
                    </button>
                  </div>
                </>
              )}
              <div className="platform-membership-tags">
                {selected.memberships.map((membership) => (
                  <span className="status-pill" key={membership.organizationId}>
                    {membership.organization?.name ?? membership.organizationId} ·{" "}
                    {membership.roles.map((role) => role.display_name || role.name).join(", ") || "Sin rol"}
                  </span>
                ))}
              </div>
            </>
          ) : (
            <p className="empty-state">Selecciona un usuario para administrar su acceso.</p>
          )}
        </div>
      </section>

      <form className="panel-section platform-add-member" onSubmit={addMember}>
        <div className="eyebrow">Nueva membresía</div>
        <h2>Agregar usuario a un restaurante</h2>
        <div className="form-two-col">
          <label>
            Correo
            <input required onChange={(event) => setInviteEmail(event.target.value)} type="email" value={inviteEmail} />
          </label>
          <label>
            Nombre (si es nuevo)
            <input onChange={(event) => setInviteName(event.target.value)} value={inviteName} />
          </label>
        </div>
        <div className="form-two-col">
          <label>
            Restaurante
            <select
              required
              onChange={(event) => setInviteOrganizationId(event.target.value)}
              value={inviteOrganizationId}
            >
              <option value="">Selecciona un restaurante</option>
              {organizations.map((organization) => (
                <option key={organization.id} value={organization.id}>
                  {organization.name}
                </option>
              ))}
            </select>
          </label>
          <div className="role-check-list inline">
            {roles.map((role) => (
              <label key={role.id}>
                <input
                  checked={inviteRoleIds.includes(role.id)}
                  onChange={() => toggleRole(role.id, setInviteRoleIds)}
                  type="checkbox"
                />
                {role.display_name || role.name}
              </label>
            ))}
          </div>
        </div>
        <button className="button button-primary" disabled={busy || inviteRoleIds.length === 0} type="submit">
          {busy ? "Procesando..." : "Agregar o invitar usuario"}
        </button>
      </form>
    </main>
  );
}
