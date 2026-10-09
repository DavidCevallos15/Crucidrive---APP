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
 *
 * @param {{ config: import('expo/config').ExpoConfig }} contexto
 * @returns {import('expo/config').ExpoConfig}
 */
module.exports = ({ config }) => {
  const local = path.join(__dirname, 'google-services.json');
  const googleServicesFile = process.env.GOOGLE_SERVICES_JSON
    || (fs.existsSync(local) ? './google-services.json' : undefined);

  return {
    ...config,
    android: {
      ...config.android,
      ...(googleServicesFile ? { googleServicesFile } : {}),
    },
    plugins: [
      ...(config.plugins ?? []),
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
