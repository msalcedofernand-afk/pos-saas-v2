# POS SaaS V2

Nueva base del POS SaaS, separada del proyecto legacy.

## Proyectos

- `pos-saas-api`: API propia con Next.js, autenticación y reglas de negocio.
- `pos-saas-web`: frontend web del POS.
- `pos-saas-infra`: migraciones y configuración de Supabase.

## Documentación operativa

- [Guía de despliegue, health checks, monitoreo, backup y rollback](DEPLOYMENT.md).
- [Política de seguridad y reporte de incidentes](SECURITY.md).
- [Documentación de la web y sus pruebas](pos-saas-web/README.md).
- [Documentación de infraestructura y migraciones](pos-saas-infra/README.md).

La arquitectura actual mantiene Supabase sólo detrás de la API, aplica aislamiento
por organización y valida las operaciones mediante API checks, smoke tests y E2E
autenticado en staging.

## Desarrollo local

```bash
cd pos-saas-api
npm install
npm run dev
```

En otra terminal:

```bash
cd pos-saas-web
npm install
npm run dev
```

- Web: `http://localhost:3001`
- API: `http://localhost:3000`
- Demo de diseños V2: `http://localhost:3001/demo`

Las variables reales deben mantenerse en archivos `.env.local` y nunca subirse al repositorio.
