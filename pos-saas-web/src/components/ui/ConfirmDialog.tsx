"use client";

import { useEffect } from "react";

type ConfirmDialogProps = {
  open: boolean;
  title: string;
  description: string;
  confirmLabel?: string;
  busy?: boolean;
  danger?: boolean;
  onCancel: () => void;
  onConfirm: () => void;
};

export function ConfirmDialog({
  open,
  title,
  description,
  confirmLabel = "Confirmar",
  busy = false,
  danger = false,
  onCancel,
  onConfirm,
}: ConfirmDialogProps) {
  useEffect(() => {
    if (!open) return;
    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape" && !busy) onCancel();
    }
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [busy, onCancel, open]);

  if (!open) return null;

  return (
    <div
      className="modal-backdrop"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget && !busy) onCancel();
      }}
    >
      <section
        aria-labelledby="confirm-dialog-title"
        aria-modal="true"
        className="product-modal confirm-dialog"
        role="dialog"
      >
        <div className="modal-heading">
          <div>
            <div className="eyebrow">Confirmación</div>
            <h2 id="confirm-dialog-title">{title}</h2>
          </div>
          <button
            aria-label="Cerrar confirmación"
            className="modal-close"
            disabled={busy}
            onClick={onCancel}
            type="button"
          >
            ×
          </button>
        </div>
        <p className="empty-state">{description}</p>
        <div className="modal-actions">
          <button className="button button-secondary" disabled={busy} onClick={onCancel} type="button">
            Cancelar
          </button>
          <button
            className={`button ${danger ? "button-danger" : "button-primary"}`}
            disabled={busy}
            onClick={onConfirm}
            type="button"
          >
            {busy ? "Procesando..." : confirmLabel}
          </button>
        </div>
      </section>
    </div>
  );
}
