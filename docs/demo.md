# Demostración del taller

Objetivo: mostrar que un binario llega a Cloudinary, sus metadatos a Neon y un
borrado desde React retira ambos. Usar solo archivos propios de Cloud Media Vault.

## Video entregado y repetición sencilla

La [grabación entregada](../Video%20Demostracion%20en%20VIVO/Taller%20Media%20Cloud%20Voult%20Video%20Funcionamiento.mp4)
dura aproximadamente 5:07 y muestra el flujo solicitado por el profesor. El guion
de ocho minutos que aparece más abajo es una propuesta para una sustentación en
equipo, no la duración ni una transcripción del video.

Con el entorno ya configurado, desde la raíz del proyecto:

1. Ejecutar `npm run dev` y mantener esa terminal abierta. Abrir
   `http://127.0.0.1:5173`, Cloudinary Media Library y Neon SQL Editor, en la base
   `cloud_media_vault` del proyecto. No mostrar pantallas de credenciales.
2. Mostrar el rechazo de un archivo mayor de 10 MB, un formato no admitido y un
   archivo que tenga extensión permitida pero contenido inválido.
3. Subir una imagen, un video y un PDF válidos, uno por uno, con título y autor.
   Esperar el mensaje de éxito y su aparición en la galería.
4. Ejecutar la consulta general indicada abajo. Mostrar las nuevas filas y sus
   `publicId`; actualizar Cloudinary y localizar esos mismos recursos.
5. Eliminar los archivos de esta demostración desde la web y confirmar que
   desaparecen. Ejecutar otra vez la misma consulta de Neon.
6. En el mismo entorno de Cloudinary, quitar filtros anteriores y buscar cada
   `publicId` completo que se guardó antes de borrar. Mostrar la ausencia de
   resultados. Si la tabla tenía otros activos, sus filas deben permanecer.

## Preparación antes de presentar

1. Cada titular revisa sus seis commits, pruebas y PR, y explica su responsabilidad.
2. Instalar y configurar según el [README](../README.md). Ejecutar migraciones,
   `npm run check`, `npm run test:db -w server` y `npm run test:e2e -w client`.
3. Ejecutar `npm run dev`. Abrir `http://127.0.0.1:5173`, Cloudinary Media Library
   y Neon Tables para la base **cloud_media_vault**, tabla **Activo**. No abrir
   Connect, API Keys, `.env` ni paneles de credenciales durante la proyección.
4. Preparar una imagen PNG/JPEG, un MP4 y un PDF propios, menores de 10 MB.
   Usar títulos `Demo taller - imagen`, `Demo taller - video`, `Demo taller - PDF`
   y los nombres reales de los autores. No reutilizar archivos de otros proyectos.
5. Confirmar `GET /api/health`, conexión de ambos servicios y entrega del PDF.
   Si el PDF carga pero no abre: Cloudinary → Settings → Security → habilitar
   **Allow delivery of PDF and ZIP files** → guardar → volver a comprobar la URL.
6. En DevTools, mostrar solo Network con el filtro `archivos`; las respuestas de
   la API son públicas y seguras. Tener listo el [diagrama](arquitectura.md).

## Guion cronometrado

| Tiempo | Responsable | Acción y evidencia visible |
| --- | --- | --- |
| 0:00–0:50 | Juan Felipe Fajardo | Presenta Cloud Media Vault, Ruta B y diagrama: binarios en Cloudinary, URL/metadatos en Neon, sin login |
| 0:50–1:30 | Juan Felipe Fajardo | Muestra modelo Prisma y health; señala conexión de ejecución y migración sin abrir credenciales |
| 1:30–2:40 | David Neira Conde | Explica límite/MIME/firma, selecciona o arrastra imagen, escribe título/autor, sube y espera 201; muestra progreso y aparición en galería |
| 2:40–3:40 | Juan David Ortiz Dcroz | Sube video y PDF; reproduce el video y abre el PDF; muestra vistas previas y disposición móvil |
| 3:40–4:50 | Juan Sebastian Gomez Muñoz | Busca los tres títulos en Neon; comprueba URL, publicId, resourceType, MIME, tamaño, fecha y autor. En Cloudinary localiza los recursos por publicId dentro de cloud-media-vault |
| 4:50–5:40 | Juan David Ortiz Dcroz | Combina búsqueda y categoría. Muestra paginación si hay más de 12 activos propios, sin crear datos ficticios en la interfaz; vuelve a Todos |
| 5:40–6:50 | Juan Sebastian Gomez Muñoz + Juan David Ortiz Dcroz | Elimina una imagen de esta demo desde React y confirma. Muestra DELETE 204, desaparición inmediata, actualización de Cloudinary sin el recurso y Neon sin la fila |
| 6:50–7:30 | David Neira Conde | Muestra rechazo de un archivo mayor de 10 MB y explica compensación; enseña resultados automatizados de fallos cloud/DB y reintentos, sin simular un fallo real durante la demo |
| 7:30–8:00 | Los cuatro | Muestra cuatro PR con merge y seis commits por integrante. Cada titular resume su contribución y el resultado de pruebas |

Duración total: **8:00**. La comprobación del borrado usa la API/Media Library de
Cloudinary; una URL CDN puede seguir temporalmente en caché. No sustituir la
verificación con una recarga de una URL cacheada.

## Comprobación de datos

En Neon SQL Editor, esta consulta muestra todos los archivos subidos, del más
reciente al más antiguo, sin buscar un título específico:

```sql
SELECT "titulo", "categoria", "publicId", "secureUrl"
FROM "Activo"
ORDER BY "fechaSubida" DESC;
```

Antes de borrar, guardar los `publicId` de los archivos de la demo. Después de
eliminarlos desde React, volver a ejecutar la misma consulta: sus filas ya no
deben aparecer. Si eran los únicos registros, el resultado estará vacío. El nombre
de tabla y campos coincide con la migración. En Cloudinary, buscar el **publicId
guardado**, no el UUID de PostgreSQL ni el nombre original del archivo.

## Si algo falla

- No declarar éxito antes del 201 ni reenviar una subida incierta sin revisar la biblioteca.
- Si DELETE falla, mostrar el aviso y reintentar el mismo ID; respetar los cinco minutos
  cuando lo indique. Seguir la [guía de recuperación](recuperacion.md).
- Un error de red real se explica como tal; no presentar capturas anteriores como prueba en vivo.
- Tras presentar, retirar únicamente los activos creados para esta demo desde React.
  No borrar por prefijos generales ni tocar recursos ajenos.

La prueba reproducible `npm run test:e2e:live -w client` ejercita el mismo flujo
desde un navegador real y consulta ambos proveedores; véanse los [resultados](informe-parte-4.md).
