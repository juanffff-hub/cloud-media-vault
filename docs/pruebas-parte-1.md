# Verificación de la Parte 1

## Sin servicios externos

```sh
npm ci
npm run db:validate -w server
npm run check
```

`check` verifica tipos (incluyendo tests y scripts), ejecuta pruebas unitarias del
cliente y servidor, y compila ambos proyectos. No usa credenciales reales en los dobles.

Cobertura: entorno válido/inválido y redacción, CORS/preflight/origen incorrecto,
JSON mal formado, salud con éxito/fallo/recuperación, selección de resourceType,
IDs únicos, límite de buffers, metadatos cloud inválidos, fallo de stream/callback,
borrado confirmado/ausente/ambiguo/fallido y aislamiento de conexiones de prueba.

## Con PostgreSQL real

Completar [la guía de configuración](configuracion-local.md). Luego, desde la raíz:

```sh
npm run test:db -w server
npm run db:test:status -w server
npm run db:migrate -w server
npm run db:status -w server
npm run db:check -w server
npm run cloud:check -w server
```

`test:db` aplica la migración en la base separada y comprueba persistencia completa,
restricciones SQL, índice GIN, búsqueda insensible a mayúsculas, estado operativo,
salud HTTP con DB real, CORS y limpieza de su UUID. Solo crea metadatos sintéticos
en la base de pruebas; no afirma subir archivos reales a Cloudinary.

La CI usa PostgreSQL 17 efímero y claves públicas locales de ese contenedor, no secretos
de Neon. La prueba local en Neon sigue siendo necesaria para cerrar la parte.
`cloud:check` verifica autenticación mediante ping, sin modificar activos.
Las subidas reales de imagen/video/PDF corresponden a la Parte 2; la prueba desde React
y su borrado en ambos servicios corresponden al cierre final.

## Seguridad y revisión

```sh
git diff --check
git check-ignore server/.env server/.env.test client/.env node_modules client/dist server/dist
git ls-files
git log origin/main..HEAD --format="%h %s | %an <%ae>"
```

Revisar que solo las plantillas de entorno estén versionadas, que no haya binarios
de prueba o build y que las dependencias cloud/DB no aparezcan en el bundle del cliente.
No registrar URLs PostgreSQL ni errores crudos del proveedor al diagnosticar fallos.

En este entorno Windows, Vitest requiere permiso para lanzar procesos fuera del
sandbox de Codex. Un fallo `spawn EPERM` no es una prueba funcional fallida; hay que
repetir la verificación con el permiso correspondiente y registrar el resultado real.
