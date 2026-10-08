import { supabase } from './supabaseClient';
import { TAMANO_MAXIMO_BYTES } from './imagen';

export type TipoFoto = 'conductor' | 'cedula' | 'vehiculo';

/**
 * Sube una foto de verificación al bucket privado `verificacion`, en la carpeta del
 * propio usuario (las políticas de Storage no permiten otra ruta). Reemplaza la foto
 * anterior mientras la solicitud no esté aprobada.
 *
 * @throws Error con un mensaje listo para mostrar.
 */
export const subirFoto = async (userId: string, tipo: TipoFoto, uri: string): Promise<void> => {
  const respuesta = await fetch(uri);
  const contenido = await respuesta.arrayBuffer();

  if (contenido.byteLength > TAMANO_MAXIMO_BYTES) {
    throw new Error('Una de las fotos pesa demasiado. Vuelve a tomarla.');
  }

  const { error } = await supabase.storage
    .from('verificacion')
    .upload(`${userId}/${tipo}.jpg`, contenido, { contentType: 'image/jpeg', upsert: true });

  if (error) {
    console.error('[subirFoto] Error de Storage:', error.message);
    throw new Error('No se pudo subir una de las fotos. Revisa tu conexión e inténtalo de nuevo.');
  }
};
