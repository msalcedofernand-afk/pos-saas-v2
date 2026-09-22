# Estado actual del roadmap SaaS

**Repositorio:** `msalcedofernand-afk/pos-saas-v2`
**Commit actual verificado:** `4c1e820` — `feat(ops): add phase6 recovery and release controls`
**Rama:** `main` sincronizada con `origin/main`
**Entorno revisado:** staging y workflows de GitHub Actions

## Resumen ejecutivo

El resumen adjunto corresponde a una revisión anterior y menciona el commit `de42226`. GitHub ya avanzó más allá de ese estado. En el momento de esta revisión, las fases 0, 1, 2, 3, 4 y 5 están implementadas y publicadas. La Fase 6 está implementada técnicamente, pero todavía no está cerrada porque el E2E completo falla por secretos faltantes y no se ha ejecutado el simulacro real de restauración en un proyecto Supabase separado.

La Fase 7, correspondiente a planes y límites, todavía no ha comenzado. Tampoco han comenzado suscripciones, pagos ni la web comercial.

## Estado por fase

| Fase | Estado real | Commit o referencia | Falta para cerrarla |
|---|---|---|---|
| 0. Seguridad y contexto | Completada | `712946d` | Activar protección contra contraseñas filtradas en Supabase |
| 1. Organizaciones | Completada | `ab23f15` | Mejoras futuras no bloqueantes |
| 2. Usuarios y membresías | Completada | `189c051` / `ec44eb0` | Mejoras futuras de UX y soporte |
| 3. Auditoría | Completada | `c5a4866` / `2ae89b2` | Exportación o retención avanzada, no necesarias para el piloto |
| 4. Soporte seguro | Completada | `be53e6f` | Probar soporte con una cuenta real y documentar operación |
| 5. Métricas y operación | Completada | `9ef0c49` | Alertas externas reales y umbrales operativos |
| 6. Calidad y recuperación | Parcial | `4c1e820` | Secretos E2E, simulacro de restauración y evidencia |
| 7. Planes y límites | No iniciada | Sin implementación | Diseñar planes, cuotas y estados de suscripción |
| 8. Suscripciones y pagos | No iniciada | Sin implementación | Definir modelo comercial e integrar pagos |
| 9. Escalamiento y gobierno | No iniciada | Sin implementación | Tickets, operadores globales y gobierno avanzado |

## Fase 0 — Seguridad y contexto explícito

### Implementado

El `platform_admin` ya no cae automáticamente en la primera organización. El restaurante operativo debe seleccionarse explícitamente. La selección queda auditada. Las rutas operativas requieren contexto. El acceso directo de clientes a roles y a la función `has_role` fue restringido.

### Estado

**Completada y validada.**

### Pendiente

Supabase todavía reporta desactivada la protección contra contraseñas filtradas. Debe activarse manualmente en Auth antes de abrir el sistema a muchos usuarios. No bloquea el funcionamiento actual, pero sí es una recomendación de seguridad importante.

## Fase 1 — Administración de organizaciones

### Implementado

El panel global permite listar, buscar, consultar, editar, suspender y reactivar organizaciones. La suspensión no borra datos, bloquea la operación y genera auditoría. Las acciones son idempotentes. También existen métricas básicas y actividad reciente por organización.

### Estado

**Completada.**

### Pendiente

No hay bloqueos técnicos. Como mejora futura se puede agregar más información de facturación, propietario comercial y configuración avanzada, pero no es necesaria para los primeros restaurantes.

## Fase 2 — Usuarios, membresías y roles

### Implementado

El panel global administra usuarios globales y usuarios por restaurante. Permite bloquear, desbloquear, reenviar invitaciones, agregar membresías, revocar membresías y cambiar roles. La base protege el último administrador y las mutaciones tienen auditoría e idempotencia.

### Estado

**Completada.**

### Pendiente

No hay bloqueo técnico. Como mejora futura se puede agregar búsqueda avanzada, historial específico por usuario y notificaciones de cambios administrativos.

## Fase 3 — Auditoría visible

### Implementado

La ruta `/dashboard/platform/audit` tiene filtros por actor, organización, acción y fechas. Incluye paginación, detalle de eventos y acceso restringido a `platform_admin`. Las acciones de organizaciones, usuarios, roles y membresías quedan registradas.

### Estado

**Completada.**

### Pendiente

No es necesario exportar logs para el piloto. Más adelante se puede agregar exportación CSV, retención configurable, alertas de seguridad y firmas de integridad de eventos.

## Fase 4 — Soporte seguro

### Implementado

Existe acceso temporal con motivo obligatorio, duración limitada, lectura por defecto, confirmación para escritura, expiración automática, revocación manual, banner visible y auditoría completa.

### Estado

**Completada técnicamente.**

### Pendiente operativo

Debe realizarse una prueba manual con una cuenta real de soporte y una organización de prueba. Se debe confirmar que:

- El modo lectura bloquea modificaciones.
- El modo escritura requiere confirmación.
- El acceso expira realmente.
- La revocación corta el acceso.
- La auditoría muestra entrada, salida y cambios.

## Fase 5 — Métricas y operación SaaS

### Implementado

El panel `/dashboard/platform/metrics` muestra métricas globales y por organización. Se corrigió el acceso interno de `service_role` a los campos necesarios de `auth.users`. También se agregaron métricas de usuarios, productos, pedidos, actividad, invitaciones y errores operativos.

El monitoreo revisa health, readiness y status. Los checks de disponibilidad están incluidos en GitHub Actions.

### Estado

**Completada técnicamente.**

### Pendiente operativo

El monitoreo existe en el repositorio, pero debe comprobarse que las notificaciones externas lleguen al responsable cuando un endpoint falla. También conviene fijar umbrales para errores 5xx, latencia e invitaciones fallidas.

## Fase 6 — Calidad, backups y recuperación

### Implementado

El commit `4c1e820` agrega:

- Backup con manifest.
- Hash SHA-256.
- Conteos de datos.
- Restauración protegida hacia otro proyecto.
- Workflow manual de backup y restauración.
- Gate operativo.
- Monitoreo cada 15 minutos.
- Rollback de Vercel.
- Migraciones correctivas.
- Matriz E2E por rol.
- Plantilla de incidentes.
- Recuperación de organizaciones y datos.

### Estado real

**Parcial; todavía no cerrada.**

Los checks del commit actual muestran:

| Check | Resultado |
|---|---:|
| API | ✅ success |
| Migraciones | ✅ success |
| Smoke web | ✅ success |
| Gate operativo | ✅ success |
| E2E autenticado | ⚠️ failure |

El fallo de E2E se debe a que no están configurados todos los secretos del administrador global.

### Secretos faltantes en `staging`

La revisión de nombres de secretos muestra que existe `E2E_PLATFORM_EMAIL`, pero todavía faltan:

```text
E2E_PLATFORM_PASSWORD
E2E_PLATFORM_TARGET_ORGANIZATION_ID
E2E_PLATFORM_TARGET_USER_ID
```

No deben enviarse contraseñas por chat. Deben agregarse directamente en GitHub:

```text
Settings → Environments → staging → Environment secrets
```

### Restauración pendiente

El workflow `Phase 6 backup and restore drill` requiere un environment separado llamado `backup-restore` con:

```text
SOURCE_DATABASE_URL
TARGET_DATABASE_URL
PHASE6_RESTORE_CONFIRMATION
```

El valor de confirmación debe ser:

```text
RESTORE_TO_TEST_ONLY
```

También requiere dos proyectos Supabase distintos, un proyecto de origen y un proyecto desechable de destino. Nunca debe usarse el mismo proyecto para origen y destino.

### Criterio para cerrar la Fase 6

La fase estará terminada cuando:

1. El E2E autenticado del commit final quede en verde.
2. El environment `backup-restore` exista.
3. El workflow de restauración se ejecute correctamente.
4. El artifact de evidencia contenga manifest, hashes y conteos.
5. Se verifique que el proyecto de destino contiene los datos esperados.
6. Se documente el resultado del simulacro.

## Fase 7 — Planes y límites

### Estado

**No iniciada.**

Todavía no hay implementación de planes, límites ni contadores de consumo en el estado actual de GitHub.

### Trabajo necesario

Crear:

```text
plans
organization_subscriptions
organization_limits
usage_counters
```

Definir inicialmente pocos planes. Cada plan debe especificar usuarios, sucursales, productos, pedidos, almacenamiento y módulos habilitados.

Implementar estados controlados:

```text
trial
active
past_due
suspended
cancelled
expired
```

Validar límites en API y base de datos. El frontend solo debe mostrar el estado y la acción recomendada.

### Dependencias

No empezar esta fase como prioridad hasta cerrar la Fase 6 y confirmar el modelo comercial. Para operar uno o dos restaurantes en piloto, esta fase no es obligatoria.

## Fase 8 — Suscripciones y pagos

### Estado

**No iniciada.**

No existe todavía una integración de pagos ni debe agregarse hasta definir:

- Precios.
- Moneda.
- Impuestos.
- Renovación.
- Cancelación.
- Reembolsos.
- Periodo de gracia.
- Suspensión por falta de pago.
- Responsable de soporte.

Después se podrá implementar checkout, portal de cliente, webhooks firmados, idempotencia y sincronización de estados.

## Fase 9 — Escalamiento y gobierno

### Estado

**No iniciada.**

Esta fase corresponde a una etapa posterior con más clientes y más operadores. Incluirá tickets, comentarios, archivos adjuntos controlados, SLA, operadores con permisos limitados, segundo administrador global y roles como `support_agent`, `billing_admin` y `security_auditor`.

## Problemas visuales encontrados en el resumen adjunto

Estos hallazgos no bloquean seguridad ni operación, pero sí conviene corregirlos antes de presentar el producto a más clientes:

### Separación visual del panel global

El panel global todavía muestra elementos visuales asociados a la operación de restaurante. Esto puede confundir al propietario global. Debe existir una navegación diferenciada para plataforma y POS.

### Doble barra superior en dashboard

El dashboard muestra la barra del `DashboardShell` y otra barra propia. Debe conservarse una sola barra principal para reducir ruido visual.

### Logo que vuelve a `/`

La raíz redirige a `/login`, por lo que el logo puede parecer que cerró la sesión. Debe apuntar al dashboard correcto según rol o mostrar un enlace explícito al panel correspondiente.

### Protección contra contraseñas filtradas

Sigue pendiente activarla en Supabase Auth.

### E2E autenticado global

El workflow existe, pero el commit de Fase 6 todavía falla por los secretos faltantes. Después de agregarlos debe repetirse el workflow y confirmar el resultado.

## Estado de los entornos

En GitHub aparecen los environments `Production` y `staging`. No aparece todavía el environment `backup-restore`, necesario para ejecutar el simulacro de restauración protegido.

## Conclusión

El proyecto no está detenido en la Fase 5. Está en la **Fase 6 parcial**.

El orden inmediato es:

1. Agregar los tres secretos faltantes de `staging`.
2. Repetir Authenticated web E2E.
3. Crear environment `backup-restore`.
4. Configurar URLs de base de datos de origen y destino como secretos.
5. Ejecutar el simulacro de restauración.
6. Guardar la evidencia.
7. Activar protección contra contraseñas filtradas.
8. Corregir la separación visual del panel global.
9. Después comenzar Fase 7, planes y límites.

No recomiendo comenzar pagos todavía. La base administrativa ya está avanzada, pero la recuperación real de datos y el E2E global deben quedar cerrados antes de comercializar el sistema.
