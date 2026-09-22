"use client";

import Link from "next/link";
import { FormEvent, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { apiFetch } from "@/lib/api/client";
import { brand } from "@/config/brand";
import { getBrowserAuthClient } from "@/lib/auth/browser";

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const recoveryHash = window.location.hash;
    const hashParams = new URLSearchParams(recoveryHash.replace(/^#/, ""));
    const authType = hashParams.get("type");
    const isRecoveryFlow =
      authType === "recovery" ||
      authType === "invite" ||
      hashParams.has("access_token") ||
      hashParams.get("error_code") === "otp_expired";

    if (!isRecoveryFlow) return;

    // Initialize Supabase so it consumes the session fragment before the
    // password page reads the recovery session.
    getBrowserAuthClient();
    router.replace(`/auth/update-password${recoveryHash}`);
  }, [router]);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setLoading(true);

    try {
      const response = await apiFetch<{
        data: {
          roles?: string[];
        };
      }>("/api/v1/auth/login", {
        method: "POST",
        body: JSON.stringify({ email, password }),
      });
      const destination = response.data.roles?.includes("platform_admin") ? "/dashboard/platform" : "/dashboard";
      router.replace(destination);
      router.refresh();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "No se pudo iniciar sesión");
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
        <h1>Iniciar sesión</h1>
        <p className="lead auth-lead">Entra para revisar el turno, pedidos, caja y operación de tu restaurante.</p>

        <form className="auth-form" onSubmit={handleSubmit}>
          <label htmlFor="login-email">
            Correo electrónico
            <input
              id="login-email"
              type="email"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              autoComplete="email"
              required
            />
          </label>
          <label htmlFor="login-password">
            Contraseña
            <input
              id="login-password"
              type="password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              autoComplete="current-password"
              minLength={8}
              required
            />
          </label>
          {error && (
            <p className="form-error" role="alert">
              {error}
            </p>
          )}
          <button className="button button-primary" type="submit" disabled={loading}>
            {loading ? "Ingresando..." : "Ingresar"}
          </button>
          <Link className="link-button" href="/login/forgot-password">
            ¿Olvidaste tu contraseña?
          </Link>
        </form>
      </section>
    </main>
  );
}
