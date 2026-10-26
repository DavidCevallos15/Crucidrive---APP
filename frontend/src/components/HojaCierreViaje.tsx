import React, { useEffect, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { GlassButton } from './GlassButton';
import { GlassInput } from './GlassInput';
import { HojaDesplazable } from './HojaDesplazable';
import { PressableScale } from './PressableScale';
import { COLORS, FONTS, SHAPES, SPACING } from '../constants/theme';
import type { ActiveRide } from '../store/useRideStore';
import {
  faseDelCierre,
  MAX_COMENTARIO,
  textoConfirmar,
  textoResumenCobro,
  venceLaAutoconfirmacion,
} from '../utils/viajePasajero';

type Resultado = { ok: true } | { ok: false; mensaje: string };

interface Props {
  ride: ActiveRide;
  conectado: boolean;
  onConfirmar: (llego: boolean) => Promise<Resultado>;
  onCalificar: (estrellas: number, comentario: string) => Promise<Resultado>;
  /** «Ahora no» o «Omitir»: cierra la hoja sin responder. */
  onCerrar: () => void;
  /** Se mostró la hoja de calificar (cuenta una de las dos veces que se ofrece). */
  onMostrarCalificacion: (viajeId: string) => void;
  /** Alto disponible: si no cabe, el cuerpo se desplaza y los botones quedan fijos. */
  altoMaximo: number;
  /** Aire inferior de la hoja (la barra de pestañas o el borde seguro). */
  paddingInferior: number;
}

const ALTO_BOTON = 56;
const ALTO_CERRAR = 48;
const ALTO_AVISO = 52;
const ALTO_ERROR = 48;

const SIN_CONEXION = 'Sin conexión: no se puede enviar. Inténtalo cuando vuelva la señal.';

/**
 * Hoja del viaje que el conductor terminó (paso 005, criterios 5, 5a, 15 y 16): resumen,
 * «Llegué» o «No llegué» y, si llegó, las estrellas con comentario opcional. Nada avanza hasta que
 * el servidor responde (criterio 20). Pasados 30 minutos sin responder, la llegada cuenta como
 * confirmada y se pasa directo a calificar.
 */
export const HojaCierreViaje: React.FC<Props> = ({
  ride, conectado, onConfirmar, onCalificar, onCerrar, onMostrarCalificacion, altoMaximo, paddingInferior,
}) => {
  const [ahora, setAhora] = useState(() => Date.now());
  const [enviando, setEnviando] = useState<'si' | 'no' | 'calificar' | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [estrellas, setEstrellas] = useState(0);
  const [comentario, setComentario] = useState('');
  const fase = faseDelCierre(ride, ahora);
  const encomienda = ride.serviceType === 'encomienda';
  const textos = textoConfirmar(encomienda);

  // A los 30 minutos sin responder la hoja pasa sola a calificar.
  const finalizadoEn = ride.cierre?.finalizadoEn ?? null;
  useEffect(() => {
    const vence = finalizadoEn ? venceLaAutoconfirmacion(finalizadoEn) : null;
    if (fase !== 'confirmar' || vence === null) return undefined;
    const id = setTimeout(() => setAhora(Date.now()), Math.max(0, vence - Date.now()) + 50);
    return () => clearTimeout(id);
  }, [fase, finalizadoEn]);

  useEffect(() => {
    if (fase === 'calificar') onMostrarCalificacion(ride.id);
    // Una vez por vez que entra a calificar, no por cada cambio de la función.
  }, [fase, ride.id]);

  if (fase === 'nada') return null;

  const bloqueado = enviando !== null || !conectado;

  const confirmar = async (llego: boolean) => {
    setError(null);
    setEnviando(llego ? 'si' : 'no');
    const r = await onConfirmar(llego);
    setEnviando(null);
    if (!r.ok) setError(r.mensaje);
  };

  const calificar = async () => {
    if (estrellas < 1) {
      setError('Elige de 1 a 5 estrellas.');
      return;
    }
    setError(null);
    setEnviando('calificar');
    const r = await onCalificar(estrellas, comentario);
    setEnviando(null);
    if (!r.ok) setError(r.mensaje);
  };

  // Lo fijo: los botones, el aviso sin conexión, el error y el aire de abajo.
  const fijo = (fase === 'confirmar' ? ALTO_BOTON + ALTO_CERRAR : ALTO_BOTON) + SPACING.sm
    + (conectado ? 0 : ALTO_AVISO) + (error ? ALTO_ERROR : 0) + paddingInferior;

  return (
    <View>
      <HojaDesplazable
        maxHeight={Math.max(120, altoMaximo - fijo)}
        contentContainerStyle={styles.cuerpo}
        keyboardShouldPersistTaps="handled"
      >
        {fase === 'confirmar' ? (
          <>
            <View style={styles.encabezado}>
              <Ionicons name="checkmark-circle" size={28} color={COLORS.success} />
              <Text style={styles.titulo} accessibilityRole="header" accessibilityLiveRegion="polite">{textos.titulo}</Text>
            </View>
            <Text style={styles.cobro}>{textoResumenCobro(ride)}</Text>
            <Text style={styles.pregunta}>{textos.pregunta}</Text>
          </>
        ) : (
          <>
            <View style={styles.encabezado}>
              <Ionicons name="star" size={24} color={COLORS.primary} />
              <Text style={styles.titulo} accessibilityRole="header">¿Cómo te fue con {ride.driver?.nombre ?? 'tu conductor'}?</Text>
            </View>
            <View style={styles.estrellas} accessibilityRole="radiogroup">
              {[1, 2, 3, 4, 5].map((n) => (
                <PressableScale
                  key={n}
                  onPress={() => setEstrellas(n)}
                  accessibilityRole="radio"
                  accessibilityLabel={`${n} ${n === 1 ? 'estrella' : 'estrellas'}`}
                  accessibilityState={{ selected: estrellas === n }}
                  style={styles.estrella}
                >
                  <Ionicons name={n <= estrellas ? 'star' : 'star-outline'} size={36} color={COLORS.primary} />
                </PressableScale>
              ))}
            </View>
            <GlassInput
              label="Comentario (opcional)"
              value={comentario}
              onChangeText={setComentario}
              maxLength={MAX_COMENTARIO}
              multiline
              helperText={`Sin enlaces ni teléfonos. ${comentario.length}/${MAX_COMENTARIO}`}
            />
          </>
        )}
      </HojaDesplazable>

      {!conectado && (
        <View style={styles.sinConexion} accessibilityRole="alert">
          <Ionicons name="cloud-offline" size={18} color={COLORS.danger} />
          <Text style={styles.sinConexionTexto}>{SIN_CONEXION}</Text>
        </View>
      )}
      {error && <Text style={styles.error} accessibilityRole="alert" accessibilityLiveRegion="polite">{error}</Text>}

      <View style={[styles.pie, { paddingBottom: paddingInferior }]}>
        {fase === 'confirmar' ? (
          <>
            <View style={styles.filaBotones}>
              <GlassButton
                label={textos.si}
                onPress={() => void confirmar(true)}
                variant="primary"
                size="lg"
                loading={enviando === 'si'}
                disabled={bloqueado}
                style={styles.botonMitad}
              />
              <GlassButton
                label={textos.no}
                onPress={() => void confirmar(false)}
                variant="secondary"
                size="lg"
                loading={enviando === 'no'}
                disabled={bloqueado}
                style={styles.botonMitad}
              />
            </View>
            <GlassButton label="Ahora no" onPress={onCerrar} variant="ghost" size="sm" disabled={enviando !== null} style={styles.cerrar} />
          </>
        ) : (
          <View style={styles.filaBotones}>
            <GlassButton label="Omitir" onPress={onCerrar} variant="ghost" size="lg" disabled={enviando !== null} style={styles.botonOmitir} />
            <GlassButton
              label="Enviar"
              onPress={() => void calificar()}
              variant="primary"
              size="lg"
              loading={enviando === 'calificar'}
              disabled={bloqueado}
              style={styles.botonEnviar}
            />
          </View>
        )}
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  cuerpo: { paddingHorizontal: SPACING.md, paddingTop: SPACING.md, paddingBottom: SPACING.xs },
  encabezado: { flexDirection: 'row', alignItems: 'center', gap: SPACING.sm, marginBottom: SPACING.xs },
  titulo: { flex: 1, fontSize: FONTS.sizes.xl, fontFamily: FONTS.heading, fontWeight: FONTS.weights.bold, color: COLORS.glassTextDark },
  cobro: { fontSize: FONTS.sizes.lg, fontFamily: FONTS.heading, fontWeight: FONTS.weights.bold, color: COLORS.primary, marginBottom: SPACING.sm },
  pregunta: { fontSize: FONTS.sizes.lg, fontFamily: FONTS.body, color: COLORS.glassTextDark, marginBottom: SPACING.xs },
  estrellas: { flexDirection: 'row', justifyContent: 'center', marginBottom: SPACING.sm },
  estrella: { minWidth: 48, minHeight: 48, alignItems: 'center', justifyContent: 'center' },
  pie: { paddingHorizontal: SPACING.md, paddingTop: SPACING.sm },
  filaBotones: { flexDirection: 'row', gap: SPACING.sm },
  botonMitad: { flex: 1, minHeight: ALTO_BOTON },
  botonOmitir: { flex: 1, minHeight: ALTO_BOTON },
  botonEnviar: { flex: 2, minHeight: ALTO_BOTON },
  cerrar: { alignSelf: 'center', minHeight: ALTO_CERRAR, marginTop: SPACING.xs },
  sinConexion: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.sm,
    marginHorizontal: SPACING.md,
    marginTop: SPACING.xs,
    padding: SPACING.sm,
    borderRadius: SHAPES.borderRadiusMd,
    backgroundColor: COLORS.wineSoft,
  },
  sinConexionTexto: { flex: 1, fontSize: FONTS.sizes.sm, fontFamily: FONTS.body, color: COLORS.glassTextDark },
  error: {
    marginHorizontal: SPACING.md,
    marginTop: SPACING.xs,
    fontSize: FONTS.sizes.base,
    fontFamily: FONTS.body,
    fontWeight: FONTS.weights.semibold,
    color: COLORS.danger,
  },
});

export default HojaCierreViaje;
