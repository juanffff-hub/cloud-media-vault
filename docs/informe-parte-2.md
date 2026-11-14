# Verificación técnica — Parte 2

Responsable: David Neira Conde, `DavidN09 <dcneira10@gmail.com>`.
Rama: `neira-cloud-vault`. Repositorio: `juanffff-hub/cloud-media-vault`.
Fecha de verificación: 13 de noviembre de 2026 (America/Bogota).

## Alcance entregado

Recepción multipart acotada con Multer; validación de formulario, MIME, extensión,
firma y estructura; transferencia firmada y cancelable con el SDK Cloudinary;
controlador de ingesta con contrato de persistencia; compensación y diario durable.
No se conserva el binario en disco ni se pasa al contrato de PostgreSQL.

`POST /api/archivos` permanece sin registrar en la aplicación pública. Las pruebas
del controlador inyectan persistencia simulada y exigen su confirmación antes del 201.
La conexión del POST con Prisma corresponde a Parte 3. La interfaz corresponde a Parte 4.

## Resultados

| Comprobación | Resultado |
| --- | --- |
| `npm run check` | Tipos, 100 pruebas servidor, 6 cliente y ambos builds aprobados |
| `npm run db:validate -w server` | Modelo Prisma válido |
| `npm run test:db -w server` | Migración, persistencia, restricciones, índices, búsqueda, estado, health/CORS y limpieza propia en Neon de prueba aprobados |
| Validador importado desde `server/dist` | Validación PNG y worker JavaScript compilados correctos |
| `npm run test:cloud:live -w server -- <ruta-ffmpeg>` | Seis archivos reales subidos, consultados, entregados por HTTPS y eliminados |
| Diario de la prueba real | Seis operaciones terminadas en COMPENSATED; ninguna pendiente |
| Revisión de archivos versionables | Sin secretos locales, entornos privados, dependencias, builds ni archivos subidos |
| `git diff --check` | Sin errores de espacios |

Las pruebas de ingesta cubren 400 por formulario/MIME/contenido inválidos, 413 al
superar 10 MiB, aceptación del límite exacto, multipart mal formado, concurrencia,
recepción lenta, cancelación, liberación de memoria, timeout cloud, respuesta inválida,
persistencia fallida y compensación fallida o incierta. Los errores no reflejan secretos.

### Cloudinary real

| Archivo generado | resourceType confirmado | Bytes devueltos | URL HTTPS | Ausencia tras borrar |
| --- | --- | ---: | --- | --- |
| PNG | image | 69 | 200 | 404 en API del proveedor |
| JPEG | image | 207 | 200 | 404 en API del proveedor |
| WebP | image | 58 | 200 | 404 en API del proveedor |
| MP4 | video | 1683 | 200 | 404 en API del proveedor |
| WebM | video | 613 | 200 | 404 en API del proveedor |
| PDF | image | 600 | 200 y cabecera PDF | 404 en API del proveedor |

Todos los recursos eran originales de esta prueba, bajo `cloud-media-vault/tests/part-2/`
con UUID. Se borraron con invalidación de caché y se confirmó su ausencia mediante
la API del proveedor. También se retiraron sus archivos temporales locales. No se
escribieron metadatos en Neon durante esta prueba cloud ni se tocaron recursos ajenos.
La propagación de invalidación CDN puede tardar; la comprobación de borrado usa la API.

La prueba independiente de Neon utilizó únicamente `cloud_media_vault_test` y limpió
su propio registro. La demostración conjunta desde React continúa pendiente de Parte 4.

## Trazabilidad y continuación

Los cinco primeros commits son `fb462c5`, `2bbb7d5`, `4788f4b`, `112ec47` y `f0c3b7d`.
Este informe pertenece al sexto: `test(upload): cubrir multipart y proveedor cloud`.
Consultar hashes completos y autoría en Git y en el PR
`feat: ingesta multipart y transferencia a Cloudinary`.

La CI repite tipos, pruebas, builds y persistencia con PostgreSQL 17 efímero. El
cierre del PR debe confirmar su resultado antes de integrar con merge commit.

Después del merge y de sincronizar main, detenerse. Parte 3 requiere la cuenta
`sebasgomezmunoz3-ship-it` y la orden exacta `Continúa`. El titular debe revisar y
asumir su contribución; cambiar la cuenta Git no sustituye la participación real.
