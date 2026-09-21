"use client";

type ToastProps = {
  message: string;
  tone?: "error" | "success" | "info";
  onClose: () => void;
};

export function Toast({ message, tone = "info", onClose }: ToastProps) {
  return (
    <div className={`app-toast app-toast-${tone}`} role={tone === "error" ? "alert" : "status"}>
      <span>{message}</span>
      <button aria-label="Cerrar mensaje" className="app-toast-close" onClick={onClose} type="button">
        ×
      </button>
    </div>
  );
}
