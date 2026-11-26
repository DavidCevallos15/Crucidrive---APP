# 019 · Cumplimiento legal y seguridad web previa a Play Store

Estado: **Aprobada por David el 25 nov 2026** (titular: David Cevallos, RUC `1350766547001`, domicilio: Crucita, Portoviejo, Manabí, Ecuador; contacto: `soporte@tricimoto.app`). Aplica el checklist legal previo a publicación en tiendas y sitios web (privacidad, términos, reembolsos, eliminación de cuenta, consentimiento explícito, preferencias de cookies/almacenamiento y cabeceras de seguridad).

## Por qué
Antes de crear la cuenta de Google Play Developer y publicar la app móvil y la app web en producción, CruciDrive necesita documentos legales públicos accesibles sin cuenta, consentimiento explícito en todos los formularios de entrada y control claro de almacenamiento/servicios externos en la versión web. Sin estos documentos, las tiendas rechazan la publicación y la plataforma queda expuesta ante reclamos de usuarios o incumplimientos de la LOPDP de Ecuador.

## Historias
- Como **pasajero o conductor**, quiero leer la Política de Privacidad, los Términos de Uso y la Política de Reembolsos sin iniciar sesión, desde la web y desde la app, para saber exactamente qué datos se recogen y cuáles son las reglas del servicio.
- Como **usuario con cuenta**, quiero poder eliminar mi cuenta tanto dentro de la app como desde una página web pública, sabiendo qué datos se borran de inmediato y cuáles por obligación legal.
- Como **visitante o pasajero en la web**, quiero elegir si autorizo cargar mapas externos o usar solo el almacenamiento esencial, sin que me obliguen a aceptar todo y pudiendo cambiar mi decisión en cualquier momento.
- Como **David (responsable)**, quiero que la app deje claro que es intermediaria tecnológica, que el botón SOS no sustituye al 911 y que los documentos ya no muestren avisos de «borrador pendiente de revisión» ni queden secretos expuestos.

## Criterios de aceptación

### A. Documentos legales públicos sin registro
1. **Dado** cualquier persona sin sesión, **cuando** abre la dirección pública de Privacidad, **entonces** accede por HTTPS a un documento en lenguaje claro de hasta 2.000 palabras con: responsable (David Cevallos, RUC `1350766547001`, Crucita, Portoviejo, Manabí, Ecuador y `soporte@tricimoto.app`), tabla completa de datos personales con finalidad, base legal LOPDP y plazo de conservación (incluida la ubicación en segundo plano de conductores), proveedores externos, derechos ARCO/LOPDP, mención a la Superintendencia de Protección de Datos Personales y enlace para eliminar cuenta.
2. **Dado** cualquier persona sin sesión, **cuando** abre la dirección pública de Términos de Uso, **entonces** accede por HTTPS a un documento de hasta 3.000 palabras que define el rol de intermediación tecnológica, requisitos de edad y aprobación de conductores, reglas de viajes y encomiendas (prohibición de objetos peligrosos o ilícitos), prohibición de uso indebido e ingeniería inversa, aclaración de que el SOS no sustituye al 911, cláusula de limitación de responsabilidad al 100 % de los importes pagados a la plataforma y jurisdicción de Ecuador (Portoviejo, Manabí).
3. **Dado** cualquier persona sin sesión, **cuando** abre la dirección pública de Reembolsos, **entonces** accede por HTTPS a las reglas de pagos en efectivo (no procesados por la app) y devoluciones de créditos o cuotas de conductores (incluido el reintegro automático de créditos cuando el pasajero cancela antes de iniciar el servicio) y el canal de reclamo en `soporte@tricimoto.app`.
4. **Dado** cualquier usuario, **cuando** abre la página pública de Eliminación de cuenta, **entonces** ve las instrucciones para eliminar su cuenta desde la app y la vía web para solicitarlo sin tener la app instalada, con el detalle de qué datos se borran de inmediato, cuáles a los 30 días y cuáles por obligación legal o anonimizados.
5. **Dado** la página pública de inicio y confirmación de correo, **cuando** se abre, **entonces** conserva la confirmación de cuenta y enlaza al pie a Privacidad, Términos de Uso, Reembolsos y Eliminación de cuenta.

### B. Consentimiento explícito y enlaces dentro de la app
6. **Dado** la versión del consentimiento legal, **cuando** se publica este cambio, **entonces** la versión vigente pasa a `1.0` tanto en la app como en el servidor, elimina la leyenda de «borrador pendiente de revisión legal» e identifica al responsable y su canal de contacto. Los conductores que aceptaron una versión anterior vuelven a aceptar la `1.0` antes de ponerse disponibles.
7. **Dado** el formulario de creación de cuenta con correo, **cuando** el usuario quiere registrarse, **entonces** debe marcar de forma explícita una casilla no marcada por defecto aceptando la Política de Privacidad y los Términos de Uso, con enlaces visibles a ambos documentos. Al iniciar sesión con una cuenta existente no se exige marcar la casilla, pero los enlaces siguen visibles.
8. **Dado** las pantallas «Completa tu perfil» y «Configuración / Privacidad», **cuando** el usuario las abre, **entonces** encuentra enlaces directos a la Política de Privacidad, los Términos de Uso, la Política de Reembolsos y la página de Eliminación de cuenta.

### C. Preferencias de cookies y almacenamiento en la web
9. **Dado** un usuario que entra por primera vez a la versión web, **cuando** carga la pantalla, **entonces** puede elegir entre tres opciones sin bloqueo abusivo: aceptar el mapa interactivo externo, usar solo lo esencial (mapa de respaldo sin servicios de terceros de analítica ni publicidad) o personalizar su elección.
10. **Dado** una preferencia guardada en la web, **cuando** se registra, **entonces** guarda la versión, la fecha de elección y una fecha de caducidad (180 días), declara que no se usan cookies publicitarias ni de analítica, y puede modificarse en cualquier momento desde Configuración.
11. **Dado** que el usuario elige «Solo esenciales» (sin mapa externo), **cuando** abre el mapa en la web, **entonces** la app no carga el script del mapa externo y muestra directamente el mapa de respaldo.

### D. Seguridad de cabeceras y repositorio
12. **Dado** el sitio legal y la app web, **cuando** responden por HTTPS, **entonces** incluyen cabeceras estrictas de transporte seguro (HSTS) y política de seguridad de contenido (CSP) compatibles con los recursos autorizados de la app.
13. **Dado** el repositorio y su historial, **cuando** se audita antes de publicar, **entonces** no contiene archivos `.env`, llaves privadas ni credenciales secretas, y los archivos locales de notas externas quedan ignorados fuera del control de versiones.

## Fuera de alcance
- Revisión formal firmada por un abogado externo (sigue siendo recomendable antes de escalar o firmar con cooperativas/GAD; D-07).
- Registro formal de marca o depósito de código ante el SENADI (gestión administrativa de David).
- Cobro de créditos o pasarela de pagos (va en `020-pagos-y-comisiones`).
- Separación del panel de administración y registro de alertas SOS (va en `006-sos-admin`).
