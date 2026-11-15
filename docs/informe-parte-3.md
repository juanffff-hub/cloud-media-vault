# Verificación técnica — Parte 3

Responsable: Juan Sebastian Gomez Muñoz,
`sebasgomezmunoz3-ship-it <sebasgomezmunoz3@gmail.com>`.
Rama: `gomez-cloud-vault`. Repositorio: `juanffff-hub/cloud-media-vault`.
Fecha de verificación: 15 de noviembre de 2026 (America/Bogota).

## Alcance entregado

POST conectado a Prisma con respuesta 201 tras confirmar cloud y DB. GET con
búsqueda por título, categoría, paginación, orden estable y exclusión de estados
parciales. DELETE con reserva condicional, referencia guardada en DB, cloud primero
y metadatos después. Recuperación por el mismo ID y comandos de mantenimiento;
reconciliación de subidas inciertas con consulta DB previa. Contrato REST documentado.

No se añadió login. Los binarios se conservan en Cloudinary; PostgreSQL recibe solo
URL y metadatos. El formulario y la galería React corresponden a Parte 4.

## Resultados

| Comprobación | Resultado |
| --- | --- |
| `npm run check` | TypeScript, 144 pruebas servidor, 6 cliente y ambos builds aprobados |
| `npm run test:db -w server` | Migración, arquitectura y CRUD HTTP completos en Neon de prueba aprobados |
| Integración de listado | Orden descendente, título literal/insensible a mayúsculas, categoría y paginación correctos |
| Fallos de ingesta | Error cloud sin fila DB; rechazo SQL real con compensación confirmada |
| Fallos de borrado | Conservación de fila ante error cloud; estado oculto y reintento tras fallos DB |
| Concurrencia real DB | Dos DELETE no duplican la operación cloud; un intento antiguo no modifica la reserva nueva |
| `npm run test:assets:live -w server -- <ruta-ffmpeg>` | PNG, MP4 y PDF recorrieron POST/GET/DELETE reales con Cloudinary y Neon |
| Servidor compilado en puerto temporal | Health/listado 200, POST/DELETE registrados y preflight CORS 204 |
| Comandos de inspección de recuperación | Ejecutados sin mutaciones; sin pendientes en DB de aplicación ni diario de ingesta |
| Revisión de archivos versionables | Sin secretos locales, entornos privados, dependencias, builds ni binarios cargados |
| `git diff --check` | Sin errores de espacios |

### Flujo cloud real

| Archivo propio | POST | resourceType | Registro Neon y URL | DELETE | Resultado final |
| --- | --- | --- | --- | --- | --- |
| PNG | 201 | image | Completo; HTTPS 200 | 204 | Ausente en cloud y DB |
| MP4 | 201 | video | Completo; HTTPS 200 | 204 | Ausente en cloud y DB |
| PDF | 201 | image | Completo; HTTPS 200 y cabecera PDF | 204 | Ausente en cloud y DB |

La ausencia cloud se confirmó mediante 404 en su API; la ausencia DB, consultando
el UUID. El listado final del lote quedó vacío. Se utilizó `cloud_media_vault_test`
y `cloud-media-vault/tests/part-3/UUID/`. No se tocaron recursos ajenos y se retiraron
los archivos temporales propios. Los diarios de prueba contienen solo metadatos,
fuera de Git. No quedaron recursos ni registros de ese lote pendientes de limpieza.

## Corrección encontrada por la integración

Prisma 7.10.1 con adapter-pg devuelve la violación CHECK de PostgreSQL (SQLSTATE
23514) dentro de P2039. Se agregó esa identificación específica para compensar un
rechazo SQL definitivo. Los fallos desconocidos de conexión siguen siendo inciertos:
se comprueba el registro y, si no puede confirmarse, se conserva la referencia.
La regresión está cubierta por una prueba unitaria y un rechazo SQL real.

## Trazabilidad y cierre

Los cinco primeros commits son `34000bd`, `6d4beab`, `81f75bf`, `cfa9bfd` y `b923839`.
Este informe pertenece al sexto: `docs(api): documentar contrato REST y sincronización`.
Consultar hashes completos, autoría y estado en Git y en el PR
`feat: persistencia CRUD y eliminación sincronizada`.

La CI ejecuta tipos, pruebas, builds y ambos conjuntos de integración con PostgreSQL
17 efímero. Confirmar su resultado antes del merge commit. Los informes previos
conservan el alcance histórico de sus partes.

Tras integrar y sincronizar main, detenerse. Parte 4 requiere `Juanortizd17`,
`Juanortizd17@gmail.com` y la orden exacta `Continúa`. El titular debe revisar y
asumir su contribución; el cambio de cuenta no sustituye participación real.
