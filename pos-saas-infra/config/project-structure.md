# Convención de nombres y responsabilidades

## Carpetas principales

- `pos-saas-api`: endpoints HTTP, reglas de negocio y adaptadores del backend.
- `pos-saas-web`: interfaz web; no contiene acceso a Supabase.
- `pos-saas-infra`: migraciones, configuración e integraciones documentadas.
- `pos-saas-main`: legacy; no se usa para el desarrollo nuevo.

## Convenciones

- Carpetas y archivos propios: `kebab-case`.
- Rutas dinámicas de Next.js: `[id]`, `[dni]`.
- Archivos especiales de Next.js: `route.ts`, `page.tsx`, `layout.tsx`, `globals.css`.
- Repositorios: `<entidad>-repository.ts`.
- Adaptadores externos: `<integracion>-provider.ts`.
- Documentos: `README.md` para entrada de carpeta y nombres descriptivos para el resto.

## Decisiones

- `src/lib/supabase` en la API contiene clientes técnicos de sesión y administración.
- `src/infrastructure/database/supabase` contiene repositorios de datos.
- `src/proxy.ts` no se renombra porque es una convención reconocida por Next.js.
- No se agregan carpetas de Android, contratos compartidos ni `admin-web/public-web` hasta que la API de autenticación y los módulos principales estén definidos.
