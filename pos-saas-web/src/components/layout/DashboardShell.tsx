"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { brand } from "@/config/brand";
import {
  apiFetch,
  clearOrganizationContext,
  getPlatformOrganizationContext,
  type PlatformOrganizationContext,
} from "@/lib/api/client";

const navigation = [
  { label: "Resumen", href: "/dashboard", section: "Operación" },
  { label: "Pedidos", href: "/dashboard/orders", section: "Operación" },
  { label: "Cocina", href: "/dashboard/kitchen", section: "Operación" },
  { label: "Caja", href: "/dashboard/cash", section: "Operación" },
  { label: "Productos", href: "/dashboard/products", section: "Catálogo" },
  { label: "Inventario", href: "/dashboard/inventory", section: "Catálogo" },
  { label: "Reportes", href: "/dashboard/reports", section: "Control" },
  { label: "Configuración", href: "/dashboard/settings", section: "Control" },
  { label: "Plan y límites", href: "/dashboard/subscription", section: "Control" },
];

const platformNavigation = [
  { label: "Organizaciones", href: "/dashboard/platform", section: "Plataforma" },
  { label: "Usuarios", href: "/dashboard/platform/users", section: "Plataforma" },
  { label: "Accesos globales", href: "/dashboard/platform/access", section: "Plataforma" },
  { label: "Soporte", href: "/dashboard/platform/support", section: "Plataforma" },
  { label: "Tickets", href: "/dashboard/platform/tickets", section: "Plataforma" },
  { label: "Incidentes", href: "/dashboard/platform/incidents", section: "Plataforma" },
  { label: "Planes", href: "/dashboard/platform/plans", section: "Plataforma" },
  { label: "Auditoría", href: "/dashboard/platform/audit", section: "Plataforma" },
];

const pageNames = new Map(navigation.map((item) => [item.href, item.label]));

export function DashboardShell({ children }: Readonly<{ children: React.ReactNode }>) {
  const pathname = usePathname();
  const router = useRouter();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [platformContext, setPlatformContext] = useState<PlatformOrganizationContext | null>(null);
  const [revokingSupport, setRevokingSupport] = useState(false);
  const [globalRoles, setGlobalRoles] = useState<string[]>([]);
  const isPlatform = pathname.startsWith("/dashboard/platform");
  const links = isPlatform
    ? platformNavigation.filter((item) => {
        if (item.href.endsWith("/access")) return globalRoles.includes("platform_owner");
        if (globalRoles.some((role) => ["platform_owner", "platform_admin"].includes(role))) return true;
        if (globalRoles.includes("support_agent")) return ["Soporte", "Tickets", "Incidentes"].includes(item.label);
        return item.label === "Incidentes";
      })
    : navigation;
  const currentLabel =
    links.find((item) => item.href === pathname)?.label ?? pageNames.get(pathname) ?? "Panel operativo";
  const sections = [...new Set(links.map((item) => item.section))];

  useEffect(() => {
    setPlatformContext(getPlatformOrganizationContext());
    if (pathname.startsWith("/dashboard/platform")) {
      void apiFetch<{ data: { user: { roles: string[] } } }>("/api/v1/auth/me")
        .then((response) => setGlobalRoles(response.data.user.roles))
        .catch(() => setGlobalRoles([]));
    }
  }, [pathname]);

  async function leaveOrganizationContext() {
    if (!platformContext) return;
    setRevokingSupport(true);
    try {
      await apiFetch(`/api/v1/platform/support/access/${platformContext.supportAccessId}/revoke`, {
        method: "POST",
        headers: { "Idempotency-Key": crypto.randomUUID() },
        body: JSON.stringify({ reason: "Salida manual del soporte temporal" }),
      });
    } catch {
      // The context is still cleared locally; expired access will be rejected server-side.
    } finally {
      clearOrganizationContext();
      setPlatformContext(null);
      setRevokingSupport(false);
      router.replace("/dashboard/platform");
    }
  }

  return (
    <div className={`app-shell ${mobileOpen ? "app-shell-menu-open" : ""}`}>
      <button
        aria-label="Cerrar navegación"
        className="app-shell-scrim"
        onClick={() => setMobileOpen(false)}
        type="button"
      />
      <aside className="app-sidebar" aria-label="Navegación principal">
        <div className="app-sidebar-head">
          <Link className="app-wordmark" href="/dashboard" onClick={() => setMobileOpen(false)}>
            {brand.name}
          </Link>
          <span className="app-sidebar-caption">
            {isPlatform ? "Administración de plataforma" : "Operación de restaurante"}
          </span>
        </div>
        <nav className="app-nav">
          {sections.map((section) => (
            <div className="app-nav-group" key={section}>
              <span className="app-nav-label">{section}</span>
              {links
                .filter((item) => item.section === section)
                .map((item) => {
                  const active =
                    pathname === item.href || (item.href !== "/dashboard" && pathname.startsWith(`${item.href}/`));
                  return (
                    <Link
                      aria-current={active ? "page" : undefined}
                      className={`app-nav-link ${active ? "active" : ""}`}
                      href={item.href}
                      key={item.href}
                      onClick={() => setMobileOpen(false)}
                    >
                      <span className="app-nav-glyph" aria-hidden="true">
                        {item.label.slice(0, 2).toUpperCase()}
                      </span>
                      <span>{item.label}</span>
                    </Link>
                  );
                })}
            </div>
          ))}
        </nav>
        <div className="app-sidebar-foot">
          <Link className="app-status-link" href="/status" onClick={() => setMobileOpen(false)}>
            <span className="app-status-dot" />
            Estado del servicio
          </Link>
        </div>
      </aside>
      <div className="app-main">
        <header className="app-topbar">
          <button
            aria-expanded={mobileOpen}
            aria-label="Abrir navegación"
            className="app-menu-button"
            onClick={() => setMobileOpen((current) => !current)}
            type="button"
          >
            <span />
            <span />
            <span />
          </button>
          <div className="app-breadcrumb">
            <span>Panel operativo</span>
            <b>/</b>
            <strong>{currentLabel}</strong>
          </div>
          <div className="app-topbar-actions">
            <Link className="app-quick-action" href={isPlatform ? "/dashboard/platform/support" : "/dashboard/orders"}>
              {isPlatform ? "Soporte temporal" : "+ Nuevo pedido"}
            </Link>
            <span className="app-live-status">
              <i /> Sistema operativo
            </span>
          </div>
        </header>
        <main className="app-content">
          {platformContext && (
            <div className="platform-context-banner" role="status">
              <div>
                <span className="eyebrow">
                  Soporte temporal · {platformContext.supportMode === "write" ? "Escritura habilitada" : "Solo lectura"}
                </span>
                <strong>{platformContext.name}</strong>
                <small>
                  Vence {new Date(platformContext.expiresAt).toLocaleString("es-PE")}. Todas las acciones quedan
                  auditadas.
                </small>
              </div>
              <button
                className="button button-small button-secondary"
                disabled={revokingSupport}
                onClick={() => void leaveOrganizationContext()}
                type="button"
              >
                {revokingSupport ? "Revocando..." : "Salir y revocar"}
              </button>
            </div>
          )}
          {children}
        </main>
      </div>
    </div>
  );
}
