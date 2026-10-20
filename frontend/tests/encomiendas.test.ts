import { validateParcel } from '../src/utils/encomienda';
import { armarCuerpoSolicitud } from '../src/utils/solicitud';
import { destinoGuardia } from '../src/utils/routing';
import { ofertaDesdeFila } from '../src/utils/avisoOferta';

describe('encomiendas y configuración', () => {
  it('exige contenido, destinatario y autorización', () => {
    expect(validateParcel({ descripcion: 'Caja', destinatario: 'Ana', autorizado: true })).toBeNull();
    expect(validateParcel({ descripcion: 'Caja', destinatario: 'Ana', autorizado: false })).not.toBeNull();
    expect(validateParcel({ descripcion: '', destinatario: 'Ana', autorizado: true })).not.toBeNull();
  });
  it('el cuerpo no incluye una tarifa inventada ni un número de pasajeros de otro servicio', () => {
    const request = armarCuerpoSolicitud({ tipoServicio: 'encomienda', encomienda: { descripcion: 'Caja', destinatario: 'Ana', autorizado: true }, origen: { tipo: 'gps', coords: { lat: -0.86, lng: -80.53 }, sectorId: 'malecon' }, destino: { tipo: 'lugar', lugar: { id: 'lugar' } as any }, pasajeros: 8, origenNota: '', destinoNota: '' });
    expect(request.tipoServicio).toBe('encomienda'); expect(request.pasajeros).toBe(1); expect(request.tarifa).toBeUndefined();
  });
  it.each(['pasajero', 'conductor', 'admin'] as const)('mantiene la configuración accesible para %s', (rol) => {
    expect(destinoGuardia(['(settings)', 'configuracion'], { isInitialized: true, hasSession: true, profileChecked: true, rol, verificationChecked: true, verificacion: 'pendiente' })).toBeNull();
  });
  it('la privacidad no requiere iniciar sesión', () => {
    expect(destinoGuardia(['(settings)', 'privacidad'], { isInitialized: true, hasSession: false, profileChecked: false, rol: null, verificationChecked: false, verificacion: null })).toBeNull();
  });
  it('una notificación de encomienda no convierte precio a convenir en cero dólares', () => {
    const result = ofertaDesdeFila({ fase: 'secuencial', vence_en: '2026-10-20T12:00:00Z', distancia_m: 10, resultado: 'pendiente', viaje: { id: 'v', estado: 'solicitado', tipo_servicio: 'encomienda', pasajeros: 1, tarifa: null, sector_origen_id: null, sector_destino_id: null, origen_descripcion: null, destino_descripcion: null } }, Date.parse('2026-10-20T11:59:00Z'));
    expect(result?.tipoServicio).toBe('encomienda'); expect(result?.tarifa).toBeNull();
  });
});
