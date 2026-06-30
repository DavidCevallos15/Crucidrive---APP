# Registro de Cambios - CruciDrive Backend

## [1.0.0] - 2026-06-30 13:08 (Hora Local)

### Añadido
- **FASE 1: Inicialización de Git y GitHub:**
  - Repositorio Git inicializado localmente (`git init`).
  - Configurado `user.name` como "DavidCevallos15" y `user.email` como "jimdav1506ceva@gmail.com".
  - Creado y configurado el archivo `README.md` inicial.
  - Subido el commit inicial a la rama `main` del repositorio remoto `https://github.com/DavidCevallos15/Crucidrive---APP.git`.
- **FASE 2: Estructura de Node.js y Dependencias:**
  - Proyecto Node.js inicializado (`npm init -y`).
  - Instaladas dependencias principales de producción: `express`, `cors`, `dotenv`, `@supabase/supabase-js`.
  - Instalada dependencia de desarrollo: `nodemon`.
  - Configurado script de desarrollo `"dev": "nodemon src/index.js"` en `package.json` para facilitar la ejecución interactiva.
- **FASE 3: Arquitectura y Conexiones:**
  - Creado archivo `.gitignore` para excluir estrictamente `.env`, `node_modules` y directorios temporales de editores.
  - Creado `.env.example` como plantilla para configuración de puerto y Supabase.
  - Creado `.env` con las claves reales suministradas para el desarrollo local (nunca subidas a Git).
  - Estructurado el archivo de conexión `src/config/supabase.js` que inicializa el cliente de Supabase usando variables de entorno.
  - Creados los directorios de arquitectura limpia `src/controllers/` y `src/routes/` con archivos `.gitkeep` correspondientes.
  - Creado punto de entrada `src/index.js` para levantar el servidor Express en el puerto 3000 con un endpoint de health check `/` que verifica la conectividad a la API de Supabase.
