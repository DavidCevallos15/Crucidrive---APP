# CruciDrive — Plataforma Hiperlocal de Transporte

CruciDrive es una plataforma móvil hiperlocal diseñada para modernizar la gestión y el monitoreo de seguridad del transporte público en tricimotos dentro de la parroquia turística de Crucita, Manabí (Ecuador). 

El objetivo principal es centralizar el despacho de unidades para sustituir el patrullaje aleatorio ("vuelteo") por una asignación geográfica basada en proximidad, mitigando el consumo innecesario de combustible y mejorando la seguridad ciudadana.

---

## 📌 Resumen del Proyecto

### Problema
1. **Inseguridad Ciudadana:** Falta de un registro auditable de los conductores y rutas en tiempo real, aumentando la vulnerabilidad de pasajeros y transportistas.
2. **Ineficiencia Económica:** Pérdida de ingresos debido al desgaste mecánico excesivo y consumo inútil de combustible por el patrullaje aleatorio ("vuelteo").

### Solución
Una plataforma móvil compuesta por una aplicación para pasajeros y otra para conductores, coordinadas por un servidor backend de alta disponibilidad y bajo costo operativo. La asignación de viajes se realiza bajo demanda por proximidad geográfica.

---

## 🗺️ Plan de Ejecución (Desarrollo)
El desarrollo está estructurado bajo marcos de trabajo ágiles (**Scrum**) en un cronograma cerrado e improrrogable de **6 meses (24 semanas)**, distribuidos en **12 Sprints de 14 días**.

El enfoque inicial prioriza un **Producto Mínimo Viable (MVP)** tipo "Prueba de Concepto Técnica" con adopción directa (*Self-Service*). Los conductores se registran validando su identidad por SMS y aceptando los términos de rastreo GPS.

Para más detalles del plan de desarrollo, consulta el archivo [PLAN.md](file:///c:/Users/David/Documents/Proyectos/PLANIFICACIÓN%20DE%20PROYECTO-%20CRUCIDRIVE/CruciDrive%20-%20APP/PLAN.md).

---

## 🏗️ Arquitectura Tecnológica
El proyecto se implementa utilizando un enfoque de **Monorepo** estructurado en:
- `/backend`: Servidor Express.js en Node.js, comunicación en tiempo real con Socket.io y persistencia mediante Supabase (PostgreSQL + PostGIS).
- `/frontend`: Aplicación móvil multiplataforma desarrollada en React Native (Expo).

### Stack de Tecnologías
*   **Frontend Mobile:** React Native (Expo) para Android e iOS.
*   **Backend API:** Node.js con Express.
*   **Base de Datos:** PostgreSQL con extensión PostGIS en Supabase.
*   **Real-time:** Socket.io (WebSockets) para tracking GPS en vivo.
*   **UI/UX:** Tailwind CSS (NativeWind) con diseño **Glassmorphism** (fondos translúcidos `rgba(255, 255, 255, 0.1)`, desenfoque `backdrop-blur` y animaciones fluidas a 60fps con Reanimated).

Para especificaciones detalladas, consulta [ARQUITECTURA.md](file:///c:/Users/David/Documents/Proyectos/PLANIFICACIÓN%20DE%20PROYECTO-%20CRUCIDRIVE/CruciDrive%20-%20APP/ARQUITECTURA.md).

---

## 📊 Matriz Integral de Viabilidad

| Dimensión | Nivel | Mitigación y Estrategia |
| :--- | :---: | :--- |
| **Técnica** | **ALTA** | Geolocalización estable mediante el uso de bases de datos locales (caché) para mitigar las caídas de red celular en la playa. |
| **Económica** | **ALTA** | Uso de tecnologías Open Source y la capa gratuita de Supabase/Render para costos iniciales de $0. Sostenibilidad posterior con una micro-cuota tecnológica de $5 mensuales por unidad. |
| **Legal** | **ALTA** | Cumplimiento estricto de la LOPDP de Ecuador mediante cifrado de datos sensibles (AES-256) y consentimiento explícito en el registro de usuarios. |
| **Operativa** | **MEDIA** | Riesgo de rechazo por brecha digital y teléfonos de gama baja. Mitigación mediante una interfaz ultra-simplificada con botones gigantes y colores binarios contrastantes (Verde/Rojo). |

---

## 👥 Validación Ciudadana y Participación

La justificación de CruciDrive nace de un clamor explícito declarado por la comunidad local y los transportistas ante la inseguridad. Por ello, no se requiere de encuestas masivas previas para autorizar el desarrollo. Sin embargo, la validación se integra de forma práctica en dos frentes:

1. **Fase Piloto en Territorio (Mes 5):** Despliegue operativo real en campo con 10 tricimotos en la parroquia Crucita para evaluar la usabilidad y aceptación.
2. **Encuestas Automatizadas Post-Viaje:** Medición continua del índice de percepción de seguridad mediante un sistema de calificación de estrellas y comentarios dentro de la app al finalizar cada carrera.

---

## 🚀 Inicio Rápido

### Requisitos Previos
*   [Node.js](https://nodejs.org/) (Versión recomendada LTS)
*   [Git](https://git-scm.com/)

### Clonar el Proyecto
```bash
git clone https://github.com/DavidCevallos15/Crucidrive---APP.git
cd Crucidrive---APP
```

### Ejecutar el Backend (Desarrollo)
1. Navega al directorio del backend:
   ```bash
   cd backend
   ```
2. Instala las dependencias:
   ```bash
   npm install
   ```
3. Crea un archivo `.env` tomando como referencia `.env.example` y añade tus credenciales.
4. Levanta el servidor de desarrollo:
   ```bash
   npm run dev
   ```
