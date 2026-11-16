# Recuperación entre Cloudinary y PostgreSQL

No hay una transacción compartida entre proveedores. Las transacciones Prisma son
cortas y no contienen llamadas cloud. El listado muestra únicamente ACTIVO.

## Borrado

1. Una actualización condicional reserva la fila, incrementa intentosBorrado y marca
   ELIMINANDO. Se comparan estado, contador y fecha anteriores para evitar reservas dobles.
2. Cloudinary recibe publicId y resourceType guardados en DB, con invalidate=true.
3. Solo deleted o already_absent permiten marcar NUBE_ELIMINADA y eliminar la fila.

Un error cloud deja ERROR_BORRADO. Si también falla la actualización DB, queda
ELIMINANDO. Si cloud ya desapareció y falla DB, queda ELIMINANDO o NUBE_ELIMINADA.
Los tres estados se excluyen de la galería; el registro conserva la referencia.

Repetir `DELETE /api/archivos/:id` recupera la operación. ERROR_BORRADO admite
reintento inmediato. ELIMINANDO y NUBE_ELIMINADA reservan cinco minutos desde el
inicio del intento; durante ese plazo responden DELETE_IN_PROGRESS. Ese plazo
supera el máximo configurado de la llamada cloud (dos minutos) y las operaciones DB.
Cada intento tiene un contador: una respuesta tardía no puede modificar una reserva
más reciente. NUBE_ELIMINADA permite finalizar sin otra llamada cloud. Si el estado
no llegó a guardarse, `not found` del proveedor también permite terminar.

Un DELETE ya completado responde 404 al repetirse; el efecto sigue siendo idempotente.
La invalidación CDN puede tardar en propagarse. La comprobación autoritativa del
borrado usa la API del proveedor; el listado se entrega con Cache-Control: no-store.

Para localizar pendientes y recuperar un ID concreto desde la terminal:

React conserva el ID y título de una operación iniciada en sessionStorage antes de
enviar DELETE. Si no confirma el resultado, muestra **Reintentar borrado** y actualiza
la galería para ocultar estados parciales. Recargar la misma pestaña conserva ese
aviso; cerrar la pestaña puede retirarlo. Para otra pestaña/equipo, usar los comandos
de recuperación. Si el navegador bloquea su almacenamiento, el estado DB sigue siendo
la fuente duradera. No se reintenta automáticamente ni se declara éxito ante un 500.

```sh
npm run assets:recover -w server
npm run assets:recover -w server -- --id UUID
# Base de pruebas separada (solo recursos propios):
npm run assets:recover -w server -- --test
```

Sin ID, el comando solo lista hasta 50 pendientes con estado y códigos, sin URLs
ni datos del formulario. Con ID exige un registro pendiente y del prefijo del
proyecto; no inicia el borrado de activos ACTIVO. Repetir después de la reserva
si responde DELETE_IN_PROGRESS. No existe un cron oculto que borre activos.

## Subidas y respuestas DB inciertas

Un rechazo definitivo de PostgreSQL después de cloud activa la compensación.
Si falla la compensación, la referencia queda en el diario durable. Si se pierde
la respuesta DB, el repositorio intenta confirmar el registro mediante su identidad
cloud. Una confirmación coincidente permite responder 201. Si sigue sin poder
determinar el resultado, responde PERSISTENCE_UNCERTAIN y conserva el recurso para
evitar borrar un archivo cuyo COMMIT pudo completarse.

Para reconciliar estas subidas, detener primero todas las instancias de ingesta y
esperar al menos diez minutos desde el último evento. Así se evita competir con
una subida o confirmación DB todavía en curso. Desde la terminal:

```sh
npm run uploads:reconcile -w server
npm run uploads:reconcile -w server -- --operation UUID_DE_OPERACION
```

El primer comando solo muestra operaciones pendientes. El segundo actúa sobre una
sola referencia del diario y del prefijo configurado. Siempre consulta DB antes:
si existe un registro, conserva cloud y marca PERSISTED; si confirma ausencia, borra
cloud y marca COMPENSATED. Si DB o cloud falla, sigue pendiente. No se aceptan publicId
externos. Este comando utiliza la base de aplicación asociada al diario de esa instancia.

`server/var/upload-journal.jsonl` requiere volumen persistente en despliegue. No se
versiona y no contiene binarios ni secretos. El lector rechaza archivos dañados o
mayores de 10 MiB sin modificarlos: revisar/restaurar una copia íntegra antes de
reconciliar, conservando todas las referencias sin resolver. No eliminar el diario
para silenciar un error. Archivar operaciones resueltas es mantenimiento explícito.

Referencia: [transacciones Prisma 7](https://www.prisma.io/docs/orm/v7/prisma-client/queries/transactions).
