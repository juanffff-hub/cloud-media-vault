# Ingesta multipart — Parte 2

La recepción acepta un archivo en el campo `archivo` y dos campos de texto:
`titulo` y `subidoPor`. El máximo inclusivo es 10 MiB (10 485 760 bytes).

Multer usa memoria y limita archivos, campos, partes, tamaño de campos, nombres
y anidación. Dos solicitudes pueden ocupar el flujo de subida simultáneamente;
no hay cola que acumule buffers. La admisión se mantiene hasta terminar la respuesta
o liberar explícitamente la sesión después de cancelar el trabajo asíncrono.
La recepción tiene un plazo de 60 segundos; al agotarse se corta la conexión.
Al cerrar la respuesta se libera la referencia al buffer. No se guarda el binario en disco.

El pico de memoria incluye los chunks y su concatenación (hasta aproximadamente
20 MiB por recepción, además del procesamiento posterior y del proceso base).
La inspección de firmas corre en un worker separado, con plazo de tres segundos y
memoria de JS acotada. Copia como máximo un buffer adicional de 10 MiB por operación.

Un multipart mal formado, campos excesivos o archivos adicionales responden 400.
Un archivo que supera el máximo responde 413. Si los cupos están ocupados, responde
500 `UPLOAD_BUSY` para que el cliente pueda reintentar, conforme a los códigos del contrato.
Los errores no incluyen el mensaje original del parser ni los datos del formulario.

La recepción se prueba en rutas de test. `POST /api/archivos` permanece sin registrar
en la aplicación hasta conectar la persistencia real en Parte 3.

Referencia: [Multer](https://expressjs.com/en/resources/middleware/multer/).

## Validación

Título y autor deben ser cadenas no vacías de hasta 160 y 100 caracteres. Se rechazan
duplicados, arrays, objetos y campos adicionales. El nombre de archivo se reduce a su
nombre base y se eliminan controles y caracteres que alteran la presentación.

Se exige coincidencia entre MIME declarado, extensión y firma detectada: JPEG, PNG,
WebP, MP4, WebM y PDF. Además se revisan terminación JPEG/PDF, chunks PNG, longitud
RIFF/WebP, cajas MP4 y marcas de segmento/cluster WebM para detectar truncamientos.
Son comprobaciones de firma y estructura, no una decodificación completa ni un antivirus.
Cloudinary vuelve a comprobar el formato al procesar el archivo.

Referencia: [alcance de file-type](https://github.com/sindresorhus/file-type).

## Contrato preparado para Parte 3

`createUploadRouter` compone multipart, validación y servicio de ingesta. Exige
`AssetPersistence.create`, que debe resolver tras confirmar PostgreSQL. Solo entonces
responde 201 `{ data: registro }`. El contrato de persistencia recibe únicamente
metadatos; nunca recibe el buffer. La prueba del endpoint usa persistencia simulada.

La ruta continúa ausente de `app.ts`; la aplicación pública responde 404 al POST.
La Parte 3 conectará Prisma y montará la ruta, inyectando también `createUploadJournal()`.

## Compensación y recuperación

Antes del primer byte hacia Cloudinary se registra `PREPARED` con UUID de operación,
publicId y resourceType. El diario `server/var/upload-journal.jsonl` se escribe con
`fsync`, está ignorado por Git y contiene solo referencias/códigos, nunca binarios,
formularios, respuestas crudas ni credenciales. La ingesta falla antes de transferir
si no puede guardar esa referencia. Debe residir en almacenamiento persistente al desplegar.

Después de cloud se registra `UPLOAD_CONFIRMED`; después de DB, `PERSISTED`. Si DB
falla, se intenta borrar el recurso cloud y se registra `COMPENSATED` o
`RECONCILIATION_REQUIRED`. Si el cliente se desconecta antes de DB, también se compensa.
Un fallo del diario después de confirmar DB no provoca el borrado de ese activo.

Si cloud termina con timeout o cancelación, se intenta limpiar su referencia preparada
pero se conserva como pendiente: una petición remota podría terminar después del borrado.
Una caída del proceso también deja la referencia durable para revisar.

Para recuperar, agrupar el diario por operationId y consultar el último estado. Ante
un estado sin resolver, verificar primero en PostgreSQL si existe publicId/resourceType;
si existe, conservar cloud y reconciliar el diario. Si no existe, verificar el resultado
remoto y reintentar el borrado del recurso de este proyecto. Nunca borrar automáticamente
una referencia solo por aparecer pendiente: DB pudo confirmar antes de la interrupción.
La automatización de reconciliación con el repositorio real se incorpora en Parte 3.
