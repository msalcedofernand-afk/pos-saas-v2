"use client";

import { useCallback, useEffect, useState } from "react";

const apiUrl = (process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3000").replace(/\/$/, "");

export type ApiHealthStatus = "checking" | "online" | "offline";
export type ApiHealth = {
  status: ApiHealthStatus;
  apiStatus: string | null;
  supabaseStatus: string | null;
  latencyMs: number | null;
  checkedAt: Date | null;
  error: string | null;
};

const initialHealth: ApiHealth = {
  status: "checking",
  apiStatus: null,
  supabaseStatus: null,
  latencyMs: null,
  checkedAt: null,
  error: null,
};

export function useApiHealth(intervalMs = 30_000) {
  const [health, setHealth] = useState<ApiHealth>(initialHealth);

  const refresh = useCallback(async () => {
    const startedAt = performance.now();
    setHealth((current) => ({ ...current, status: "checking", error: null }));

    try {
      const response = await fetch(`${apiUrl}/api/v1/health/ready`, {
        cache: "no-store",
        credentials: "include",
      });
      const payload = (await response.json().catch(() => null)) as {
        status?: string;
        dependencies?: { supabase?: string };
      } | null;
      if (!response.ok || payload?.status !== "ready") throw new Error("La API no está disponible");

      setHealth({
        status: "online",
        apiStatus: "Operativa",
        supabaseStatus: payload.dependencies?.supabase === "ok" ? "Conectado" : "No disponible",
        latencyMs: Math.round(performance.now() - startedAt),
        checkedAt: new Date(),
        error: null,
      });
    } catch (cause) {
      setHealth({
        ...initialHealth,
        status: "offline",
        latencyMs: Math.round(performance.now() - startedAt),
        checkedAt: new Date(),
        error: cause instanceof Error ? cause.message : "No se pudo contactar la API",
      });
    }
  }, []);

  useEffect(() => {
    void refresh();
    const timer = window.setInterval(() => void refresh(), intervalMs);
    return () => window.clearInterval(timer);
  }, [intervalMs, refresh]);

  return { health, refresh };
}
