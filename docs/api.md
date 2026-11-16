# Contrato REST — Cloud Media Vault

Versión de entrega: Parte 4 (contrato de Parte 3). Base local: `http://127.0.0.1:3001/api`.
Este documento es la especificación equivalente a OpenAPI; sus ejemplos y campos
se contrastan con las pruebas HTTP indicadas al final. No requiere autenticación.
`subidoPor` es texto ingresado por el usuario, no una identidad verificada.

| Método y ruta | Resultado correcto |
| --- | --- |
| POST /archivos | 201 con el registro persistido |
| GET /archivos | 200 con registros y paginación |
| DELETE /archivos/:id | 204 sin cuerpo, después de cloud y DB |
| GET /health | 200 si PostgreSQL responde |

## POST /archivos

Content-Type: `multipart/form-data` con boundary generado por el cliente. En React,
usar FormData y dejar que el navegador establezca Content-Type y boundary.

| Campo | Requerido | Regla |
| --- | --- | --- |
| titulo | Sí | Texto no vacío, hasta 160 caracteres tras normalizar NFC y recortar espacios |
| subidoPor | Sí | Texto no vacío, hasta 100 caracteres, sin controles |
| archivo | Sí | Un archivo no vacío de hasta 10 485 760 bytes, inclusive |

Se rechazan campos adicionales, duplicados, objetos y archivos múltiples. Los campos
de texto tienen además límite multipart de 1024 bytes; título y autor no admiten controles.
Nombre de archivo: solo nombre base, normalizado para mostrar y hasta 255 caracteres.

| Extensión | MIME | categoria | resourceType |
| --- | --- | --- | --- |
| .jpg, .jpeg | image/jpeg | imagen | image |
| .png | image/png | imagen | image |
| .webp | image/webp | imagen | image |
| .mp4 | video/mp4 | video | video |
| .webm | video/webm | video | video |
| .pdf | application/pdf | pdf | image |

Se exige coincidencia de extensión, MIME, firma y estructura básica. Cloudinary
valida el formato al procesarlo. PDF requiere permitir su entrega en Security.
Los binarios solo se conservan en Cloudinary; el backend usa memoria acotada.

Ejemplo 201 (valores ilustrativos):

```json
{
  "data": {
    "id": "83a5f72d-5b33-412c-a730-e2fe83320521",
    "titulo": "Informe del taller",
    "nombreOriginal": "informe.pdf",
    "secureUrl": "https://res.cloudinary.com/demo/image/upload/v1/informe.pdf",
    "publicId": "cloud-media-vault/05da303e-7e3b-40c4-b29f-e7f28104136b",
    "resourceType": "image",
    "categoria": "pdf",
    "mimeType": "application/pdf",
    "tamanoBytes": 600,
    "fechaSubida": "2026-11-15T12:00:00.000Z",
    "subidoPor": "Autor del taller",
    "estado": "ACTIVO"
  }
}
```

Los tres campos cloud se toman de la respuesta confirmada del SDK. id y fechaSubida
proceden de PostgreSQL/Prisma. tamanoBytes usa el tamaño confirmado por Cloudinary.
No se incluyen contadores ni errores operativos en la respuesta pública.

La secuencia es validar → registrar referencia durable → subir a Cloudinary →
guardar metadatos → responder 201. Un rechazo definitivo de DB provoca compensación.
Un resultado DB incierto conserva la referencia para revisión; no conviene reenviar
automáticamente porque la escritura pudo confirmarse. No hay una clave de idempotencia
de subida: dos POST válidos independientes crean dos activos.

Dos cargas ocupan como máximo el flujo simultáneamente. La recepción tiene 60 segundos;
si se exceden, se corta la conexión. La inspección tiene tres segundos y Cloudinary
un timeout configurable. El cliente debe manejar tanto JSON de error como fallo de red.

## GET /archivos

Todos los parámetros son opcionales, únicos y de texto. Se rechazan parámetros extra.

| Parámetro | Valor por defecto | Regla |
| --- | --- | --- |
| buscar | Sin búsqueda | Subcadena literal del título, sin distinguir mayúsculas, hasta 160 caracteres |
| categoria | Todas | imagen, video o pdf; no admite cadena vacía |
| pagina | 1 | Entero decimal de 1 a 10000 |
| limite | 12 | Entero decimal de 1 a 50 |

Ejemplo: `GET /archivos?buscar=informe&categoria=pdf&pagina=1&limite=12`.
buscar vacío o solo espacios equivale a no filtrar. Los caracteres `%`, `_` y `\`
se buscan literalmente. No se admiten ceros iniciales, decimales ni notación exponencial
en pagina/limite. Se combinan búsqueda y categoría.

Respuesta 200: `{ "data": [registro], "meta": { "pagina": 1, "limite": 12, "total": 1, "totalPaginas": 1 } }`.
Cada registro tiene los mismos campos que el ejemplo de POST. Sin resultados,
data es `[]`, total es 0 y totalPaginas es 0. Una página posterior al final devuelve
data vacío manteniendo el total de coincidencias.

Solo incluye ACTIVO. Orden fijo: fechaSubida descendente y luego id descendente para
desempatar. Página y total comparten un snapshot RepeatableRead; páginas solicitadas
en momentos distintos pueden cambiar si se suben o eliminan activos. Respuesta con
`Cache-Control: no-store`.

## DELETE /archivos/:id

id debe tener formato UUID. No admite cuerpo JSON ni parámetros de consulta.
publicId y resourceType del cliente nunca deciden qué borrar: se leen de PostgreSQL.

Reserva la fila, la oculta del listado, confirma Cloudinary con invalidación de caché
y finalmente elimina sus metadatos. Un éxito devuelve **204 sin JSON**; React debe
retirar el activo de inmediato y no intentar parsear un cuerpo vacío.

Si el activo no existe, responde 404 ASSET_NOT_FOUND. Repetir un DELETE completo
también devuelve 404; mantiene el mismo efecto de ausencia. Si quedó interrumpido,
se reintenta con el mismo ID. ERROR_BORRADO admite reintento inmediato; ELIMINANDO o
NUBE_ELIMINADA esperan el vencimiento de la reserva de cinco minutos antes de ser
reclamados. Una respuesta DELETE_PENDING indica cloud ausente y DB pendiente.
Ante 500, el cliente debe refrescar el listado y conservar el ID para el reintento;
un activo parcialmente eliminado no vuelve a mostrarse como activo normal.

Los pendientes se inspeccionan con los comandos de [recuperación](recuperacion.md).
El borrado cloud se comprueba por su API; la invalidación CDN puede tardar.

## GET /health y CORS

200: `{ "data": { "status": "ok", "database": "up" } }`.
Si falla PostgreSQL: 500 DATABASE_UNAVAILABLE. No confirma disponibilidad de Cloudinary.
Este endpoint también usa `Cache-Control: no-store`.

El navegador debe usar exactamente CLIENT_ORIGIN. Un origen diferente responde
400 ORIGIN_NOT_ALLOWED. Se permiten GET, POST, DELETE y OPTIONS, con Content-Type;
el preflight correcto responde 204. No se envían cookies ni credenciales de sesión.
Una petición sin Origin está permitida: CORS no es autenticación.

## Errores JSON

```json
{ "error": { "code": "FILE_TOO_LARGE", "message": "El archivo supera el límite de 10 MB." } }
```

| HTTP | Códigos principales | Tratamiento |
| --- | --- | --- |
| 400 | INVALID_MULTIPART, INVALID_FORM, FILE_REQUIRED, INVALID_FILE, UPLOAD_CANCELLED | Corregir formulario o selección |
| 400 | INVALID_QUERY, INVALID_DELETE, INVALID_JSON, ORIGIN_NOT_ALLOWED | Corregir solicitud/configuración pública |
| 404 | ASSET_NOT_FOUND, NOT_FOUND | Archivo o ruta inexistente |
| 413 | FILE_TOO_LARGE, PAYLOAD_TOO_LARGE | Reducir tamaño; archivo máximo 10 MiB, JSON máximo 16 KiB |
| 500 | UPLOAD_BUSY, CLOUD_UPLOAD_FAILED, JOURNAL_UNAVAILABLE | Mostrar error de carga; operación sin éxito confirmado |
| 500 | PERSISTENCE_FAILED | DB rechazó la escritura; compensación intentada |
| 500 | PERSISTENCE_UNCERTAIN | Resultado DB pendiente de reconciliación; evitar reenvío automático |
| 500 | CLOUD_DELETE_FAILED, DELETE_PENDING, DELETE_IN_PROGRESS | Conservar ID y seguir política de recuperación |
| 500 | DATABASE_UNAVAILABLE, INTERNAL_ERROR | Fallo de servicio con mensaje seguro |

Las respuestas no exponen cadenas de conexión, API secrets, SQL, stack traces ni
mensajes crudos de proveedores. DATABASE_URL, DIRECT_URL y credenciales Cloudinary
permanecen en el backend; solo configuración pública se incorpora a React.

## Evidencia del contrato

- `server/test/upload-route.test.ts`: multipart, 201, 400 y errores seguros de creación.
- `server/test/multipart.test.ts`: máximo inclusivo y 413, forma multipart y concurrencia.
- `server/test/list-assets.test.ts`: parámetros, valores por defecto, paginación y errores.
- `server/test/delete-asset.test.ts`: UUID, referencia DB, orden cloud/DB, 204/404/500.
- `server/test/integration/assets.ts`: HTTP completo con PostgreSQL real, filtros literales,
  persistencia, compensación SQL, fallos intermedios, reservas concurrentes y reintentos.
- `server/test/live/assets.ts`: 201/200/204 reales con Cloudinary y Neon, tres categorías.

Resultados y fecha: [informe de Parte 3](informe-parte-3.md).
