"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { apiFetch } from "@/lib/api/client";

type SessionResponse = { data: { user: { email?: string; roles: string[] } } };
type Product = { id: string };
type Category = { id: string };

const moduleRules = [
  { label: "Cocina", description: "Comandas y estados", href: "/dashboard/kitchen", roles: ["admin", "kitchen", "staff"], icon: "CO" },
  { label: "Productos", description: "Carta y disponibilidad", href: "/dashboard/products", roles: ["admin", "cashier", "staff"], icon: "PR" },
  { label: "Pedidos", description: "Mesas y pedidos", href: "/dashboard/orders", roles: ["admin", "cashier", "waiter"], icon: "PE" },
  { label: "Caja", description: "Cobros y turnos", href: "/dashboard/cash", roles: ["admin", "cashier"], icon: "CA" },
  { label: "Inventario", description: "Stock y movimientos", href: "/dashboard/inventory", roles: ["admin", "staff"], icon: "IN" },
  { label: "Reportes", description: "Ventas e indicadores", href: "/dashboard/reports", roles: ["admin", "cashier"], icon: "RE" },
  { label: "Configuración", description: "Usuarios y reglas", href: "/dashboard/settings", roles: ["admin"], icon: "CF" },
];

export default function DashboardPage() {
  const router = useRouter();
  const [session, setSession] = useState<SessionResponse["data"]["user"] | null>(null);
  const [productCount, setProductCount] = useState(0);
  const [categoryCount, setCategoryCount] = useState(0);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;

    async function loadDashboard() {
      try {
        const currentSession = await apiFetch<SessionResponse>("/api/v1/auth/me");
        if (!active) return;
        setSession(currentSession.data.user);

        if (!currentSession.data.user.roles.includes("kitchen")) {
          const [products, categories] = await Promise.all([
            apiFetch<{ data: Product[] }>("/api/v1/products?limit=100"),
            apiFetch<{ data: Category[] }>("/api/v1/categories"),
          ]);
          if (!active) return;
          setProductCount(products.data.length);
          setCategoryCount(categories.data.length);
        }
      } catch (cause) {
        if (!active) return;
        const message = cause instanceof Error ? cause.message : "No se pudo cargar el panel";
        if (message === "No autenticado") router.replace("/login");
        else setError(message);
      }
    }

    void loadDashboard();
    return () => { active = false; };
  }, [router]);

  async function logout() {
    await apiFetch("/api/v1/auth/logout", { method: "POST" });
    router.replace("/login");
    router.refresh();
  }

  if (error) return <main className="shell"><p className="form-error">{error}</p></main>;

  const visibleModules = moduleRules.filter((module) =>
    session?.roles.some((role) => module.roles.includes(role)),
  );
  const isKitchenUser = session?.roles.includes("kitchen") ?? false;
  const emailName = session?.email?.split("@")[0] ?? "usuario";

  return (
    <main className="shell dashboard-shell">
      <nav className="dashboard-topbar">
        <Link className="brand" href="/">POS SaaS</Link>
        <div className="dashboard-account"><span>{session?.email ?? "Cargando..."}</span><button className="button button-small" onClick={logout}>Salir</button></div>
      </nav>

      <section className="dashboard-welcome">
        <div><div className="eyebrow">Panel operativo</div><h1>Hola, {emailName}</h1><p>{isKitchenUser ? "Entra a tu pantalla de trabajo." : "Selecciona un módulo para continuar."}</p></div>
        <span className="dashboard-role">{session?.roles.join(" · ") ?? ""}</span>
      </section>

      <section className="dashboard-modules" aria-label="Módulos disponibles">
        {visibleModules.map((module) => module.href ? (
          <Link className="dashboard-module active" href={module.href} key={module.label}><span className="module-icon">{module.icon}</span><span><strong>{module.label}</strong><small>{module.description}</small></span><b>›</b></Link>
        ) : (
          <div className="dashboard-module disabled" key={module.label}><span className="module-icon">{module.icon}</span><span><strong>{module.label}</strong><small>{module.description}</small></span><em>Próximamente</em></div>
        ))}
      </section>

      {!isKitchenUser && <section className="dashboard-summary"><div><span>Productos</span><strong>{productCount}</strong></div><div><span>Categorías</span><strong>{categoryCount}</strong></div><div><span>Roles activos</span><strong>{session?.roles.length ?? 0}</strong></div></section>}
    </main>
  );
}
