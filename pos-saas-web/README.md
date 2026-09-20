# POS SaaS Web

Frontend independiente del POS. Esta aplicación no contiene Supabase, migraciones ni claves privadas. Se comunicará exclusivamente con `pos-saas-api` mediante HTTP.

## Estado inicial

- Landing visual creada desde cero.
- Ruta `/dashboard` como base del panel.
- Cliente HTTP preparado en `src/lib/api/client.ts`.
- Puerto local: `3001`.

## Ejecutar

```bash
npm install
copy .env.example .env.local
npm run dev
```

La API corre en `http://localhost:3000` y esta web en `http://localhost:3001`.

Las pantallas del proyecto anterior permanecen en `../pos-saas-main` y se migrarán gradualmente, reemplazando sus consultas directas por llamadas a la API.
