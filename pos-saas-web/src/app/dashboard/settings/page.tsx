"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { apiFetch } from "@/lib/api/client";

type Role = { id: string; name: string; display_name: string };
type UserRole = { role_id: string; roles: Role };
type User = { id: string; email: string; name: string | null; is_blocked: boolean; user_roles: UserRole[] };

export default function SettingsPage() {
  const router = useRouter();
  const [users, setUsers] = useState<User[]>([]);
  const [roles, setRoles] = useState<Role[]>([]);
  const [selected, setSelected] = useState<User | null>(null);
  const [selectedRoles, setSelectedRoles] = useState<string[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    try {
      const [userResponse, roleResponse] = await Promise.all([
        apiFetch<{ data: User[] }>("/api/v1/settings/users"),
        apiFetch<{ data: Role[] }>("/api/v1/settings/roles"),
      ]);
      setUsers(userResponse.data);
      setRoles(roleResponse.data);
      setError(null);
    } catch (cause) {
      const message = cause instanceof Error ? cause.message : "No se pudo cargar configuración";
      if (message === "No autenticado") router.replace("/login");
      else setError(message);
    }
  }, [router]);
  useEffect(() => {
    void load();
  }, [load]);
  function selectUser(user: User) {
    setSelected(user);
    setSelectedRoles(user.user_roles.map((row) => row.role_id));
  }
  function toggleRole(roleId: string) {
    setSelectedRoles((current) =>
      current.includes(roleId) ? current.filter((id) => id !== roleId) : [...current, roleId],
    );
  }
  async function saveRoles() {
    if (!selected) return;
    setSaving(true);
    try {
      await apiFetch(`/api/v1/settings/users/${selected.id}/roles`, {
        method: "PATCH",
        body: JSON.stringify({ roleIds: selectedRoles }),
      });
      await load();
      setSelected(null);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "No se pudieron guardar los roles");
    } finally {
      setSaving(false);
    }
  }

  return (
    <main className="shell module-shell">
      <nav className="nav compact-nav">
        <Link className="brand" href="/dashboard">
          ← Panel
        </Link>
        <div className="nav-actions">
          <strong>Configuración</strong>
          <Link className="button button-small" href="/dashboard">
            Volver
          </Link>
          <Link className="button button-small" href="/dashboard/subscription">
            Plan y límites
          </Link>
        </div>
      </nav>
      <div className="module-page-heading">
        <div>
          <div className="eyebrow">Administración</div>
          <h1>Configuración</h1>
        </div>
        <button className="button button-small" onClick={() => void load()}>
          Actualizar
        </button>
      </div>
      {error && <p className="form-error">{error}</p>}
      <section className="settings-layout">
        <div className="panel-section">
          <div className="section-heading">
            <div>
              <div className="eyebrow">Accesos</div>
              <h2>Usuarios y roles</h2>
            </div>
          </div>
          {users.length === 0 ? (
            <p className="empty-state">No hay usuarios registrados.</p>
          ) : (
            <div className="settings-users">
              {users.map((user) => (
                <button
                  className={selected?.id === user.id ? "settings-user selected" : "settings-user"}
                  key={user.id}
                  onClick={() => selectUser(user)}
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
            </div>
          )}
        </div>
        <div className="panel-section settings-role-panel">
          <div className="eyebrow">Roles múltiples</div>
          <h2>{selected ? selected.email : "Selecciona un usuario"}</h2>
          {selected ? (
            <>
              <div className="role-check-list">
                {roles.map((role) => (
                  <label key={role.id}>
                    <input
                      type="checkbox"
                      checked={selectedRoles.includes(role.id)}
                      onChange={() => toggleRole(role.id)}
                    />
                    {role.display_name || role.name}
                  </label>
                ))}
              </div>
              <button className="button button-primary" disabled={saving} onClick={() => void saveRoles()}>
                {saving ? "Guardando..." : "Guardar roles"}
              </button>
            </>
          ) : (
            <p className="empty-state">Elige un usuario para editar sus permisos.</p>
          )}
        </div>
      </section>
    </main>
  );
}
