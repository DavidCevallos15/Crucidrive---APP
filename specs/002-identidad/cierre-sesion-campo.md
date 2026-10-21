# Corrección de cierre de sesión · 20 oct 2026

Alcance: corregir la salida ya prevista en 002 y la limpieza de cuenta de 009,
solicitado por David tras un bloqueo. No añade funcionalidades ni cambia permisos.

## Evidencia inicial y plan

- Pasajero real: inició sesión, abrió menú y pulsó salir. Se observó «Cerrando
  sesión…»; después las dos pestañas abiertas dejaron de responder a inspección.
  Una pestaña nueva sí abrió login sin sesión guardada y el mapa público funcionó.
  Por tanto Auth llegó a borrar la sesión: no atribuir todo el bloqueo a la red.
- Revisar especialmente la transición y los efectos al desmontar pantallas y menú;
  separar la confirmación de Auth de la navegación para evitar salidas duplicadas.
- La limpieza GPS/avisos ya tiene límite de 4 s, pero la revocación no. Limitar
  también esa espera; si no hay confirmación mostrar error y permitir reintentar,
  sin fingir salida ni borrar solo el estado visual dejando credenciales guardadas.
- Mantener el listener de Auth síncrono; diferir las lecturas del perfil fuera del
  callback, conservando la protección contra respuestas de una cuenta anterior.
- Unificar estado de salida y error entre pantallas. Impedir solicitudes simultáneas
  y dar feedback accesible en menú, perfil y administrador, con cabecera adaptable.

## Tareas y pruebas

- [x] Regresión: Auth que no responde, fallo, éxito y resultado tardío. Datos locales
  solo se limpian con confirmación, y un segundo toque no duplica la revocación.
- [x] Corregir transición reproducida, listener y estado compartido; probar scopes.
- [x] Mejorar carga/error/reintento y layout de salida en los tres roles.
- [x] Prueba web con las tres cuentas: login, pantalla del rol, chat si está
  disponible, salida, recarga y navegación protegida sin resucitar sesión.
- [x] Tests frontend/backend, TypeScript, exportación y revisión independiente UI.
- [x] Registro, commit y PR con CI. Android físico se declara pendiente si ADB no
  expone dispositivos; no sustituir esa prueba por evidencia web.

Las credenciales de prueba se usan solo en memoria y no se guardan en Git.

## Causa confirmada durante la reproducción

Salir desde Perfil también dejó el árbol visible vacío. La consola de la versión
compilada registró React #185 (profundidad máxima de actualizaciones). El guard
redirigía de `(app)` a `/`, ruta compartida por el índice privado del pasajero y
el mapa público. Además el layout `(app)` tenía otro Redirect a `/`, que competía
con el raíz. Se elimina esa segunda redirección: sin sesión no monta contenido
privado. El guard raíz redirige una sola vez por destino a `/explorar`, alias
inequívoco del mapa público; `/` sigue funcionando como entrada habitual.
Regresión de los tres grupos privados → `/explorar`, sin redirección posterior.
El menú deja la navegación únicamente al guard y se cierra al cambiar identidad.

## Resultado de las pruebas

- Pasajero: acceso al mapa y perfil; salida desde menú a `/explorar`, recarga sin
  sesión y acceso directo a `/profile` redirigido sin mostrar contenido privado.
- Conductor aprobado: consola, chat y perfil propios; salida desde Perfil y
  recarga sin sesión. El perfil no presenta «No disponible» si ese dato no existe.
- Administrador: panel vacío real, catálogo cargado y búsqueda Farmacia + Malecón
  con tres resultados; salida desde cabecera con controles busy/disabled,
  recarga y menú de visitante. Sin React #185 en la comprobación final.
- Ambos chats están sin viaje activo; no se enviaron mensajes ni solicitudes
  nuevas, ni se aprobó/rechazó documentación. No se modificaron precios o roles.
- Limpieza de viaje/chat/referencias y conductores cercanos al cambiar identidad;
  las lecturas tardías de viajes se descartan si cambió la generación de cuenta.
- Regresión de Auth confirmada primero en rojo. Pruebas finales: 412 frontend y
  388 backend, TypeScript y exportación web. La integración con el SDK instalado
  prueba fallo conservando credenciales y reintento exitoso sin sesión al reiniciar.
- Capturas verificadas en `.impeccable/review/logout/`: admin 360×640 y 1280×800,
  menú de pasajero 360×640 y salida pública 360×640. Sin credenciales en archivos.
- No hay dispositivo en ADB; no se declara probado logout, teclado o recepción de
  mensajes en teléfono. La exportación Android/Hermes valida empaquetado solamente.
- Revisión independiente: capturas sin defectos visuales materiales; se detectó
  una carrera adicional en las mutaciones de viaje. Corregida con scopes antes de
  aplicar solicitudes/cancelaciones/pasos y sus finally. Quince pruebas ejercitan
  las acciones reales con red diferida → salir/cambiar/volver a la misma cuenta.
  Veredicto posterior **ship al P1 revisado, resolved**; no amplía la evidencia nativa.
- Entrega: [PR #61](https://github.com/DavidCevallos15/Crucidrive---APP/pull/61),
  implementación `adb43b4`. CI backend/frontend y Vercel en verde; Supabase Preview
  omitido al no cambiar la BD. El PR queda abierto para revisión y fusión de David.
