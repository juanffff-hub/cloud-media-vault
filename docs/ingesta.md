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
