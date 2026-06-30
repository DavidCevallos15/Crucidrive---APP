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

## Directriz de UI (Frontend)
Toda la interfaz debe implementar "Glassmorphism". Los contenedores (modales, tarjetas de información, barras de navegación) deben tener fondos semitransparentes (ej. `rgba(255, 255, 255, 0.1)`), desenfoque de fondo (`backdrop-blur`), bordes sutiles y sombras suaves para dar un aspecto premium y moderno. Las transiciones de pantallas y estados de carga deben usar animaciones fluidas.
