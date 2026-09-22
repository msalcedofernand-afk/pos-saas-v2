"use client";

import Link from "next/link";
import { FormEvent, useState } from "react";
import { brand } from "@/config/brand";
import { getBrowserAuthClient } from "@/lib/auth/browser";

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState("");
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setMessage(null);
    setLoading(true);

    try {
      const supabase = getBrowserAuthClient();
      const configuredSiteUrl = process.env.NEXT_PUBLIC_SITE_URL?.trim().replace(/\/+$/, "");
      const redirectTo = `${configuredSiteUrl || window.location.origin}/auth/update-password`;
      const { error: resetError } = await supabase.auth.resetPasswordForEmail(email, { redirectTo });
      if (resetError) throw resetError;
      setMessage("Si el correo existe, recibirás un enlace para crear una contraseña nueva.");
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "No se pudo enviar el enlace");
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="auth-shell">
      <section className="auth-card">
        <div className="auth-brand-lockup">
          <span className="auth-brand-mark" aria-hidden="true">
            MC
          </span>
          <div>
            <div className="auth-brand-name">{brand.name}</div>
            <div className="auth-brand-context">Panel operativo</div>
          </div>
        </div>
        <h1>Recuperar acceso</h1>
        <p className="lead auth-lead">Te enviaremos un enlace para crear una contraseña nueva.</p>

        <form className="auth-form" onSubmit={handleSubmit}>
          <label htmlFor="recovery-email">
            Correo electrónico
            <input
              id="recovery-email"
              type="email"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              autoComplete="email"
              required
            />
          </label>
          {message && (
            <p className="muted-copy" role="status">
              {message}
            </p>
          )}
          {error && (
            <p className="form-error" role="alert">
              {error}
            </p>
          )}
          <button className="button button-primary" type="submit" disabled={loading}>
            {loading ? "Enviando..." : "Enviar enlace"}
          </button>
          <Link className="link-button" href="/login">
            Volver a iniciar sesión
          </Link>
        </form>
      </section>
    </main>
  );
}
