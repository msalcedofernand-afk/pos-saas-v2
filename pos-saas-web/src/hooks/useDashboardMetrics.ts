"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { apiFetch } from "@/lib/api/client";

export type DashboardUser = { email?: string; roles: string[]; organizationId: string };
export type MetricState = "loading" | "ok" | "forbidden" | "error";
export type DashboardMetrics = {
  sales: number | null;
  activeOrders: number | null;
  kitchenOrders: number | null;
  cashOpen: boolean | null;
  lowStock: number | null;
  averageTicket: number | null;
  productCount: number | null;
  categoryCount: number | null;
};
export type DashboardMetricKey = keyof DashboardMetrics;

type MetricResult<T> = { data: T | null; state: MetricState };
type DashboardResponse = { data: DashboardMetrics & { paidOrders: number | null } };

const emptyMetrics: DashboardMetrics = {
  sales: null,
  activeOrders: null,
  kitchenOrders: null,
  cashOpen: null,
  lowStock: null,
  averageTicket: null,
  productCount: null,
  categoryCount: null,
};

const initialStates: Record<DashboardMetricKey, MetricState> = {
  sales: "loading",
  activeOrders: "loading",
  kitchenOrders: "loading",
  cashOpen: "loading",
  lowStock: "loading",
  averageTicket: "loading",
  productCount: "loading",
  categoryCount: "loading",
};

async function fetchMetric<T>(path: string): Promise<MetricResult<T>> {
  try {
    return { data: await apiFetch<T>(path), state: "ok" };
  } catch (cause) {
    const status = (cause as Error & { status?: number }).status;
    return { data: null, state: status === 403 ? "forbidden" : "error" };
  }
}

export function useDashboardMetrics() {
  const router = useRouter();
  const [session, setSession] = useState<DashboardUser | null>(null);
  const [metrics, setMetrics] = useState<DashboardMetrics>(emptyMetrics);
  const [metricStates, setMetricStates] = useState<Record<DashboardMetricKey, MetricState>>(initialStates);
  const [metricsWarning, setMetricsWarning] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;

    async function loadDashboard() {
      try {
        const currentSession = await apiFetch<{ data: { user: DashboardUser } }>("/api/v1/auth/me");
        if (!active) return;
        const user = currentSession.data.user;
        setSession(user);

        const roles = user.roles;
        const canCatalog = roles.some((role) => ["admin", "cashier", "staff"].includes(role));
        const canKitchen = roles.some((role) => ["admin", "kitchen", "staff"].includes(role));
        const canCash = roles.some((role) => ["admin", "cashier"].includes(role));
        const canOrders = roles.some((role) => ["admin", "cashier", "waiter", "kitchen", "staff"].includes(role));

        const dashboard = await fetchMetric<DashboardResponse>("/api/v1/dashboard/metrics");

        if (!active) return;
        const states: Record<DashboardMetricKey, MetricState> = {
          sales: canCash ? dashboard.state : "forbidden",
          activeOrders: canOrders ? dashboard.state : "forbidden",
          kitchenOrders: canKitchen ? dashboard.state : "forbidden",
          cashOpen: canCash ? dashboard.state : "forbidden",
          lowStock: canKitchen ? dashboard.state : "forbidden",
          averageTicket: canCash ? dashboard.state : "forbidden",
          productCount: canCatalog ? dashboard.state : "forbidden",
          categoryCount: canCatalog ? dashboard.state : "forbidden",
        };
        setMetricStates(states);
        setMetricsWarning(dashboard.state === "error");
        const values = dashboard.data?.data;
        const paidOrders = values?.paidOrders ?? 0;
        const sales = values?.sales ?? null;
        setMetrics({
          sales,
          activeOrders: values?.activeOrders ?? null,
          kitchenOrders: values?.kitchenOrders ?? null,
          cashOpen: values?.cashOpen ?? null,
          lowStock: values?.lowStock ?? null,
          averageTicket: sales !== null && paidOrders > 0 ? sales / paidOrders : values ? 0 : null,
          productCount: values?.productCount ?? null,
          categoryCount: values?.categoryCount ?? null,
        });
      } catch (cause) {
        if (!active) return;
        const message = cause instanceof Error ? cause.message : "No se pudo cargar el panel";
        if (message === "No autenticado") router.replace("/login");
        else setError(message);
      }
    }

    void loadDashboard();
    return () => {
      active = false;
    };
  }, [router]);

  return { session, metrics, metricStates, metricsWarning, error };
}
