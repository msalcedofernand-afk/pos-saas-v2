"use client";

import { FormEvent, useEffect, useState } from "react";
import { apiFetch } from "@/lib/api/client";

type Ticket = {
  id: string;
  subject: string;
  description: string;
  priority: string;
  status: string;
  organization_id: string | null;
  updated_at: string;
};

export default function PlatformTicketsPage() {
  const [tickets, setTickets] = useState<Ticket[]>([]);
  const [subject, setSubject] = useState("");
  const [description, setDescription] = useState("");
  const [priority, setPriority] = useState("normal");
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  async function load() {
    try {
      setTickets((await apiFetch<{ data: Ticket[] }>("/api/v1/platform/tickets")).data);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "No se pudieron cargar los tickets");
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
      await apiFetch("/api/v1/platform/tickets", {
        method: "POST",
        body: JSON.stringify({ subject, description, priority }),
      });
      setSubject("");
      setDescription("");
      await load();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "No se pudo crear el ticket");
    } finally {
      setSaving(false);
    }
  }
  return (
    <main className="module-page">
      <div className="module-page-heading">
        <div>
          <div className="eyebrow">Gobierno SaaS</div>
          <h1>Tickets de soporte</h1>
          <p className="muted-copy">Registra y da seguimiento a solicitudes de restaurantes.</p>
        </div>
      </div>
      <section className="platform-layout">
        <form className="panel-section platform-form" onSubmit={submit}>
          <div className="eyebrow">Nuevo ticket</div>
          <label>
            Asunto
            <input value={subject} maxLength={160} onChange={(e) => setSubject(e.target.value)} required />
          </label>
          <label>
            Descripción
            <textarea value={description} maxLength={5000} onChange={(e) => setDescription(e.target.value)} required />
          </label>
          <label>
            Prioridad
            <select value={priority} onChange={(e) => setPriority(e.target.value)}>
              <option value="low">Baja</option>
              <option value="normal">Normal</option>
              <option value="high">Alta</option>
              <option value="urgent">Urgente</option>
            </select>
          </label>
          <button className="button button-primary" disabled={saving} type="submit">
            {saving ? "Guardando…" : "Crear ticket"}
          </button>
          {error && <p className="form-error">{error}</p>}
        </form>
        <section className="panel-section">
          <div className="section-heading">
            <div>
              <div className="eyebrow">Cola operativa</div>
              <h2>Tickets recientes</h2>
            </div>
            <strong>{tickets.length}</strong>
          </div>
          {tickets.length === 0 ? (
            <p className="empty-state">No hay tickets registrados.</p>
          ) : (
            <div className="platform-organizations">
              {tickets.map((ticket) => (
                <article className="platform-organization" key={ticket.id}>
                  <div>
                    <strong>{ticket.subject}</strong>
                    <small>{ticket.description}</small>
                  </div>
                  <div className="platform-organization-actions">
                    <span className="status-pill available">{ticket.status}</span>
                    <span className="status-pill">{ticket.priority}</span>
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
