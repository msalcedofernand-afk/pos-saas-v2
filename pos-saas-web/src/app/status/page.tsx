"use client";

import Link from "next/link";
import { brand } from "@/config/brand";
import { useApiHealth } from "@/hooks/useApiHealth";

function statusLabel(status: "checking" | "online" | "offline") {
  if (status === "online") return "Operativa";
  if (status === "offline") return "Con problemas";
  return "Verificando";
}

export default function StatusPage() {
  const { health, refresh } = useApiHealth();
  const checkedAt = health.checkedAt?.toLocaleTimeString("es-PE", { hour: "2-digit", minute: "2-digit" });

  return (
    <main className="shell status-shell">
      <nav className="nav compact-nav">
        <Link className="brand" href="/">
          {brand.name}
        </Link>
        <div className="nav-actions">
          <Link className="button button-primary button-small" href="/login">
            Ingresar
          </Link>
        </div>
      </nav>

      <section className="status-hero">
        <div className="eyebrow">Estado del servicio</div>
        <h1>Todo lo que necesitas, funcionando.</h1>
        <p>Comprobamos la conexión con Mesa Clara y su base de datos en tiempo real.</p>
      </section>

      <section className={`status-overview status-${health.status}`} aria-live="polite">
        <span className="status-dot" />
        <div>
          <strong>{statusLabel(health.status)}</strong>
          <small>{checkedAt ? `Última comprobación: ${checkedAt}` : "Comprobando disponibilidad…"}</small>
        </div>
        <button className="button button-secondary button-small" onClick={() => void refresh()} type="button">
          Actualizar
        </button>
      </section>

      <section className="status-grid" aria-label="Estado de los servicios">
        <article className="status-card">
          <span>API Mesa Clara</span>
          <strong>{health.apiStatus ?? "—"}</strong>
          <small>{health.latencyMs !== null ? `${health.latencyMs} ms de respuesta` : "Esperando respuesta"}</small>
        </article>
        <article className="status-card">
          <span>Base de datos</span>
          <strong>{health.supabaseStatus ?? "—"}</strong>
          <small>Conexión verificada por el servidor</small>
        </article>
      </section>

      {health.error && <p className="form-error">{health.error}. Intenta actualizar en unos segundos.</p>}
      <p className="status-footnote">
        Si ves un problema persistente, guarda la hora de la incidencia y contacta al administrador de tu cuenta.
      </p>
    </main>
  );
}
