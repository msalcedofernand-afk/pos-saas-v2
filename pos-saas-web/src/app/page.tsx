import Link from "next/link";
import { AuthLinkRedirect } from "@/components/AuthLinkRedirect";

export default function HomePage() {
  return (
    <main className="shell">
      <AuthLinkRedirect />
      <nav className="nav" aria-label="Navegación pública">
        <Link className="brand" href="/">
          Mesa Clara
        </Link>
        <Link className="button button-small" href="/login">
          Iniciar sesión
        </Link>
      </nav>
      <section className="hero">
        <div>
          <p className="eyebrow">Piloto gratuito · acceso por aprobación</p>
          <h1>Tu restaurante, en un solo lugar.</h1>
          <p className="lead">
            Coordina pedidos, cocina y caja. Dale a cada persona de tu equipo el acceso que necesita y sigue la
            operación de tu restaurante.
          </p>
          <div className="actions">
            <Link className="button button-primary" href="/register">
              Crear cuenta
            </Link>
            <a className="button button-secondary" href="#como-funciona">
              Cómo funciona
            </a>
          </div>
          <p className="muted-copy">Sin tarjeta ni cobros automáticos durante el piloto.</p>
        </div>
        <div className="panel-section">
          <p className="eyebrow">Del pedido al cierre</p>
          <h2>Un equipo conectado</h2>
          <div className="organization-list">
            <div>
              <strong>01 · Salón</strong>
              <span>Registra pedidos y atiende tus mesas.</span>
            </div>
            <div>
              <strong>02 · Cocina</strong>
              <span>Organiza la preparación de cada pedido.</span>
            </div>
            <div>
              <strong>03 · Caja</strong>
              <span>Registra pagos y revisa el cierre del turno.</span>
            </div>
          </div>
        </div>
      </section>
      <section id="como-funciona">
        <h2>Empieza con tu propio restaurante</h2>
        <div className="data-grid">
          <article className="data-card">
            <h3>Crea tu cuenta</h3>
            <p>Elige tu contraseña y confirma tu correo.</p>
          </article>
          <article className="data-card">
            <h3>Solicita acceso al piloto</h3>
            <p>Registra tu restaurante. Revisaremos la solicitud antes de habilitar su operación.</p>
          </article>
          <article className="data-card">
            <h3>Organiza a tu equipo</h3>
            <p>Asigna permisos internos de acuerdo con el trabajo de cada persona.</p>
          </article>
        </div>
      </section>
      <section className="panel-section">
        <h2>Tu información y tus permisos</h2>
        <p className="lead">
          Cada restaurante tiene su propio espacio. Su administrador gestiona al equipo; el soporte accede mediante
          permisos temporales y sus acciones quedan registradas.
        </p>
        <Link className="button button-primary" href="/register">
          Solicitar acceso gratuito
        </Link>
      </section>
      <footer className="nav">
        <span>Mesa Clara · Piloto cerrado</span>
        <Link href="/login/forgot-password">Recuperar mi cuenta</Link>
        <Link href="/status">Estado del servicio</Link>
      </footer>
    </main>
  );
}
