import Link from "next/link";

export default function HomePage() {
  return (
    <main className="shell">
      <nav className="nav">
        <Link className="brand" href="/">POS SaaS</Link>
        <Link className="nav-link" href="/login">Iniciar sesión</Link>
      </nav>

      <section className="hero">
        <div>
          <div className="eyebrow">Nueva plataforma</div>
          <h1>Opera tu negocio con más claridad.</h1>
          <p className="lead">
            Esta es la nueva base visual del frontend. La web, Android y el panel
            administrativo consumirán la misma API, sin depender directamente de Supabase.
          </p>
          <div className="actions">
            <Link className="button button-primary" href="/login">Ingresar al panel</Link>
            <a className="button button-secondary" href="http://localhost:3000/api/v1/health">Ver API</a>
          </div>
        </div>

        <div className="preview" aria-label="Vista previa del panel">
          <div className="preview-top"><span>Resumen del negocio</span><span>Hoy</span></div>
          <div className="metric"><div className="metric-label">Ventas del día</div><div className="metric-value">S/ 4,280</div></div>
          <div className="preview-row">
            <div className="mini-card">24 pedidos</div>
            <div className="mini-card">8 mesas activas</div>
            <div className="mini-card">12 productos</div>
          </div>
        </div>
      </section>
    </main>
  );
}
