# POS SaaS Infrastructure

Carpeta local para los recursos compartidos de infraestructura y configuraciones.

## Contenido

- `supabase/migrations`: migraciones oficiales de la base de datos.
- `config`: reglas de configuración por ambiente.
- `docs`: documentación técnica del proyecto.
- `scripts`: procesos locales controlados de infraestructura.

La web, Android y otros clientes no deben importar nada de esta carpeta. Sólo la API administra la base de datos.

## Regla de secretos

No se guardan tokens reales aquí. La versión actual no consume proveedores externos: los datos se consultan únicamente desde la base propia mediante `pos-saas-api`. Si algún proveedor se activa en el futuro, sus secretos se configurarán sólo en el servidor usando un gestor de secretos en producción.
