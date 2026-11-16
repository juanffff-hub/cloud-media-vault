# Pruebas de interfaz e integración final

## Automatizadas

```sh
npm run check
npm run test:db -w server
npx playwright install chromium
npm run test:e2e -w client
```

| Área | Cobertura |
| --- | --- |
| Formulario | Título/autor requeridos, normalización, MIME/extensión, límite inclusivo de 10 MiB, foco en primer error |
| Selección | Input tradicional, Drag and Drop, rechazo de múltiples archivos, vistas imagen/video/PDF y revocación de object URLs |
| Envío | FormData, progreso por bytes, espera de persistencia tras 100%, doble envío bloqueado, cancelación al desmontar |
| Errores | 400, 413, 500, red/timeout, respuesta inválida; conserva formulario y no refleja mensajes internos |
| Galería | Imagen, video nativo, enlace PDF, autor/fecha/MIME/tamaño, vacío/carga/error, enlaces HTTPS |
| Consultas | Búsqueda combinada con categoría, paginación, reinicio de página, respuestas obsoletas canceladas |
| Borrado | Confirmar/cancelar, 204 vacío, 404 del activo ausente, retiro reactivo, fallos parciales y reintento por mismo ID |
| Recuperación UI | SessionStorage conserva IDs iniciados; recarga de pestaña, reintento y corrección de última página vacía |
| Navegador | Seis casos: tres en escritorio y tres en móvil, teclado/Escape/foco, filtros, subida, drag/drop, 10 MB y eliminación |

Los 39 tests del cliente usan Vitest/jsdom; los 144 del servidor prueban los contratos
y fallos de proveedores. Las pruebas DB aplican migraciones y realizan operaciones
reales en `cloud_media_vault_test`. Playwright abre Vite en puerto 5174 y simula solo
la API en los seis casos de interfaz; **no necesita credenciales cloud**.

La CI reproduce tipos, pruebas, ambos builds, integración con PostgreSQL 17 y
Chromium. Documentación primaria: [Playwright y servidor local](https://playwright.dev/docs/test-webserver),
[selección de archivos](https://playwright.dev/docs/input).

## Prueba real desde React

1. Configurar servicios locales según [configuración](configuracion-local.md).
2. Instalar FFmpeg y dejar su ejecutable en PATH o definir FFMPEG_PATH localmente.
3. Mantener `npm run dev` activo en una terminal (origen 127.0.0.1:5173, API 3001).
   No ejecutar generación de Prisma, migraciones ni builds simultáneamente: el
   watcher puede reiniciar Express e interrumpir una carga en curso.
4. En otra terminal ejecutar `npm run test:e2e:live -w client`.

El test genera un PNG de paisaje, un MP4 reproducible y un PDF originales. Los
selecciona en el formulario y sube con título único y autor. Para cada archivo:

- Confirma POST 201 y vista en React; espera imagen decodificada y metadatos de video.
- Consulta con Prisma la fila completa en `cloud_media_vault` y compara todos los metadatos.
- Consulta Cloudinary con resourceType guardado y verifica entrega HTTPS 200.
- Reproduce el video, filtra PDF, busca por título y revisa ancho móvil de 390 px.
- Elimina desde el diálogo React; exige DELETE 204, ausencia en galería, Cloudinary 404 y fila DB ausente.

Se inspeccionan visualmente las capturas de escritorio, móvil y confirmación.
`tmp/browser-live/` conserva localmente esas capturas y `resultado.json` con referencias
públicas del lote, sin credenciales. No se versionan los binarios de prueba ni sus capturas.
El test retira los tres activos propios y archivos temporales; los fallos de limpieza
se reportan explícitamente. No modifica recursos ajenos.

Si el servidor se reinicia antes de devolver 201, puede quedar una referencia
PREPARED en el diario aunque el test no tenga un ID de activo. Revisar
`npm run uploads:reconcile -w server` y seguir el protocolo de diez minutos con
la ingesta detenida. No eliminar ni modificar el diario para saltar ese plazo.

Esto complementa las pruebas con dobles y la demostración presencial del [guion de ocho minutos](demo.md).
Resultados ejecutados: [informe final de Parte 4](informe-parte-4.md).
