// Propiedades que el middleware de autenticación del socket agrega a cada conexión
// (sockets/socketHandler.js). Solo sirven para la revisión de tipos (007, T17); no generan código.
import 'socket.io';

declare module 'socket.io' {
  interface Socket {
    /** Usuario autenticado: id, correo y rol leídos de su perfil. */
    user: { id: string; email?: string; rol: string };
    /** Cliente de Supabase con el JWT del usuario: RLS aplica en cada consulta. */
    supabase: any;
  }
}
