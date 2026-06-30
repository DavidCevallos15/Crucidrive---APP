# Plan de Ejecución del Proyecto

Este proyecto se desarrollará de forma iterativa priorizando la funcionalidad núcleo del MVP.

- **Fase 1: Configuración Base (Actual)**
  - Inicialización del monorepo (`/frontend` y `/backend`).
  - Configuración del enrutamiento (Expo Router) y dependencias de UI (Glassmorphism).
  - Configuración del servidor Node.js y conexión a PostgreSQL/Supabase.

- **Fase 2: Autenticación y Seguridad**
  - Login/Registro de usuarios y conductores (Validación por SMS/Token).
  - RBAC (Role-Based Access Control).

- **Fase 3: Core de Geolocalización (WebSockets)**
  - Emisión de coordenadas del conductor en background.
  - Renderizado de tricimotos activas en el mapa del pasajero (OpenStreetMap/Mapbox).

- **Fase 4: Flujo de Viaje y Emergencia**
  - Algoritmo de cálculo de tarifa fija por sector geocercado.
  - Implementación del "Botón de Pánico" y compartición de ruta.

- **Fase 5: Pulido y Despliegue**
  - Optimización de animaciones de interfaz.
  - Pruebas de estrés de consumo de datos móviles (límite: 15MB/jornada).
