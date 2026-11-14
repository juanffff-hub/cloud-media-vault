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
La Parte 2 añadirá validación de contenido, transferencia, compensación y sus pruebas.

Un multipart mal formado, campos excesivos o archivos adicionales responden 400.
Un archivo que supera el máximo responde 413. Si los cupos están ocupados, responde
500 `UPLOAD_BUSY` para que el cliente pueda reintentar, conforme a los códigos del contrato.
Los errores no incluyen el mensaje original del parser ni los datos del formulario.

La recepción se prueba en rutas de test. `POST /api/archivos` permanece sin registrar
en la aplicación hasta conectar la persistencia real en Parte 3.

Referencia: [Multer](https://expressjs.com/en/resources/middleware/multer/).
