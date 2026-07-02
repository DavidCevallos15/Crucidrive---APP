# Master Prompt de Generación de Frontend: CruciDrive App (Stitch & Glassmorphism)

> **Rol del Agente de IA:** Actúa como un Senior Frontend Engineer con experiencia en desarrollo móvil nativo en React Native (Expo) y optimización de rendimiento en interfaces Glassmorphic. Tu objetivo es generar y estructurar todo el frontend bajo la carpeta `/frontend` siguiendo fielmente la especificación de diseño de **Google Stitch** definida en el archivo `DESIGN.md`.

---

## 1. Contexto del Proyecto y Misión
**CruciDrive** es una plataforma móvil hiperlocal de movilidad diseñada para la parroquia de Crucita en Ecuador. El sistema permite a pasajeros solicitar viajes en tricimotos locales, visualizar vehículos en tiempo real mediante geolocalización, comunicarse por chat en vivo con el conductor asignado y contar con un Botón de Pánico en caso de emergencias.

El frontend está estructurado como una aplicación multiplataforma con **React Native (Expo)** bajo el monorepo en `/frontend`.

---

## 2. Stack Tecnológico de Frontend
- **Plataforma:** React Native mediante el SDK de Expo (Expo Router para la navegación jerárquica basada en directorios).
- **Estilos:** Tailwind CSS aplicado con **NativeWind** para la consistencia y rapidez de diseño de componentes.
- **Efectos Visuales:** `expo-blur` para el renderizado del efecto esmerilado del Glassmorphism.
- **Animaciones:** `react-native-reanimated` para micro-interacciones de gestos y animaciones fluidas a 60fps.
- **Gestión de Estado:** **Zustand** para el manejo global y liviano del estado del viaje, geolocalización e información del perfil.
- **Comunicación en Tiempo Real:** **Socket.io-client** para WebSockets de GPS y mensajería en vivo.

---

## 3. Especificación de Diseño (Stitch Design)
Antes de escribir cualquier componente de la interfaz, **DEBES leer y cumplir estrictamente** con la especificación de diseño detallada en [DESIGN.md](file:///c:/Users/David/Documents/Proyectos/PLANIFICACIÓN%20DE%20PROYECTO-%20CRUCIDRIVE/CruciDrive%20-%20APP/DESIGN.md).

### Reglas Clave de Estilo:
- **Efecto de Cristal (Glassmorphic Container):**
  - Implementar fondos semitransparentes mediante clases de NativeWind como `bg-white/10` (claro) o `bg-slate-900/40` (oscuro).
  - Aplicar desenfoque físico usando el componente `<BlurView intensity={20}>` de `expo-blur` que envuelve el contenido de las tarjetas y modales.
  - Usar bordes finos de cristal como `border border-white/20` o `border-slate-800/50`.
  - Crear sombras amplias y suaves usando sombras de color (`shadow-lg shadow-black/25`).
- **Accesibilidad y Legibilidad:** Mantener un alto contraste de tipografía (blanco o slate oscuro) sobre las capas de cristal.
- **Micro-animaciones de Toque:** Todo botón o tarjeta interactiva debe reducir ligeramente su escala (`0.97` de escala mediante `Animated.View` o `reanimated`) cuando el usuario pulsa sobre ella.

---

## 4. Estructura de Carpetas del Frontend
Debes organizar los archivos en el directorio `/frontend/src/` respetando estrictamente la siguiente jerarquía:

```text
/frontend/src/
├── assets/           # Logotipos, iconos personalizados, fuentes (Outfit, Inter)
├── components/       # Componentes visuales genéricos y de cristal (GlassCard, GlassButton, InputField, BlurContainer)
├── constants/        # Colores del tema, sectores geográficos y configuración de red
├── hooks/            # Custom hooks encapsulados (useLocation para geolocalización, useSocket para WebSockets)
├── navigation/       # Rutas protegidas y públicas administradas por Expo Router
├── screens/          # Pantallas de la aplicación (LoginScreen, MapScreen, RideDetailScreen, DriverConsoleScreen, ChatScreen)
├── store/            # Almacenes Zustand (useAuthStore, useRideStore, useLocationStore)
├── styles/           # Configuración base de NativeWind y estilos globales de Tailwind
└── utils/            # Utilidades de negocio (cálculo de tarifas fijas por geocerca, formateadores de distancia)
```

---

## 5. Instrucciones de Implementación por Flujo

### A. Flujo de Autenticación (Login con Teléfono/SMS)
1. **Interfaz:** Diseñar una tarjeta Glassmorphic central flotante sobre un gradiente de fondo radial que evoca los colores marinos de Crucita.
2. **Lógica:** Consumir el endpoint REST `/api/auth/registro` del backend. Solicitar el ingreso del número telefónico (único y obligatorio), validar formato y recibir el token JWT para almacenarlo de forma segura en la sesión del usuario.
3. **Roles:** Al iniciar sesión, dirigir al usuario a la pantalla correspondiente según su rol: `pasajero` o `conductor`.

### B. Geolocalización e Integración de Mapas (Pasajero)
1. **Fondo de Pantalla:** Cargar un mapa interactivo de pantalla completa (Mapbox o alternativa como OpenStreetMap).
2. **WebSockets:** Suscribirse automáticamente a la sala del sector en el que se encuentra el usuario (ej. `sector:${sectorId}`) usando Socket.io.
3. **Tracking:** Renderizar marcadores personalizados (tricimotos) que se muevan suavemente por el mapa a medida que el backend emite eventos de coordenadas `update_location`.
4. **Búsqueda de Destino:** Una caja flotante estilo píldora de cristal en la parte superior que permite buscar el sector de llegada.

### C. Ficha de Viaje y Ciclo de Solicitud (Bottom Sheet)
1. **Diseño:** Un modal deslizante (Bottom Sheet) translúcido con desenfoque de fondo.
2. **Cálculo de Tarifa:** Utilizar el módulo de utilidad local para mostrar la tarifa fija precalculada basada en la geocerca de origen y destino.
3. **Flujo del Viaje:**
   - Botón grande de cristal naranja (`#F59E0B`) para "Solicitar Tricimoto". El viaje se inserta en estado `solicitado`.
   - Mostrar estado de búsqueda ("Buscando Conductor...") con un spinner animado en rotación y pulso continuo.
   - Al ser aceptado por un conductor (estado `aceptado`), actualizar dinámicamente la ficha mostrando la foto, nombre del conductor, número de placa de la tricimoto, y abrir el canal de chat interactivo.

### D. Botón de Pánico (SOS)
- Un botón circular rojo flotante (`#EF4444`) con un efecto visual de pulsación continua (ondas concéntricas transparentes que se expanden hacia afuera).
- Al pulsar y mantener presionado por 2 segundos, emitir una señal HTTP/WebSocket inmediata que registre la emergencia y comparta las coordenadas GPS en tiempo real con el panel de administración.

### E. Consola del Conductor (Modo Conductor)
- **Cabecera de Cristal:** Contiene un Switch táctil grande para alternar el estado entre `disponible` (verde `#10B981`) y `ocupado`/`inactivo`.
- **Modo Background:** Al estar activo, ejecutar el hook de tracking GPS en segundo plano transmitiendo la ubicación a baja frecuencia para optimizar la batería y el consumo de datos (límite: 15MB por jornada).
- **Notificación Flotante de Viaje:** Al recibir un viaje, mostrar un modal de cristal elástico y prioritario con botones grandes para aceptar o rechazar en 15 segundos.

### F. Chat en Tiempo Real
- **Diseño de Burbujas:** Textos legibles sobre fondos translúcidos de burbujas (verdes para enviados, grises para recibidos) flotando sobre la pantalla de mapa activa.
- **Canal Seguro:** Conectarse al socket en la sala `chat:${threadId}` y validar mediante JWT que el ID del usuario pertenece a los miembros habilitados en la carrera.

---

## 6. Reglas de Codificación y Calidad (Clean Code)
1. **Idioma Estricto:** Escribe todo el código técnico, nombres de variables, funciones, bases de datos y configuraciones en **Inglés**. Escribe todos los comentarios explicativos y los textos visuales de cara al usuario en **Español**.
2. **Tratamiento de Excepciones:** Aplica bloques `try/catch` con logs estructurados en todas las promesas y solicitudes de red.
3. **Seguridad Absoluta:** No quemes credenciales. Lee las URLs del backend y claves de API de las variables de entorno usando un archivo `.env` configurado mediante Expo Config (`app.json` / `eas.json`).
4. **Optimización de Renderizado:** Memoriza componentes pesados del mapa usando `React.memo` y callbacks (`useCallback`) para evitar repeticiones innecesarias de renderizado gráfico de marcadores.