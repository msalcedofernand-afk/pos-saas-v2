# Despliegue de POS SaaS

El primer despliegue debe hacerse en staging, con un proyecto Supabase separado
y usuarios de prueba. No uses cuentas ni datos de producción para E2E.

## Orden de publicación

1. Crear backup de Supabase y registrar el punto de restauración.
2. Aplicar las migraciones en staging desde `pos-saas-infra`.
3. Ejecutar las pruebas SQL y el workflow `API and database checks`.
4. Publicar la API con las variables de `pos-saas-api/.env.example`.
5. Ejecutar el preflight de API:

   ```bash
   cd pos-saas-infra
   npm ci
   npm run preflight:api
   ```

6. Publicar la web con las variables de `pos-saas-web/.env.example`.
7. Ejecutar el preflight de cada superficie si se validan por separado:

   ```bash
   node scripts/preflight-production.mjs --surface api
   node scripts/preflight-production.mjs --surface web
   ```

8. Configurar los secretos E2E de staging en GitHub. El workflow
   `Authenticated web E2E` se ejecuta manualmente y también después de cada push
   a `main`; antes de probar espera que la API y la web de staging respondan.
9. Verificar health, readiness, CORS, login, cookies, cambio de organización,
   pedido, cocina, pago, caja y reportes.

## Variables críticas

La API debe tener `SUPABASE_SECRET_KEY` sólo en el servidor, `WEB_ORIGIN` sin
barra final, `AUTH_COOKIE_SECURE=true` y `AUTH_COOKIE_SAME_SITE=lax` para
subdominios del mismo sitio. Usa `none` sólo cuando frontend y API sean
realmente cross-site.

Para habilitar el primer administrador global, configura
`PLATFORM_ADMIN_EMAIL` con el correo exacto de una cuenta existente y haz que
esa cuenta inicie sesión una vez. La promoción es de un solo uso: cuando ya
existe un `platform_admin`, el correo configurado no puede promover otra
cuenta.

El alta de restaurantes envía una invitación de Supabase Auth; no se generan ni
se almacenan contraseñas temporales. Configura SMTP/invitaciones en el proyecto
Supabase de staging antes de probar el onboarding.

La web sólo recibe `NEXT_PUBLIC_API_URL`, `NEXT_PUBLIC_SITE_URL` y la zona
horaria. Nunca configures variables `SUPABASE_*` en el frontend.

## Verificación HTTP

```bash
curl -i https://api.tudominio.com/api/v1/health
curl -i https://api.tudominio.com/api/v1/health/ready
```

En PowerShell puedes validar CORS con:

```powershell
./pos-saas-infra/scripts/check-cors.ps1 `
  -ApiUrl https://api.tudominio.com `
  -WebOrigin https://app.tudominio.com
```

La URL que debe considerarse producción es la configurada en Vercel y en los
secretos del entorno `production`, no una URL de ejemplo. Antes de abrir el
servicio, verifica ambas superficies:

```powershell
curl.exe -i https://api.tudominio.com/api/v1/health
curl.exe -i https://api.tudominio.com/api/v1/health/ready
curl.exe -I https://app.tudominio.com/status
```

`health/ready` debe devolver `200` y `"supabase":"ok"`. La URL `/status` debe
devolver `200` desde la web pública.

## Monitoreo externo

Configura un monitor externo (por ejemplo Better Uptime, UptimeRobot o el
monitoring del proveedor) con estas comprobaciones:

- `GET https://api.tudominio.com/api/v1/health/ready`, esperado `200`.
- `GET https://app.tudominio.com/status`, esperado `200`.
- Intervalo recomendado: 1–5 minutos.
- Alertas a dos personas responsables y un canal operativo.

No uses una comprobación desde el mismo servidor de Vercel como único monitor:
el objetivo es detectar también problemas de red, DNS o proveedor.

## Backup y restauración

Antes de la primera migración de producción crea un backup descargable y
registra fecha, proyecto, commit y migración aplicada. Desde `pos-saas-infra`:

```powershell
New-Item -ItemType Directory -Force backups | Out-Null
npm.cmd exec -- supabase db dump --linked --file backups/production-YYYYMMDD.sql
```

Guarda el archivo fuera del repositorio y prueba la restauración en un proyecto
Supabase desechable, nunca directamente en producción. Con una cadena de
conexión de restauración ya percent-encoded:

```powershell
psql "$env:RESTORE_DATABASE_URL" --file backups/production-YYYYMMDD.sql
```

La prueba sólo cuenta como backup válido si se puede restaurar y consultar el
esquema y los datos esenciales.

## Rollback

Para código:

1. Identifica el último commit/deployment estable.
2. Usa `Redeploy` o `Rollback` en Vercel para API y web.
3. Conserva el commit fallido y registra la causa.

Para base de datos, no borres ni edites una migración ya aplicada. Si es una
corrección compatible, publica una nueva migración hacia adelante. Si existe
pérdida o corrupción de datos, detén escrituras, restaura el backup probado en
un proyecto de recuperación y coordina el cambio antes de reemplazar la base
de producción.
