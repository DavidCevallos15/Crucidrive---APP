/**
 * Quién tiene un socket abierto ahora mismo (plan R6). El despachador solo ofrece viajes a
 * conductores conectados: la BD sabe dónde estuvo cada uno, no si sigue con la app abierta.
 * Un mismo usuario puede tener varios sockets (p. ej. al reconectar antes de que caiga el viejo).
 */
class RegistroConexiones {
  constructor() {
    /** @type {Map<string, Set<string>>} */
    this.porUsuario = new Map();
  }

  agregar(userId, socketId) {
    if (!this.porUsuario.has(userId)) this.porUsuario.set(userId, new Set());
    this.porUsuario.get(userId).add(socketId);
  }

  quitar(userId, socketId) {
    const sockets = this.porUsuario.get(userId);
    if (!sockets) return;
    sockets.delete(socketId);
    if (sockets.size === 0) this.porUsuario.delete(userId);
  }

  estaConectado(userId) {
    return this.porUsuario.has(userId);
  }
}

/** Instancia única del proceso (un solo backend; plan, riesgo "un solo proceso"). */
const conexiones = new RegistroConexiones();

module.exports = { RegistroConexiones, conexiones };
