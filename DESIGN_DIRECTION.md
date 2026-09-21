# Dirección visual — Mesa Clara

## Alcance

Esta iteración rediseña el producto interno para el uso diario de restaurantes. La única entrada pública principal será el inicio de sesión; la landing comercial queda fuera de la experiencia del piloto. El trabajo es visual y conserva la lógica de negocio, las llamadas API, las validaciones, los permisos y las rutas internas.

## Modo de rediseño

**Redesign · Preserve.** Se conserva la arquitectura de información, la navegación, el contenido operativo y los contratos técnicos. Se modernizan jerarquía, densidad, tokens, estados, formularios y responsive.

## Design Read

- **Artefactos:** login y panel operativo interno.
- **Audiencia:** propietarios, administradores, cajeros, meseros, cocina y staff.
- **Lenguaje visual:** control de turno cálido, claro y preciso; más herramienta de operación que SaaS corporativo.
- **Modo:** preserve.
- **Variación visual:** 4/10.
- **Movimiento:** 2/10.
- **Densidad de información:** 7/10 en operaciones; 5/10 en dashboard.
- **Dependencia de assets:** 2/10.
- **Fidelidad de marca:** 9/10.

## Posicionamiento

- **Rol narrativo:** el login orienta y da confianza; el dashboard permite decidir en segundos.
- **Distancia de lectura:** tablet y laptop durante un turno, con uso ocasional en móvil.
- **Temperatura:** cálida, operativa y confiable.
- **Capacidad:** priorizar 4–6 KPIs, acciones rápidas y estados accionables; evitar paneles decorativos.

## Tokens

- **Brand:** `#7C5CDB` para acciones primarias y selección activa.
- **Brand hover:** `#6747C5`.
- **Ink:** `#20242B`.
- **Muted:** `#667085`.
- **Canvas:** `#F6F7F9`.
- **Surface:** `#FFFFFF`.
- **Line:** `#E6E8EC`.
- **Navy:** `#182333` para navegación y resúmenes operativos.
- **Success:** `#15803D`.
- **Warning:** `#B45309`.
- **Danger:** `#B42318`.
- **Info:** `#2563EB`.

Los pares de texto y fondo se verificarán con contraste WCAG AA. Se mantendrá Inter/system-ui para evitar una migración tipográfica innecesaria.

## Escala y componentes

- Base de espaciado: 8 px.
- Radios: 10 px controles, 14 px tarjetas, 18 px superficies principales.
- Sombra: solo elevación ligera en superficies interactivas; evitar sombras decorativas.
- Botones: mínimo 44 px de altura en acciones táctiles.
- Inputs: labels visibles, focus ring consistente y mensajes de error debajo del campo.
- KPIs: máximo 6 en el dashboard inicial; cada uno debe tener valor, etiqueta y contexto.
- Estados: loading, vacío, error, prohibido y actualizado deben compartir patrones.

## Preservar

- Rutas `/dashboard/*`.
- Campos, orden y comportamiento de login.
- Contratos de API, roles, organizaciones y permisos.
- Funciones de caja, pedidos, cocina e inventario.
- Selectores usados por pruebas E2E.
- Accesibilidad existente y navegación por teclado.

## Mejorar

- Jerarquía del dashboard.
- Lectura del estado de plataforma y caja.
- Densidad y agrupación de tarjetas.
- Claridad de acciones rápidas.
- Login como puerta de entrada única.
- Responsive para tablet y móvil.

## Remover

- Sensación de landing comercial en la entrada del producto.
- Colores dispersos y estilos heredados.
- Sombras pesadas y tarjetas excesivamente redondeadas.
- Información decorativa que no ayuda a operar el turno.

## Fallback

Si la dirección visual no funciona en una pantalla operativa, se conserva el layout actual y se revierte únicamente la capa de estilos de esa pantalla. No se cambia la lógica ni se migran componentes de forma masiva.
