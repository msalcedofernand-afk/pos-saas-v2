# Fases 8 y 9 — Base comercial y gobierno operativo

## Alcance implementado

Esta entrega agrega la base operativa necesaria para continuar hacia suscripciones comerciales sin activar cobros reales todavía.

### Base comercial

La base de datos incorpora eventos comerciales provider-neutral con identificador externo único, estado de procesamiento, payload protegido y fecha de recepción. El receptor HTTP exige una firma HMAC SHA-256 mediante `BILLING_WEBHOOK_SECRET` y procesa cada evento de forma idempotente.

La ruta es:

```text
POST /api/v1/platform/billing/webhook
```

La implementación no crea cargos ni consulta un proveedor de pagos. El proveedor, precios, moneda, impuestos, cancelaciones y periodo de gracia deben definirse antes de conectar Stripe u otro proveedor.

### Gobierno operativo

Se agregan roles globales separados:

```text
platform_owner
platform_admin
support_agent
billing_admin
security_auditor
```

Los roles tienen permisos limitados por endpoint. Un agente de soporte no puede administrar facturación ni cambiar roles globales. Un auditor puede consultar incidentes, pero no crear tickets administrativos ni cambiar suscripciones.

### Tickets

Se agregan tickets con:

- Organización opcional.
- Solicitante.
- Asignación.
- Prioridad.
- Estado.
- Descripción limitada.
- Comentarios internos.
- Auditoría de creación, cambio y comentario.

Rutas principales:

```text
GET  /api/v1/platform/tickets
POST /api/v1/platform/tickets
GET  /api/v1/platform/tickets/:id
PATCH /api/v1/platform/tickets/:id
POST /api/v1/platform/tickets/:id
```

### Incidentes

Se agregan incidentes con organización opcional, severidad, estado, resumen, fecha de inicio y fecha de resolución.

Rutas principales:

```text
GET   /api/v1/platform/incidents
POST  /api/v1/platform/incidents
PATCH /api/v1/platform/incidents/:id
```

Paneles:

```text
/dashboard/platform/tickets
/dashboard/platform/incidents
```

## Pendientes externos

### Pagos reales

Para activar pagos se necesita definir primero:

- Proveedor.
- Precios de `starter`, `growth` y `enterprise`.
- Moneda.
- Periodicidad.
- Impuestos.
- Reembolsos.
- Cancelación.
- Periodo de gracia.
- Secretos separados para staging y producción.

No se deben agregar claves de pago ni webhooks de producción hasta aprobar esas decisiones.

### Backup y restauración

La Fase 6 continúa pendiente hasta ejecutar el simulacro real en un proyecto Supabase desechable y guardar su evidencia.

### E2E global

El E2E autenticado requiere configurar `E2E_PLATFORM_PASSWORD` en el environment `staging`. No se deben colocar contraseñas en el repositorio ni en el chat.

## Criterio de salida de esta entrega

La entrega se considera técnicamente válida cuando API, migraciones, web smoke, typecheck y build están verdes. La activación comercial completa requiere posteriormente un proveedor y sus decisiones comerciales aprobadas.
