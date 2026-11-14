# Pruebas de ingesta y transferencia

## Automatizadas sin servicios

```sh
npm run check
```

Incluyen multipart mal formado, campos acotados, límite inclusivo de 10 MiB y exceso,
concurrencia, cancelación de recepción, liberación del buffer, campos obligatorios,
MIME/extensión/firma y archivos truncados. Prueban clasificación
imagen/video/PDF, timeout, cancelación, respuestas cloud inválidas, persistencia
simulada, compensación, resultados inciertos y diario durable sin secretos.

Los pequeños contenedores estructurales usados por algunos tests de firma no son
fixtures de reproducción. La prueba real siguiente genera archivos decodificables.
El cierre de Parte 2 incluye además una comprobación del validador y su worker desde
`server/dist`, después del build, para verificar la ejecución del JavaScript emitido.

## Real con Cloudinary

Requiere entorno local configurado y FFmpeg con libx264, libvpx-vp9 y libwebp.
FFmpeg es una herramienta de prueba, no una dependencia de ejecución de la API.
Con FFmpeg en PATH:

```sh
npm run test:cloud:live -w server
```

También se puede pasar la ruta absoluta al ejecutable después de `--`.
El script genera PNG, JPEG, WebP, MP4, WebM y PDF propios en una carpeta temporal.
Valida cada archivo, lo sube firmado, comprueba resourceType y existencia con la API
del proveedor, abre su URL HTTPS y elimina exclusivamente ese recurso recién creado.
Confirma la ausencia mediante la API de Cloudinary y retira los archivos locales.
No guarda registros en Neon ni expone un POST con persistencia ficticia.

El prefijo es `cloud-media-vault/tests/part-2/` (o ese sufijo bajo el prefijo configurado).
Cada intento se registra en `server/var/upload-journal.jsonl`, ignorado por Git.
Si una limpieza falla, no se declara aprobada la prueba y se conserva la referencia.

Si falla la entrega del PDF, revisar en Cloudinary **Settings > Security > Allow
delivery of PDF and ZIP files**, guardar y repetir. No basta con que la subida responda bien:
la prueba exige HTTP 200 y un documento con cabecera PDF en la URL entregada.

## Entrega a Parte 3

Montar `createUploadRouter` en `/api/archivos` solo después de inyectar Prisma en
`AssetPersistence.create` y el diario durable. Mantener la compensación ya implementada.
Reconciliar primero con DB antes de limpiar referencias pendientes del diario.
