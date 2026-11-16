# Revisión final de entrega

Fecha: **16 de noviembre de 2026**. Revisión sobre las cuatro partes integradas en
`main` (`b8123c0`), seguida de un commit adicional de documentación y video con
`Juanortizd17 <Juanortizd17@gmail.com>`. No se encontraron fallos que requirieran
cambiar el código de la aplicación durante este cierre.

## Requisitos y evidencia

| Área de la rúbrica | Comprobación |
| --- | --- |
| Subida cloud y binarios (25 %) | Multipart con un archivo, límite de 10 MiB, validación de MIME, extensión y contenido. Cloudinary recibe el binario; imagen/PDF usan image y video usa video. Errores, cancelación y compensación cubiertos por pruebas. |
| Metadatos (25 %) | Prisma almacena referencias HTTPS, publicId, resourceType, título, nombre, autor, categoría, MIME, tamaño, fecha y estado; sin binarios. Migraciones, restricciones, índices, búsqueda, filtros, orden descendente y paginación probados en PostgreSQL. |
| Interfaz (20 %) | Formulario en español, arrastre, vistas previas, progreso real de envío, mensajes, galería diferenciada, búsqueda y filtros. Pruebas de navegador en escritorio y móvil. |
| Borrado y seguridad (15 %) | El servidor obtiene las referencias desde DB. Confirma Cloudinary antes de retirar el registro; los estados parciales quedan ocultos y permiten reintento. CORS, errores seguros y credenciales solo en servidor. |
| Colaboración y sustentación (15 %) | Cuatro PR integrados mediante merge, seis commits técnicos por integrante, documentación por parte y grabación que muestra subida y eliminación verificadas en los dos servicios. |

El formulario no autentica al autor. Cloudinary y PostgreSQL no comparten una
transacción: la compensación y los estados recuperables resuelven fallos entre
proveedores. Los detalles y límites están en [arquitectura](arquitectura.md),
[API](api.md) y [recuperación](recuperacion.md).

## Verificación ejecutada en este cierre

| Comando o revisión | Resultado |
| --- | --- |
| `npm run check` | Tipos correctos, 39 pruebas del cliente y 144 del servidor aprobadas; ambos builds completos |
| `npm run test:db -w server` | Migraciones y CRUD HTTP con Neon de prueba aprobados; restricciones, búsqueda, paginación, compensación, concurrencia y recuperación comprobadas |
| `npm run test:e2e -w client` | 6 pruebas aprobadas, escritorio y móvil; API simulada |
| `npm run db:check -w server` | Conexión real con Neon y modelo Activo verificados |
| `npm run cloud:check -w server` | Autenticación y disponibilidad reales de Cloudinary verificadas |
| `npm audit --omit=dev` | 0 vulnerabilidades reportadas en dependencias de producción |
| Grabación MP4 | Decodificación completa sin errores; revisión visual de las etapas de subida, consulta y borrado |

Las pruebas de DB de este cierre usan una base separada y Cloudinary simulado para
inyectar fallos. Las comprobaciones reales de los tres formatos desde React,
incluida entrega HTTPS y borrado consultado mediante ambas APIs, se documentaron
en el [cierre de la Parte 4](informe-parte-4.md). El video añadido ahora aporta la
grabación del usuario desde la interfaz y los paneles de los proveedores.

## Evidencia audiovisual

[Abrir o descargar el video](../Video%20Demostracion%20en%20VIVO/Taller%20Media%20Cloud%20Voult%20Video%20Funcionamiento.mp4)
(MP4, 1920 × 1080, aproximadamente 5:07, 19,5 MB, sin narración).

La secuencia muestra validaciones, carga de PNG/MP4/PDF, filas en Neon y recursos
en Cloudinary. Después del borrado desde React se ven búsquedas de los publicId
sin resultados en Cloudinary y una consulta general vacía en Neon. La última
sección vuelve a cargar archivos para mostrar búsqueda, filtros y paginación;
por eso la biblioteca vuelve a tener contenido al terminar el video.

El [README](../README.md) contiene la instalación, el arranque, los integrantes,
la arquitectura, las pruebas y enlaces a los cuatro PR. El [guion](demo.md)
incluye los pasos para repetir la demostración y una consulta de todos los
registros, sin filtro por título.
