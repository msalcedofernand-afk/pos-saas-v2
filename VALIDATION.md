# Matriz de validación

La validación se aplica en tres capas: interfaz para feedback inmediato, API
para rechazar requests manuales y PostgreSQL para proteger la integridad final.
La API y la base son la autoridad; los límites siguientes deben mantenerse
alineados cuando se agreguen módulos.

| Campo | Regla actual |
| --- | --- |
| Nombre de producto | Texto recortado, 1–150 caracteres |
| Nombre de categoría | Texto recortado, 1–100 caracteres |
| Precio y montos | Número finito, `0–99,999,999`, máximo 2 decimales |
| Cantidad de pedido | Entero `1–999` |
| Invitados | Entero `1–999` |
| Tiempo de preparación | Entero `0–999` minutos |
| Orden de categoría | Entero `0–9,999` |
| Página | Entero `1–10,000` |
| Límite de registros | Entero `1–100` |
| Notas de pedido | Máximo 1,000 caracteres |
| Notas de producto/pedido | Máximo 500 caracteres para líneas y estados |
| Referencia de pago | Máximo 200 caracteres |
| UUID | Formato UUID válido |
| Estados y métodos | Enumeraciones cerradas en API y PostgreSQL |

## Reglas de seguridad

- Los identificadores se validan como UUID y la organización se obtiene del
  usuario autenticado; nunca se acepta `organizationId` desde el body.
- Los parámetros enteros de query rechazan formatos ambiguos como `1e3`,
  decimales y texto parcial.
- Los mensajes de validación devuelven `400` con `code: "REQUEST_ERROR"` y
  detalles `{ field, message }`; no se exponen errores internos de PostgreSQL.
- Los cambios de pedidos, cocina, pagos y caja siguen funciones transaccionales,
  idempotencia y reglas de transición.
- Las claves foráneas compuestas de organización impiden relaciones cruzadas
  entre negocios.

## Cobertura

- API: esquemas compartidos en `pos-saas-api/src/lib/validation/rules.ts`.
- Base: `20260921145955_harden_input_constraints.sql`.
- pgTAP: `input_constraints_test.sql` y las pruebas existentes de aislamiento,
  concurrencia, idempotencia y caja.
- Frontend: `min`, `max`, `step`, `inputMode` y `maxLength` en los formularios
  operativos principales.
