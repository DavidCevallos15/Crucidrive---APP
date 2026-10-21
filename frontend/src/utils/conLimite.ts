/**
 * Espera una promesa como mucho `ms` milisegundos. Si no responde a tiempo, devuelve
 * `respaldo` (la promesa sigue su curso, pero ya nadie la espera). Para tareas de limpieza
 * que no deben dejar la app colgada si la red o un servicio nativo no responden.
 */
export const conLimite = <T, R = T>(promesa: Promise<T>, ms: number, respaldo: R): Promise<T | R> =>
  new Promise((resolve, reject) => {
    const timer = setTimeout(() => resolve(respaldo), ms);
    promesa.then(
      (valor) => { clearTimeout(timer); resolve(valor); },
      (error) => { clearTimeout(timer); reject(error); },
    );
  });
