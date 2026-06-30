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
```
