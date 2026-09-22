# POS SaaS V2 — Guía de operación

Guía funcional y técnica para desarrollar, desplegar y operar el POS SaaS.

> Estado de referencia: Fase 2 en el commit que publique este cambio — 22 de septiembre de 2026.

## 1. Qué es el sistema

POS SaaS V2 es una plataforma multi-tenant para restaurantes. Cada restaurante
opera dentro de una organización aislada y la API centraliza autenticación,
autorización y reglas de negocio.

El sistema tiene dos niveles de acceso:

| Nivel | Rol | Responsabilidad |
|---|---|---|
| Plataforma | `platform_admin` | Administra todo el SaaS, registra restaurantes y envía invitaciones. |
| Restaurante | `admin` | Administra únicamente su organización, usuarios y operación. |

El rol `platform_admin` no se asigna desde la configuración normal de un
restaurante.

## 2. Componentes

```text
pos-saas-web   → Interfaz Next.js para usuarios y plataforma
       │
       ├── HTTPS, cookies y CORS
       ▼
pos-saas-api   → API Next.js, auth, autorización y reglas de negocio
       │
       ▼
Supabase       → Auth y PostgreSQL multi-tenant

pos-saas-infra  → Migraciones, validaciones y scripts operativos
```

Directorios principales:

- `pos-saas-web`: login, dashboard, recuperación de contraseña y panel global.
- `pos-saas-api`: endpoints `/api/v1`, sesiones, CSRF, roles y provisioning.
- `pos-saas-infra`: migraciones y preflight de base de datos.
- `docs`: documentación operativa de este proyecto.

## 3. Entornos actuales

| Superficie | URL |
|---|---|
| Web publicada | `https://pos-saas-v2.vercel.app` |
| API de staging | `https://mesa-clara-api-staging.vercel.app` |
| Supabase staging | proyecto `vxdwguoguxxypesviais` |
| Web local | `http://localhost:3001` |
| API local | `http://localhost:3000` |

La web y la API deben pertenecer al mismo entorno lógico. Si se separan
producción y staging, cada entorno debe usar su propio proyecto Supabase y sus
propias variables.

## 4. Variables de entorno

### API (`pos-saas-api`)

Configúralas en Vercel, nunca en el navegador:

```env
NEXT_PUBLIC_SUPABASE_URL=https://<project-ref>.supabase.co
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=<publishable-key>
SUPABASE_SECRET_KEY=<server-only-secret>
PLATFORM_ADMIN_EMAIL=<correo-del-propietario-global>
WEB_ORIGIN=https://<dominio-exacto-de-la-web>
AUTH_COOKIE_SECURE=true
AUTH_COOKIE_SAME_SITE=lax
```

`SUPABASE_SECRET_KEY` y cualquier `service_role` son secretos de servidor. No
los uses con prefijo `NEXT_PUBLIC_` ni los guardes en el frontend.

### Web (`pos-saas-web`)

Estas variables sí pueden exponerse al navegador:

```env
NEXT_PUBLIC_API_URL=https://<dominio-de-la-api>
NEXT_PUBLIC_SITE_URL=https://<dominio-de-la-web>
NEXT_PUBLIC_SUPABASE_URL=https://<project-ref>.supabase.co
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=<publishable-key>
NEXT_PUBLIC_BUSINESS_TIMEZONE=America/Lima
```

La web no debe recibir `SUPABASE_SECRET_KEY`.

## 5. Primer acceso del administrador global

El bootstrap global es intencionalmente controlado y de un solo uso.

1. Crea o invita al correo configurado en `PLATFORM_ADMIN_EMAIL` desde Supabase Auth.
2. Configura el mismo correo en la API de Vercel para `Production` y/o `Preview`.
3. El propietario acepta la invitación o establece su contraseña.
4. Inicia sesión desde la web publicada.
5. La API crea el rol `platform_admin` y registra la auditoría.
6. La aplicación redirige a `/dashboard/platform`.

No se usa una contraseña temporal fija. El sistema no guarda contraseñas
temporales y la invitación se envía por Supabase Auth.

## 6. Registrar un restaurante

Desde `/dashboard/platform`, el administrador global completa:

```text
Nombre del restaurante
Slug único
Nombre del administrador
Correo del administrador
```

El endpoint es:

```text
POST /api/v1/platform/organizations
```

Requiere:

- sesión autenticada;
- rol global `platform_admin`;
- `Idempotency-Key` entre 16 y 128 caracteres;
- nombre, slug, nombre del administrador y correo válidos.

El flujo realiza lo siguiente:

1. Reclama la clave de idempotencia.
2. Invita al administrador mediante Supabase Auth.
3. Crea la organización.
4. Asigna el rol `admin` únicamente dentro de esa organización.
5. Registra auditoría de éxito.
6. Devuelve la organización creada.

Si falla un paso, elimina los recursos provisionales y registra auditoría de
error. No se debe repetir el formulario rápidamente; el cliente ya envía una
clave de idempotencia para proteger contra doble envío.

## 7. Administrar una organización

El panel global permite buscar por nombre, slug y estado desde:

```text
/dashboard/platform/organizations
```

El detalle administrativo está disponible en:

```text
/dashboard/platform/organizations/<organization-id>
```

Endpoints protegidos exclusivamente con `platform_admin`:

```text
GET   /api/v1/platform/organizations
GET   /api/v1/platform/organizations/:id
PATCH /api/v1/platform/organizations/:id
POST  /api/v1/platform/organizations/:id/suspend
POST  /api/v1/platform/organizations/:id/reactivate
```

La lista acepta `search` y `status`. El detalle muestra administrador
principal, usuarios, productos, pedidos recientes y actividad. Las acciones
de nombre, suspensión y reactivación requieren `Idempotency-Key`.

Suspender cambia `status` a `suspended` e `is_active` a `false`; no elimina
productos, pedidos, usuarios ni movimientos. El acceso operativo queda
bloqueado porque la autenticación exige una organización activa. Reactivar
restaura el acceso y limpia los datos de suspensión. Cada cambio real genera
un evento en `platform_audit_logs`; repetir la misma solicitud devuelve la
respuesta guardada sin duplicar auditoría.

## 8. Administrar usuarios y membresías globales

Desde `/dashboard/platform/users`, un `platform_admin` puede consultar todos
los usuarios y filtrar por restaurante, bloquear o desbloquear cuentas,
reenviar invitaciones, agregar usuarios a una organización, cambiar roles y
revocar membresías.

Endpoints globales:

```text
GET    /api/v1/platform/users
POST   /api/v1/platform/users/:id/block
POST   /api/v1/platform/users/:id/unblock
POST   /api/v1/platform/users/:id/invite
GET    /api/v1/platform/organizations/:id/members
POST   /api/v1/platform/organizations/:id/members
PATCH  /api/v1/platform/organizations/:id/members/:userId
DELETE /api/v1/platform/organizations/:id/members/:userId
```

Las acciones mutables requieren `Idempotency-Key`. La base de datos bloquea
las membresías de la organización durante el cambio y rechaza cualquier
operación que deje a la organización sin administrador. `platform_admin` no
puede asignarse como rol de restaurante. Cada cambio se guarda en
`platform_audit_logs`; las tablas de solicitudes y funciones administrativas
solo son ejecutables por `service_role`.

Bloquear actualiza el perfil operativo y aplica una suspensión de Auth desde
el servidor. Desbloquear revierte ambas condiciones. Las invitaciones no usan
contraseñas fijas: Supabase Auth envía el enlace.

## 9. Recuperación de contraseña

Rutas de la web:

```text
/login/forgot-password
/auth/update-password
```

El flujo usa `resetPasswordForEmail` y posteriormente `updateUser` de Supabase
Auth. En Supabase configura:

- **Site URL**: dominio público de la web.
- **Redirect URL**:
  `https://<dominio-de-la-web>/auth/update-password`

Los enlaces enviados por el proveedor SMTP integrado tienen un límite bajo. Si
se supera, espera al restablecimiento del límite o configura SMTP propio.

## 10. API esencial

### Salud

```powershell
curl.exe -i https://<api>/api/v1/health
curl.exe -i https://<api>/api/v1/health/ready
```

`health/ready` debe devolver HTTP `200` y `"supabase":"ok"`.

### Autenticación

```text
POST /api/v1/auth/login
POST /api/v1/auth/logout
GET  /api/v1/auth/me
GET  /api/v1/auth/csrf
```

### Plataforma y organizaciones

```text
GET  /api/v1/platform/organizations
POST /api/v1/platform/organizations
GET  /api/v1/platform/organizations/:id
PATCH /api/v1/platform/organizations/:id
POST /api/v1/platform/organizations/:id/suspend
POST /api/v1/platform/organizations/:id/reactivate
GET  /api/v1/organizations
```

### Usuarios y membresías globales

```text
GET    /api/v1/platform/users
POST   /api/v1/platform/users/:id/block
POST   /api/v1/platform/users/:id/unblock
POST   /api/v1/platform/users/:id/invite
GET    /api/v1/platform/organizations/:id/members
POST   /api/v1/platform/organizations/:id/members
PATCH  /api/v1/platform/organizations/:id/members/:userId
DELETE /api/v1/platform/organizations/:id/members/:userId
```

### Operación del restaurante

```text
/api/v1/dashboard/metrics
/api/v1/products
/api/v1/categories
/api/v1/orders
/api/v1/kitchen/orders
/api/v1/kitchen/summary
/api/v1/inventory
/api/v1/cash
/api/v1/reports/summary
/api/v1/settings/users
/api/v1/settings/roles
```

Las rutas protegidas requieren cookies de sesión, organización activa y los
controles de autorización correspondientes.

## 11. Seguridad operativa

- No compartas tokens de recuperación ni URLs con `access_token`.
- Rota la contraseña si un token fue pegado en un chat o ticket.
- Mantén `SUPABASE_SECRET_KEY` únicamente en Vercel API.
- No asignes roles globales desde `user_metadata` ni desde el frontend.
- Mantén RLS habilitado en las tablas expuestas.
- No edites migraciones ya aplicadas; crea una migración correctiva nueva.
- Conserva `WEB_ORIGIN` sin barra final y exactamente igual al origen de la web.
- Revisa auditoría después de bootstrap y provisioning.
- Usa SMTP propio antes de abrir el onboarding a más usuarios.

## 12. Desarrollo local

API:

```powershell
cd pos-saas-api
npm.cmd install
npm.cmd run dev
```

Web:

```powershell
cd pos-saas-web
npm.cmd install
npm.cmd run dev
```

Validaciones web:

```powershell
npm.cmd run typecheck
npm.cmd run lint
npm.cmd run format:check
npm.cmd run build
```

Validaciones API:

```powershell
cd pos-saas-api
npm.cmd run typecheck
npm.cmd run lint
npm.cmd test
npm.cmd run build
```

## 13. Despliegue

1. Confirma que GitHub contiene el commit esperado.
2. Despliega la API desde `pos-saas-api`.
3. Configura variables privadas de la API en Vercel.
4. Comprueba `health` y `health/ready`.
5. Verifica CORS con el origen exacto de la web.
6. Despliega la web desde `pos-saas-web`.
7. Configura las variables públicas de la web.
8. Configura Site URL y Redirect URLs en Supabase.
9. Ejecuta una recuperación de contraseña con una sola solicitud.
10. Inicia sesión con el propietario y verifica `/dashboard/platform`.
11. Registra un restaurante de prueba y confirma la invitación.

No consideres terminado un despliegue si solo compila: también debe pasar
health, readiness, CORS, login, aislamiento por organización y provisioning.

## 14. Resolución de problemas

### `Failed to fetch`

Comprueba `NEXT_PUBLIC_API_URL` en la web y `WEB_ORIGIN` en la API. Ambos deben
usar HTTPS y dominios exactos, sin barra final en `WEB_ORIGIN`.

### La recuperación vuelve a `localhost`

Configura `Site URL`, `Redirect URLs` y vuelve a solicitar un enlace nuevo.
Nunca reutilices un token de recuperación antiguo.

### `email rate limit exceeded`

El proveedor SMTP integrado alcanzó su límite. Espera antes de repetir o
configura SMTP propio.

### `Credenciales inválidas`

La aplicación no conoce una contraseña temporal. Usa una invitación o el flujo
de recuperación. No pruebes contraseñas compartidas en chats.

### No aparece `/dashboard/platform`

Confirma que `PLATFORM_ADMIN_EMAIL` está en el entorno de la API que realmente
sirve la web. El bootstrap ocurre durante el login de la API, no al crear el
usuario directamente en la tabla de Auth.

### Vercel muestra login o `302`

El despliegue tiene protección de Vercel. Inicia sesión en Vercel o revisa la
política de protección del entorno de staging.

## 15. Decisiones importantes

- Se eligió `platform_admin` separado de `admin` para evitar que un restaurante
  pueda administrar todo el SaaS.
- Se eligieron invitaciones en lugar de contraseñas temporales para reducir el
  riesgo de credenciales compartidas.
- Se usa idempotencia, rollback y auditoría porque registrar una organización
  coordina Auth, base de datos y membresías.
- Se mantiene un monolito modular Next.js porque el sistema aún comparte
  autenticación, dominio y despliegue; separar servicios ahora aumentaría el
  costo operativo sin beneficio proporcional.

## 16. Mantenimiento documental

Actualiza esta guía cuando cambien:

- variables de entorno;
- dominios de Vercel;
- migraciones o roles;
- flujos de Auth;
- endpoints públicos;
- procedimientos de rollback.

Cada cambio de seguridad o autenticación debe incluir una prueba y una nota en
esta documentación antes de publicarse.
