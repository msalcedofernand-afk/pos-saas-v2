# Configuración por ambiente

## API

La API es el único proyecto que recibe credenciales privadas:

```text
NEXT_PUBLIC_SUPABASE_URL
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY
SUPABASE_SECRET_KEY
WEB_ORIGIN=http://localhost:3001
AUTH_COOKIE_SAME_SITE=lax
AUTH_COOKIE_SECURE=false
NEXT_PUBLIC_BUSINESS_TIMEZONE=America/Lima
```

En producción usa el origen real de la web. Si la web y la API son sitios distintos,
configura `AUTH_COOKIE_SAME_SITE=none` y `AUTH_COOKIE_SECURE=true`.

Puedes verificar el preflight desplegado con PowerShell:

```powershell
./pos-saas-infra/scripts/check-cors.ps1 `
  -ApiUrl https://api.tudominio.com `
  -WebOrigin https://app.tudominio.com
```

Aunque la URL y la clave publishable tengan el prefijo `NEXT_PUBLIC`, en esta arquitectura sólo se usan dentro de la API. La `SUPABASE_SECRET_KEY` y tokens de integraciones nunca salen del servidor.

## Web

La web sólo necesita conocer la URL pública de la API:

```text
NEXT_PUBLIC_API_URL=http://localhost:3000
NEXT_PUBLIC_SITE_URL=http://localhost:3001
NEXT_PUBLIC_BUSINESS_TIMEZONE=America/Lima
```

La web no recibe variables `SUPABASE_*` ni claves de servicio.

## Android

Android usará la URL pública de la API compilada por ambiente. No debe incluir secretos. La autenticación será mediante sesión de usuario, no mediante una clave fija dentro del APK.

## Ambientes recomendados

```text
local       localhost
staging     entorno de pruebas aislado
production  entorno real con secretos administrados
```
