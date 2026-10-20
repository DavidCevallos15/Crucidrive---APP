export interface ParcelDetails { descripcion: string; destinatario: string; autorizado: boolean }
export const validateParcel = (parcel: ParcelDetails): string | null => {
  if (parcel.descripcion.trim().length < 2 || parcel.descripcion.trim().length > 200) return 'Describe el contenido del paquete (2 a 200 caracteres).';
  if (parcel.destinatario.trim().length < 2 || parcel.destinatario.trim().length > 100) return 'Escribe quién recibe la encomienda (2 a 100 caracteres).';
  if (!parcel.autorizado) return 'Confirma que puedes compartir los datos de la persona que recibe.';
  return null;
};
