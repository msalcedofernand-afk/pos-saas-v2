"use client";
import { useState, type FormEvent } from "react";
import { apiFetch } from "@/lib/api/client";
export function InviteWorker() {
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const element = event.currentTarget;
    const form = new FormData(element);
    setBusy(true);
    setMessage("");
    try {
      await apiFetch("/api/v1/settings/invitations", {
        method: "POST",
        body: JSON.stringify({ name: form.get("name"), email: form.get("email"), role: form.get("role") }),
      });
      setMessage("Invitación enviada. El trabajador elegirá su contraseña desde el correo.");
      element.reset();
    } catch (cause) {
      setMessage(cause instanceof Error ? cause.message : "No se pudo invitar");
    } finally {
      setBusy(false);
    }
  }
  return (
    <form className="panel-section platform-form" onSubmit={submit}>
      <h2>Invitar trabajador</h2>
      <p>Cada persona configura su contraseña desde su correo.</p>
      <label>
        Nombre
        <input name="name" required minLength={2} maxLength={120} />
      </label>
      <label>
        Correo
        <input name="email" type="email" required maxLength={254} />
      </label>
      <label>
        Rol
        <select name="role">
          <option value="waiter">Mesero</option>
          <option value="cashier">Cajero</option>
          <option value="kitchen">Cocina</option>
          <option value="manager">Encargado</option>
          <option value="staff">Personal</option>
        </select>
      </label>
      <button className="button button-primary" disabled={busy}>
        {busy ? "Enviando…" : "Enviar invitación"}
      </button>
      {message && <p role="status">{message}</p>}
    </form>
  );
}
