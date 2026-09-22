# Plan restante de Mesa Clara SaaS

**Punto de partida:** fase 0 publicada en el commit `712946d`.
**Regla de validación:** todos los cambios se validarán mediante GitHub Actions y staging. No se utilizará el entorno local como requisito de aceptación.

## Objetivo general

Completar el producto para que pueda operar con los primeros restaurantes, administrarlos desde un panel global, ofrecer soporte controlado y quedar preparado para incorporar planes comerciales después del piloto.

El orden recomendado es:

1. Panel global operativo.
2. Gestión global de usuarios y auditoría.
3. Soporte seguro.
4. Calidad, monitoreo y operación.
5. Planes y límites.
6. Suscripciones y venta del SaaS.

Las fases comerciales no deben comenzar hasta que las fases administrativas y de soporte estén estabilizadas.

## Flujo obligatorio de cada cambio

Cada funcionalidad seguirá este ciclo:

1. Crear un commit pequeño y descriptivo.
2. Subirlo a `main` o a una rama de trabajo.
3. Dejar que GitHub Actions ejecute los checks.
4. Corregir cualquier fallo únicamente a partir de los logs de Actions.
5. Esperar el despliegue automático en staging.
6. Verificar health, readiness y web status.
7. Ejecutar E2E autenticado en staging.
8. Revisar manualmente el flujo afectado en la web publicada.
9. Registrar el resultado en la documentación.
10. Promover a producción solo si los checks y la prueba funcional están correctos.

Los criterios de aceptación no se basarán en un build ejecutado en el equipo local. La fuente de verdad será GitHub Actions más staging.

## Fase 1 — Panel global operativo

**Prioridad:** inmediata.
**Objetivo:** administrar restaurantes sin entrar directamente a Supabase.

### Entregables

Crear estas rutas:

```text
/dashboard/platform/organizations
/dashboard/platform/organizations/[id]
```

La vista de organizaciones debe permitir buscar por nombre, slug y estado. El detalle debe mostrar identidad, estado, fecha de creación, administrador principal, número de usuarios, productos, pedidos recientes y actividad reciente.

### Acciones necesarias

Implementar en API, base de datos y web:

- Consultar detalle de organización.
- Editar nombre visible.
- Suspender organización.
- Reactivar organización.
- Reenviar invitación al administrador.
- Ver usuarios y membresías.
- Ver última actividad.

Suspender nunca debe borrar datos. Debe impedir el acceso operativo de los usuarios de esa organización y mostrar un mensaje claro. Reactivar debe ser reversible y quedar auditado.

### Seguridad

Cada endpoint debe exigir `platform_admin`. La organización objetivo debe validarse por UUID y estado. Las mutaciones deben tener idempotencia. No se deben aceptar cambios de `organization_id` desde un usuario normal.

### Pruebas en GitHub Actions

Agregar pruebas de contrato y E2E para:

- `platform_admin` puede consultar detalle.
- Usuario normal recibe `403`.
- Suspender bloquea operaciones.
- Reactivar devuelve el acceso.
- Doble clic no genera dos acciones.
- La acción aparece en auditoría.
- Los datos de la organización no se borran al suspender.

### Criterio de finalización

La fase termina cuando el propietario puede administrar “Ceciloa rest” completamente desde la web publicada y todos los workflows están verdes.

## Fase 2 — Usuarios, membresías y roles

**Prioridad:** alta.
**Objetivo:** administrar usuarios de todos los restaurantes desde un único panel.

### Entregables

Crear:

```text
/dashboard/platform/users
/dashboard/platform/organizations/[id]/users
```

La vista debe permitir filtrar por correo, nombre, organización, rol y estado.

### Acciones

Implementar:

- Ver usuario.
- Ver organizaciones asociadas.
- Ver roles por organización.
- Bloquear usuario.
- Desbloquear usuario.
- Reenviar invitación.
- Cambiar rol dentro de una organización.
- Revocar membresía.
- Designar nuevo administrador.

El sistema debe impedir retirar el último administrador de una organización. También debe impedir dejar una organización activa sin administrador.

### Reglas de seguridad

El rol global `platform_admin` debe mantenerse separado de los roles operativos. La pantalla global no debe permitir asignar `platform_admin` como un rol ordinario. La promoción global debe seguir siendo una acción controlada del servidor.

Todas las acciones deben registrar actor, usuario afectado, organización, rol anterior, rol nuevo y motivo cuando corresponda.

### Pruebas en GitHub Actions

- Admin de restaurante no puede consultar usuarios de otra organización.
- Platform admin puede consultar usuarios globales.
- No se puede eliminar al último admin.
- Un usuario bloqueado no puede iniciar sesión.
- Un usuario desbloqueado puede volver a iniciar sesión.
- El cambio de rol modifica correctamente los permisos.
- La revocación de membresía elimina el acceso a esa organización.

## Fase 3 — Auditoría visible

**Prioridad:** alta.
**Objetivo:** que el propietario pueda revisar qué ocurrió sin consultar directamente la base.

### Entregables

Crear:

```text
/dashboard/platform/audit
```

La pantalla debe tener filtros por fecha, actor, organización, acción y entidad. Debe mostrar paginación y detalle de valores anteriores y nuevos cuando sea seguro hacerlo.

### Eventos mínimos

Registrar y mostrar:

- Alta de organización.
- Suspensión y reactivación.
- Invitación y reenvío.
- Bloqueo y desbloqueo.
- Cambio de rol.
- Revocación de membresía.
- Selección de contexto operativo.
- Entrada y salida del modo soporte.
- Cambios de plan cuando existan.

Los logs deben ser inmutables desde la interfaz. No deben incluir contraseñas, tokens, enlaces privados ni secretos.

### Pruebas

GitHub Actions debe verificar que cada mutación administrativa genera exactamente el evento esperado y que un usuario autenticado normal no puede consultar los logs globales.

## Fase 4 — Soporte seguro

**Prioridad:** necesaria antes de atender varios clientes.
**Objetivo:** ayudar a un restaurante sin impersonar silenciosamente a sus usuarios.

### Modelo

Crear un acceso temporal de soporte con:

- Organización objetivo.
- Usuario operador.
- Motivo obligatorio.
- Fecha de inicio.
- Fecha de expiración.
- Alcance.
- Modo lectura o escritura.
- Estado revocado o activo.

El modo predeterminado debe ser solo lectura. Las operaciones de escritura deben requerir una confirmación adicional.

### Interfaz

Mostrar un banner persistente con:

- Restaurante actual.
- Operador.
- Motivo.
- Modo.
- Tiempo restante.
- Botón para salir.

No se debe permitir iniciar soporte sin organización explícita. El acceso debe expirar automáticamente.

### Pruebas

- No se puede iniciar soporte sin motivo.
- No se puede entrar a una organización suspendida.
- El acceso expira.
- El modo lectura bloquea escrituras.
- El modo escritura registra cada modificación.
- El restaurante aparece correctamente en auditoría.

## Fase 5 — Métricas y operación

**Prioridad:** media-alta.
**Objetivo:** medir el uso y detectar problemas sin revisar manualmente cada restaurante.

### Métricas globales

Agregar al panel:

- Organizaciones activas.
- Organizaciones suspendidas.
- Usuarios activos.
- Pedidos del periodo.
- Ventas agregadas.
- Última actividad.
- Invitaciones pendientes.
- Errores recientes.

### Métricas por organización

Mostrar:

- Usuarios activos.
- Productos y categorías.
- Pedidos.
- Actividad de caja.
- Inventario.
- Último acceso.
- Errores relevantes.

Las métricas deben ser agregadas y no deben permitir cruzar datos entre organizaciones desde el API operativo.

### Operación

Configurar monitores externos para:

```text
GET /api/v1/health/ready
GET /status
```

Registrar alertas de API caída, readiness fallido, errores 5xx, invitaciones fallidas y provisioning incompleto.

## Fase 6 — Calidad y despliegue mediante GitHub Actions

**Prioridad:** transversal.
**Objetivo:** que cada cambio se valide automáticamente.

### API and database checks

Debe ejecutar:

- Instalación limpia de dependencias.
- Lint.
- TypeScript.
- Tests de contrato.
- Supabase local en el runner de GitHub.
- Migraciones desde cero.
- Pruebas pgTAP.
- Prueba de aislamiento.
- Prueba de concurrencia.
- Build de API.

### Web smoke tests

Debe ejecutar:

- Instalación limpia.
- Auditoría de dependencias.
- Lint.
- Prettier.
- TypeScript.
- Build web.
- Smoke tests públicos.

### Authenticated web E2E

Debe ejecutar contra staging:

- Login por rol.
- Dashboard.
- Pedidos.
- Cocina.
- Caja.
- Inventario.
- Permisos.
- Aislamiento.
- Panel global.
- Invitaciones cuando el entorno de correo permita probarlas.

### Regla de bloqueo

Ningún cambio avanza a producción si falla API/database, web smoke o E2E autenticado. Los checks cancelados no se consideran aprobados; deben repetirse sobre el commit final.

## Fase 7 — Backup, restauración y rollback

**Prioridad:** obligatoria antes de clientes de pago.

### Backup

Antes de cada migración importante:

1. Crear backup fuera del repositorio.
2. Registrar fecha, proyecto, commit y migración.
3. Verificar que el archivo sea legible.
4. Restaurarlo en un proyecto de prueba.
5. Consultar tablas y datos esenciales.

### Rollback

Para código, usar el deployment anterior de Vercel. Para base de datos, publicar una migración correctiva hacia adelante. No borrar migraciones aplicadas.

### Prueba en GitHub Actions

El workflow debe validar que las migraciones se pueden aplicar desde cero y que las pruebas SQL pasan. La restauración real puede ejecutarse como procedimiento operativo controlado, no como parte de cada push.

## Fase 8 — Planes y límites

**Prioridad:** después del piloto.
**Objetivo:** preparar monetización sin introducir complejidad antes de validar el uso real.

### Modelo inicial

Agregar:

```text
plans
organization_subscriptions
organization_limits
usage_counters
```

Cada plan debe definir usuarios, sucursales, productos, pedidos, almacenamiento y módulos habilitados.

### Aplicación

Los límites deben validarse en API y base de datos. El frontend solo debe informar el estado. Los errores de límite deben tener códigos estables para que la interfaz pueda mostrar acciones útiles.

### Pruebas

- Organización dentro del límite puede operar.
- Organización excedida recibe error controlado.
- Una organización no puede consumir el límite de otra.
- Cambiar de plan actualiza los límites.
- Suspender suscripción bloquea solo las acciones definidas.

## Fase 9 — Suscripciones y venta

**Prioridad:** posterior al primer cliente validado.

Antes de integrar pagos se deben definir precio, moneda, impuestos, renovación, cancelación, reembolso y responsable de soporte.

Los webhooks deben validar firma, ser idempotentes y registrar cada cambio de estado. La facturación no debe modificar directamente permisos sin pasar por una política de suscripción verificable.

La página pública de venta debe añadirse solo después de que el onboarding por invitación y el soporte funcionen correctamente.

## Orden recomendado de ejecución

| Orden | Fase | Resultado |
|---:|---|---|
| 1 | Panel global operativo | Administrar restaurantes |
| 2 | Usuarios y roles | Administrar acceso |
| 3 | Auditoría | Revisar acciones |
| 4 | Soporte seguro | Ayudar con trazabilidad |
| 5 | Métricas y operación | Supervisar el SaaS |
| 6 | Calidad y backup | Publicar con control |
| 7 | Planes y límites | Preparar monetización |
| 8 | Suscripciones | Cobrar y automatizar ventas |

## Meta para los próximos dos restaurantes

Antes de incorporar más de dos restaurantes, Mesa Clara debe cumplir estos puntos:

- Crear el restaurante desde el panel global.
- Enviar y aceptar invitación.
- Seleccionar organización explícitamente.
- Operar pedidos, cocina y caja.
- Administrar usuarios y roles.
- Suspender y reactivar el restaurante.
- Consultar auditoría.
- Ejecutar E2E por rol.
- Tener backup restaurable.
- Contar con health, readiness y monitor externo.

No es necesario tener facturación automática para este hito. Sí es necesario que el acceso, el aislamiento y la recuperación operativa sean confiables.

## Siguiente bloque concreto

El siguiente commit debe implementar el **detalle de organización** y las acciones de **suspender/reactivar**, incluyendo:

- Migración SQL.
- Endpoints `GET`, `PATCH` y acción de estado.
- Auditoría.
- Pantalla de detalle.
- Pruebas de autorización.
- Pruebas de aislamiento.
- E2E en staging.

Ese bloque aporta más valor inmediato que crear planes o pagos y prepara la base para usuarios, soporte y métricas.
