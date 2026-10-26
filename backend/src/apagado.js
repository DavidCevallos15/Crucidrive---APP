/**
 * Cierre ordenado del servidor (008, backend de prueba). Al apagar o reiniciar la VM, systemd
 * manda SIGTERM: se detiene el despacho (barrido y temporizadores de ofertas), se cierran los
 * sockets y se deja de aceptar peticiones. Al volver, `recuperar()` retoma los viajes desde la
 * BD. Si algo no cierra a tiempo, se sale igual para no bloquear el reinicio.
 */

/**
 * @param {{
 *   server: { close: (cb: (err?: Error) => void) => void },
 *   io: { close: () => void },
 *   detenerDespacho: () => void,
 *   limiteMs?: number,
 *   salir?: (codigo: number) => void,
 *   log?: (mensaje: string) => void,
 * }} deps
 * @returns {(senal: string) => void}
 */
const crearApagado = ({
  server,
  io,
  detenerDespacho,
  limiteMs = 10000,
  salir = (codigo) => process.exit(codigo),
  log = (mensaje) => console.log(mensaje),
}) => {
  let apagando = false;
  return (senal) => {
    if (apagando) return;
    apagando = true;
    log(`[CruciDrive] ${senal}: cerrando el servidor…`);
    const limite = setTimeout(() => {
      log('[CruciDrive] El cierre tardó demasiado; se sale igual.');
      salir(1);
    }, limiteMs);
    limite.unref?.();
    try {
      detenerDespacho();
      io.close();
    } catch (err) {
      log(`[CruciDrive] Error al detener el despacho o los sockets: ${err.message}`);
    }
    server.close((err) => {
      clearTimeout(limite);
      salir(err ? 1 : 0);
    });
  };
};

module.exports = { crearApagado };
