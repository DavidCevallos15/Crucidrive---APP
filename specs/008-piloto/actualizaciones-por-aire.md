# 008 · Actualizaciones por aire para las pruebas (parte del piloto)

Estado: **Aprobada por David** el 26 oct 2026 en este chat («hagamoslo»), tras la recomendación de usar EAS Update en `preview`. Cubre solo las pruebas con el APK `preview`; la publicación en la Play Store se decide más cerca del piloto.

## Por qué
Cada ajuste que sale de una prueba de campo obliga hoy a generar un APK nuevo, esperar la cola de EAS, descargarlo e instalarlo en cada teléfono. Casi todos los cambios son de pantallas, textos y lógica de la app, que no necesitan código nativo nuevo.

## Qué
Que un teléfono con el APK `preview` reciba los cambios de JavaScript y de imágenes **sin reinstalar**, y que quien prueba pueda comprobar qué versión tiene.

## Criterios de aceptación
1. **Dado** un APK `preview` generado con esta configuración, **cuando** se publica una actualización en el canal `preview` y el teléfono abre la app con conexión, **entonces** la recibe sin reinstalar. Con una conexión normal la ve en la primera apertura; si la descarga tarda más de 3 segundos, la ve en la siguiente.
2. **Dado** el APK `preview`, **cuando** se publica una actualización en el canal `production`, **entonces** no la recibe, y al revés. Un canal nunca mezcla las pruebas con la versión final.
3. **Dado** una actualización que depende de código nativo que el APK no tiene (librería nueva, permisos o cambio de SDK), **cuando** se publica, **entonces** ningún teléfono la recibe: el APK solo acepta actualizaciones de su misma versión de la app. Cambiar código nativo exige subir la versión y generar un APK nuevo.
4. **Dado** una actualización que falla al arrancar, **cuando** el teléfono la prueba, **entonces** vuelve solo a la versión anterior que funcionaba.
5. **Dado** un usuario, **cuando** abre *Ajustes → Acerca de*, **entonces** ve qué corre: «Actualización `a1b2c3d4` · fecha · canal preview», o «Código de la instalación» si aún no recibió ninguna. En la web y en desarrollo no aparece nada.
6. **Dado** el repositorio, **cuando** alguien lo lee, **entonces** no hay claves ni tokens: la configuración solo lleva el identificador público del proyecto y los nombres de los canales.

## Decisiones
- **EAS Update, canal `preview`.** Ya se usa EAS para compilar; las actualizaciones por aire son gratis dentro del plan y no agregan servidores ni cuentas.
  - Descartado **solo la Play Store**: da distribución, pero cada versión nativa sigue necesitando un APK, así que no evita el problema de fondo.
  - Descartado **un servidor propio de actualizaciones**: infraestructura nueva sin necesidad (regla 8 de CLAUDE.md).
- **Versión de ejecución por `appVersion`.** Un APK solo acepta actualizaciones de su misma versión de la app (`version` de `app.json`). La regla es simple: **si se toca código nativo, se sube la versión**.
  - Descartado **`fingerprint`**: detecta solo los cambios nativos, pero se calcula en la PC de David (Windows) y en el servidor de EAS (Linux), y una diferencia de entorno puede hacer que ningún APK acepte la actualización sin dar ningún aviso.
- **Descarga al arrancar con espera de hasta 3 s** (`fallbackToCacheTimeout`): sin eso, quien prueba tendría que abrir la app dos veces para ver un cambio. Con mala señal, la app abre con la versión anterior y no se bloquea. El valor se revisa antes de publicar en la Play Store.
- **Las variables `EXPO_PUBLIC_*` viajan dentro de la actualización.** Al publicar con `--environment preview`, EAS las vuelve a incrustar desde el entorno `preview`. Así que cambiar la URL del backend o la zona de prueba **no** exige APK nuevo. *(Corrige lo que se dijo antes en el chat.)*
- **Solo `preview`.** El canal `production` queda definido, pero no se publica en él hasta el paso 008 completo.

## Fuera de alcance
- Cambios de código nativo, permisos y cambio de versión de Expo: siguen necesitando un APK nuevo.
- Actualizaciones de la web (PWA): ya se despliegan en Vercel.
- Revertir en bloque o publicar por porcentajes: se evalúa si hace falta con usuarios reales.
- Publicación en la Play Store.

## Riesgos
- **Olvidar subir la versión al cambiar algo nativo.** La actualización llegaría a APK que no la soportan; `expo-updates` intenta volver a la versión anterior (criterio 4), pero el teléfono queda con una pantalla rota hasta entonces. Mitigación: la lista de control de `deploy/actualizaciones.md`.
- **Cambiar el esquema de la BD o la API con una actualización publicada.** Un APK viejo sigue hablando con el servidor nuevo. Las migraciones y el backend deben seguir aceptando la versión anterior hasta que todos actualicen.
- **Estado de las cuotas.** El plan gratuito de EAS limita las actualizaciones por aire; con unos pocos testers sobra, pero hay que revisarlo antes del piloto.

## Tareas
- [x] T1 · `expo-updates`, `runtimeVersion` por `appVersion`, `updates.url` y canales `preview` y `production` en `eas.json` → prueba: `npx expo config` y `npm ci`.
- [x] T2 · Mostrar en *Acerca de* qué actualización corre (criterio 5) → prueba: `tests/actualizacion.test.ts`.
- [x] T3 · Guía `deploy/actualizaciones.md` con publicar, comprobar y la lista de control de cambios nativos.
- [ ] T4 · **David:** generar **un APK `preview` nuevo** con esta configuración e instalarlo. Es el último que hace falta mientras no cambie el código nativo.
- [ ] T5 · **David:** prueba de punta a punta: publicar un cambio pequeño con `eas update`, abrir la app en el teléfono y comprobar en *Acerca de* que cambió el id (criterios 1 y 5). Probar también un canal equivocado (criterio 2).
