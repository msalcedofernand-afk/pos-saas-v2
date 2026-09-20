# Configuración por ambiente

## API

La API es el único proyecto que recibe credenciales privadas:

```text
NEXT_PUBLIC_SUPABASE_URL
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY
SUPABASE_SERVICE_ROLE_KEY
STORE_DEVICE_SETUP_KEY
```

Aunque la URL y la clave publishable tengan el prefijo `NEXT_PUBLIC`, en esta arquitectura sólo se usan dentro de la API. La `SUPABASE_SERVICE_ROLE_KEY`, `STORE_DEVICE_SETUP_KEY` y tokens de integraciones nunca salen del servidor.

## Web

La web sólo necesita conocer la URL pública de la API:

```text
NEXT_PUBLIC_API_URL=http://localhost:3000
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
