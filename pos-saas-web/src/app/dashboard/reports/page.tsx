"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { apiFetch } from "@/lib/api/client";

type Report = { date: string; orders: number; paidOrders: number; cancelled: number; sales: number; paymentsByMethod: Record<string, number> };

export default function ReportsPage() {
  const router = useRouter();
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10));
  const [report, setReport] = useState<Report | null>(null);
  const [error, setError] = useState<string | null>(null);
  async function load() { try { setReport((await apiFetch<{ data: Report }>(`/api/v1/reports/summary?date=${date}`)).data); setError(null); } catch (cause) { const message = cause instanceof Error ? cause.message : "No se pudo cargar reporte"; if (message === "No autenticado") router.replace("/login"); else setError(message); } }
  useEffect(() => { void load(); }, [date]);
  return <main className="shell module-shell"><nav className="nav compact-nav"><Link className="brand" href="/dashboard">← Panel</Link><div className="nav-actions"><strong>Reportes</strong><Link className="button button-small" href="/dashboard">Volver</Link></div></nav><div className="module-page-heading"><div><div className="eyebrow">Indicadores</div><h1>Reportes</h1></div><input className="report-date" type="date" value={date} onChange={(event) => setDate(event.target.value)} /></div>{error && <p className="form-error">{error}</p>}<section className="report-stats"><div><span>Ventas pagadas</span><strong>S/ {(report?.sales ?? 0).toFixed(2)}</strong></div><div><span>Pedidos</span><strong>{report?.orders ?? 0}</strong></div><div><span>Pagados</span><strong>{report?.paidOrders ?? 0}</strong></div><div><span>Cancelados</span><strong>{report?.cancelled ?? 0}</strong></div></section><section className="panel-section"><div className="eyebrow">Métodos de pago</div><h2>Distribución del día</h2>{Object.keys(report?.paymentsByMethod ?? {}).length === 0 ? <p className="empty-state">No hay pagos registrados para esta fecha.</p> : <div className="payment-report">{Object.entries(report?.paymentsByMethod ?? {}).map(([method, amount]) => <div key={method}><span>{method}</span><strong>S/ {amount.toFixed(2)}</strong></div>)}</div>}</section></main>;
}
