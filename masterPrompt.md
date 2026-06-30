1. ARQUITECTURA.md
Markdown
# Arquitectura del Sistema: CRUCIDRIVE APP

## Descripción General
CRUCIDRIVE es una plataforma hiperlocal de movilidad (MVP) diseñada para la parroquia Crucita. El sistema opera bajo un entorno de alta disponibilidad y bajo costo operativo utilizando un modelo Cliente-Servidor con comunicación en tiempo real.

## Stack Tecnológico
- **Frontend (Mobile Multiplataforma):** React Native (Expo) para garantizar compilación nativa simultánea en Android e iOS.
- **Backend (API & Lógica):** Node.js con Express.
- **Base de Datos:** PostgreSQL (con extensión PostGIS para geolocalización) alojado en Supabase.
- **Comunicación en Tiempo Real:** Socket.io (WebSockets) para el tracking GPS de las tricimotos.
- **Estilos y UI:** Tailwind CSS (NativeWind) aplicado bajo el concepto de diseño "Glassmorphism" (translucidez, desenfoques de fondo y bordes de cristal) impulsado por Reanimated para animaciones fluidas a 60fps.

## Patrones de Diseño
- Arquitectura basada en microservicios modulares dentro de un monolito (Modular Monolith) en el backend.
- Patrón MVC (Model-View-Controller) simplificado en Node.js.
- Estado global en el frontend manejado mediante Zustand o Context API.
2. PLAN.md
Markdown
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
3. CASOSDEUSO.md
Markdown
# Casos de Uso Principales

## 1. Actor: Pasajero
- **CU-P01:** Registrarse e iniciar sesión de forma segura.
- **CU-P02:** Visualizar en un mapa interactivo las tricimotos disponibles en un radio cercano.
- **CU-P03:** Solicitar un viaje indicando sector de origen y destino (con visualización de tarifa pre-calculada).
- **CU-P04:** Activar botón de pánico que notifique al panel administrador y comparta ruta de emergencia.

## 2. Actor: Conductor
- **CU-C01:** Iniciar sesión con credenciales previamente verificadas por administración.
- **CU-C02:** Alternar estado operativo (Disponible / Ocupado) mediante un switch de alta accesibilidad visual.
- **CU-C03:** Recibir notificación de solicitud de viaje con interfaz de aceptación rápida (botones grandes).
- **CU-C04:** Transmitir ubicación GPS en tiempo real de forma eficiente (ahorro de batería y datos).

## 3. Actor: Administrador (Panel Web)
- **CU-A01:** Aprobar, suspender o auditar documentación de conductores.
- **CU-A02:** Recibir alertas visuales y sonoras inmediatas cuando se activa un botón de pánico.
- **CU-A03:** Consultar logs inmutables del historial de viajes.
4. ESTRUCTURA.md
Markdown
# Estructura del Monorepo

El proyecto está dividido estrictamente en dos entornos principales en la raíz para mantener la separación de responsabilidades.

```text
crucidrive-app/
├── backend/                  # Entorno Node.js / Express
│   ├── src/
│   │   ├── config/           # Conexión a BD, variables de entorno
│   │   ├── controllers/      # Lógica de negocio
│   │   ├── middlewares/      # Autenticación, manejo de errores, seguridad
│   │   ├── models/           # Esquemas de Prisma ORM / PostgreSQL
│   │   ├── routes/           # Definición de endpoints REST
│   │   ├── sockets/          # Eventos de Socket.io (Tracking en vivo)
│   │   └── index.js          # Entry point del servidor
│   ├── package.json
│   └── .env
│
├── frontend/                 # Entorno React Native (Expo) - UI/UX
│   ├── src/
│   │   ├── assets/           # Imágenes, iconos, fuentes
│   │   ├── components/       # Componentes reutilizables (Botones Glass, Tarjetas)
│   │   ├── constants/        # Paleta de colores, configuraciones, sectores
│   │   ├── hooks/            # Custom hooks (ej. useLocation, useSocket)
│   │   ├── navigation/       # Configuración de Expo Router
│   │   ├── screens/          # Pantallas principales (Map, Login, RideRequest)
│   │   ├── store/            # Estado global (Zustand)
│   │   ├── styles/           # Utilidades para Glassmorphism (Tailwind/Estilos globales)
│   │   └── utils/            # Funciones helper (cálculo de distancias, formateo)
│   ├── app.json
│   ├── package.json
│   └── babel.config.js
│
├── REGISTRO_CAMBIOS.md       # Log de actividad del Agente de IA
├── ARQUITECTURA.md           # Definición técnica
├── PLAN.md                   # Fases del proyecto
├── CASOSDEUSO.md             # Requerimientos funcionales
├── SEGURIDAD.md              # Normativas LOPDP y encriptación
└── SKILLS.md                 # Directrices del agente
Directriz de UI (Frontend): Toda la interfaz debe implementar "Glassmorphism". Los contenedores (modales, tarjetas de información, barras de navegación) deben tener fondos semitransparentes (ej. rgba(255, 255, 255, 0.1)), desenfoque de fondo (backdrop-blur), bordes sutiles y sombras suaves para dar un aspecto premium y moderno. Las transiciones de pantallas y estados de carga deben usar animaciones fluidas.


---

### 5. `SKILLS.md`
```markdown
# Habilidades y Reglas Técnicas del Agente

Como asistente de IA (Cursor/Windsurf), debes acatar estrictamente las siguientes reglas al generar o refactorizar código:

1. **Stack Estricto:** Eres un desarrollador Senior en React Native, Node.js, Express, PostgreSQL, Tailwind CSS y Socket.io. No sugieras ni instales dependencias fuera de este stack sin consultar primero.
2. **Código Limpio (Clean Code):** Escribe funciones modulares, cortas y descriptivas. Aplica DRY (Don't Repeat Yourself) y maneja las excepciones (`try/catch`) en todas las operaciones asíncronas.
3. **Comentarios de Calidad:** Documenta la lógica compleja (cálculos de GPS, webhooks, seguridad) usando JSDoc.
4. **Respeto a la Estructura:** No crees archivos fuera de la arquitectura definida en `ESTRUCTURA.md`. Mantén la lógica de frontend en `/frontend` y la del servidor en `/backend`.
5. **Idioma:** Todo el código (variables, funciones) debe estar en inglés por estándar internacional, pero los comentarios explicativos y los textos de la interfaz de usuario (UI) deben estar en **Español**.
6. REGISTRO_CAMBIOS.md (El Tracker Automático)
Markdown
# Registro de Cambios (Changelog y Logs del Agente)

**INSTRUCCIÓN OBLIGATORIA PARA EL AGENTE DE IA:** 
Cada vez que finalices la creación de un archivo, modifiques una lógica, ejecutes un comando en la terminal o completes un requerimiento del usuario, **DEBES ABRIR ESTE ARCHIVO Y REGISTRAR EL CAMBIO AUTOMÁTICAMENTE** en la parte superior del log antes de dar tu respuesta final por chat.

## Formato Requerido para cada entrada:
- **[Fecha/Hora]:** 
- **Acción Realizada:** (Ej: Creación del controlador de login / Instalación de dependencias de Expo).
- **Archivos Modificados:** (Ej: `/backend/src/routes/auth.js`)
- **Estado:** [Completado / Pendiente de revisión]

---
## HISTORIAL DE LOGS:

- **[Inicio de Proyecto]:** Inicialización de la estructura `.md` base y directrices del sistema.
7. Mi Recomendación: SEGURIDAD.md
Este archivo es crucial. Le indica al agente que está trabajando con datos reales y sensibles (geolocalización de personas en Ecuador) y fuerza estándares de seguridad desde la primera línea de código.

Markdown
# Directrices de Seguridad y Normativa (LOPDP)

Este proyecto maneja datos críticos de usuarios (cédulas, ubicaciones GPS, números telefónicos). El Agente de IA debe aplicar los siguientes escudos de seguridad por defecto:

1. **Cumplimiento LOPDP (Ecuador):**
   - Nunca almacenar contraseñas en texto plano. Obligatorio usar `bcrypt` para hashing antes de guardar en PostgreSQL.
   - Las coordenadas GPS históricas (logs de viajes) no deben ser accesibles públicamente y deben estar vinculadas a un ID anónimo, no al nombre del usuario.

2. **Gestión de Entorno:**
   - Jamás quemar (hardcode) credenciales, claves de API (Supabase, JWT secrets), ni URLs en el código fuente. Obligatorio inyectarlas a través de archivos `.env`.
   - Generar un archivo `.env.example` para documentar qué variables se necesitan.

3. **Seguridad en WebSockets y API:**
   - Todo endpoint de la API (`/backend/src/routes/`) debe estar protegido por un middleware de autenticación (JWT) excepto las rutas públicas (Login/Registro).
   - Las conexiones de Socket.io