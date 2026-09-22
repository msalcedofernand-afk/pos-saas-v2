"use client";
import Link from "next/link";
import { useState, type FormEvent } from "react";
import { getBrowserAuthClient } from "@/lib/auth/browser";

export default function RegisterPage() {
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    setBusy(true);
    setError("");
    setMessage("");
    try {
      const password = String(form.get("password"));
      if (password !== form.get("confirm")) throw new Error("Las contraseñas no coinciden");
      const { error: authError } = await getBrowserAuthClient().auth.signUp({
        email: String(form.get("email")).trim(),
        password,
        options: { emailRedirectTo: `${window.location.origin}/register/restaurant` },
      });
      if (authError) throw authError;
      setMessage(
        "Revisa tu correo para confirmar la cuenta. Si ya tienes una cuenta, inicia sesión o recupera tu contraseña.",
      );
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "No se pudo crear la cuenta");
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
        <h1>Crear cuenta</h1>
        <p>Solicita acceso al piloto gratuito. Tu restaurante se habilitará después de la aprobación.</p>
        <form className="auth-form" onSubmit={submit}>
          <label>
            Correo electrónico
            <input name="email" type="email" autoComplete="email" maxLength={254} required />
          </label>
          <label>
            Contraseña
            <input
              name="password"
              type="password"
              autoComplete="new-password"
              minLength={12}
              maxLength={128}
              required
            />
          </label>
          <label>
            Repite tu contraseña
            <input name="confirm" type="password" autoComplete="new-password" minLength={12} maxLength={128} required />
          </label>
          <p>Usa al menos 12 caracteres.</p>
          {error && (
            <p className="form-error" role="alert">
              {error}
            </p>
          )}
          {message && (
            <p className="form-success" role="status">
              {message}
            </p>
          )}
          <button className="button button-primary" disabled={busy || Boolean(message)}>
            {busy ? "Creando…" : "Crear cuenta"}
          </button>
          <Link href="/register/restaurant">Ya confirmé mi correo</Link>
          <Link href="/login">Ya tengo cuenta · Iniciar sesión</Link>
        </form>
      </section>
    </main>
  );
}
