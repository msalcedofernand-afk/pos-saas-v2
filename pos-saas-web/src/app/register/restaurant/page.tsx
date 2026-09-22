"use client";
import Link from "next/link";
import { useState, type FormEvent } from "react";
import { apiFetch } from "@/lib/api/client";
import { getBrowserAuthClient } from "@/lib/auth/browser";

export default function RegisterRestaurantPage() {
  const [busy, setBusy] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState("");
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const name = String(new FormData(event.currentTarget).get("name"));
    setBusy(true);
    setError("");
    try {
      const client = getBrowserAuthClient();
      const code = new URLSearchParams(window.location.search).get("code");
      if (code) {
        const result = await client.auth.exchangeCodeForSession(code);
        if (result.error) throw result.error;
      }
      const { data } = await client.auth.getSession();
      const headers: Record<string, string> = data.session
        ? { Authorization: `Bearer ${data.session.access_token}` }
        : {};
      await apiFetch("/api/v1/auth/onboarding", { method: "POST", headers, body: JSON.stringify({ name }) });
      window.history.replaceState({}, "", "/register/restaurant");
      setSent(true);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "No se pudo enviar la solicitud");
    } finally {
      setBusy(false);
    }
  }
  return (
    <main className="auth-shell">
      <section className="auth-card">
        <Link className="brand" href="/">
          Mesa Clara
        </Link>
        <h1>Tu restaurante</h1>
        {sent ? (
          <p role="status">
            Solicitud registrada. Tu cuenta será administradora de este restaurante cuando se apruebe el acceso. Puedes
            volver a iniciar sesión después de la aprobación.
          </p>
        ) : (
          <form className="auth-form" onSubmit={submit}>
            <p>Confirma primero el correo recibido. Si el enlace venció, inicia sesión para continuar.</p>
            <label>
              Nombre del restaurante
              <input name="name" required minLength={2} maxLength={120} />
            </label>
            {error && (
              <p className="form-error" role="alert">
                {error}
              </p>
            )}
            <button className="button button-primary" disabled={busy}>
              {busy ? "Enviando…" : "Solicitar acceso al piloto"}
            </button>
          </form>
        )}
        <p>
          <Link href="/login">Ir a iniciar sesión</Link>
        </p>
      </section>
    </main>
  );
}
