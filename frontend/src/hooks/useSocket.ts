import { useEffect, useRef, useCallback, useState } from 'react';
import { io, type Socket } from 'socket.io-client';
import { SOCKET_CONFIG } from '../constants/config';
import { useAuthStore } from '../store/useAuthStore';
import type { EventoViajeAceptado, EventoViajeSinConductor } from '../utils/viaje';

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
  // Paso 003 (plan R12): avisos al pasajero en su sala usuario:{id}.
  viaje_aceptado: (data: EventoViajeAceptado) => void;
  viaje_sin_conductor: (data: EventoViajeSinConductor) => void;
}

type Handler = (...args: any[]) => void;

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
  // Listeners registrados con onEvent: se vuelven a enganchar en cada socket nuevo
  // (cambio de token), para no perder avisos como viaje_aceptado.
  const handlersRef = useRef(new Map<string, Set<Handler>>());
  const [isConnected, setIsConnected] = useState(false);
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
      setIsConnected(true);
    });

    socket.on('disconnect', (reason) => {
      console.log('[Socket.io] Desconectado:', reason);
      setIsConnected(false);
    });

    socket.on('connect_error', (error) => {
      console.error('[Socket.io] Error de conexión:', error.message);
    });

    socket.on('error_message', (message: string) => {
      console.warn('[Socket.io] Error del servidor:', message);
    });

    handlersRef.current.forEach((handlers, event) => {
      handlers.forEach((handler) => socket.on(event, handler));
    });

    socketRef.current = socket;

    // Limpieza al desmontar o al cambiar de sesión
    return () => {
      socket.removeAllListeners();
      socket.disconnect();
      socketRef.current = null;
      setIsConnected(false);
    };
  }, [session?.access_token]);

  // ─── Métodos de emisión ────────────────────────────────────

  /**
   * Suscribirse a un sector geográfico para recibir ubicaciones de conductores.
   */
  const joinSector = useCallback((sectorId: string) => {
    if (!socketRef.current?.connected) {
      console.warn('[Socket.io] No conectado. No se pudo unir al sector:', sectorId);
      return;
    }
    socketRef.current.emit('join_sector', { sectorId });
  }, []);

  /**
   * Enviar actualización de ubicación GPS (solo conductores).
   */
  const updateLocation = useCallback(
    (sectorId: string, coords: { lat: number; lng: number }, estado: string) => {
      if (!socketRef.current?.connected) {
        return;
      }
      socketRef.current.emit('update_location', { sectorId, coords, estado });
    },
    []
  );

  /**
   * Unirse a la sala de chat de un viaje.
   */
  const joinChat = useCallback((threadId: string) => {
    if (!socketRef.current?.connected) {
      console.warn('[Socket.io] No conectado. No se pudo unir al chat:', threadId);
      return;
    }
    socketRef.current.emit('join_chat', { threadId });
  }, []);

  /**
   * Enviar un mensaje de chat.
   */
  const sendMessage = useCallback((threadId: string, content: string) => {
    if (!socketRef.current?.connected) {
      console.warn('[Socket.io] No conectado. No se pudo enviar el mensaje.');
      return;
    }
    socketRef.current.emit('send_message', { threadId, content });
  }, []);

  /**
   * Registrar un listener para un evento del servidor.
   * Retorna una función para desregistrar el listener.
   */
  const onEvent = useCallback(
    <K extends keyof ServerEvents>(event: K, handler: ServerEvents[K]) => {
      const fn = handler as Handler;
      const handlers = handlersRef.current.get(event) ?? new Set<Handler>();
      handlers.add(fn);
      handlersRef.current.set(event, handlers);
      socketRef.current?.on(event as string, fn);
      return () => {
        handlers.delete(fn);
        socketRef.current?.off(event as string, fn);
      };
    },
    []
  );

  return {
    /** Referencia al socket actual */
    socket: socketRef.current,
    /** Indica si el socket está conectado (se actualiza al conectar y desconectar) */
    isConnected,

    // Métodos
    joinSector,
    updateLocation,
    joinChat,
    sendMessage,
    onEvent,
  };
};
