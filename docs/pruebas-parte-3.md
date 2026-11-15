# Pruebas de persistencia y sincronización

## Automatizadas

```sh
npm run check
npm run test:db -w server
```

El primer comando ejecuta TypeScript, pruebas sin servicios y builds de ambos
proyectos. El segundo valida el destino separado, aplica migraciones y ejecuta
arquitectura y CRUD HTTP con PostgreSQL real y Cloudinary simulado. En local usa
Neon `cloud_media_vault_test`; en CI usa PostgreSQL 17 efímero sin secretos cloud.

La integración crea un lote con UUID y un prefijo propio, verifica metadatos de
imagen/video/PDF, orden, búsqueda literal y sin distinguir mayúsculas, categoría,
paginación y estados ocultos. Fuerza fallos cloud, un rechazo SQL real, errores DB
entre pasos del borrado y dos DELETE simultáneos. Adelanta únicamente el reloj
inyectado del repositorio de prueba para verificar reservas vencidas sin esperar
cinco minutos ni cambiar el reloj de Windows. Comprueba que un intento antiguo no
modifique al nuevo. Limpia exclusivamente las filas de su lote.

Los mensajes RECONCILIATION_REQUIRED y DELETE_RETRY_REQUIRED durante esta prueba
corresponden a fallos simulados deliberadamente. Su diario y cloud son dobles en
memoria; no dejan operaciones cloud reales pendientes.

## Flujo real en ambos servicios

Con `.env`, `.env.test`, migración de prueba y FFmpeg configurados:

```sh
npm run test:assets:live -w server
# O indicar una ruta absoluta a FFmpeg:
npm run test:assets:live -w server -- RUTA_AL_EJECUTABLE
```

Se generan PNG, MP4 y PDF originales. El comando utiliza multipart HTTP contra
la misma fábrica de aplicación del servidor, con adaptadores reales. Cada POST
debe responder 201; se consulta su registro completo en Neon, el recurso en la API
Cloudinary y su URL HTTPS. Luego se prueba listado/filtro/paginación y cada DELETE
debe responder 204 con ausencia en ambos proveedores.

Usa la base `cloud_media_vault_test`, el prefijo `cloud-media-vault/tests/part-3/UUID/`
y un diario separado `server/var/live-part-3-UUID.jsonl`. En caso de error intenta
limpiar únicamente referencias capturadas antes de transferir en esa ejecución.
Nunca elimina una fila sin confirmación de borrado cloud. Si falla la limpieza,
el comando termina con error y conserva el diario para revisar ese lote en DB de
prueba. No aplicar a ese diario el comando de reconciliación de la base de aplicación.

Los binarios temporales se retiran; los diarios contienen solo metadatos y están
ignorados por Git. Las pruebas reales son explícitas y no se ejecutan en CI.
No equivalen todavía a la demo desde React, que corresponde a Parte 4.
