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

8. Configurar los secretos E2E de staging en GitHub y ejecutar manualmente
   `Authenticated web E2E`.
9. Verificar health, readiness, CORS, login, cookies, cambio de organización,
   pedido, cocina, pago, caja y reportes.

## Variables críticas

La API debe tener `SUPABASE_SECRET_KEY` sólo en el servidor, `WEB_ORIGIN` sin
barra final, `AUTH_COOKIE_SECURE=true` y `AUTH_COOKIE_SAME_SITE=lax` para
subdominios del mismo sitio. Usa `none` sólo cuando frontend y API sean
realmente cross-site.

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

## Rollback

Para código, vuelve al commit anterior mediante el mecanismo de rollback del
proveedor y conserva el commit fallido. Para base de datos, no borres una
migración aplicada manualmente: restaura el backup sólo si es necesario y
coordina cualquier corrección mediante una nueva migración hacia adelante.
