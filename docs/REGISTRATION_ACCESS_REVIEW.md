# Registro, presentación y permisos — revisión del 22 de septiembre de 2026

## Hallazgos verificados

- El clon estaba en `f37e52d`; se sincronizó por fast-forward con `084a250`.
- La raíz redirigía al login y no existía registro público.
- La autenticación solo reconocía `platform_admin` como cuenta sin restaurante.
- Los roles internos excluían únicamente `platform_admin`, dejando expuestos otros roles globales.
- CORS omitía `X-Organization-Id` y `X-Support-Access-Id`.
- La migración de Fases 8/9 estaba en GitHub pero NO aplicada en staging. Se aplicó antes de esta entrega.

## Flujo implementado

1. `/`: presentación del piloto gratuito, login, registro y recuperación.
2. `/register`: correo y contraseña propios mediante Supabase Auth.
3. Confirmación de correo → `/register/restaurant`.
4. La API verifica el usuario y la confirmación, crea una organización `pending`, inactiva, con membresía `admin`. La operación es transaccional y una repetición devuelve la misma organización.
5. Desde el detalle global, el propietario/administrador de plataforma aprueba el restaurante mediante la acción de activación existente.
6. El administrador del restaurante invita trabajadores desde Configuración. Los trabajadores reciben el enlace existente `/auth/update-password` y establecen su contraseña.
7. `/dashboard/platform/access` permite al propietario otorgar y revocar roles globales de cuentas registradas. No permite asignar `platform_owner`, modificar al propietario ni autoasignarse permisos.

Los metadatos enviados por el navegador no determinan el rol ni el restaurante. Los roles globales se leen exclusivamente de `user_roles`; los internos se filtran mediante una lista explícita y un trigger rechaza roles globales dentro de membresías.

## Soporte

`support_agent` puede entrar al panel de soporte, solicitar acceso temporal de lectura y revocar su acceso. No puede habilitarse escritura ni cambiar roles globales o planes. Las consultas operativas necesitan la concesión vigente. La habilitación de escritura sigue reservada a propietario/administrador global.

La recuperación de contraseña sigue siendo por correo. No se muestran ni almacenan contraseñas de terceros. La nueva invitación de trabajadores acepta cuentas nuevas; para incorporar una cuenta ya existente se requiere intervención global. Si el envío se completa pero la asignación falla, se informa expresamente y la cuenta queda sin acceso hasta resolverla; no se elimina la cuenta Auth.

## Activación y límites

- `nando.d0000@gmail.com`: propietario confirmado por el usuario y asignado en staging con auditoría.
- Correo de la persona de soporte: pendiente. No se asignó ese rol a ninguna cuenta real.
- Configurar en Supabase Auth la URL pública correcta y autorizar `/register/restaurant` y `/auth/update-password` como redirects del entorno. La página de inicio también encamina los fragmentos Auth si Supabase vuelve a la raíz pública.
- No se enviaron correos de prueba a personas reales. El recorrido real por correo sigue pendiente de validación con una cuenta de prueba.
- Fase 6 (restauración) y secreto E2E permanecen pendientes.
- No se activaron cobros.

## Verificación

API: lint, TypeScript, build y 11 contratos existentes. Web: lint, TypeScript, build y smoke de navegación.
Base de datos: `registration_roles_test.sql` verifica correo confirmado, registro pendiente, repetición, rechazo de roles globales en membresías, concesión/revocación por owner, auditoría y bloqueo de escalamiento por soporte. Se ejecuta en una transacción con rollback y cuentas sintéticas.

Los smoke no equivalen a un E2E real de confirmación por correo, y los contratos existentes de API son pruebas estáticas.
