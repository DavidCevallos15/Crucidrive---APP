// Las tareas de segundo plano se definen en el ámbito global, antes de Expo Router: Android
// puede relanzar la app sin interfaz solo para ejecutarlas (paso 004, P8 y P10).
import './src/tareas/ubicacionFondo';
import './src/tareas/avisosFondo';
import 'expo-router/entry';
