# 008 · Backend de prueba en la nube (parte del piloto)

Estado: **Aprobada por David** el 21 oct 2026 (un servidor gratuito en lugar de pagar un hosting antes de terminar la app). El 26 oct David ya tenía una VM `crucidrive-api` en **Azure for Students**, y se usa esa en lugar de la e2-micro de Google Cloud que se había propuesto. Es solo la parte del 008 que permite probar en campo. El hosting definitivo del piloto se decide después.

## Por qué
Hoy el backend corre en la PC de David y los teléfonos tienen que estar en su misma Wi-Fi, o pasar por ngrok mientras la PC esté encendida. Una prueba real en Crucita usa datos móviles y no tiene ni esa Wi-Fi ni esa PC. David no quiere pagar un servidor hasta terminar la app.

## Qué
Un servidor siempre encendido, sin costo, al que la app llega por HTTPS y WebSocket seguro (WSS) desde cualquier red.

## Criterios de aceptación
1. **Dado** el servidor de prueba encendido, **cuando** se abre `https://<servidor>/`, **entonces** responde `{"status":"ok"}` con un certificado válido.
2. **Dado** el APK `preview` apuntando al servidor, **cuando** dos teléfonos usan datos móviles (sin Wi-Fi), **entonces** se puede iniciar sesión, poner al conductor disponible, pedir un viaje, recibir la oferta, aceptarla y recibir un aviso con la app cerrada.
3. **Dado** un reinicio de la VM o del servicio, **cuando** vuelve, **entonces** el backend arranca solo, sin intervención, y los viajes abiertos se recuperan desde la base de datos.
4. **Dado** un apagado del servicio, **cuando** llega la señal de cierre, **entonces** el despacho se detiene y los sockets se cierran en orden, en menos de 15 s.
5. **Dado** el repo, **cuando** alguien lo lee, **entonces** no hay claves en él: las claves viven en un archivo de la VM con permisos restringidos.
6. **Dado** la prueba de humo, **cuando** se corre contra la URL pública, **entonces** pasa igual que en local.

## Decisiones
- **Una VM de Azure for Students** (`crucidrive-api`, con IP pública fija), con Ubuntu o Debian. David ya la tenía creada.
  - Descartada la **e2-micro de Google Cloud**: era la opción propuesta, pero implicaba crear otra cuenta y otra VM.
  - Descartado **Render Free**: se duerme tras 15 min sin tráfico, y el despacho necesita un proceso siempre encendido porque guarda sus temporizadores y conexiones en memoria.
  - Descartado **Cloud Run**: escala a cero, igual que Render Free.
  - Descartado **un hosting de pago**: se deja para el piloto.
- **Una sola instancia.** El despacho no se puede repartir entre varios procesos sin un servicio nuevo (Redis), y la regla 8 no lo permite sin una spec.
- **HTTPS con Caddy y un nombre gratuito**: `<IP>.sslip.io` o la etiqueta DNS de Azure (`<nombre>.<región>.cloudapp.azure.com`). Caddy renueva el certificado solo. Descartado comprar un dominio: no hace falta para pruebas.
- **systemd sin Docker.** Docker es infraestructura nueva (regla 8) y no aporta nada para un solo proceso.
- **Costo:** al 26 oct, 0,94 USD en 6 días (IP pública 0,55, disco 0,39 y cómputo 0,00): unos 4 USD al mes, dentro del tope de 25 USD de la regla 5 y del crédito de Azure for Students. David pone una alerta de presupuesto.

## Fuera de alcance
- El hosting definitivo del piloto, monitoreo y alertas.
- Escalar a varias instancias.
- El agente de aprobación de conductores: David lo planteará después.

## Tareas
- [x] T1 · `npm start`, `engines` y cierre ordenado con SIGTERM (`backend/src/apagado.js`) → prueba: `tests/apagado.test.js`.
- [x] T2 · `deploy/vm/`: servicio systemd, Caddyfile, `api.env.ejemplo`, `instalar.sh` (Ubuntu o Debian) y guía de Azure → prueba: `bash -n instalar.sh` y revisión.
- [ ] T3 · **David:** abrir los puertos 80 y 443 en Azure, correr `instalar.sh`, cargar las claves y comprobar el criterio 1.
- [ ] T4 · **David:** variables de EAS `preview`, APK nuevo y prueba de humo contra la URL pública (criterio 6).
- [ ] T5 · **David:** prueba de campo con datos móviles (criterio 2).
