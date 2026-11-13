# Salud del sistema

`GET /api/health` comprueba la conexión PostgreSQL mediante Prisma (`SELECT 1`).
No cambia datos, no devuelve secretos y usa `Cache-Control: no-store`.

Respuesta 200:

```json
{ "data": { "status": "ok", "database": "up" } }
```

Si la consulta falla, responde 500 (según el contrato del proyecto):

```json
{ "error": { "code": "DATABASE_UNAVAILABLE", "message": "La base de datos no está disponible." } }
```

Este endpoint verifica DB; no afirma que Cloudinary esté disponible. La validación
de credenciales cloud y sus operaciones se prueban por separado para no consumir
la cuota del proveedor en cada consulta de salud.

El proceso crea un único PrismaClient con pool máximo de cinco conexiones, límites
de conexión y consulta, y cierre del pool al recibir SIGINT/SIGTERM. No registra SQL
con valores ni errores crudos del proveedor. Una base temporalmente inactiva no
impide escuchar HTTP: health devuelve 500 hasta recuperarse.

Después de configurar `server/.env`:

```sh
npm run db:migrate -w server
npm run db:check -w server
npm run dev
```

Abrir `http://127.0.0.1:3001/api/health`. `db:check` también comprueba la existencia
del modelo migrado sin imprimir registros. Los dobles de prueba no sustituyen
esta verificación real con Neon.
