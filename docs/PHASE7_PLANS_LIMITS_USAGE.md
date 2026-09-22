# Fase 7 — planes, límites y uso

La Fase 6 de backup/restauración queda pendiente. La Fase 7 implementa la base de planes por organización sin activar cobros automáticos.

## Incluido

- Catálogo inicial `trial`, `starter`, `growth` y `enterprise`.
- Suscripción, límites y contadores aislados por organización.
- Plan de prueba automático para nuevas organizaciones.
- Backfill de la organización histórica a `starter` para no bloquear datos existentes.
- Límites aplicados en base de datos al crear usuarios, productos y pedidos.
- RPC para consultar consumo y RPC protegida para que solo `platform_admin` cambie el plan.
- Auditoría de cada cambio de plan.
- API global en `/api/v1/platform/plans` y `/api/v1/platform/organizations/:id/subscription`.
- API de consulta del restaurante en `/api/v1/subscription`.
- Panel global `/dashboard/platform/plans` y consulta del restaurante en `/dashboard/subscription`.

## Fuera de alcance por ahora

- Precios comerciales definitivos.
- Stripe u otro proveedor de pagos.
- Cobros, facturas y renovaciones automáticas.
- Backup, restauración y rollback de la Fase 6.

## Operación

Los precios de `starter`, `growth` y `enterprise` quedan en `NULL` hasta definir la oferta comercial. El plan `trial` tiene precio cero y límites conservadores. La organización existente se conserva operativa con `starter`; las nuevas organizaciones inician en `trial`.
