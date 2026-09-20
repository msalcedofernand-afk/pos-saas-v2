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

## Pruebas

```bash
npm run typecheck
npm run build
npm test
```

Las pruebas públicas corren sin configuración adicional. Para habilitar los flujos
contra una API y base de datos de pruebas, define `PLAYWRIGHT_API_URL`, `E2E_EMAIL`,
`E2E_PASSWORD`, `E2E_ADMIN_EMAIL`, `E2E_ADMIN_PASSWORD` y las credenciales restringidas.
La cuenta admin se usa exclusivamente para preparar y limpiar productos; la cuenta
de operación puede ser admin, cashier o waiter.

GitHub Actions ejecuta smoke tests en cada push y pull request. El workflow E2E se
ejecuta manualmente contra una URL desplegada y falla antes de probar si faltan
los secretos de web, API o usuarios E2E.

Las pantallas del proyecto anterior permanecen en `../pos-saas-main` y se migrarán gradualmente, reemplazando sus consultas directas por llamadas a la API.
