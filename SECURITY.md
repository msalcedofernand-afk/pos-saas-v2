# Política de seguridad

## Reportar una vulnerabilidad

No publiques vulnerabilidades, credenciales, tokens ni datos de clientes en issues o pull requests. Reporta el problema de forma privada a los mantenedores del repositorio, incluyendo:

- descripción y pasos para reproducirlo;
- impacto y datos potencialmente expuestos;
- versión, commit o entorno afectado;
- evidencia mínima que permita validarlo sin acceder a datos reales.

El equipo confirmará la recepción, evaluará el impacto y coordinará la corrección y divulgación responsable.

## Secretos y respuesta

- Las claves de Supabase `service_role` y `SUPABASE_SECRET_KEY` sólo deben existir en el servidor o en los secretos del entorno de despliegue.
- Si un secreto se expone, revócalo y rótalo inmediatamente; después revisa los logs de acceso y los despliegues recientes.
- Las migraciones de tenant deben probarse con una base limpia antes de aplicarse en producción.
- Los incidentes que afecten ventas, pagos, sesiones o aislamiento entre organizaciones deben tratarse como críticos.
