"use client";

import { FormEvent, useEffect, useState } from "react";
import { apiFetch } from "@/lib/api/client";

type Incident = { id: string; title: string; summary: string; severity: string; status: string; created_at: string };

export default function PlatformIncidentsPage() {
  const [incidents, setIncidents] = useState<Incident[]>([]);
  const [title, setTitle] = useState("");
  const [summary, setSummary] = useState("");
  const [severity, setSeverity] = useState("minor");
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  async function load() {
    try {
      setIncidents((await apiFetch<{ data: Incident[] }>("/api/v1/platform/incidents")).data);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "No se pudieron cargar incidentes");
    }
  }
  useEffect(() => {
    void load();
  }, []);
  async function submit(event: FormEvent) {
    event.preventDefault();
    setSaving(true);
    setError(null);
    try {
      await apiFetch("/api/v1/platform/incidents", {
        method: "POST",
        body: JSON.stringify({ title, summary, severity }),
      });
      setTitle("");
      setSummary("");
      await load();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "No se pudo crear el incidente");
    } finally {
      setSaving(false);
    }
  }
  return (
    <main className="module-page">
      <div className="module-page-heading">
        <div>
          <div className="eyebrow">Continuidad operativa</div>
          <h1>Incidentes</h1>
          <p className="muted-copy">Registra interrupciones y conserva el historial de recuperación.</p>
        </div>
      </div>
      <section className="platform-layout">
        <form className="panel-section platform-form" onSubmit={submit}>
          <div className="eyebrow">Registrar incidente</div>
          <label>
            Título
            <input value={title} maxLength={160} onChange={(e) => setTitle(e.target.value)} required />
          </label>
          <label>
            Resumen
            <textarea value={summary} maxLength={5000} onChange={(e) => setSummary(e.target.value)} required />
          </label>
          <label>
            Severidad
            <select value={severity} onChange={(e) => setSeverity(e.target.value)}>
              <option value="minor">Menor</option>
              <option value="major">Mayor</option>
              <option value="critical">Crítica</option>
            </select>
          </label>
          <button className="button button-primary" disabled={saving} type="submit">
            {saving ? "Guardando…" : "Registrar incidente"}
          </button>
          {error && <p className="form-error">{error}</p>}
        </form>
        <section className="panel-section">
          <div className="section-heading">
            <div>
              <div className="eyebrow">Registro</div>
              <h2>Incidentes recientes</h2>
            </div>
            <strong>{incidents.length}</strong>
          </div>
          {incidents.length === 0 ? (
            <p className="empty-state">No hay incidentes registrados.</p>
          ) : (
            <div className="platform-organizations">
              {incidents.map((incident) => (
                <article className="platform-organization" key={incident.id}>
                  <div>
                    <strong>{incident.title}</strong>
                    <small>{incident.summary}</small>
                  </div>
                  <div className="platform-organization-actions">
                    <span className={`status-pill ${incident.severity === "critical" ? "unavailable" : "available"}`}>
                      {incident.severity}
                    </span>
                    <span className="status-pill">{incident.status}</span>
                  </div>
                </article>
              ))}
            </div>
          )}
        </section>
      </section>
    </main>
  );
}
