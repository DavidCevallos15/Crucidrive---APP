# Actualizaciones por aire (EAS Update)

Para probar cambios en el teléfono **sin generar un APK nuevo** (spec `specs/008-piloto/actualizaciones-por-aire.md`, D-17). Solo vale para cambios de JavaScript e imágenes.

> Los comandos sirven en bash (Fedora) y en PowerShell o Git Bash (Windows). Corren dentro de `frontend/`, con la sesión de EAS iniciada (`npx eas-cli whoami`). Ningún token va al repo ni al chat.

## 1. Una sola vez: el APK de base
Un teléfono solo recibe actualizaciones si su APK se compiló con esta configuración. Genera **uno nuevo** e instálalo; después no hace falta otro mientras no cambie el código nativo.

```bash
cd frontend
npx eas-cli env:list preview        # URL del backend, Supabase, Google Maps y, si pruebas fuera de Crucita, EXPO_PUBLIC_ZONA_PRUEBA
npx eas-cli build --profile preview --platform android
```

## 2. Publicar un cambio
```bash
cd frontend
npx eas-cli update --channel preview --environment preview --message "Qué cambió, en una frase"
```
- `--channel preview`: solo lo reciben los APK `preview`.
- `--environment preview`: toma las variables `EXPO_PUBLIC_*` del entorno `preview` de EAS y las incrusta en la actualización.
- Antes de publicar, corre `npm test` y `npx tsc --noEmit`: una actualización rota llega a todos los testers.

## 3. Comprobar que llegó
1. Cierra la app del todo (deslízala fuera de las recientes) y ábrela con datos o Wi-Fi.
2. Si la descarga tardó más de 3 s, ciérrala y ábrela otra vez.
3. En el teléfono: menú → *Ajustes* → *Acerca de*. Debe decir «Actualización `a1b2c3d4` · fecha · canal preview», y el id debe ser el que muestra `npx eas-cli update:list --branch preview`.

Si dice «Código de la instalación», no llegó nada: revisa que el APK sea el nuevo (paso 1), el canal y la conexión.

## 4. Lista de control: cuándo SÍ hace falta un APK nuevo
Si tu cambio toca **cualquiera** de estas cosas, no basta con `eas update`:

| Cambio | Qué hacer |
| --- | --- |
| Instalar o quitar una librería con código nativo (`expo-*`, `react-native-*`) | Subir `version` en `app.json` y generar APK nuevo |
| Permisos, íconos, nombre, `plugins` o cualquier cosa de `app.json` que no sea texto de la interfaz | Igual |
| Subir la versión de Expo o de React Native | Igual |
| Pantallas, textos, estilos, lógica, imágenes, variables `EXPO_PUBLIC_*` | `eas update` |

**Regla:** si dudas, sube la versión. Un APK solo acepta actualizaciones de su misma versión (`runtimeVersion` por `appVersion`), así que subirla nunca rompe a nadie: los APK viejos dejan de recibir cambios y los nuevos sí.

## 5. Si una actualización sale mal
- Una actualización que falla al arrancar hace que el teléfono vuelva solo a la anterior que funcionaba.
- Para quitar una mala de un canal: `npx eas-cli update:rollback` (guiado). Permite volver a una actualización publicada antes o al código de la instalación. Al publicar de nuevo, todos reciben la nueva.
- Cambios de la API o de la BD: mientras haya APK viejos, el backend y las migraciones deben seguir aceptando lo anterior.
