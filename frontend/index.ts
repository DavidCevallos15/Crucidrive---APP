// La tarea de ubicación en segundo plano se define en el ámbito global, antes de Expo Router:
// Android puede relanzar la app sin interfaz solo para ejecutarla (paso 004, P10).
import './src/tareas/ubicacionFondo';
import 'expo-router/entry';
