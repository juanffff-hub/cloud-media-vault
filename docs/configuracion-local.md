# Configuración local sin compartir secretos

## 1. Archivos ignorados

Desde PowerShell, en la raíz del repositorio (no sobrescribir archivos ya configurados):

```powershell
Copy-Item server/.env.example server/.env
Copy-Item server/.env.test.example server/.env.test
Copy-Item client/.env.example client/.env
git check-ignore server/.env server/.env.test client/.env
```

El último comando debe mostrar las tres rutas. Solo editar los archivos locales;
no pegar valores en el chat, capturas, commits o terminales compartidas.
Las variables `VITE_` llegan al navegador y solo contienen configuración pública.

## 2. Neon exclusivo de Cloud Media Vault

1. En https://console.neon.tech crear un proyecto `cloud-media-vault`.
2. En el selector de proyecto/rama elegir la rama de desarrollo. En **Postgres database >
   Databases > Add database**, crear `cloud_media_vault` y `cloud_media_vault_test`.
   La segunda base es exclusiva para pruebas; no usar bases de otros proyectos.
3. En **Connect**, seleccionar `cloud_media_vault` y copiar la cadena con **Connection pooling**
   activado a `DATABASE_URL` de `server/.env`. Desactivar pooling y copiar la conexión directa
   a `DIRECT_URL`. Conservar los parámetros TLS entregados por Neon, incluido `sslmode=require`.
4. Seleccionar `cloud_media_vault_test` en **Connect** y repetir con `TEST_DATABASE_URL`
   (pooling) y `TEST_DIRECT_URL` (directa) dentro de `server/.env.test`.

Se usan dos bases distintas para evitar que las pruebas modifiquen los datos de la aplicación.
Las migraciones y pruebas se ejecutan desde los scripts del repositorio cuando estén preparados.
No ejecutar `migrate reset` ni borrar bases como parte de esta configuración.

## 3. Cloudinary

1. Entrar a https://console.cloudinary.com y seleccionar el entorno del proyecto.
2. En **Settings > API Keys** localizar Cloud name, API Key y API Secret. Copiar cada valor
   a su variable `CLOUDINARY_*` correspondiente en `server/.env`.
3. Conservar `CLOUDINARY_FOLDER=cloud-media-vault`. Los recursos de prueba de esta aplicación
   tendrán ese prefijo; no se reutilizan identificadores de otros productos.
4. En **Settings > Security**, habilitar **Allow delivery of PDF and ZIP files** para poder
   abrir PDFs en cuentas Free. Guardar el cambio. La entrega real se verificará con un PDF de prueba.

## 4. Confirmación

Guardar los tres archivos en VS Code y responder `Listo` sin adjuntar credenciales.
Se verificará presencia y funcionamiento sin imprimir las cadenas ni el API secret.
`CLIENT_ORIGIN` debe coincidir exactamente con la dirección del navegador, incluido puerto:
usar `http://127.0.0.1:5173` con la configuración predeterminada.

CORS restringe qué orígenes pueden leer la API desde un navegador; no es autenticación.
La aplicación del taller no incorpora login ni verifica la identidad indicada en `subidoPor`.

Referencias: [Neon y Prisma](https://neon.com/docs/guides/prisma),
[bases de datos Neon](https://neon.com/docs/manage/databases),
[entrega de PDF en Cloudinary](https://cloudinary.com/documentation/image_delivery_options).
