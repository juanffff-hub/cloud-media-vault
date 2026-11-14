# Cloud Media Vault

Proyecto independiente del taller de Desarrollo de Experiencias Multimedia para la Web.
Ruta B: React + Vite en `client/`, Express en `server/`, Cloudinary para binarios y
Neon/PostgreSQL con Prisma para metadatos. No requiere inicio de sesión:
`subidoPor` será un dato del formulario, no una identidad verificada.

## Equipo y ejecución por partes

| Parte | Integrante | Cuenta GitHub | Responsabilidad |
| --- | --- | --- | --- |
| 1 | Juan Felipe Fajardo | juanffff-hub | Arquitectura cloud y base de datos |
| 2 | David Neira Conde | DavidN09 | Ingesta y subida cloud |
| 3 | Juan Sebastian Gomez Muñoz | sebasgomezmunoz3-ship-it | Persistencia CRUD y sincronización |
| 4 | Juan David Ortiz Dcroz | Juanortizd17 | Formulario, galería y QA (roles 4 y 5) |

Cada parte tiene seis commits técnicos y un PR integrado con merge commit.
Los titulares deben revisar y asumir sus contribuciones. El cambio de cuenta Git
no sustituye la participación real. Solo se avanza de parte tras la orden `Continúa`.

## Desarrollo

Requisitos: Node.js 24 LTS y npm 11. Desde la raíz:

```sh
npm ci
# Configurar los archivos de entorno antes de iniciar el servidor:
# ver docs/configuracion-local.md
npm run dev
```

Cliente: `http://127.0.0.1:5173`. API: `http://127.0.0.1:3001/api`.
El punto de entrada es funcional; la carga y galería se implementarán en las partes siguientes.

```sh
npm test
npm run typecheck
npm run build
# O todas las verificaciones:
npm run check
```

## Organización

```text
client/              React, Vite y pruebas de interfaz
server/src/routes/   Contratos HTTP
server/src/services/ Reglas de aplicación
server/src/adapters/ Proveedores externos
server/prisma/       Modelo y migraciones (Parte 1)
docs/                Requisitos, arquitectura, API y demo
```

Nunca se versionan `.env`, credenciales, `node_modules`, `dist` ni archivos subidos.
Solo Cloudinary almacenará los binarios; PostgreSQL conservará URL y metadatos.
La entrega final incluye una demostración real de subida y borrado en ambos servicios.

Configuración de servicios y variables: [guía local](docs/configuracion-local.md).
La API valida el entorno antes de escuchar; si falta un dato informa solo el nombre
de la variable. El cliente acepta únicamente configuración pública de URL y límite.

## Arquitectura y verificaciones de la Parte 1

- [Diagrama y decisiones](docs/arquitectura.md).
- [Modelo Prisma y migraciones](docs/modelo-datos.md).
- [Endpoint de salud](docs/salud.md).
- [Adaptador Cloudinary](docs/cloudinary.md).
- [Pruebas automatizadas y reales](docs/pruebas-parte-1.md).
- [Resultados de verificación de la Parte 1](docs/informe-parte-1.md).
- [Consigna y rúbrica](docs/requisitos.md).

Configurar las dos bases Neon antes de aplicar migraciones:

```sh
npm run test:db -w server
npm run db:migrate -w server
npm run db:check -w server
npm run cloud:check -w server
```

`GET /api/health` comprueba PostgreSQL. Las rutas de activos se incorporarán en
las partes siguientes. La interfaz inicial todavía no permite subir ni borrar.

## Ingesta y subida cloud — Parte 2

Multer recibe un archivo de hasta 10 MiB con título y autor. La ingesta valida
MIME, extensión y contenido, transfiere con el SDK firmado y compensa fallos de
persistencia. Un diario durable conserva las referencias de operaciones inciertas.
El controlador exige persistencia confirmada antes de responder 201; permanece
sin registrar en la API pública hasta conectar Prisma en la Parte 3.

- [Límites, validación y compensación](docs/ingesta.md).
- [Pruebas automatizadas y prueba real de seis formatos](docs/pruebas-parte-2.md).
- [Resultados de verificación de la Parte 2](docs/informe-parte-2.md).
