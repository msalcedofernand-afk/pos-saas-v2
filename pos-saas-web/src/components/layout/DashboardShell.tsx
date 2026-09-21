"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import { brand } from "@/config/brand";

const navigation = [
  { label: "Resumen", href: "/dashboard", section: "Operación" },
  { label: "Pedidos", href: "/dashboard/orders", section: "Operación" },
  { label: "Cocina", href: "/dashboard/kitchen", section: "Operación" },
  { label: "Caja", href: "/dashboard/cash", section: "Operación" },
  { label: "Productos", href: "/dashboard/products", section: "Catálogo" },
  { label: "Inventario", href: "/dashboard/inventory", section: "Catálogo" },
  { label: "Reportes", href: "/dashboard/reports", section: "Control" },
  { label: "Configuración", href: "/dashboard/settings", section: "Control" },
];

const pageNames = new Map(navigation.map((item) => [item.href, item.label]));

export function DashboardShell({ children }: Readonly<{ children: React.ReactNode }>) {
  const pathname = usePathname();
  const [mobileOpen, setMobileOpen] = useState(false);
  const currentLabel = pageNames.get(pathname) ?? "Panel operativo";
  const sections = [...new Set(navigation.map((item) => item.section))];

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
          <span className="app-sidebar-caption">Operación de restaurante</span>
        </div>
        <nav className="app-nav">
          {sections.map((section) => (
            <div className="app-nav-group" key={section}>
              <span className="app-nav-label">{section}</span>
              {navigation
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
            <Link className="app-quick-action" href="/dashboard/orders">
              <span aria-hidden="true">+</span> Nuevo pedido
            </Link>
            <span className="app-live-status">
              <i /> Sistema operativo
            </span>
          </div>
        </header>
        <main className="app-content">{children}</main>
      </div>
    </div>
  );
}
