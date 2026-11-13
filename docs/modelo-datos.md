# Modelo de metadatos

`Activo` no contiene binarios. Su UUID identifica el registro de la API; `publicId`
y `resourceType` identifican juntos el recurso de Cloudinary. Solo se guardará la
`secure_url` HTTPS realmente devuelta por el proveedor.

| Campo | Propósito |
| --- | --- |
| id | UUID generado por Prisma |
| titulo, nombreOriginal | Título del usuario y nombre de archivo seguro para mostrar |
| secureUrl, publicId, resourceType | Referencia cloud; image para imagen/PDF, video para video |
| categoria, mimeType, tamanoBytes | Tipo y tamaño técnico; máximo 10 485 760 bytes |
| fechaSubida | Fecha UTC con zona horaria; orden descendente |
| subidoPor | Nombre requerido, sin verificación de identidad |
| estado | ACTIVO, ELIMINANDO, ERROR_BORRADO, NUBE_ELIMINADA |
| intentosBorrado, borradoIniciadoEn | Seguimiento y detección de operaciones interrumpidas |
| ultimoErrorCodigo | Código seguro de fallo; nunca respuesta cruda ni credenciales |
| actualizadoEn | Última modificación, utilizable para control de concurrencia |

Solo los activos en estado `ACTIVO` serán visibles en el listado normal. La Parte 3
implementará las transiciones, exclusión mutua y reintentos; estos campos preparan ese contrato.

Los índices compuestos comienzan por estado y cubren fecha/ID descendentes con y sin
categoría. El ID desempata fechas iguales. Un índice GIN con `pg_trgm` facilita
búsquedas parciales e insensibles a mayúsculas sobre `titulo` mediante `ILIKE`.
La migración habilita la extensión en la base exclusiva de este proyecto.
Incluye restricciones SQL de tamaño, URL HTTPS, textos no vacíos y coherencia entre
categoría, MIME y resourceType. Se mantienen en la migración porque Prisma no
representa las restricciones CHECK en el modelo.

Prisma 7.10.1 usa `prisma.config.ts` para la URL de migraciones (`DIRECT_URL`). El
cliente generado en `src/generated/prisma` es TypeScript ESM y no se versiona.
La ejecución empleará `@prisma/adapter-pg` con `DATABASE_URL` agrupada de Neon.

## Comandos desde la raíz

```sh
npm run db:validate -w server
npm run db:generate -w server
npm run db:test:migrate -w server
npm run db:test:status -w server
npm run db:migrate -w server
npm run db:status -w server
```

Validar y generar no exige servicios reales. Aplicar/verificar migraciones exige
configurar las conexiones según [la guía local](configuracion-local.md).
Los scripts comprueban el nombre de la base, separan pruebas y ejecución, usan
la conexión directa y ocultan las salidas del proveedor que puedan contener URLs.
No resetean ni vacían bases. Los archivos SQL deben conservarse en Git.

Referencia: [PostgreSQL y Prisma 7](https://www.prisma.io/docs/orm/v7/core-concepts/supported-databases/postgresql).
