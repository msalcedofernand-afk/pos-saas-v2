"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { apiFetch } from "@/lib/api/client";
import { businessDate } from "@/lib/date/business-date";

export type DashboardUser = { email?: string; roles: string[] };
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
type ProductResponse = { data: { id: string }[]; meta?: { total?: number } };
type CategoryResponse = { data: { id: string }[] };
type OrderResponse = { data: { status: string }[] };
type KitchenResponse = { data: { id: string }[] };
type CashResponse = { data: { shift: { id: string } | null } };
type ReportResponse = { data: { sales: number; paidOrders: number } };
type InventoryResponse = { data: { current_stock: number; minimum_stock: number }[] };

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

function forbiddenMetric<T>(): MetricResult<T> {
  return { data: null, state: "forbidden" };
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

        const [products, categories, orders, kitchenOrders, cash, report, inventory] = await Promise.all([
          canCatalog
            ? fetchMetric<ProductResponse>("/api/v1/products?limit=1")
            : Promise.resolve(forbiddenMetric<ProductResponse>()),
          canCatalog
            ? fetchMetric<CategoryResponse>("/api/v1/categories")
            : Promise.resolve(forbiddenMetric<CategoryResponse>()),
          canOrders ? fetchMetric<OrderResponse>("/api/v1/orders") : Promise.resolve(forbiddenMetric<OrderResponse>()),
          canKitchen
            ? fetchMetric<KitchenResponse>("/api/v1/kitchen/orders")
            : Promise.resolve(forbiddenMetric<KitchenResponse>()),
          canCash
            ? fetchMetric<CashResponse>("/api/v1/cash/summary")
            : Promise.resolve(forbiddenMetric<CashResponse>()),
          canCash
            ? fetchMetric<ReportResponse>(`/api/v1/reports/summary?date=${businessDate()}`)
            : Promise.resolve(forbiddenMetric<ReportResponse>()),
          canKitchen
            ? fetchMetric<InventoryResponse>("/api/v1/inventory")
            : Promise.resolve(forbiddenMetric<InventoryResponse>()),
        ]);

        if (!active) return;
        const activeStatuses = new Set(["pending", "confirmed", "preparing", "ready"]);
        const activeOrders = orders.data?.data.filter((order) => activeStatuses.has(order.status)).length ?? null;
        const paidOrders = report.data?.data.paidOrders ?? 0;
        const states: Record<DashboardMetricKey, MetricState> = {
          sales: report.state,
          activeOrders: orders.state,
          kitchenOrders: kitchenOrders.state,
          cashOpen: cash.state,
          lowStock: inventory.state,
          averageTicket: report.state,
          productCount: products.state,
          categoryCount: categories.state,
        };
        setMetricStates(states);
        setMetricsWarning(Object.values(states).some((state) => state === "error"));
        setMetrics({
          sales: report.data?.data.sales ?? null,
          activeOrders,
          kitchenOrders: kitchenOrders.data?.data.length ?? null,
          cashOpen: cash.data ? Boolean(cash.data.data.shift) : null,
          lowStock:
            inventory.data?.data.filter((item) => Number(item.current_stock) <= Number(item.minimum_stock)).length ??
            null,
          averageTicket: report.data && paidOrders > 0 ? report.data.data.sales / paidOrders : report.data ? 0 : null,
          productCount: products.data?.meta?.total ?? products.data?.data.length ?? null,
          categoryCount: categories.data?.data.length ?? null,
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
