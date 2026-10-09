const fs = require('fs');
const path = require('path');

/**
 * Configuración dinámica de Expo (paso 004, plan P21). Extiende app.json, que sigue siendo
 * la base, con lo que no puede ir en el repo:
 *
 * - `google-services.json` (Firebase, para los avisos en Android). En EAS llega por la
 *   variable de tipo archivo GOOGLE_SERVICES_JSON; en local, si existe, se usa el archivo
 *   de esta carpeta (está en .gitignore). Sin ninguno de los dos la app compila igual,
 *   pero sin avisos.
 * - El plugin de expo-notifications con el ícono y el color de los avisos.
 * - La clave de Google Maps para Android (variable GOOGLE_MAPS_API_KEY de EAS). Sin ella,
 *   react-native-maps cierra la app al pintar el mapa; `extra.mapaAndroid` le dice al
 *   componente del mapa si puede usarlo.
 *
 * @param {{ config: import('expo/config').ExpoConfig }} contexto
 * @returns {import('expo/config').ExpoConfig}
 */
module.exports = ({ config }) => {
  const local = path.join(__dirname, 'google-services.json');
  const googleServicesFile = process.env.GOOGLE_SERVICES_JSON
    || (fs.existsSync(local) ? './google-services.json' : undefined);
  const mapsApiKey = process.env.GOOGLE_MAPS_API_KEY || undefined;

  return {
    ...config,
    android: {
      ...config.android,
      ...(googleServicesFile ? { googleServicesFile } : {}),
    },
    extra: {
      ...config.extra,
      mapaAndroid: Boolean(mapsApiKey),
    },
    plugins: [
      ...(config.plugins ?? []),
      ...(mapsApiKey ? [['react-native-maps', { androidGoogleMapsApiKey: mapsApiKey }]] : []),
      [
        'expo-notifications',
        {
          icon: './assets/android-icon-monochrome.png',
          color: '#0D9488',
        },
      ],
    ],
  };
};
