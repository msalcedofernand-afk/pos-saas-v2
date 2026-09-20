"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { apiFetch } from "@/lib/api/client";

type Shift = { id: string; opened_at: string; opening_amount: number; status: string };
type CashOrder = { id: string; total_amount: number; created_at: string; table: { name: string } | null };
type CashData = { shift: Shift | null; pendingOrders: CashOrder[]; totalPaid: number };

export default function CashPage() {
  const router = useRouter();
  const [data, setData] = useState<CashData>({ shift: null, pendingOrders: [], totalPaid: 0 });
  const [openingAmount, setOpeningAmount] = useState("0");
  const [closingAmount, setClosingAmount] = useState("");
  const [method, setMethod] = useState("cash");
  const [paymentOrder, setPaymentOrder] = useState<CashOrder | null>(null);
  const [paymentAmount, setPaymentAmount] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function load() {
    try { setData((await apiFetch<{ data: CashData }>("/api/v1/cash/summary")).data); setError(null); }
    catch (cause) { const message = cause instanceof Error ? cause.message : "No se pudo cargar caja"; if (message === "No autenticado") router.replace("/login"); else setError(message); }
  }
  useEffect(() => { void load(); }, []);

  async function openCash() {
    setBusy(true);
    try { await apiFetch("/api/v1/cash/open", { method: "POST", body: JSON.stringify({ openingAmount: Number(openingAmount) }) }); await load(); }
    catch (cause) { setError(cause instanceof Error ? cause.message : "No se pudo abrir caja"); }
    finally { setBusy(false); }
  }

  function openPayment(order: CashOrder) { setPaymentOrder(order); setPaymentAmount(String(order.total_amount)); setError(null); }

  async function submitPayment() {
    if (!paymentOrder) return;
    const amount = Number(paymentAmount);
    if (!Number.isFinite(amount) || amount <= 0) { setError("Ingresa un monto válido"); return; }
    setBusy(true);
    try { await apiFetch("/api/v1/cash/payments", { method: "POST", body: JSON.stringify({ orderId: paymentOrder.id, method, amount, changeAmount: Math.max(0, amount - Number(paymentOrder.total_amount)) }) }); setPaymentOrder(null); await load(); }
    catch (cause) { setError(cause instanceof Error ? cause.message : "No se pudo registrar el pago"); }
    finally { setBusy(false); }
  }

  async function closeCash() {
    const amount = Number(closingAmount);
    if (!Number.isFinite(amount) || amount < 0) { setError("Ingresa el monto final de caja"); return; }
    setBusy(true);
    try { await apiFetch("/api/v1/cash/close", { method: "POST", body: JSON.stringify({ closingAmount: amount }) }); await load(); setClosingAmount(""); }
    catch (cause) { setError(cause instanceof Error ? cause.message : "No se pudo cerrar caja"); }
    finally { setBusy(false); }
  }

  return <main className="shell module-shell"><nav className="nav compact-nav"><Link className="brand" href="/dashboard">← Panel</Link><div className="nav-actions"><strong>Caja</strong><Link className="button button-small" href="/dashboard">Volver</Link></div></nav><div className="module-page-heading"><div><div className="eyebrow">Cobros y turnos</div><h1>Caja</h1></div><button className="button button-small" onClick={() => void load()}>Actualizar</button></div>{error && <p className="form-error">{error}</p>}{!data.shift ? <section className="cash-opening panel-section"><div className="eyebrow">Inicio de turno</div><h2>Abrir caja</h2><p className="empty-state">Registra el monto inicial antes de empezar a cobrar.</p><div className="inline-form"><label>Monto inicial<input type="number" min="0" step="0.01" value={openingAmount} onChange={(event) => setOpeningAmount(event.target.value)} /></label><button className="button button-primary" disabled={busy} onClick={() => void openCash()}>Abrir caja</button></div></section> : <><section className="cash-header panel-section"><div><div className="eyebrow">Turno abierto</div><h2>Operación actual</h2><small>Desde {new Date(data.shift.opened_at).toLocaleTimeString()}</small></div><div className="cash-total"><span>Total cobrado</span><strong>S/ {data.totalPaid.toFixed(2)}</strong></div><div className="cash-close"><input type="number" min="0" placeholder="Monto final" value={closingAmount} onChange={(event) => setClosingAmount(event.target.value)} /><button className="button button-small" disabled={busy || data.pendingOrders.length > 0} onClick={() => void closeCash()}>Cerrar caja</button></div></section><section className="cash-orders panel-section"><div className="section-heading"><div><div className="eyebrow">Cobros pendientes</div><h2>Pedidos servidos</h2></div><div className="payment-method"><label>Método<select value={method} onChange={(event) => setMethod(event.target.value)}><option value="cash">Efectivo</option><option value="card">Tarjeta</option><option value="yape">Yape</option><option value="plin">Plin</option><option value="transfer">Transferencia</option><option value="qr">QR</option></select></label></div></div>{data.pendingOrders.length === 0 ? <p className="empty-state">No hay pedidos pendientes de cobro.</p> : <div className="orders-list">{data.pendingOrders.map((order) => <article className="order-row" key={order.id}><div><strong>{order.table?.name ?? "Para llevar"}</strong><small>#{order.id.slice(-6).toUpperCase()}</small></div><b>S/ {Number(order.total_amount).toFixed(2)}</b><button className="button button-primary button-small" disabled={busy} onClick={() => openPayment(order)}>Cobrar</button></article>)}</div>}</section></>}{paymentOrder && <div className="modal-backdrop"><section className="product-modal"><div className="modal-heading"><div><div className="eyebrow">Registrar pago</div><h2>{paymentOrder.table?.name ?? "Para llevar"}</h2></div><button className="modal-close" onClick={() => setPaymentOrder(null)}>×</button></div><p className="payment-modal-total">Total a cobrar: <strong>S/ {Number(paymentOrder.total_amount).toFixed(2)}</strong></p><label>Monto recibido<input autoFocus type="number" min="0.01" step="0.01" value={paymentAmount} onChange={(event) => setPaymentAmount(event.target.value)} /></label><p className="payment-change">Vuelto: <strong>S/ {Math.max(0, Number(paymentAmount || 0) - Number(paymentOrder.total_amount)).toFixed(2)}</strong></p><div className="modal-actions"><button className="button button-secondary" onClick={() => setPaymentOrder(null)}>Cancelar</button><button className="button button-primary" disabled={busy} onClick={() => void submitPayment()}>{busy ? "Guardando..." : "Confirmar pago"}</button></div></section></div>}</main>;
}
