"use client";

import Link from "next/link";
import { useState } from "react";
import { brand } from "@/config/brand";

type DemoModel = "operativo" | "analitico" | "mesas";

const models: Record<DemoModel, { number: string; name: string; description: string }> = {
  operativo: { number: "01", name: "Operativo oscuro", description: "Máxima velocidad para cocina, caja y trabajo continuo." },
  analitico: { number: "02", name: "SaaS analítico", description: "Una vista moderna para administrar ventas, inventario y equipo." },
  mesas: { number: "03", name: "POS de mesas", description: "El centro de la operación gira alrededor del salón y sus mesas." },
};

export default function DemoPage() {
  const [model, setModel] = useState<DemoModel>("operativo");
  const current = models[model];

  return (
    <main className="shell demo-shell">
      <nav className="nav compact-nav"><Link className="brand" href="/">{brand.name}</Link><Link className="nav-link" href="/login">Volver al acceso</Link></nav>
      <section className="demo-v2-heading"><div><div className="eyebrow">{brand.name} · demos visuales</div><h1>Elige la dirección visual.</h1><p className="lead">Tres modelos distintos para definir cómo se sentirá el producto antes de conectar más módulos.</p></div><span className="demo-user">Demo temporal · datos ficticios</span></section>

      <div className="demo-model-picker" role="tablist" aria-label="Modelos visuales">
        {(Object.keys(models) as DemoModel[]).map((key) => <button aria-selected={model === key} className={`demo-model-card${model === key ? " active" : ""}`} key={key} onClick={() => setModel(key)} role="tab" type="button"><span>{models[key].number}</span><strong>{models[key].name}</strong><small>{models[key].description}</small></button>)}
      </div>

      <section className={`v2-preview v2-${model}`} aria-live="polite">
        <div className="v2-preview-top"><div><span className="demo-kicker">Modelo {current.number}</span><h2>{current.name}</h2></div><span className="v2-live">● Jornada abierta</span></div>
        {model === "operativo" && <OperationalModel />}
        {model === "analitico" && <AnalyticalModel />}
        {model === "mesas" && <TablesModel />}
      </section>
      <p className="demo-v2-footnote">Todos los datos mostrados son simulados. Esta pantalla no consume la API ni modifica Supabase.</p>
    </main>
  );
}

function OperationalModel() {
  return <div className="operational-preview"><aside className="op-sidebar"><b>POS<br />V2</b><span className="op-selected">⌂ Inicio</span><span>▣ Pedidos</span><span>⚑ Cocina</span><span>▤ Caja</span><span>⚙ Más</span><small>admin@demo</small></aside><div className="op-main"><div className="op-toolbar"><div><small>DOMINGO 20 SEP 2026</small><h3>Centro de operación</h3></div><button type="button">+ Nuevo pedido</button></div><div className="op-stats"><div><small>Ventas de hoy</small><b>S/ 4,280</b><span>+12.4%</span></div><div><small>Pedidos activos</small><b>24</b><span>8 en cocina</span></div><div><small>Mesas ocupadas</small><b>8/12</b><span>4 disponibles</span></div></div><div className="op-columns"><div className="op-panel"><header><b>Flujo de pedidos</b><small>Actualizado ahora</small></header><div className="flow-row"><i className="flow-dot yellow" /><span>Nuevos</span><strong>4</strong></div><div className="flow-row"><i className="flow-dot blue" /><span>Preparando</span><strong>8</strong></div><div className="flow-row"><i className="flow-dot green" /><span>Listos</span><strong>3</strong></div></div><div className="op-panel"><header><b>Actividad reciente</b><small>Ver todo</small></header><div className="activity"><strong>Pedido #1042</strong><span>Mesa 6 · En preparación</span><time>hace 4 min</time></div><div className="activity"><strong>Pedido #1041</strong><span>Mesa 2 · Listo</span><time>hace 7 min</time></div><div className="activity"><strong>Caja abierta</strong><span>S/ 300 iniciales</span><time>hace 1 h</time></div></div></div></div></div>;
}

function AnalyticalModel() {
  return <div className="analytical-preview"><div className="an-topbar"><div className="an-logo">pos<span>.</span>saas</div><span>Restaurante Demo⌄</span><div className="an-avatar">AD</div></div><div className="an-body"><aside><small>MENÚ PRINCIPAL</small><b className="an-active">▦ Resumen</b><b>▤ Ventas</b><b>▥ Productos</b><b>◉ Inventario</b><b>⚙ Configuración</b><small>CUENTA</small><b>◇ Equipo</b><b>↪ Salir</b></aside><div className="an-content"><div className="an-heading"><div><small>RESUMEN GENERAL</small><h3>Buenos días, Administrador</h3></div><button type="button">Esta semana⌄</button></div><div className="an-metrics"><div><small>Ventas netas</small><strong>S/ 18,460</strong><span>↗ 18.2%</span></div><div><small>Ticket promedio</small><strong>S/ 48.20</strong><span>↗ 4.8%</span></div><div><small>Pedidos</small><strong>382</strong><span>↗ 11.4%</span></div><div><small>Productos vendidos</small><strong>1,204</strong><span>↗ 9.6%</span></div></div><div className="an-grid"><div className="an-chart"><header><b>Ventas de la semana</b><span>S/ 18.4k</span></header><div className="fake-chart"><i /><i /><i /><i /><i /><i /><i /></div><div className="chart-labels"><span>Lun</span><span>Mar</span><span>Mié</span><span>Jue</span><span>Vie</span><span>Sáb</span><span>Dom</span></div></div><div className="an-ranking"><header><b>Más vendidos</b><span>Ver reporte</span></header><p><b>01</b><span>Ceviche</span><strong>184</strong></p><p><b>02</b><span>Arroz con pollo</span><strong>162</strong></p><p><b>03</b><span>Ají de gallina</span><strong>139</strong></p></div></div></div></div></div>;
}

function TablesModel() {
  return <div className="tables-preview"><header className="tables-header"><div><small>SALÓN PRINCIPAL · DOMINGO 20 SEP</small><h3>Mesas y pedidos</h3></div><div className="tables-actions"><span><i className="table-dot free" /> Libre 4</span><span><i className="table-dot busy" /> Ocupada 6</span><button type="button">+ Abrir pedido</button></div></header><div className="tables-layout"><div className="floor-plan"><div className="floor-label">SALÓN</div><div className="table-node free-node t1"><b>Mesa 1</b><small>Libre</small></div><div className="table-node busy-node t2"><b>Mesa 2</b><small>S/ 86.00</small></div><div className="table-node busy-node t3"><b>Mesa 3</b><small>S/ 124.50</small></div><div className="table-node free-node t4"><b>Mesa 4</b><small>Libre</small></div><div className="table-node busy-node t5"><b>Mesa 5</b><small>S/ 42.00</small></div><div className="bar-zone">BARRA</div></div><aside className="table-order"><div className="selected-table"><span>Mesa 3</span><b>Pedido abierto</b><small>2 personas · hace 18 min</small></div><div className="order-line"><span>2 × Ceviche</span><b>S/ 16.00</b></div><div className="order-line"><span>1 × Arroz con pollo</span><b>S/ 3.00</b></div><div className="order-line"><span>2 × Gaseosa</span><b>S/ 5.00</b></div><div className="order-total"><span>Total</span><strong>S/ 24.00</strong></div><button className="table-primary" type="button">Continuar pedido</button><button className="table-secondary" type="button">Ver cuenta</button></aside></div></div>;
}
