# Verificación técnica — Parte 4 y entrega final

Responsable: **Juan David Ortiz Dcroz**.
Autor Git: `Juanortizd17 <Juanortizd17@gmail.com>`.
Rama: `juanda-cloud-vault`. Repositorio: `juanffff-hub/cloud-media-vault`.
Fecha: 16 de noviembre de 2026, America/Bogota.

## Entrega

Formulario responsive en español con título, autor y archivo; selección tradicional
y arrastre, vistas previas, progreso real y feedback. Galería con imagen, video nativo
y PDF, metadatos, búsqueda, categorías y paginación. Borrado confirmado y reactivo;
avisos de reintento que conservan el ID ante fallos parciales. README final, equipo,
arquitectura y demo de ocho minutos documentados.

## Resultados de verificación

| Comprobación | Resultado |
| --- | --- |
| Tipos TypeScript | Cliente y servidor aprobados |
| Vitest | 39 cliente + 144 servidor = 183 pruebas aprobadas |
| Builds | React/Vite y Express/TypeScript aprobados |
| Neon de prueba | Migración/modelo, CRUD HTTP, orden/filtros/paginación, compensación SQL, fallos y reintentos aprobados |
| Chromium con API simulada | Seis casos aprobados: escritorio y móvil, teclado, formulario, arrastre, límite, filtros y borrado |
| Flujo real desde React | PNG, MP4 y PDF subidos y eliminados; proveedores y entrega HTTPS comprobados |
| Revisión visual | Escritorio 1440 px, móvil 390 px y diálogo; sin desbordamiento horizontal |
| Consola del navegador | Sin errores de JavaScript ni errores de consola en el flujo real |
| PDF | Entrega HTTPS 200 con cabecera PDF y enlace React correcto |
| Video | Metadatos disponibles y reproducción confirmada en navegador |

La verificación real se ejecutó con Chromium local mediante Playwright y se
inspeccionaron sus capturas. El navegador integrado de la sesión no estaba disponible.
No se utilizaron mocks de Cloudinary ni Neon en esa ejecución.

Durante una repetición, generar Prisma simultáneamente reinició el servidor y
cortó una subida. La interfaz mostró error de red y el diario conservó PREPARED.
La repetición con servidor estable pasó completamente, incluida reproducción de
video. La operación interrumpida se reconcilió después del plazo de diez minutos,
con ingesta detenida: PostgreSQL confirmó ausencia de fila y Cloudinary confirmó
la compensación. El diario quedó marcado COMPENSATED, sin descartar referencias.

### Resultado de cada activo propio

| Archivo | resourceType | POST React | Cloudinary / Neon | Entrega | DELETE React | Comprobación posterior |
| --- | --- | --- | --- | --- | --- | --- |
| paisaje.png | image | 201 | Recurso y metadatos completos | HTTPS 200, imagen visible | 204 | Cloudinary 404, DB sin fila, galería actualizada |
| movimiento.mp4 | video | 201 | Recurso y metadatos completos | HTTPS 200, video reproducible | 204 | Cloudinary 404, DB sin fila, galería actualizada |
| documento.pdf | image | 201 | Recurso y metadatos completos | HTTPS 200, PDF válido y enlace | 204 | Cloudinary 404, DB sin fila, galería actualizada |

Se usó la base exclusiva `cloud_media_vault`, títulos con identificador de ejecución
y publicIds bajo `cloud-media-vault/`. Los tres activos y archivos temporales propios
quedaron retirados. Las pruebas DB separadas usan `cloud_media_vault_test`. El diario
conserva referencias operativas, nunca binarios. Evidencia local ignorada: `tmp/browser-live/`.

## Seis contribuciones de esta parte

| Commit | Título |
| --- | --- |
| b9e4e85 | feat(client): crear formulario de activos |
| 654caca | feat(client): añadir Drag and Drop y vistas previas |
| 12da0c2 | feat(client): enviar FormData con progreso y feedback |
| c830472 | feat(client): mostrar galería multimedia |
| 6c27b97 | feat(client): filtrar y eliminar de forma reactiva |
| Este informe | test(client): cerrar interfaz, integración y demo |

Los hashes completos y la verificación definitiva del merge se consultan en Git y
en el [PR de interfaz](https://github.com/juanffff-hub/cloud-media-vault/pull/4),
titulado `feat: interfaz multimedia y entrega del taller`. El sexto commit contiene
este informe: su hash se registra en el cierre, sin crear un séptimo commit para autorreferenciarlo.

El historial previsto conserva 24 commits técnicos y cuatro merge commits, además
del commit inicial. Las cuatro ramas y PR permiten revisar las seis contribuciones
de cada titular. El cambio de identidad Git no sustituye esa revisión por el equipo.

## Límites y reproducción

No se añadió autenticación; el nombre del autor es texto del formulario. CORS no
acredita identidad. `health` comprueba PostgreSQL. El borrado CDN puede propagarse
después del 204; se comprobó ausencia con la API de Cloudinary. Las operaciones
entre proveedores requieren estados y compensaciones, no una transacción compartida.

Para repetir la demo: [guion](demo.md), [pruebas](pruebas-parte-4.md),
[configuración local](configuracion-local.md) y [recuperación](recuperacion.md).
La parte se cierra únicamente después de CI aprobada, PR integrado con merge commit,
main sincronizada y árbol limpio; el informe de cierre de la sesión registra esos hashes.
