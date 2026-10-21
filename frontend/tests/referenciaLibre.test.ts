import { armarCuerpoSolicitud, nombreDestino, nombreLibreValido, nombreOrigen, referenciaEnSector } from '../src/utils/solicitud';
import { SECTORS } from '../src/constants/sectors';

describe('003 · nombre libre sin catálogo (criterio 20)', () => {
  test.each(['viaje', 'encomienda'] as const)('%s lleva nombres libres de origen y destino al servidor, también dentro del mismo sector', (tipoServicio) => {
    const origen = referenciaEnSector('  Tienda   de la esquina  ', 'malecon')!;
    const destino = referenciaEnSector('Panadería sin catálogo', 'malecon')!;
    const cuerpo = armarCuerpoSolicitud({
      tipoServicio, origen: origen.punto, destino: destino.punto,
      origenNota: origen.nota, destinoNota: destino.nota, pasajeros: 1,
      ...(tipoServicio === 'encomienda' ? { encomienda: { descripcion: 'Caja pequeña', destinatario: 'Persona de prueba', autorizado: true } } : {}),
    });
    expect(cuerpo).toMatchObject({ origenDescripcion: 'Tienda de la esquina', destinoDescripcion: 'Panadería sin catálogo', sectorOrigenId: 'malecon', sectorDestinoId: 'malecon' });
    expect(cuerpo.origen).toEqual(SECTORS.find((s) => s.id === 'malecon')!.center);
    expect(cuerpo).not.toHaveProperty('lugarOrigenId');
    expect(cuerpo).not.toHaveProperty('lugarDestinoId');
    expect(cuerpo).not.toHaveProperty('tarifa');
    expect(nombreOrigen(origen.punto, origen.nota)).toBe('Tienda de la esquina · Malecón de Crucita');
    expect(nombreDestino(destino.punto, destino.nota)).toBe('Panadería sin catálogo · Malecón de Crucita');
  });
  test.each(['', '   ', 'x', 'a'.repeat(201)])('un nombre vacío, demasiado corto o largo no permite continuar: %p', (texto) => {
    expect(nombreLibreValido(texto)).toBe(false);
    expect(referenciaEnSector(texto, 'malecon')).toBeNull();
  });
  test('exige un sector real y conserva tildes y signos del nombre', () => {
    expect(referenciaEnSector('Café & Pan, Nº 2', '')).toBeNull();
    expect(referenciaEnSector('Café & Pan, Nº 2', 'madrid')).toBeNull();
    expect(referenciaEnSector('Café & Pan, Nº 2', 'la_boca')?.nota).toBe('Café & Pan, Nº 2');
    expect(nombreLibreValido('a'.repeat(200))).toBe(true);
  });
});
