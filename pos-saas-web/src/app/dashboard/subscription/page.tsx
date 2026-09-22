"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { apiFetch } from "@/lib/api/client";

type SubscriptionData = {
  subscription: { status: string; currentPeriodEnd: string | null; trialEndsAt: string | null };
  plan: {
    code: string;
    name: string;
    monthlyPrice: number | null;
    currency: string;
    features: Record<string, unknown>;
  };
  limits: { users: number | null; branches: number | null; products: number | null; monthlyOrders: number | null };
  usage: { users: number; branches: number; products: number; monthlyOrders: number };
};

const showLimit = (value: number | null) => (value == null ? "Sin límite" : value.toLocaleString("es-PE"));

export default function SubscriptionPage() {
  const router = useRouter();
  const [data, setData] = useState<SubscriptionData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const load = useCallback(async () => {
    try {
      const response = await apiFetch<{ data: SubscriptionData }>("/api/v1/subscription");
      setData(response.data);
    } catch (cause) {
      const status = (cause as Error & { status?: number }).status;
      if (status === 401) router.replace("/login");
      else setError(cause instanceof Error ? cause.message : "No se pudo cargar el plan");
    } finally {
      setLoading(false);
    }
  }, [router]);
  useEffect(() => {
    void load();
  }, [load]);
  return (
    <main className="shell module-shell">
      <nav className="nav compact-nav">
        <Link className="brand" href="/dashboard">
          ← Panel
        </Link>
        <Link className="button button-small" href="/dashboard/settings">
          Configuración
        </Link>
      </nav>
      <div className="module-page-heading">
        <div>
          <div className="eyebrow">Cuenta del restaurante</div>
          <h1>Plan y límites</h1>
        </div>
        <button className="button button-small" onClick={() => void load()} type="button">
          Actualizar
        </button>
      </div>
      {error && <p className="form-error">{error}</p>}
      {loading ? (
        <p className="empty-state">Cargando plan…</p>
      ) : (
        data && (
          <>
            <section className="panel-section">
              <div className="section-heading">
                <div>
                  <div className="eyebrow">Suscripción</div>
                  <h2>{data.plan.name}</h2>
                  <p className="muted-copy">Estado: {data.subscription.status}</p>
                </div>
                <span className="status-pill available">{data.plan.code}</span>
              </div>
              <p className="muted-copy">
                Los cambios de plan los realiza el administrador global de la plataforma. Si necesitas ampliar límites,
                solicita soporte.
              </p>
            </section>
            <section className="metrics-grid">
              <div className="metric-card">
                <span>Usuarios</span>
                <strong>
                  {data.usage.users} / {showLimit(data.limits.users)}
                </strong>
              </div>
              <div className="metric-card">
                <span>Productos</span>
                <strong>
                  {data.usage.products} / {showLimit(data.limits.products)}
                </strong>
              </div>
              <div className="metric-card">
                <span>Pedidos del mes</span>
                <strong>
                  {data.usage.monthlyOrders} / {showLimit(data.limits.monthlyOrders)}
                </strong>
              </div>
            </section>
            <section className="panel-section">
              <div className="eyebrow">Incluye</div>
              <h2>Características del plan</h2>
              <pre>{JSON.stringify(data.plan.features, null, 2)}</pre>
            </section>
          </>
        )
      )}
    </main>
  );
}
