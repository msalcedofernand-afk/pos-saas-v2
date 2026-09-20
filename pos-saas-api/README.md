# POS SaaS API

Proyecto separado para construir la API central del POS. La interfaz administrativa, la web pública y Android se conectarán a este proyecto por HTTP; ninguna de esas aplicaciones debe conectarse directamente a Supabase.

## Alcance inicial

- API versionada bajo `/api/v1`.
- Acceso server-only a Supabase.
- Seguridad por dispositivo, sesión y roles.
- Productos y categorías como primer módulo.
- Migraciones SQL administradas desde `../pos-saas-infra/supabase/migrations`.

## Rutas iniciales

- `GET /api/v1/health`
- `POST /api/v1/auth/login`
- `POST /api/v1/auth/logout`
- `GET /api/v1/auth/me`
- `GET|POST /api/v1/products`
- `PATCH|DELETE /api/v1/products/:id`
- `GET|POST /api/v1/categories`
- `DELETE /api/v1/categories/:id`

## Variables de entorno

Copiar `.env.example` a `.env.local`. `SUPABASE_SECRET_KEY` es un secreto de servidor y nunca debe llegar al frontend. La API acepta `SUPABASE_SERVICE_ROLE_KEY` sólo como compatibilidad legacy.

## Qué quedó fuera de esta carpeta

- Panel web anterior y componentes visuales.
- Web pública y aplicación Android, que se crearán como aplicaciones independientes.
- Módulo académico `PA02`.
- Rutas antiguas `/api/db`.
- Pruebas E2E y reportes de interfaz.

La infraestructura compartida está en `../pos-saas-infra` y el proyecto original permanece intacto en `../pos-saas-main` como respaldo y fuente de migración gradual.
