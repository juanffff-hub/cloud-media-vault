# Requisitos y rúbrica

Fuente: consigna oficial «Taller Práctico Colaborativo: Gestor de Activos Multimedia
en la Nube (Cloud Media Vault)», cuatro páginas, leídas íntegramente antes de editar.
Las instrucciones del usuario definen la metodología y concretan el stack permitido.

## Consigna

- Aplicación fullstack con carga de imágenes, videos y PDF; límite sugerido de 10 MB.
- Ruta B elegida: React/Vite, Express, Multer y CORS.
- Binarios exclusivamente en cloud; URL, publicId, nombre, tamaño, MIME, fecha y autor en DB.
- GET ordenado con búsqueda por título y filtros por categoría.
- Galería con vista diferenciada, nombre, peso legible, tipo y fecha.
- DELETE elimina primero el recurso cloud y después el registro de DB; actualiza React.
- Formulario con selección o arrastre, validaciones y feedback de carga/éxito/error.
- Cuatro integrantes: se fusionan los roles de formulario y galería/QA.
- GitHub debe evidenciar aportes por rol; README con nombres, roles, arquitectura y ejecución.
- Sin secretos ni dependencias instaladas en Git. Incluir ejemplos de entorno.
- Sustentación máxima de ocho minutos con subida y borrado comprobados en cloud y DB.

## Rúbrica (máximo 5.0)

| Criterio | Peso | Evidencia para nivel excelente |
| --- | --- | --- |
| Subida cloud y binarios | 25 % | Multipart, transferencia segura, formatos/peso y errores robustos |
| Persistencia de metadatos | 25 % | Modelo completo y consultas ordenadas/óptimas mediante ORM |
| Interfaz y experiencia multimedia | 20 % | Responsive, Drag & Drop, feedback, vistas nativas y filtros |
| Borrado sincronizado y seguridad | 15 % | Cloud + DB, actualización inmediata, CORS y entorno protegido |
| Colaboración y sustentación | 15 % | Historial equilibrado, README y flujo completo demostrado en vivo |

La rúbrica describe el borrado como «atómico». Cloudinary y PostgreSQL no comparten
una transacción distribuida: se concretará con estado operativo y reintentos recuperables.

## Contratos adicionales del proyecto

Cloudinary + Neon/PostgreSQL + Prisma; máximo estricto de 10 MiB (10 485 760 bytes).
JPEG, PNG, WebP, MP4, WebM y PDF; validación de MIME, extensión y contenido.
`POST /api/archivos`, `GET /api/archivos`, `DELETE /api/archivos/:id`, `GET /api/health`.
Solo habrá respuesta 201 tras confirmar cloud y persistencia. Si DB falla, compensar en cloud.
El servidor obtiene `publicId` y `resourceType` desde DB para borrar. No habrá login.
Listado normal excluye borrados pendientes. Pruebas simuladas y reales en recursos exclusivos.

## Entrega incremental

1. Arquitectura/configuración/modelo/salud/adaptador y pruebas base.
2. Multipart, validación de archivos, transferencia y compensación de subida.
3. Persistencia, listado y eliminación recuperable.
4. Formulario, galería, integración, QA y demo final.

El contrato previsto no implica que sus endpoints ya estén implementados.
