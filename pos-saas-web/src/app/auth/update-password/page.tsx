"use client";

import Link from "next/link";
import { FormEvent, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { brand } from "@/config/brand";
import { getBrowserAuthClient } from "@/lib/auth/browser";

export default function UpdatePasswordPage() {
  const router = useRouter();
  const [password, setPassword] = useState("");
  const [confirmation, setConfirmation] = useState("");
  const [ready, setReady] = useState(false);
  const [checking, setChecking] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    let mounted = true;
    let invalidLinkTimer: number | undefined;

    try {
      const supabase = getBrowserAuthClient();

      const hashParams = new URLSearchParams(window.location.hash.replace(/^#/, ""));
      if (hashParams.get("error_description") || hashParams.get("error_code")) {
        setError("El enlace de recuperación no es válido o ya expiró. Solicita uno nuevo.");
        setChecking(false);
      }

      const subscription = supabase.auth.onAuthStateChange((event, session) => {
        if (!mounted) return;
        if (event === "PASSWORD_RECOVERY" || Boolean(session)) {
          window.clearTimeout(invalidLinkTimer);
          setReady(true);
          setChecking(false);
        }
      });

      void supabase.auth.getSession().then(({ data }) => {
        if (!mounted) return;
        if (data.session) {
          setReady(true);
          setChecking(false);
          return;
        }

        invalidLinkTimer = window.setTimeout(() => {
          if (mounted) setChecking(false);
        }, 10000);
      });

      return () => {
        mounted = false;
        window.clearTimeout(invalidLinkTimer);
        subscription.data.subscription.unsubscribe();
      };
    } catch (cause) {
      if (mounted) {
        setChecking(false);
        setError(cause instanceof Error ? cause.message : "No se pudo validar el enlace");
      }
    }

    return () => {
      mounted = false;
      window.clearTimeout(invalidLinkTimer);
    };
  }, []);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);

    if (password.length < 8) {
      setError("La contraseña debe tener al menos 8 caracteres.");
      return;
    }
    if (password !== confirmation) {
      setError("Las contraseñas no coinciden.");
      return;
    }

    setLoading(true);
    try {
      const { error: updateError } = await getBrowserAuthClient().auth.updateUser({ password });
      if (updateError) throw updateError;
      await getBrowserAuthClient().auth.signOut();
      router.replace("/login?reset=1");
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "No se pudo actualizar la contraseña");
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
        <h1>Nueva contraseña</h1>
        <p className="lead auth-lead">Configura una contraseña para entrar al panel.</p>

        <form className="auth-form" onSubmit={handleSubmit}>
          <label htmlFor="new-password">
            Nueva contraseña
            <input
              id="new-password"
              type="password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              minLength={8}
              required
            />
          </label>
          <label htmlFor="confirm-password">
            Repite la contraseña
            <input
              id="confirm-password"
              type="password"
              value={confirmation}
              onChange={(event) => setConfirmation(event.target.value)}
              minLength={8}
              required
            />
          </label>
          {checking && (
            <p className="muted-copy" role="status">
              Validando el enlace...
            </p>
          )}
          {!checking && !ready && (
            <p className="form-error" role="alert">
              El enlace no es válido o ya expiró. Solicita otro enlace.
            </p>
          )}
          {error && (
            <p className="form-error" role="alert">
              {error}
            </p>
          )}
          <button className="button button-primary" type="submit" disabled={loading || !ready}>
            {loading ? "Guardando..." : "Guardar contraseña"}
          </button>
          <Link className="link-button" href="/login">
            Volver a iniciar sesión
          </Link>
        </form>
      </section>
    </main>
  );
}
