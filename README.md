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
