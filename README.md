# POS SaaS V2

Nueva base del POS SaaS, separada del proyecto legacy.

## Proyectos

- `pos-saas-api`: API propia con Next.js, autenticación y reglas de negocio.
- `pos-saas-web`: frontend web del POS.
- `pos-saas-infra`: migraciones y configuración de Supabase.

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
