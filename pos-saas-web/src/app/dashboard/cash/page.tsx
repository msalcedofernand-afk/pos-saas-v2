"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { apiFetch, createIdempotencyKey } from "@/lib/api/client";

type Shift = { id: string; opened_at: string; opening_amount: number; status: string };
type CashOrder = {
  id: string;
  total_amount: number;
  paid_amount: number;
  remaining_amount: number;
  created_at: string;
  table: { name: string } | null;
};
type CashData = { shift: Shift | null; pendingOrders: CashOrder[]; totalPaid: number };

export default function CashPage() {
  const router = useRouter();
  const [data, setData] = useState<CashData>({ shift: null, pendingOrders: [], totalPaid: 0 });
  const [openingAmount, setOpeningAmount] = useState("0");
  const [closingAmount, setClosingAmount] = useState("");
  const [differenceReason, setDifferenceReason] = useState("");
  const [method, setMethod] = useState("cash");
  const [paymentOrder, setPaymentOrder] = useState<CashOrder | null>(null);
  const [paymentAmount, setPaymentAmount] = useState("");
  const [receivedAmount, setReceivedAmount] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      setData((await apiFetch<{ data: CashData }>("/api/v1/cash/summary")).data);
      setError(null);
    } catch (cause) {
      const message = cause instanceof Error ? cause.message : "No se pudo cargar caja";
      if (message === "No autenticado") router.replace("/login");
      else setError(message);
    }
  }, [router]);

  useEffect(() => {
    void load();
  }, [load]);

  async function openCash() {
    setBusy(true);
    try {
      await apiFetch("/api/v1/cash/open", {
        method: "POST",
        headers: { "Idempotency-Key": createIdempotencyKey() },
        body: JSON.stringify({ openingAmount: Number(openingAmount) }),
      });
      await load();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "No se pudo abrir caja");
    } finally {
      setBusy(false);
    }
  }

  function openPayment(order: CashOrder) {
    setPaymentOrder(order);
    setPaymentAmount(String(order.remaining_amount));
    setReceivedAmount(String(order.remaining_amount));
    setError(null);
  }

  async function submitPayment() {
    if (!paymentOrder) return;
    const amount = Number(paymentAmount);
    const received = Number(receivedAmount);
    if (!Number.isFinite(amount) || amount <= 0 || amount > Number(paymentOrder.remaining_amount)) {
      setError("El monto aplicado no es válido");
      return;
    }
    if (!Number.isFinite(received) || received < amount) {
      setError("El monto recibido no cubre el pago");
      return;
    }
    setBusy(true);
    try {
      await apiFetch("/api/v1/cash/payments", {
        method: "POST",
        headers: { "Idempotency-Key": createIdempotencyKey() },
        body: JSON.stringify({
          orderId: paymentOrder.id,
          method,
          amount,
          receivedAmount: method === "cash" ? received : amount,
        }),
      });
      setPaymentOrder(null);
      await load();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "No se pudo registrar el pago");
    } finally {
      setBusy(false);
    }
  }

  async function closeCash() {
    const amount = Number(closingAmount);
    if (!Number.isFinite(amount) || amount < 0) {
      setError("Ingresa el monto final de caja");
      return;
    }
    setBusy(true);
    try {
      await apiFetch("/api/v1/cash/close", {
        method: "POST",
        headers: { "Idempotency-Key": createIdempotencyKey() },
        body: JSON.stringify({
          closingAmount: amount,
          differenceReason: differenceReason.trim() || undefined,
        }),
      });
      await load();
      setClosingAmount("");
      setDifferenceReason("");
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "No se pudo cerrar caja");
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="shell module-shell">
      <nav className="nav compact-nav">
        <Link className="brand" href="/dashboard">
          ← Panel
        </Link>
        <div className="nav-actions">
          <strong>Caja</strong>
          <Link className="button button-small" href="/dashboard">
            Volver
          </Link>
        </div>
      </nav>
      <div className="module-page-heading">
        <div>
          <div className="eyebrow">Cobros y turnos</div>
          <h1>Caja</h1>
        </div>
        <button className="button button-small" onClick={() => void load()} type="button">
          Actualizar
        </button>
      </div>
      {error && (
        <p className="form-error" role="alert">
          {error}
        </p>
      )}
      {!data.shift ? (
        <section className="cash-opening panel-section">
          <div className="eyebrow">Inicio de turno</div>
          <h2>Abrir caja</h2>
          <p className="empty-state">Registra el monto inicial antes de empezar a cobrar.</p>
          <div className="inline-form">
            <label>
              Monto inicial
              <input
                inputMode="decimal"
                max="99999999"
                type="number"
                min="0"
                step="0.01"
                value={openingAmount}
                onChange={(event) => setOpeningAmount(event.target.value)}
              />
            </label>
            <button className="button button-primary" disabled={busy} onClick={() => void openCash()} type="button">
              Abrir caja
            </button>
          </div>
        </section>
      ) : (
        <>
          <section className="cash-header panel-section">
            <div>
              <div className="eyebrow">Turno abierto</div>
              <h2>Operación actual</h2>
              <small>Desde {new Date(data.shift.opened_at).toLocaleTimeString()}</small>
            </div>
            <div className="cash-total">
              <span>Total cobrado en turno</span>
              <strong>S/ {data.totalPaid.toFixed(2)}</strong>
            </div>
            <div className="cash-close">
              <input
                aria-label="Monto final"
                inputMode="decimal"
                max="99999999"
                type="number"
                min="0"
                step="0.01"
                placeholder="Monto final"
                value={closingAmount}
                onChange={(event) => setClosingAmount(event.target.value)}
              />
              <input
                aria-label="Motivo de diferencia"
                placeholder="Motivo si hay diferencia"
                value={differenceReason}
                onChange={(event) => setDifferenceReason(event.target.value)}
              />
              <button className="button button-small" disabled={busy} onClick={() => void closeCash()} type="button">
                Cerrar caja
              </button>
            </div>
          </section>
          <section className="cash-orders panel-section">
            <div className="section-heading">
              <div>
                <div className="eyebrow">Cobros pendientes</div>
                <h2>Pedidos servidos</h2>
              </div>
              <div className="payment-method">
                <label>
                  Método
                  <select value={method} onChange={(event) => setMethod(event.target.value)}>
                    <option value="cash">Efectivo</option>
                    <option value="card">Tarjeta</option>
                    <option value="yape">Yape</option>
                    <option value="plin">Plin</option>
                    <option value="transfer">Transferencia</option>
                    <option value="qr">QR</option>
                  </select>
                </label>
              </div>
            </div>
            {data.pendingOrders.length === 0 ? (
              <p className="empty-state">No hay pedidos pendientes de cobro.</p>
            ) : (
              <div className="orders-list">
                {data.pendingOrders.map((order) => (
                  <article className="order-row" key={order.id}>
                    <div>
                      <strong>{order.table?.name ?? "Para llevar"}</strong>
                      <small>
                        #{order.id.slice(-6).toUpperCase()} · Pagado S/ {Number(order.paid_amount).toFixed(2)}
                      </small>
                    </div>
                    <b>S/ {Number(order.remaining_amount).toFixed(2)}</b>
                    <button
                      className="button button-primary button-small"
                      disabled={busy}
                      onClick={() => openPayment(order)}
                      type="button"
                    >
                      Cobrar
                    </button>
                  </article>
                ))}
              </div>
            )}
          </section>
        </>
      )}
      {paymentOrder && (
        <div className="modal-backdrop">
          <section aria-labelledby="payment-dialog-title" aria-modal="true" className="product-modal" role="dialog">
            <div className="modal-heading">
              <div>
                <div className="eyebrow">Registrar pago</div>
                <h2 id="payment-dialog-title">{paymentOrder.table?.name ?? "Para llevar"}</h2>
              </div>
              <button
                aria-label="Cerrar pago"
                className="modal-close"
                onClick={() => setPaymentOrder(null)}
                type="button"
              >
                ×
              </button>
            </div>
            <p className="payment-modal-total">
              Saldo pendiente: <strong>S/ {Number(paymentOrder.remaining_amount).toFixed(2)}</strong>
            </p>
            <label>
              Monto aplicado
              <input
                autoFocus
                type="number"
                min="0.01"
                max={paymentOrder.remaining_amount}
                inputMode="decimal"
                step="0.01"
                value={paymentAmount}
                onChange={(event) => setPaymentAmount(event.target.value)}
              />
            </label>
            {method === "cash" && (
              <label>
                Monto recibido
                <input
                  inputMode="decimal"
                  max="99999999"
                  type="number"
                  min="0.01"
                  step="0.01"
                  value={receivedAmount}
                  onChange={(event) => setReceivedAmount(event.target.value)}
                />
              </label>
            )}
            {method === "cash" && (
              <p className="payment-change">
                Vuelto:{" "}
                <strong>S/ {Math.max(0, Number(receivedAmount || 0) - Number(paymentAmount || 0)).toFixed(2)}</strong>
              </p>
            )}
            <div className="modal-actions">
              <button className="button button-secondary" onClick={() => setPaymentOrder(null)} type="button">
                Cancelar
              </button>
              <button
                className="button button-primary"
                disabled={busy}
                onClick={() => void submitPayment()}
                type="button"
              >
                {busy ? "Guardando..." : "Confirmar pago"}
              </button>
            </div>
          </section>
        </div>
      )}
    </main>
  );
}
