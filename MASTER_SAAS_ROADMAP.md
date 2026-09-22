# Roadmap maestro de Mesa Clara SaaS

**Objetivo final:** pasar del POS multiempresa funcional a una plataforma SaaS segura, administrable, soportable y preparada para venderse a restaurantes.

**Estado actual:** fase 0 publicada en `712946d`. El contexto de organización del `platform_admin` ya es explícito y las operaciones críticas requieren restaurante seleccionado.

**Regla de validación:** no se utilizará la máquina local como criterio de aceptación. Cada fase se validará con GitHub Actions, despliegue en staging y pruebas funcionales sobre la web publicada.

## 1. Meta final

Mesa Clara estará listo para vender cuando pueda registrar un restaurante, invitar a su administrador, aislar completamente sus datos, administrar usuarios y roles, suspender y reactivar cuentas, ofrecer soporte temporal auditado, medir actividad, restaurar un backup probado y publicar cambios con pipelines confiables.

Los planes y pagos se agregarán después de comprobar el uso real con los primeros restaurantes. No son necesarios para el piloto inicial, pero sí para vender y automatizar suscripciones a mayor escala.

## 2. Arquitectura objetivo

La plataforma tendrá cuatro superficies separadas:

| Superficie | Propósito | Usuarios |
|---|---|---|
| POS operativo | Pedidos, cocina, caja, inventario y reportes | Personal del restaurante |
| Panel del restaurante | Usuarios, roles, productos, configuración y actividad | Administrador del restaurante |
| Panel global | Organizaciones, usuarios, soporte, auditoría y métricas | Propietario de la plataforma |
| Web comercial | Información, planes y solicitud de alta | Visitantes y prospectos |

El acceso global no debe convertirse automáticamente en acceso operativo. Un `platform_admin` tendrá un contexto global por defecto y solo podrá entrar a un restaurante mediante una selección explícita, con auditoría y alcance definido.

## 3. Reglas que aplican a todas las fases

Toda operación administrativa debe validarse en el servidor. La interfaz puede mejorar la experiencia, pero nunca reemplaza la autorización de API ni las restricciones de base de datos.

Toda migración nueva debe ser compatible con los datos existentes, tener pruebas SQL y ejecutarse primero en staging. No se editarán migraciones ya aplicadas.

Toda acción que cambie usuarios, organizaciones, roles, suscripciones o soporte debe producir auditoría. Los logs no deben contener contraseñas, tokens, enlaces privados ni secretos.

Todo commit debe pasar los workflows de API/database, web smoke y E2E autenticado. Un workflow cancelado no cuenta como aprobado. La prueba debe repetirse sobre el commit final.

## 4. Flujo de entrega con GitHub Actions

Cada fase seguirá exactamente este proceso:

1. Definir el alcance en una issue o documento.
2. Crear cambios pequeños y relacionados.
3. Publicar el commit en GitHub.
4. Esperar API/database checks.
5. Esperar web smoke tests.
6. Esperar authenticated E2E.
7. Confirmar despliegue de staging.
8. Consultar health y readiness.
9. Probar manualmente el flujo en staging.
10. Registrar resultado, riesgos y migraciones.
11. Promover a producción solo con backup y aprobación operativa.

Los workflows mínimos son:

```text
API and database checks
Web smoke tests
Authenticated web E2E
```

## Fase 0 — Seguridad y contexto explícito

**Estado:** completada.
**Commit:** `712946d`.

### Objetivo

Evitar que un administrador global entre accidentalmente al primer restaurante y eliminar superficies innecesarias de autorización directa desde el navegador.

### Implementado

- Eliminación del fallback a la primera organización.
- Selección explícita de organización.
- Auditoría al seleccionar contexto.
- Banner de organización activa.
- Botón “Abrir operación”.
- Requisito de organización para rutas operativas.
- Revocación del acceso directo a `roles`.
- Revocación de ejecución de `has_role` para clientes autenticados.
- Tests de contrato y aislamiento.

### Verificación

- API checks verdes.
- Web smoke verde.
- E2E autenticado verde.
- Migración aplicada en staging.
- Health y readiness correctos.

### Pendiente operativo

Activar en Supabase la protección contra contraseñas filtradas. Esta acción es recomendable y no cambia el modelo funcional actual.

## Fase 1 — Administración completa de organizaciones

**Objetivo:** permitir que el propietario administre restaurantes sin abrir Supabase.

### 1.1 Base de datos

Agregar una migración para completar el modelo de organización si aún faltan campos:

```text
status
suspended_at
suspended_by
suspension_reason
owner_user_id
last_activity_at
```

El estado debe usar valores controlados, por ejemplo:

```text
active
suspended
pending
archived
```

Agregar restricciones para impedir estados inválidos y crear índices para búsquedas por estado y actividad.

### 1.2 API

Crear endpoints protegidos exclusivamente con `platform_admin`:

```text
GET   /api/v1/platform/organizations
GET   /api/v1/platform/organizations/:id
PATCH /api/v1/platform/organizations/:id
POST  /api/v1/platform/organizations/:id/suspend
POST  /api/v1/platform/organizations/:id/reactivate
```

El detalle debe devolver datos administrativos y métricas resumidas, pero no información sensible innecesaria.

La suspensión debe ser idempotente. Si ya está suspendida, debe devolver un resultado controlado. La reactivación debe tener el mismo comportamiento si ya está activa.

Cada endpoint debe validar UUID, organización existente, actor autorizado y motivo cuando sea necesario.

### 1.3 Interfaz

Crear:

```text
/dashboard/platform/organizations
/dashboard/platform/organizations/[id]
```

La lista debe incluir búsqueda, estado, fecha de creación y última actividad. El detalle debe mostrar identidad, administrador principal, usuarios, actividad, estado y acciones disponibles.

La interfaz debe pedir confirmación antes de suspender. La confirmación debe mostrar el restaurante exacto y el efecto esperado.

### 1.4 Comportamiento al suspender

Una organización suspendida no debe poder iniciar sesión operativa ni utilizar pedidos, cocina, caja, inventario o reportes. No se deben borrar productos, pedidos, usuarios ni movimientos.

El administrador global debe poder seguir viendo el detalle y la auditoría de una organización suspendida.

### 1.5 Auditoría

Registrar:

```text
organization_updated
organization_suspended
organization_reactivated
```

Guardar actor, organización, motivo, estado anterior, estado nuevo y fecha.

### 1.6 Pruebas GitHub Actions

- `platform_admin` puede listar y consultar detalles.
- Usuario normal recibe `403`.
- Suspender impide acceso operativo.
- Reactivar devuelve acceso.
- Suspender dos veces no duplica eventos incorrectamente.
- Reactivar dos veces no duplica eventos incorrectamente.
- Suspender no elimina datos.
- Una organización no puede cambiar el estado de otra mediante manipulación de parámetros.

### 1.7 Criterio de salida

El propietario puede suspender y reactivar “Ceciloa rest” desde staging y todos los workflows están verdes.

## Fase 2 — Administración de usuarios y membresías

**Objetivo:** controlar usuarios y roles de todos los restaurantes desde el panel global.

### 2.1 API global

Crear:

```text
GET   /api/v1/platform/users
GET   /api/v1/platform/users/:id
GET   /api/v1/platform/organizations/:id/users
POST  /api/v1/platform/users/:id/block
POST  /api/v1/platform/users/:id/unblock
POST  /api/v1/platform/users/:id/resend-invite
POST  /api/v1/platform/organizations/:id/users
PATCH /api/v1/platform/memberships/:id
DELETE /api/v1/platform/memberships/:id
```

Cada consulta debe permitir paginación, búsqueda y filtros. Las mutaciones deben usar idempotencia cuando puedan repetirse desde la interfaz.

### 2.2 Reglas de negocio

- Un usuario puede pertenecer a varias organizaciones.
- Una membresía debe tener una organización y un rol válidos.
- Cada organización activa debe tener al menos un administrador.
- No se puede eliminar el último administrador sin designar reemplazo.
- `platform_admin` no se asigna desde el CRUD normal de roles.
- Bloquear un usuario debe impedir login y operaciones.
- Revocar membresía debe retirar únicamente el acceso a esa organización.

### 2.3 Interfaz

Crear:

```text
/dashboard/platform/users
/dashboard/platform/organizations/[id]/users
```

La tabla debe mostrar correo, nombre, estado, organización, rol y última actividad. Las acciones peligrosas deben requerir confirmación y mostrar el objetivo completo.

### 2.4 Invitaciones

El reenvío debe usar Supabase Auth desde servidor. No se deben generar contraseñas ni devolver enlaces privados en la respuesta de API.

Debe existir un límite de reenvíos para evitar abuso. El error de límite debe ser comprensible y quedar auditado.

### 2.5 Pruebas GitHub Actions

- Un admin de Restaurante A no ve usuarios de Restaurante B.
- `platform_admin` ve usuarios globales.
- Bloquear impide login.
- Desbloquear permite login.
- Revocar membresía elimina solo ese acceso.
- Cambiar rol cambia permisos.
- No se puede retirar el último admin.
- No se puede promover `platform_admin` desde una pantalla de restaurante.
- Reenviar invitación no duplica usuarios.

### 2.6 Criterio de salida

El propietario administra usuarios de dos restaurantes sin acceder directamente a Supabase y todas las acciones aparecen en auditoría.

## Fase 3 — Auditoría visible y gobierno administrativo

**Objetivo:** revisar desde la web qué ocurrió en la plataforma.

### 3.1 API

Crear:

```text
GET /api/v1/platform/audit
GET /api/v1/platform/audit/:id
```

Permitir filtros por actor, organización, acción, entidad y rango de fechas. Usar paginación obligatoria para evitar respuestas grandes.

### 3.2 Interfaz

Crear:

```text
/dashboard/platform/audit
```

Mostrar fecha, actor, organización, acción, resultado y entidad afectada. Un panel de detalle puede mostrar valores anteriores y nuevos filtrando campos sensibles.

### 3.3 Eventos

Registrar como mínimo:

- Creación de organización.
- Actualización de organización.
- Suspensión y reactivación.
- Invitación y reenvío.
- Bloqueo y desbloqueo.
- Cambio de rol.
- Revocación de membresía.
- Selección de contexto.
- Inicio y fin de soporte.
- Cambios de plan.

### 3.4 Protección

Los logs deben ser solo de inserción para la aplicación. No se deben editar ni borrar desde la interfaz. La consulta global debe estar protegida por `platform_admin`.

### 3.5 Pruebas

Cada mutación debe producir un evento esperado. Un usuario operativo no puede consultar auditoría global. Los valores sensibles deben estar ausentes de respuestas y logs.

### 3.6 Criterio de salida

El propietario puede investigar una acción administrativa completa desde la interfaz sin usar SQL.

## Fase 4 — Soporte seguro y acceso temporal

**Objetivo:** resolver incidencias sin impersonación silenciosa.

### 4.1 Modelo de datos

Crear:

```text
support_access_grants
support_sessions
support_actions
```

Cada autorización debe guardar actor, organización, motivo, alcance, modo, inicio, vencimiento, revocación y estado.

### 4.2 Inicio de soporte

El operador selecciona organización y motivo. El sistema crea un permiso temporal. El modo predeterminado es lectura. Los permisos de escritura deben estar separados.

### 4.3 Interfaz

Mostrar un banner permanente con restaurante, operador, motivo, modo y tiempo restante. El operador debe poder salir manualmente.

### 4.4 Seguridad

- No iniciar soporte sin motivo.
- No entrar a organizaciones suspendidas salvo permiso explícito de recuperación.
- No conservar soporte después de vencimiento.
- No usar cookies ambiguas.
- Validar el grant en cada request.
- Auditar cada mutación.

### 4.5 API

Crear:

```text
POST /api/v1/platform/support/access
GET  /api/v1/platform/support/access
POST /api/v1/platform/support/access/:id/revoke
POST /api/v1/platform/support/session
DELETE /api/v1/platform/support/session
```

### 4.6 Pruebas

- Acceso sin motivo: rechazado.
- Organización equivocada: rechazada.
- Acceso vencido: rechazado.
- Modo lectura: no permite escrituras.
- Modo escritura: audita cada cambio.
- Revocación inmediata: bloquea nuevas operaciones.

### 4.7 Criterio de salida

El soporte puede revisar un restaurante con lectura temporal, sin impersonar a un usuario y dejando trazabilidad completa.

## Fase 5 — Métricas, salud y operación SaaS

**Objetivo:** supervisar el uso y los problemas de todos los restaurantes.

### 5.1 Métricas globales

Mostrar:

- Organizaciones activas.
- Organizaciones suspendidas.
- Organizaciones pendientes.
- Usuarios activos.
- Invitaciones pendientes.
- Pedidos del periodo.
- Ventas agregadas.
- Última actividad.
- Errores de API.

### 5.2 Métricas por organización

Mostrar usuarios, productos, pedidos, ventas, caja, inventario, última sesión y errores recientes.

Las consultas deben usar agregaciones y límites para no afectar al POS. Las métricas globales no deben devolver datos operativos detallados sin contexto y permiso.

### 5.3 Monitoreo externo

Configurar monitores para:

```text
GET https://mesa-clara-api-staging.vercel.app/api/v1/health/ready
GET https://pos-saas-v2.vercel.app/status
```

En producción se deben usar los dominios canónicos de producción.

### 5.4 Alertas

Alertar ante caída de API, readiness fallido, errores 5xx, fallos de invitación, provisionamiento incompleto y aumento de latencia.

### 5.5 Criterio de salida

El propietario puede identificar problemas por restaurante antes de recibir una queja del cliente.

## Fase 6 — Calidad, backups y despliegue controlado

**Objetivo:** que cada cambio sea verificable y reversible sin depender de la máquina local.

### 6.1 API/database workflow

Debe realizar:

- Checkout limpio.
- `npm ci`.
- Auditoría de dependencias.
- Lint.
- TypeScript.
- Tests de contrato.
- Inicio de Supabase en el runner.
- Aplicación de migraciones desde cero.
- pgTAP.
- Aislamiento.
- Concurrencia.
- Lint de base.
- Build de API.

### 6.2 Web workflow

Debe realizar:

- Checkout limpio.
- `npm ci`.
- Auditoría.
- Lint.
- Prettier.
- TypeScript.
- Build.
- Smoke tests.

### 6.3 E2E staging

Debe ejecutar contra staging:

- Login.
- Logout.
- Recuperación.
- Roles.
- Pedidos.
- Cocina.
- Caja.
- Inventario.
- Aislamiento.
- Panel global.
- Suspensión.
- Reactivación.
- Invitaciones.
- Soporte temporal cuando esté implementado.

### 6.4 Backup

Antes de migraciones importantes:

1. Crear backup fuera del repositorio.
2. Registrar proyecto, fecha, commit y migración.
3. Restaurar en proyecto temporal.
4. Verificar esquema y datos esenciales.
5. Guardar evidencia del resultado.

### 6.5 Rollback

Para código, volver al deployment anterior de Vercel. Para base de datos, publicar una migración hacia adelante. No borrar migraciones aplicadas.

### 6.6 Criterio de salida

Ningún commit se promueve si un workflow está fallando, cancelado o no corresponde al commit final.

## Fase 7 — Planes, límites y uso

**Objetivo:** preparar el modelo comercial después de validar el piloto.

### 7.1 Tablas

Crear:

```text
plans
organization_subscriptions
organization_limits
usage_counters
```

### 7.2 Definición de planes

Cada plan debe indicar usuarios, sucursales, productos, pedidos, almacenamiento y módulos incluidos. Mantener pocos planes al inicio para no complicar soporte.

### 7.3 Estados

Usar estados controlados:

```text
trial
active
past_due
suspended
cancelled
expired
```

Guardar fecha de inicio, renovación, vencimiento, cancelación y motivo de suspensión.

### 7.4 Aplicación de límites

Los límites deben verificarse en API y base de datos. El frontend solo informa. Los errores deben tener códigos estables.

### 7.5 Pruebas

- Dentro del límite: permite operación.
- Sobre el límite: devuelve error controlado.
- Una organización no consume cuota de otra.
- Cambio de plan actualiza límites.
- Suspensión afecta solo la organización correcta.

### 7.6 Criterio de salida

El sistema puede aplicar planes distintos a dos restaurantes sin mezclar límites ni datos.

## Fase 8 — Suscripciones y pagos

**Objetivo:** vender acceso y automatizar renovaciones.

### 8.1 Decisiones previas

Definir precio, moneda, impuestos, cancelaciones, reembolsos, renovación, periodo de gracia y responsable de soporte.

### 8.2 Integración

Implementar checkout, portal de cliente, webhooks firmados, estado de suscripción y sincronización idempotente.

### 8.3 Seguridad

- Verificar firma de webhook.
- No confiar en el frontend.
- Registrar cada evento.
- Procesar duplicados sin doble efecto.
- Separar staging y producción.
- No guardar datos completos de tarjetas.

### 8.4 Web comercial

Crear páginas de producto, planes, preguntas frecuentes, contacto y solicitud de alta. El registro público puede mantenerse cerrado inicialmente y usar invitación global.

### 8.5 Criterio de salida

Un restaurante puede contratar un plan, pagar, renovar, cancelar y recibir los límites correctos.

## Fase 9 — Escalamiento, soporte y gobierno

**Objetivo:** preparar la operación para más clientes y más operadores.

### Funciones

- Tickets de soporte.
- Comentarios internos y del cliente.
- Archivos adjuntos controlados.
- SLA por plan.
- Operadores con permisos limitados.
- Segundo administrador global.
- Rotación de secretos.
- Registro de incidentes.
- Procedimiento de recuperación.

### Roles globales futuros

Separar responsabilidades:

```text
platform_owner
platform_admin
support_agent
billing_admin
security_auditor
```

No todos los operadores deben poder crear restaurantes, ver facturación o entrar en modo soporte.

### Criterio de salida

La plataforma puede operar con varios responsables sin entregar permisos globales innecesarios.

## 10. Matriz de pruebas por fase

| Fase | API | Base de datos | Web | E2E staging |
|---|---|---|---|---|
| 0 | Autorización y contexto | RLS y roles | Banner y selector | Aislamiento |
| 1 | CRUD de organización | Estados y restricciones | Lista y detalle | Suspender/reactivar |
| 2 | Usuarios y membresías | Integridad de roles | Tablas y acciones | Bloqueo y roles |
| 3 | Consulta paginada | Inmutabilidad | Filtros | Auditoría visible |
| 4 | Grants y sesiones | Expiración | Banner soporte | Lectura y escritura |
| 5 | Métricas agregadas | Índices | Dashboard global | Salud y actividad |
| 6 | Workflows | Migraciones | Smoke | Suite completa |
| 7 | Límites | Cuotas | Estado del plan | Exceso de límite |
| 8 | Webhooks | Suscripciones | Checkout | Renovación y cancelación |
| 9 | Tickets y permisos | Gobierno | Soporte | Flujo de incidente |

## 11. Orden de implementación recomendado

### Bloque A — Primeros restaurantes

Completar fases 1, 2, 3 y 6. Esto permite administrar organizaciones, usuarios y auditoría con despliegue confiable.

### Bloque B — Soporte controlado

Completar fase 4 y una parte de fase 5 antes de superar dos restaurantes. El acceso de soporte y las métricas reducen el riesgo operativo.

### Bloque C — Producto comercial

Completar fases 7 y 8 después de validar uso, precios y necesidades reales. No integrar pagos solo por tener la infraestructura técnica.

### Bloque D — Escalamiento

Completar fase 9 cuando existan varios clientes, varios operadores o una necesidad real de soporte formal.

## 12. Definición de listo para el piloto

Antes de usar Mesa Clara con dos restaurantes deben cumplirse estas condiciones:

- Registro por invitación.
- Login y recuperación funcionando.
- Organización explícita.
- Datos aislados.
- Usuarios y roles administrables.
- Suspensión y reactivación.
- Auditoría visible.
- Backup restaurable.
- Health y readiness monitoreados.
- API, web y E2E verdes en GitHub Actions.

## 13. Definición de listo para vender

Antes de vender a más clientes deben cumplirse además:

- Soporte temporal auditado.
- Métricas por organización.
- Planes y límites.
- Política de suspensión.
- Política de recuperación.
- Monitoreo externo.
- Procedimiento de incidentes.
- Separación real de staging y producción.
- Suscripciones y pagos probados, si se cobrará automáticamente.

## 14. Siguiente orden concreta

El orden exacto de ejecución será:

1. Implementar Fase 1 completa.
2. Pasar API/database, web smoke y E2E en GitHub Actions.
3. Verificar staging.
4. Implementar Fase 2.
5. Repetir los tres workflows.
6. Implementar Fase 3.
7. Verificar auditoría completa.
8. Implementar Fase 4 antes de aumentar el número de restaurantes.
9. Implementar Fase 5 para monitoreo y métricas.
10. Consolidar Fase 6 como requisito permanente.
11. Implementar Fase 7 solo después del piloto.
12. Implementar Fase 8 cuando exista un modelo de cobro definido.
13. Implementar Fase 9 cuando la operación lo justifique.

El siguiente trabajo de implementación será la **Fase 1 completa**, no una parte aislada: base de datos, API, interfaz, auditoría, suspensión, reactivación, pruebas y validación en staging mediante GitHub Actions.
