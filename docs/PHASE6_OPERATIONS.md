# Mesa Clara SaaS — Fase 6: calidad operativa y recuperación

Estado: procedimientos y automatización preparados. La restauración real debe
ejecutarse con un proyecto Supabase de prueba distinto al origen y con una
ventana aprobada; este repositorio no crea proyectos ni restaura producción de
forma automática.

## 1. Regla de separación de ambientes

| Ambiente   | Web                              | API                                         | Supabase               | Datos               |
| ---------- | -------------------------------- | ------------------------------------------- | ---------------------- | ------------------- |
| local      | localhost:3001                   | localhost:3000                              | local CLI              | sintéticos          |
| staging    | `https://pos-saas-v2.vercel.app` | `https://mesa-clara-api-staging.vercel.app` | `vxdwguoguxxypesviais` | pruebas controladas |
| production | dominio propio                   | dominio propio                              | proyecto separado      | datos reales        |

Nunca uses las credenciales, URLs o usuarios de producción en E2E. Cada
ambiente debe tener su propio proyecto Supabase, secretos Vercel y cuentas de
prueba. La API es la única superficie que recibe la clave secreta.

## 2. Backup antes de una migración importante

Requisitos:

- ventana aprobada y responsable identificado;
- commit y nombre de migración anotados;
- `SOURCE_DATABASE_URL` percent-encoded y guardada solo en el entorno local o
  en un GitHub Environment protegido;
- `psql` y Supabase CLI 2.117.0 disponibles;
- espacio fuera del repositorio para el backup.

Desde `pos-saas-infra`:

```powershell
$env:SOURCE_DATABASE_URL = "postgresql://..."
$env:PHASE6_MIGRATION = "20260922000000_nombre_de_migracion"
node scripts/backup-and-restore.mjs `
  --mode backup `
  --source-project-ref <project-ref> `
  --output-dir "$env:TEMP\mesa-clara-phase6-backup"
```

El script crea `database.sql`, `manifest.json` y un SHA-256. El manifest
registra proyecto origen, commit, migración, tamaño y conteos de organizaciones,
usuarios, membresías y pedidos. El directorio `backups/` está ignorado por Git;
conserva el resultado en almacenamiento cifrado y con retención definida.

No se considera válido un backup si no tiene hash, manifest y una restauración
verificada.

## 3. Restauración real en un proyecto de prueba

La opción recomendada para una copia completa es **Restore to a New Project**
desde Supabase Database Backups. Supabase copia base de datos, esquema, roles y
datos de Auth, pero Storage, ajustes de Auth, claves, Realtime y Edge Functions
requieren configuración manual posterior.

Para probar además el archivo generado por este repositorio:

1. Crea o selecciona un proyecto Supabase desechable en la misma región.
2. Confirma que su `project-ref` sea diferente al origen.
3. Verifica que el destino no atienda tráfico de usuarios.
4. Ejecuta:

```powershell
$env:TARGET_DATABASE_URL = "postgresql://..."
$env:PHASE6_RESTORE_CONFIRMATION = "RESTORE_TO_TEST_ONLY"
node scripts/backup-and-restore.mjs `
  --mode restore `
  --target-project-ref <test-project-ref> `
  --backup-dir "$env:TEMP\mesa-clara-phase6-backup"
```

La restauración se detiene ante cualquier error SQL, verifica el SHA-256 y
compara los conteos del manifest. Genera `restore-verification.json`. Después,
verifica manualmente login/Auth, una organización, membresías, un pedido,
auditoría, RLS, Storage y las variables de la API. El proyecto de prueba debe
eliminarse o pausarse al terminar, según la política de costes.

## 4. Migraciones, rollback y Vercel

Antes de aplicar una migración:

1. Ejecuta el backup y conserva su evidencia.
2. Ejecuta `node scripts/validate-migrations.mjs`.
3. Prueba la migración en staging y espera API, web, health, readiness y E2E.
4. Publica una migración nueva; nunca edites una migración ya aplicada.
5. Registra commit, migración, deployment y resultado.

Para una migración correctiva, crea un archivo nuevo con `supabase migration
new <nombre>`, hazlo idempotente cuando sea posible, agrega una prueba de
regresión y despliega hacia adelante. No uses rollback destructivo automático
para datos.

Para código en Vercel:

1. Abre el proyecto correcto y confirma si el incidente está en API, web o
   ambos.
2. En **Deployments**, identifica el último deployment `Ready` y verificado.
3. Usa **Redeploy** o **Rollback** sobre ese deployment; no promociones una
   Preview sin verificar sus variables de entorno.
4. Comprueba `health`, `health/ready`, `/status`, login, CORS y el smoke test.
5. Conserva el commit fallido y documenta la causa; el rollback de código no
   revierte migraciones de base de datos.

## 5. Monitoreo permanente y alertas

El workflow `.github/workflows/saas-monitoring.yml` revisa cada 15 minutos
staging y, cuando se configuran las variables del repositorio, producción.
Configura en GitHub Actions:

```text
STAGING_API_URL
STAGING_WEB_URL
PRODUCTION_API_URL
PRODUCTION_WEB_URL
HEALTH_ALERT_WEBHOOK_URL (secret opcional)
```

Comprueba `GET /api/v1/health`, `GET /api/v1/health/ready` con Supabase en
`ok`, y `GET /status`. Configura además un monitor externo independiente de
GitHub con intervalo de 1–5 minutos y dos destinatarios. El webhook debe
apuntar a un canal operativo, nunca a una URL que contenga secretos.

## 6. Gate automático y evidencia de despliegue

El workflow `.github/workflows/phase6-release-gate.yml` publica un artefacto
`phase6-release-evidence` con commit, URLs, respuestas de health/readiness,
estado de `/status` y validación de migraciones. Debe marcarse como check
obligatorio en la protección de `main` junto con:

- `API and database checks / api`;
- `API and database checks / migrations`;
- `Web smoke tests / smoke`;
- `Authenticated web E2E / e2e`;
- `Phase 6 operational release gate / operational-gate`.

La evidencia debe conservarse con el ticket o registro de cambio del
despliegue.

## 7. Matriz E2E por rol

| Rol/superficie   | Debe poder                                                    | Debe rechazarse                                           | Automatización              |
| ---------------- | ------------------------------------------------------------- | --------------------------------------------------------- | --------------------------- |
| sin sesión       | health, status y login público                                | API privada y paneles                                     | smoke + API 401             |
| `platform_admin` | organizaciones, usuarios, auditoría, métricas y soporte       | operar datos sin contexto concedido                       | `operations.spec.ts` global |
| `admin`          | productos, pedidos, cocina, caja y usuarios de su restaurante | otro restaurante y administración global                  | `operations.spec.ts` admin  |
| `cashier`        | caja y operaciones permitidas                                 | administración de roles y global                          | credencial operativa        |
| `waiter`         | pedidos y consulta operativa permitida                        | caja, roles y global                                      | credencial operativa        |
| restringido      | login y lectura permitida                                     | caja, mutaciones no autorizadas y global                  | `restricciones según rol`   |
| soporte temporal | lectura durante la concesión                                  | escritura sin confirmación, después de expirar o revocado | acceso temporal             |

El E2E autenticado debe usar cuentas de staging separadas y limpiar productos,
pedidos, sesiones de soporte y cualquier dato creado por la prueba.

## 8. Incidentes y recuperación

Usa `docs/incidents/INCIDENT_TEMPLATE.md` para cada incidente. Como mínimo,
registra impacto, ambiente, organización afectada, timeline, commit,
deployment, migración, backup, acciones y validación posterior.

### Organización suspendida

1. Confirma el `organizationId`, estado y último evento en auditoría.
2. Si fue una suspensión administrativa válida, reactiva desde el panel global
   o `POST /api/v1/platform/organizations/:id/reactivate` con idempotencia.
3. Verifica login, membresías, productos, pedidos y health del restaurante.
4. Si fue una suspensión accidental, conserva la auditoría y registra el
   motivo de recuperación.

### Datos afectados

1. Detén escrituras del flujo afectado y conserva logs.
2. No borres ni edites migraciones ni datos directamente para “arreglar” el
   incidente.
3. Crea un proyecto de recuperación, restaura el backup y ejecuta la
   verificación de conteos y datos esenciales.
4. Decide entre migración correctiva hacia adelante, recuperación selectiva o
   restauración coordinada de producción.
5. Revisa RLS, Auth, auditoría, pedidos, ventas y acceso por organización antes
   de reabrir.
