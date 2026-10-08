import { Stack } from 'expo-router';
import { COLORS } from '../../../src/constants/theme';

/**
 * Panel del administrador: lista de solicitudes y detalle.
 */
export default function AdminLayout() {
  return (
    <Stack
      screenOptions={{
        headerShown: false,
        contentStyle: { backgroundColor: COLORS.darkBg },
        animation: 'slide_from_right',
        animationDuration: 220,
      }}
    />
  );
}
