"use client";
import { useState, useEffect, type FormEvent } from "react";
import { apiFetch } from "@/lib/api/client";

export default function PlatformAccessPage() {
  const [users, setUsers] = useState<Array<{ id: string; email: string }>>([]);
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    apiFetch<{ data: Array<{ id: string; email: string }> }>("/api/v1/platform/users")
      .then((r) => setUsers(r.data))
      .catch((e) => setMessage(e.message));
  }, []);
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    if (!window.confirm("¿Confirmas este cambio de acceso global?")) return;
    setBusy(true);
    try {
      await apiFetch(`/api/v1/platform/users/${form.get("user")}/global-role`, {
        method: "PATCH",
        body: JSON.stringify({ role: form.get("role"), grant: form.get("action") === "grant" }),
      });
      setMessage("Cambio registrado en auditoría.");
    } catch (cause) {
      setMessage(cause instanceof Error ? cause.message : "No se pudo cambiar el acceso");
    } finally {
      setBusy(false);
    }
  }
  return (
    <main className="shell module-shell">
      <h1>Accesos globales</h1>
      <p>Solo el propietario puede otorgar y revocar estos permisos. La cuenta destinataria debe estar registrada.</p>
      <form className="panel-section platform-form" onSubmit={submit}>
        <label>
          Cuenta
          <select name="user" required>
            {users.map((user) => (
              <option key={user.id} value={user.id}>
                {user.email}
              </option>
            ))}
          </select>
        </label>
        <label>
          Rol
          <select name="role">
            <option value="support_agent">Soporte</option>
            <option value="platform_admin">Administrador de plataforma</option>
            <option value="billing_admin">Facturación</option>
            <option value="security_auditor">Auditoría</option>
          </select>
        </label>
        <label>
          Acción
          <select name="action">
            <option value="grant">Otorgar</option>
            <option value="revoke">Revocar</option>
          </select>
        </label>
        <button className="button button-primary" disabled={busy || !users.length}>
          Guardar cambio
        </button>
        {message && <p role="status">{message}</p>}
      </form>
    </main>
  );
}
