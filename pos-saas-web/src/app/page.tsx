import Link from "next/link";
import { brand } from "@/config/brand";

const benefits = [
  {
    title: "Toma pedidos sin duplicar trabajo",
    text: "Meseros, caja y cocina comparten el mismo pedido desde el primer clic.",
  },
  {
    title: "Cocina siempre sabe qué preparar",
    text: "Las comandas llegan ordenadas por estación y estado, sin papeles perdidos.",
  },
  { title: "Cierra caja con control", text: "Cada cobro, turno y método de pago queda visible para decidir mejor." },
];

const modules = ["Pedidos y mesas", "Cocina en vivo", "Caja y pagos", "Inventario", "Reportes", "Usuarios y roles"];

export default function HomePage() {
  return (
    <main className="landing-shell">
      <nav className="nav landing-nav">
        <Link className="brand landing-brand" href="/">
          <span>{brand.shortName}</span> Clara
        </Link>
        <div className="nav-actions">
          <Link className="nav-link" href="/demo">
            Ver demo
          </Link>
          <Link className="nav-link" href="/login">
            Ingresar al panel
          </Link>
        </div>
      </nav>

      <section className="hero landing-hero">
        <div>
          <div className="eyebrow">Operación clara para restaurantes</div>
          <h1>Opera tu negocio con más claridad.</h1>
          <p className="lead">
            Pedidos conectados con cocina, caja e inventario para que tu equipo atienda mejor y tú tengas el control del
            turno.
          </p>
          <div className="actions">
            <Link className="button button-primary" href="/demo">
              Ver demo
            </Link>
            <Link className="button button-secondary" href="/login">
              Ingresar al panel
            </Link>
          </div>
          <p className="landing-note">Diseñado para restaurantes que quieren crecer sin perder el ritmo.</p>
        </div>

        <div className="preview landing-preview" aria-label="Vista previa de la operación">
          <div className="preview-top">
            <span>Turno de hoy</span>
            <span className="preview-live">● En vivo</span>
          </div>
          <div className="metric">
            <div className="metric-label">Ventas del día</div>
            <div className="metric-value">S/ 4,280</div>
            <span className="preview-trend">↑ 18% vs. ayer</span>
          </div>
          <div className="landing-order-card">
            <div>
              <strong>Pedido #1842</strong>
              <small>Mesa 12 · Hace 4 min</small>
            </div>
            <span>En cocina</span>
          </div>
          <div className="preview-row">
            <div className="mini-card">
              <b>24</b>
              <small>pedidos</small>
            </div>
            <div className="mini-card">
              <b>8</b>
              <small>mesas activas</small>
            </div>
            <div className="mini-card">
              <b>3</b>
              <small>por preparar</small>
            </div>
          </div>
        </div>
      </section>

      <section className="benefits-section">
        <div className="section-heading landing-heading">
          <div>
            <div className="eyebrow">Menos fricción, más servicio</div>
            <h2>Todo el turno en una sola vista.</h2>
          </div>
          <p>La operación se mueve al ritmo de tu equipo, no al de una hoja de cálculo.</p>
        </div>
        <div className="benefit-grid">
          {benefits.map((benefit, index) => (
            <article className="benefit-card" key={benefit.title}>
              <span>0{index + 1}</span>
              <h3>{benefit.title}</h3>
              <p>{benefit.text}</p>
            </article>
          ))}
        </div>
      </section>

      <section className="landing-product">
        <div>
          <div className="eyebrow">Una plataforma, cada área conectada</div>
          <h2>Del pedido a la mesa, sin perder información.</h2>
          <p className="lead">
            Consulta el estado real del negocio mientras sucede. Tu equipo sabe qué hacer y tú sabes dónde actuar.
          </p>
          <Link className="button button-primary" href="/demo">
            Explorar la demo
          </Link>
        </div>
        <div className="module-showcase">
          <div className="module-showcase-header">
            <strong>{brand.name}</strong>
            <span>Resumen operativo</span>
          </div>
          <div className="module-showcase-body">
            <div className="showcase-line">
              <span className="showcase-dot orange" />
              Pedidos nuevos<strong>8</strong>
            </div>
            <div className="showcase-line">
              <span className="showcase-dot blue" />
              En preparación<strong>5</strong>
            </div>
            <div className="showcase-line">
              <span className="showcase-dot green" />
              Listos para entregar<strong>3</strong>
            </div>
            <div className="showcase-footer">Última actualización · hace 30 s</div>
          </div>
        </div>
      </section>

      <section className="modules-section">
        <div className="eyebrow">Módulos para crecer</div>
        <h2>Empieza con lo que necesitas.</h2>
        <div className="module-grid">
          {modules.map((module) => (
            <span key={module}>{module}</span>
          ))}
        </div>
      </section>

      <section className="landing-cta">
        <div>
          <div className="eyebrow">Tu próximo turno puede ser más simple</div>
          <h2>Prueba la operación completa.</h2>
        </div>
        <Link className="button button-primary" href="/demo">
          Ver demo
        </Link>
      </section>

      <footer className="landing-footer">
        <Link className="brand landing-brand" href="/">
          <span>{brand.shortName}</span> Clara
        </Link>
        <span>Pedidos, cocina y caja en sincronía.</span>
        <div>
          <Link href="/status">Estado del servicio</Link>
          <Link href="/login">Ingresar</Link>
        </div>
      </footer>
    </main>
  );
}
