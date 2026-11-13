# Adaptador Cloudinary

El contrato `CloudStorage` separa servicios de aplicación del SDK. Recibe un buffer
acotado y categoría; devuelve URL HTTPS, publicId, resourceType, tamaño y formato
realmente devueltos por el proveedor. Aún no se registra el POST: la ingesta será
Parte 2 y la confirmación tras persistencia será Parte 3.

| Categoría | resource_type | Formatos |
| --- | --- | --- |
| imagen | image | jpg/jpeg, png, webp |
| video | video | mp4, webm |
| pdf | image | pdf |

PDF usa `image` para permitir entrega y previsualización. Si su URL no abre en una
cuenta Free, revisar **Settings > Security > Allow delivery of PDF and ZIP files**.
No se realizan conversiones ni se activa un preset unsigned.

Las credenciales se pasan al SDK solo desde el backend. Los IDs usan UUID y prefijo
`cloud-media-vault/`; no se derivan del nombre original ni permiten sobrescritura.
El adaptador conserva un identificador candidato seguro cuando la respuesta es
incierta, para que el servicio de ingesta pueda compensar/reconciliar en la Parte 2.
El SDK recibe un timeout explícito. La validación de firma, MIME y extensión
pertenece a la ingesta; los formatos del proveedor son una segunda comprobación.

`delete` exige una referencia interna del proyecto y usa ambos campos guardados.
Solo `ok` y `not found` confirman que el recurso ya no está; una respuesta ambigua
o error rechaza la operación. Se solicita `invalidate: true`; la invalidación CDN
puede tardar en propagarse. El listado se actualizará tras confirmar la operación.
La Parte 3 debe obtener esta referencia desde PostgreSQL a partir del UUID de API.

Prueba de autenticación real, sin subir ni borrar recursos:

```sh
npm run cloud:check -w server
```

Las pruebas unitarias inyectan un gateway y nunca llaman al proveedor. Las pruebas
reales usan únicamente recursos creados por este proyecto.

Referencias: [SDK Node](https://cloudinary.com/documentation/node_image_and_video_upload),
[Upload API / destroy](https://cloudinary.com/documentation/image_upload_api_reference#destroy_method),
[entrega de PDF](https://cloudinary.com/documentation/image_delivery_options).
