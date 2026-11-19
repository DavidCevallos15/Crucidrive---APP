import React, { useMemo } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import Svg, { Circle, G, Polygon, Polyline, Text as SvgText } from 'react-native-svg';
import { SECTORS, type SectorCoordinate } from '../constants/sectors';
import { COLORS, FONTS, SPACING } from '../constants/theme';
import { TEXTO_SIN_INTERNET } from '../utils/conexion';
import {
  contornoMar, crearProyeccion, dentroDeCaja, ladoEtiqueta, lineaSectores, type CajaPlano,
} from '../utils/planoSectores';

interface PlanoSectoresProps {
  ancho: number;
  alto: number;
  origenSectorId?: string | null;
  destinoSectorId?: string | null;
  /** El GPS funciona sin internet: si cae dentro del plano se marca «Tú». */
  gps?: SectorCoordinate | null;
}

const ALTO_LEYENDA = 22;
const SEPARACION_NOMBRE = 12;

/**
 * Plano simple de los sectores de Crucita para cuando no hay internet (017, P3, criterio 2).
 * Se dibuja con los datos guardados en la app: no hace ninguna petición de red.
 */
export const PlanoSectores: React.FC<PlanoSectoresProps> = ({ ancho, alto, origenSectorId, destinoSectorId, gps }) => {
  const altoSvg = Math.max(60, alto - ALTO_LEYENDA);
  const plano = useMemo(() => {
    const caja: CajaPlano = { ancho, alto: altoSvg, margenX: Math.min(140, ancho * 0.38), margenY: 14 };
    const norteASur = [...SECTORS].sort((a, b) => b.center.lat - a.center.lat);
    const proyectar = crearProyeccion(norteASur.map((s) => s.center), caja);
    const puntos = norteASur.map((sector) => ({ sector, p: proyectar(sector.center) }));
    const yo = gps ? proyectar(gps) : null;
    return {
      puntos,
      linea: lineaSectores(puntos.map(({ p }) => p)),
      mar: contornoMar(puntos.map(({ p }) => p), caja),
      yo: yo && dentroDeCaja(yo, caja) ? yo : null,
    };
  }, [ancho, altoSvg, gps?.lat, gps?.lng]);

  const nombres = plano.puntos.map(({ sector }) => sector.name).join(', ');

  return (
    <View
      style={{ width: ancho, height: alto }}
      accessible
      accessibilityLabel={`${TEXTO_SIN_INTERNET.plano} Sectores de norte a sur: ${nombres}.`}
    >
      <Svg width={ancho} height={altoSvg}>
        <Polygon points={plano.mar} fill={COLORS.blueLight} />
        <Polyline points={plano.linea} fill="none" stroke={COLORS.outline} strokeWidth={3} />
        {plano.puntos.map(({ sector, p }, i) => {
          const esOrigen = sector.id === origenSectorId;
          const esDestino = sector.id === destinoSectorId;
          const resaltado = esOrigen || esDestino;
          const derecha = ladoEtiqueta(i) === 'derecha';
          return (
            <G key={sector.id}>
              <Circle
                cx={p.x}
                cy={p.y}
                r={resaltado ? 9 : 6}
                fill={esOrigen ? COLORS.success : esDestino ? COLORS.wine : COLORS.ink}
                stroke={COLORS.surface}
                strokeWidth={2}
              />
              <SvgText
                x={derecha ? p.x + SEPARACION_NOMBRE : p.x - SEPARACION_NOMBRE}
                y={p.y + 4}
                textAnchor={derecha ? 'start' : 'end'}
                fontSize={13}
                fontWeight={resaltado ? '700' : '400'}
                fill={derecha ? COLORS.ink : COLORS.blueInk}
              >
                {sector.name}
              </SvgText>
            </G>
          );
        })}
        {plano.yo && (
          <G>
            <Circle cx={plano.yo.x} cy={plano.yo.y} r={12} fill={COLORS.blue} opacity={0.35} />
            <Circle cx={plano.yo.x} cy={plano.yo.y} r={5} fill={COLORS.blueInk} stroke={COLORS.surface} strokeWidth={2} />
          </G>
        )}
      </Svg>
      <View style={styles.leyenda}>
        {origenSectorId ? <Text style={[styles.leyendaTexto, { color: COLORS.success }]}>● Salida</Text> : null}
        {destinoSectorId ? <Text style={[styles.leyendaTexto, { color: COLORS.wine }]}>● Llegada</Text> : null}
        {plano.yo ? <Text style={[styles.leyendaTexto, { color: COLORS.blueInk }]}>● Tú</Text> : null}
        <Text style={styles.leyendaTexto} numberOfLines={1}>{TEXTO_SIN_INTERNET.planoCorto}</Text>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  leyenda: {
    height: ALTO_LEYENDA,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: SPACING.sm,
    paddingHorizontal: SPACING.md,
  },
  leyendaTexto: {
    fontFamily: FONTS.body,
    fontSize: FONTS.sizes.xs,
    color: COLORS.glassTextMutedDark,
    flexShrink: 1,
  },
});
