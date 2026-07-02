import { useEffect, useRef, useCallback } from 'react';
import { io, type Socket } from 'socket.io-client';
import { SOCKET_CONFIG } from '../constants/config';
import { useAuthStore } from '../store/useAuthStore';

/**
 * Tipo para los eventos que el cliente puede emitir.
 */
interface ClientEvents {
  join_sector: (data: { sectorId: string }) => void;
  update_location: (data: {
    sectorId: string;
    coords: { lat: number; lng: number };
    estado: string;
  }) => void;
  join_chat: (data: { threadId: string }) => void;
  send_message: (data: { threadId: string; content: string }) => void;
}

/**
 * Tipo para los eventos que el servidor puede emitir.
 */
interface ServerEvents {
  location_updated: (data: {
    conductorId: string;
    nombre: string;
    coords: { lat: number; lng: number };
    estado: string;
  }) => void;
  message_received: (data: {
    id: string;
    thread_id: string;
    sender_id: string;
    content: string;
    created_at: string;
    perfiles: { nombre: string; rol: string };
  }) => void;
  error_message: (message: string) => void;
}

/**
 * Hook para gestionar la conexión Socket.io con autenticación JWT.
 *
 * - Se conecta automáticamente cuando hay una sesión activa.
 * - Desconecta al perder la sesión.
 * - Reintenta conexión automáticamente según la configuración.
 * - Limpia los listeners al desmontar.
 *
 * @returns Objeto con el socket, estado de conexión y métodos de emisión.
 */
export const useSocket = () => {
  const socketRef = useRef<Socket | null>(null);
  const session = useAuthStore((state) => state.session);

  // ─── Conexión y desconexión automática ─────────────────────
  useEffect(() => {
    const token = session?.access_token;

    if (!token) {
      // Sin sesión activa, desconectar si existe
      if (socketRef.current?.connected) {
        socketRef.current.disconnect();
      }
      return;
    }

    // Crear nueva conexión con autenticación
    const socket = io(SOCKET_CONFIG.url, {
      auth: { token },
      reconnection: SOCKET_CONFIG.reconnection,
      reconnectionAttempts: SOCKET_CONFIG.reconnectionAttempts,
      reconnectionDelay: SOCKET_CONFIG.reconnectionDelay,
      timeout: SOCKET_CONFIG.connectionTimeout,
      transports: ['websocket'],
    });

    socket.on('connect', () => {
      console.log('[Socket.io] Conectado al servidor:', socket.id);
    });

    socket.on('disconnect', (reason) => {
      console.log('[Socket.io] Desconectado:', reason);
    });

    socket.on('connect_error', (error) => {
      console.error('[Socket.io] Error de conexión:', error.message);
    });

    socket.on('error_message', (message: string) => {
      console.warn('[Socket.io] Error del servidor:', message);
    });

    socketRef.current = socket;

    // Limpieza al desmontar o al cambiar de sesión
    return () => {
      socket.removeAllListeners();
      socket.disconnect();
      socketRef.current = null;
    };
  }, [session?.access_token]);

  // ─── Métodos de emisión ────────────────────────────────────

  /**
   * Suscribirse a un sector geográfico para recibir ubicaciones de conductores.
   */
  const joinSector = useCallback((sectorId: string) => {
    socketRef.current?.emit('join_sector', { sectorId });
  }, []);

  /**
   * Enviar actualización de ubicación GPS (solo conductores).
   */
  const updateLocation = useCallback(
    (sectorId: string, coords: { lat: number; lng: number }, estado: string) => {
      socketRef.current?.emit('update_location', { sectorId, coords, estado });
    },
    []
  );

  /**
   * Unirse a la sala de chat de un viaje.
   */
  const joinChat = useCallback((threadId: string) => {
    socketRef.current?.emit('join_chat', { threadId });
  }, []);

  /**
   * Enviar un mensaje de chat.
   */
  const sendMessage = useCallback((threadId: string, content: string) => {
    socketRef.current?.emit('send_message', { threadId, content });
  }, []);

  /**
   * Registrar un listener para un evento del servidor.
   * Retorna una función para desregistrar el listener.
   */
  const onEvent = useCallback(
    <K extends keyof ServerEvents>(event: K, handler: ServerEvents[K]) => {
      socketRef.current?.on(event as string, handler as any);
      return () => {
        socketRef.current?.off(event as string, handler as any);
      };
    },
    []
  );

  return {
    /** Referencia al socket actual */
    socket: socketRef.current,
    /** Indica si el socket está conectado */
    isConnected: socketRef.current?.connected ?? false,

    // Métodos
    joinSector,
    updateLocation,
    joinChat,
    sendMessage,
    onEvent,
  };
};
