# POS SaaS API

Proyecto separado para construir la API central del POS. La interfaz administrativa, la web pública y Android se conectarán a este proyecto por HTTP; ninguna de esas aplicaciones debe conectarse directamente a Supabase.

## Alcance actual

- API versionada bajo `/api/v1`.
- Acceso server-only a Supabase.
- Seguridad por sesión, CSRF, rate limit, bloqueo y roles.
- Aislamiento multi-organización derivado del usuario autenticado.
- Productos, categorías, mesas, pedidos, cocina, caja, inventario y reportes.
- Migraciones SQL administradas desde `../pos-saas-infra/supabase/migrations`.

## Rutas principales

- `GET /api/v1/health`
- `GET /api/v1/health/ready`
- `POST /api/v1/auth/login`
- `POST /api/v1/auth/logout`
- `GET /api/v1/auth/me`
- `GET /api/v1/organizations`
- `GET|POST /api/v1/platform/organizations` (sólo `platform_admin`)
- `GET|POST /api/v1/products`
- `PATCH|DELETE /api/v1/products/:id`
- `GET|POST /api/v1/categories`
- `DELETE /api/v1/categories/:id`
- `GET|POST /api/v1/orders`
- `PATCH /api/v1/orders/:id/status`
- `GET|PATCH /api/v1/kitchen/orders`
- `POST /api/v1/cash/open`
- `POST /api/v1/cash/close`
- `POST /api/v1/cash/payments`
- `GET /api/v1/reports/summary`

Las mutaciones sensibles usan funciones SQL transaccionales, idempotencia y
auditoría. Los E2E autenticados cubren permisos, pedidos, cocina, caja y
aislamiento entre organizaciones en staging.

## Variables de entorno

Copiar `.env.example` a `.env.local`. `SUPABASE_SECRET_KEY` es un secreto de servidor y nunca debe llegar al frontend. La API acepta `SUPABASE_SERVICE_ROLE_KEY` sólo como compatibilidad legacy. `PLATFORM_ADMIN_EMAIL` permite promover de forma controlada la primera cuenta global al iniciar sesión. El endpoint de plataforma envía invitaciones por correo en lugar de aceptar contraseñas temporales.

## Qué quedó fuera de esta carpeta

- Panel web anterior y componentes visuales.
- Web pública y aplicación Android, que se crearán como aplicaciones independientes.
- Módulo académico `PA02`.
- Rutas antiguas `/api/db`.
- Pruebas E2E y reportes de interfaz.

La infraestructura compartida está en `../pos-saas-infra` y el proyecto original permanece intacto en `../pos-saas-main` como respaldo y fuente de migración gradual.
