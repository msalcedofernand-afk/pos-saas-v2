# Plan detallado de evolución de Mesa Clara hacia SaaS

**Versión:** 1.0
**Estado de partida:** commit `af93db0` en `main`
**Entorno inicial:** staging
**Objetivo:** convertir el MVP POS multiempresa actual en una plataforma SaaS segura, operable con los primeros restaurantes y preparada para crecer posteriormente.

## 1. Decisión ejecutiva

La base actual ya permite operar un POS multiempresa con login, recuperación de contraseña, roles de restaurante, aislamiento por organización, productos, pedidos, cocina, caja, inventario, reportes y un panel global básico. No es necesario reconstruir el producto.

La evolución debe hacerse en este orden: **seguridad de contexto**, **administración global**, **soporte auditado**, **operación y calidad**, y finalmente **planes comerciales y suscripciones**. Este orden evita invertir en facturación o marketing mientras todavía existen riesgos de acceso cruzado entre organizaciones.

Para el piloto con uno o dos restaurantes, las fases 0, 1 y una parte de la fase 2 son obligatorias. Las fases 3 y 4 pueden implementarse después de validar el uso diario con los primeros clientes.

## 2. Estado actual y alcance objetivo

| Área | Estado actual | Objetivo de la primera versión SaaS |
|---|---|---|
| POS operativo | Funcional | Mantener y cubrir con E2E por rol |
| Multiempresa | Implementado | Contexto de organización explícito |
| `platform_admin` | Implementado | Administración global sin organización implícita |
| Registro de restaurantes | Implementado | Provisioning idempotente y recuperable |
| Usuarios y roles | Parcial | Gestión global y por restaurante |
| Soporte | No implementado | Acceso temporal, lectura inicial y auditoría |
| Auditoría | Parcial | Historial visible de acciones administrativas |
| Métricas | Dashboard básico | Métricas por organización |
| Planes y límites | No implementado | Agregar cuando existan clientes de pago |
| Facturación | No implementado | Integrar solo cuando se defina el modelo comercial |
| Operación | Health y readiness | Backups probados, monitoreo y rollback documentado |

## 3. Reglas de trabajo para todas las fases

Cada cambio de base de datos debe publicarse como una migración nueva. No se deben editar migraciones ya aplicadas. Toda mutación administrativa debe ejecutarse en servidor, validar permisos y generar un registro de auditoría.

Las pruebas deben ejecutarse en tres niveles. La interfaz debe validar formato y experiencia. La API debe validar esquema, autorización e idempotencia. PostgreSQL debe proteger invariantes, claves únicas, relaciones y aislamiento mediante restricciones y RLS.

Los cambios deben entrar por ramas pequeñas y revisables. Cada fase debe terminar con lint, TypeScript, formato, build, pruebas unitarias, pruebas SQL y E2E afectadas. El despliegue debe comenzar en staging y avanzar a producción solo después de comprobar health, readiness y flujos reales.

## 4. Fase 0 — Seguridad y estabilidad

**Prioridad:** inmediata.
**Criterio de salida:** ningún `platform_admin` entra a una organización por accidente y las políticas RLS no dependen de una función ejecutable innecesariamente por usuarios finales.

### 4.1 Corregir el contexto de organización

El código actual puede seleccionar la primera organización activa cuando un `platform_admin` no tiene membresía. Ese fallback debe eliminarse.

La autenticación debe devolver `organizationId: null` para un administrador global sin contexto seleccionado. Las rutas globales deben funcionar sin organización operativa. Las rutas de restaurante deben exigir un `x-organization-id` válido y autorizado o una sesión con membresía explícita.

Debe distinguirse entre dos contextos:

- **Contexto global:** listar organizaciones, crear organizaciones y consultar auditoría global.
- **Contexto operativo:** trabajar con pedidos, caja, cocina, productos o reportes de una organización concreta.

El panel global no debe reutilizar silenciosamente la primera organización como contexto operativo.

### 4.2 Diseñar la selección explícita

Crear un flujo de selección de organización con estas propiedades:

1. El usuario global elige un restaurante desde el panel de plataforma.
2. El sistema guarda el contexto solo para la sesión actual o para una selección explícita persistida.
3. La API valida que la organización exista y esté activa.
4. Cada petición operativa registra el contexto seleccionado.
5. El usuario puede salir del modo de organización y volver al panel global.

La selección no debe otorgar membresía permanente. Debe ser una autorización temporal de soporte, separada del rol `admin` del restaurante.

### 4.3 Revisar `has_role` y las políticas RLS

Primero se debe inventariar cada política que llama `public.has_role`. Después se deben sustituir las comprobaciones ambiguas por condiciones que incluyan explícitamente `organization_members.organization_id` y `auth.uid()`.

Cuando todas las políticas estén migradas, se debe revocar la ejecución para `authenticated` si ya no es necesaria. La migración correctiva debe incluir una justificación y pruebas de regresión para usuarios `admin`, `waiter`, `kitchen`, `cashier` y `staff`.

No se debe aplicar una revocación aislada antes de actualizar las políticas, porque podría bloquear operaciones legítimas o producir errores difíciles de distinguir de un fallo de autorización.

### 4.4 Endurecer el provisioning

El endpoint global ya utiliza idempotencia e invitaciones. Debe añadirse una prueba de fallo en cada paso: invitación, organización, rol, membresía, auditoría y cierre de la solicitud. El resultado esperado es que no queden usuarios huérfanos, organizaciones incompletas ni solicitudes atascadas indefinidamente.

La tabla de solicitudes debe incorporar una política de recuperación para estados `processing` antiguos. Por ejemplo, una solicitud bloqueada por más de quince minutos debe poder reintentarse mediante una operación administrativa segura, sin permitir dos provisionamientos simultáneos.

### 4.5 Criterios de aceptación de la fase 0

- Un `platform_admin` sin organización no recibe una organización automática.
- Un usuario de Restaurante A no puede leer ni modificar datos de Restaurante B.
- Un `admin` de restaurante recibe `403` al invocar rutas globales.
- La selección explícita de organización aparece en logs de auditoría.
- Las pruebas RLS y E2E pasan para todos los roles existentes.
- No quedan secretos, tokens ni contraseñas en commits, logs o respuestas HTTP.

## 5. Fase 1 — Acceso, invitaciones y onboarding

**Prioridad:** inmediata para operar con clientes.
**Criterio de salida:** un administrador puede recibir una invitación, establecer su contraseña y entrar únicamente a su organización.

### 5.1 Completar las pantallas de autenticación

Las rutas públicas necesarias son:

- `/login`
- `/login/forgot-password`
- `/auth/update-password`
- `/auth/accept-invite`
- `/auth/pending`
- `/auth/blocked`

El flujo de invitación debe detectar si el enlace expiró, ya fue utilizado o pertenece a otro entorno. Los mensajes deben ser claros sin revelar si un correo existe en la base cuando la solicitud sea pública.

### 5.2 Configurar el correo transaccional

Supabase debe utilizar SMTP propio o un proveedor transaccional configurado para staging y producción. La configuración debe incluir URL del sitio, redirect URL de recuperación y redirect URL de invitación.

Antes de probar onboarding real se debe verificar:

- Entrega del correo.
- Dominio remitente.
- Enlace HTTPS.
- Expiración del enlace.
- Uso único del enlace.
- Cambio de contraseña.
- Redirección al panel correcto.

### 5.3 Reglas de alta

El panel global debe solicitar nombre del restaurante, slug, nombre del administrador y correo. El servidor debe normalizar el correo, convertir el slug a minúsculas, validar longitud y aplicar unicidad en base de datos.

No se deben aceptar contraseñas administrativas desde el panel global. La cuenta debe configurarse mediante invitación. La respuesta de la API debe indicar que la invitación fue enviada, sin devolver tokens ni enlaces privados.

### 5.4 Criterios de aceptación de la fase 1

- Cecilia recibe la invitación de “Ceciloa rest”.
- Cecilia puede establecer su contraseña sin intervención manual en base de datos.
- Cecilia entra con rol `admin` únicamente en “Ceciloa rest”.
- Un enlace de invitación expirado muestra un estado controlado.
- Un correo duplicado produce un conflicto claro y no crea una organización parcial.
- El flujo de recuperación funciona en staging y producción con dominios correctos.

## 6. Fase 2 — Panel global completo

**Prioridad:** siguiente bloque de producto.
**Criterio de salida:** el propietario puede administrar restaurantes y usuarios sin acceder directamente a Supabase.

### 6.1 Estructura de rutas

Crear las siguientes superficies:

```text
/dashboard/platform
/dashboard/platform/organizations
/dashboard/platform/organizations/[id]
/dashboard/platform/users
/dashboard/platform/audit
/dashboard/platform/settings
```

El panel inicial puede conservar el registro y el listado actuales. La siguiente iteración debe separar el resumen global de los detalles de cada organización.

### 6.2 Detalle de organización

El detalle debe mostrar nombre, slug, estado, fecha de alta, administrador principal, cantidad de usuarios, cantidad de productos, pedidos recientes y estado de la última actividad.

Las acciones iniciales deben ser:

- Editar nombre y datos no sensibles.
- Suspender organización.
- Reactivar organización.
- Reenviar invitación del administrador.
- Ver usuarios y membresías.
- Ver eventos de auditoría.

Suspender una organización debe impedir login operativo o acceso a sus rutas, pero no debe borrar datos. Reactivar debe ser reversible y auditable.

### 6.3 Administración global de usuarios

Crear un listado con búsqueda por correo, nombre, organización, rol y estado. Cada acción debe confirmar el objetivo antes de ejecutarse y mostrar el resultado.

Las acciones mínimas son:

- Bloquear usuario.
- Desbloquear usuario.
- Reenviar invitación.
- Consultar organizaciones asociadas.
- Consultar roles.
- Cambiar rol dentro de una organización.
- Revocar una membresía.

El sistema debe impedir retirar el último administrador de una organización sin designar un reemplazo. También debe impedir bloquear al último administrador global sin un segundo administrador global confirmado.

### 6.4 Auditoría visible

La pantalla de auditoría debe permitir filtrar por actor, organización, acción, tipo de entidad y fecha. Las entradas deben ser inmutables para el usuario de interfaz.

Las acciones mínimas que deben registrarse son:

- Creación de organización.
- Suspensión y reactivación.
- Invitación y reenvío de invitación.
- Bloqueo y desbloqueo.
- Cambios de rol.
- Entrada y salida del modo soporte.
- Cambios de plan o límites cuando existan.

### 6.5 Criterios de aceptación de la fase 2

- Se puede administrar “Ceciloa rest” sin usar el dashboard de Supabase.
- Una organización suspendida no puede operar.
- Todas las acciones administrativas generan auditoría.
- El panel no expone contraseñas, tokens ni secretos.
- El último administrador de una organización no puede eliminarse accidentalmente.

## 7. Fase 3 — Soporte seguro

**Prioridad:** necesaria antes de atender varios clientes.
**Criterio de salida:** el soporte puede ayudar sin impersonar silenciosamente a un usuario.

### 7.1 Modelo de acceso temporal

El soporte debe solicitar una organización, un motivo y una duración. El acceso debe tener expiración automática. El modo de solo lectura debe ser el comportamiento predeterminado.

Las operaciones de escritura deben requerir una segunda confirmación y registrar actor, organización, motivo, entidad modificada y valores anteriores y nuevos.

### 7.2 Modelo de datos

Agregar entidades equivalentes a:

```text
support_access_grants
support_sessions
support_actions
```

El permiso debe guardar actor, organización, motivo, alcance, modo, fecha de inicio, fecha de expiración, revocación y estado. La sesión debe estar asociada a un grant vigente.

### 7.3 Interfaz de soporte

El sistema debe mostrar una franja visible cuando el operador esté dentro de una organización como soporte. Debe indicar restaurante, operador, motivo, modo y tiempo restante. Debe existir una acción clara para salir.

### 7.4 Criterios de aceptación de la fase 3

- Un operador no puede entrar a un restaurante sin motivo.
- El acceso expira automáticamente.
- El modo lectura bloquea mutaciones.
- Todas las acciones aparecen en auditoría.
- El restaurante puede identificar que hubo acceso de soporte.

## 8. Fase 4 — Métricas y salud por restaurante

**Prioridad:** necesaria para operar y dar soporte.
**Criterio de salida:** el propietario puede detectar organizaciones activas, inactivas o con problemas sin abrir sus datos operativos manualmente.

### 8.1 Métricas globales

El panel debe mostrar número de organizaciones activas, suspendidas y pendientes. También debe mostrar usuarios activos, pedidos del periodo, volumen de ventas agregado cuando corresponda, última actividad y errores recientes.

Las métricas globales deben evitar exponer datos innecesarios. El nivel de detalle debe depender del permiso y del propósito operativo.

### 8.2 Métricas por organización

Cada organización debe contar con métricas de uso: usuarios activos, productos, pedidos, sesiones, actividad de caja, uso de inventario y errores de API. Las consultas deben estar agregadas y optimizadas para no afectar el POS.

### 8.3 Observabilidad

Mantener health y readiness como comprobaciones separadas. Configurar un monitor externo para ambos servicios. Registrar latencia, errores 4xx/5xx, fallos de invitación, fallos de provisioning y errores de base de datos.

## 9. Fase 5 — Planes, límites y suscripciones

**Prioridad:** posterior al piloto.
**Criterio de salida:** el producto puede cobrar y aplicar límites sin bloquear por error la operación de los primeros clientes.

### 9.1 Modelo de planes

Definir inicialmente pocos planes. Cada plan debe especificar usuarios incluidos, sucursales, productos, pedidos mensuales, almacenamiento y módulos habilitados.

El modelo mínimo puede incluir:

```text
plans
organization_subscriptions
organization_limits
usage_counters
```

La organización debe tener estado de suscripción, fecha de inicio, fecha de renovación, fecha de vencimiento y motivo de suspensión.

### 9.2 Aplicación de límites

Los límites deben validarse en API y, cuando sea posible, mediante restricciones o funciones SQL. El frontend solo debe informar el límite; nunca debe ser la única barrera.

Cuando se alcance un límite, la API debe devolver un código estable y la interfaz debe mostrar una acción útil, como actualizar plan, archivar datos o contactar soporte.

### 9.3 Facturación

La integración de pagos debe realizarse después de definir precios, moneda, impuestos, cancelaciones, reembolsos y responsabilidad operativa. Los webhooks deben ser idempotentes, auditados y verificables mediante firma.

## 10. Fase 6 — Calidad, backup y operación

**Prioridad:** transversal.
**Criterio de salida:** cada publicación puede validarse y revertirse con un procedimiento conocido.

### 10.1 Matriz E2E

Cubrir al menos:

| Área | Casos mínimos |
|---|---|
| Login | éxito, error, bloqueo por intentos |
| Recuperación | solicitud, enlace, nueva contraseña |
| Invitación | recepción, aceptación, enlace expirado |
| Roles | admin, waiter, kitchen, cashier, staff |
| Multiempresa | lectura y escritura cruzada bloqueadas |
| Plataforma | listar, crear, duplicado, reintento idempotente |
| Soporte | acceso temporal, expiración, lectura y auditoría |
| POS | pedido, cocina, pago, caja e inventario |

### 10.2 Migraciones y backups

Antes de una migración de producción se debe crear un backup descargable fuera del repositorio. La restauración debe probarse en un proyecto desechable. El registro debe incluir fecha, proyecto, commit, migraciones aplicadas y resultado de la restauración.

### 10.3 Despliegue

El orden recomendado es:

1. Migración en staging.
2. Tests SQL y checks de API.
3. Despliegue de API.
4. Health y readiness.
5. Despliegue web.
6. Smoke tests.
7. E2E autenticado.
8. Prueba manual de los flujos afectados.
9. Backup y despliegue de producción.

### 10.4 Criterios para producción

No se debe abrir la plataforma a clientes si falla cualquiera de estas condiciones:

- Readiness no devuelve Supabase `ok`.
- E2E autenticado está fallando.
- No existe backup restaurable.
- Las invitaciones no se entregan.
- Un usuario puede cruzar organizaciones.
- No se puede bloquear o suspender una organización.

## 11. Roadmap recomendado para tu caso

### Semana 1: seguridad y piloto

Eliminar el fallback de organización, revisar `has_role`, confirmar configuración de SMTP, probar invitaciones y ejecutar aislamiento con dos organizaciones. No agregar planes ni soporte todavía.

### Semana 2: panel global operativo

Crear detalle de organización, suspensión/reactivación, usuarios, reenvío de invitaciones y auditoría visible. Validar todas las acciones con la cuenta global `nando.d0000@gmail.com`.

### Semana 3: soporte controlado

Implementar acceso temporal de solo lectura, motivo obligatorio, franja de soporte y auditoría. Probarlo con una organización de prueba antes de usarlo con un cliente.

### Semana 4: estabilización

Completar E2E por rol, backup y restauración, monitor externo, documentación de despliegue y separación definitiva entre staging y producción.

### Después del primer cliente

Medir uso real y decidir si hacen falta planes, límites, facturación, soporte con tickets y página comercial. No construir esas áreas antes de confirmar que los flujos operativos actuales se usan y generan valor.

## 12. Definición de “listo para vender”

Mesa Clara estará listo para vender acceso a los primeros restaurantes cuando pueda registrar una organización mediante invitación, aislar sus datos, administrar sus usuarios, suspenderla y reactivarla, atender incidencias con acceso temporal auditado, restaurar un backup probado y demostrar que los E2E críticos pasan después de cada despliegue.

La facturación y los planes no son requisitos para el primer piloto. Sí son requisitos antes de automatizar ventas, límites y cobros a varios clientes.

## 13. Entregables por fase

| Fase | Entregables principales |
|---|---|
| 0 | Migración de seguridad, contexto explícito, pruebas RLS y E2E de aislamiento |
| 1 | Flujo completo de invitación, recuperación, SMTP y estados de autenticación |
| 2 | Panel global de organizaciones, usuarios, auditoría y acciones administrativas |
| 3 | Soporte temporal, solo lectura, motivo y auditoría de acciones |
| 4 | Métricas globales y por organización, monitor y alertas |
| 5 | Planes, límites, suscripciones y webhooks idempotentes |
| 6 | Matriz E2E, backup probado, restauración, rollback y documentación operativa |

## 14. Próxima acción recomendada

La primera implementación debe ser la **Fase 0**. El cambio más importante es eliminar la organización implícita de `platform_admin` y obligar a seleccionar explícitamente el restaurante para cualquier operación de soporte. En paralelo se debe preparar la migración de `has_role` y su matriz de pruebas.

Después de esa corrección se puede construir el detalle del restaurante y la administración de usuarios sin ampliar el riesgo de acceso cruzado.

## Referencias

[1]: https://github.com/msalcedofernand-afk/pos-saas-v2 "Repositorio Mesa Clara POS SaaS"
[2]: https://supabase.com/docs/reference/javascript/auth-admin-inviteuserbyemail "Supabase Auth inviteUserByEmail"
[3]: https://supabase.com/docs/guides/database/postgres/row-level-security "Supabase Row Level Security"
[4]: https://supabase.com/docs/guides/platform/going-into-prod "Supabase production checklist"
