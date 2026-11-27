import React, { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, ScrollView, StyleSheet, Text, View } from 'react-native';
import { GlassButton } from './GlassButton';
import { GlassInput } from './GlassInput';
import { PressableScale } from './PressableScale';
import { SegmentedControl } from './SegmentedControl';
import { authFetch } from '../utils/authFetch';
import { API_CONFIG } from '../constants/config';
import { COLORS, FONTS, SHAPES, SPACING } from '../constants/theme';
import {
  CANALES,
  CANALES_CON_COMPROBANTE,
  ETIQUETA_CANAL,
  detalleMovimiento,
  fechaCorta,
  formatearMonto,
  validarAcreditacion,
  type CanalRecarga,
  type FormAcreditacion,
  type Movimiento,
  type TipoAcreditacion,
} from '../utils/creditos';

const TIPOS: { value: TipoAcreditacion; label: string }[] = [
  { value: 'recarga', label: 'Recarga' },
  { value: 'ajuste', label: 'Ajuste' },
];

const FORM_VACIO: FormAcreditacion = { tipo: 'recarga', monto: '', canal: 'deuna', comprobante: '', motivo: '' };
const MOVIMIENTOS_VISIBLES = 10;

/**
 * Créditos de un conductor en el panel (020, criterio 6): saldo, historial y el formulario para
 * acreditar una recarga (con comprobante, o motivo si es en efectivo o cortesía) o un ajuste.
 * El servidor rechaza el mismo comprobante dos veces y los ajustes que dejarían saldo negativo.
 */
export const CreditosConductorAdmin: React.FC<{ conductorId: string }> = ({ conductorId }) => {
  const [saldo, setSaldo] = useState<number | null>(null);
  const [movimientos, setMovimientos] = useState<Movimiento[]>([]);
  const [form, setForm] = useState<FormAcreditacion>(FORM_VACIO);
  const [error, setError] = useState<string | null>(null);
  const [aviso, setAviso] = useState<string | null>(null);
  const [enviando, setEnviando] = useState(false);

  const cargar = useCallback(async () => {
    try {
      const r = await authFetch(API_CONFIG.endpoints.admin.creditos(conductorId));
      const cuerpo = await r.json().catch(() => null);
      if (!r.ok) {
        setError(cuerpo?.message ?? 'No se pudo cargar los créditos.');
        return;
      }
      setSaldo(Number(cuerpo?.data?.saldo ?? 0));
      setMovimientos((cuerpo?.data?.movimientos ?? []) as Movimiento[]);
    } catch {
      setError('Sin conexión con el servidor.');
    }
  }, [conductorId]);

  useEffect(() => { void cargar(); }, [cargar]);

  const cambiar = <K extends keyof FormAcreditacion>(clave: K, valor: FormAcreditacion[K]) => {
    setForm((f) => ({ ...f, [clave]: valor }));
    setError(null);
    setAviso(null);
  };

  const acreditar = useCallback(async () => {
    const validacion = validarAcreditacion(form);
    if ('error' in validacion) {
      setError(validacion.error);
      return;
    }
    setEnviando(true);
    setError(null);
    try {
      const r = await authFetch(API_CONFIG.endpoints.admin.creditos(conductorId), {
        method: 'POST',
        body: JSON.stringify(validacion.cuerpo),
      });
      const cuerpo = await r.json().catch(() => null);
      if (!r.ok) {
        setError(cuerpo?.message ?? 'No se pudo acreditar.');
        return;
      }
      setAviso(`${cuerpo?.message ?? 'Listo.'} Saldo nuevo: ${formatearMonto(cuerpo?.data?.saldo)}.`);
      setForm({ ...FORM_VACIO, tipo: form.tipo, canal: form.canal });
      await cargar();
    } catch {
      setError('Sin conexión con el servidor. No se acreditó nada.');
    } finally {
      setEnviando(false);
    }
  }, [form, conductorId, cargar]);

  const conComprobante = form.tipo === 'recarga' && form.canal !== null && CANALES_CON_COMPROBANTE.includes(form.canal);

  return (
    <View style={styles.caja}>
      <Text style={styles.titulo} accessibilityRole="header">Créditos</Text>
      {saldo === null && !error ? (
        <ActivityIndicator color={COLORS.primary} />
      ) : (
        <Text style={styles.saldo}>Saldo: {formatearMonto(saldo ?? 0)}</Text>
      )}

      <SegmentedControl label="Tipo de movimiento" opciones={TIPOS} value={form.tipo} onChange={(t) => cambiar('tipo', t)} />

      {form.tipo === 'recarga' && (
        <>
          <Text style={styles.etiqueta}>Canal del pago</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.canales} keyboardShouldPersistTaps="handled">
            {CANALES.map((c: CanalRecarga) => (
              <PressableScale
                key={c}
                onPress={() => cambiar('canal', c)}
                accessibilityRole="radio"
                accessibilityLabel={ETIQUETA_CANAL[c]}
                accessibilityState={{ checked: form.canal === c }}
                style={[styles.canal, form.canal === c && styles.canalActivo]}
              >
                <Text style={[styles.canalTexto, form.canal === c && styles.canalTextoActivo]}>{ETIQUETA_CANAL[c]}</Text>
              </PressableScale>
            ))}
          </ScrollView>
        </>
      )}

      <GlassInput
        label={form.tipo === 'recarga' ? 'Monto recibido (USD)' : 'Monto del ajuste (USD, negativo para descontar)'}
        placeholder={form.tipo === 'recarga' ? '5,00' : '-0,20'}
        keyboardType="numbers-and-punctuation"
        value={form.monto}
        onChangeText={(v) => cambiar('monto', v)}
        maxLength={8}
        required
      />
      {conComprobante && (
        <GlassInput
          label="Número de comprobante"
          placeholder="Como aparece en el comprobante"
          autoCapitalize="characters"
          autoCorrect={false}
          value={form.comprobante}
          onChangeText={(v) => cambiar('comprobante', v)}
          maxLength={40}
          required
        />
      )}
      <GlassInput
        label={conComprobante ? 'Motivo (opcional)' : 'Motivo'}
        placeholder={form.tipo === 'ajuste' ? 'Ej.: falla técnica del 27 nov' : 'Ej.: pagó en persona'}
        value={form.motivo}
        onChangeText={(v) => cambiar('motivo', v)}
        maxLength={200}
        required={!conComprobante}
      />

      {error && <Text style={styles.error} accessibilityRole="alert">{error}</Text>}
      {aviso && <Text style={styles.aviso} accessibilityLiveRegion="polite">{aviso}</Text>}

      <GlassButton
        label={form.tipo === 'recarga' ? 'Acreditar recarga' : 'Registrar ajuste'}
        onPress={() => void acreditar()}
        variant="primary"
        size="lg"
        loading={enviando}
      />

      {movimientos.length > 0 && <Text style={styles.subtitulo}>Últimos movimientos</Text>}
      {movimientos.slice(0, MOVIMIENTOS_VISIBLES).map((m) => (
        <View key={m.id} style={styles.fila}>
          <View style={styles.filaTexto}>
            <Text style={styles.filaTitulo} numberOfLines={2}>{detalleMovimiento(m)}</Text>
            <Text style={styles.filaFecha}>{fechaCorta(m.creado_en)}</Text>
          </View>
          <Text style={[styles.filaMonto, Number(m.monto) < 0 ? styles.negativo : styles.positivo]}>
            {formatearMonto(m.monto, true)}
          </Text>
        </View>
      ))}
    </View>
  );
};

const styles = StyleSheet.create({
  caja: {
    marginTop: SPACING.lg,
    padding: SPACING.md,
    borderRadius: SHAPES.borderRadiusMd,
    borderWidth: SHAPES.glassBorderWidth,
    borderColor: COLORS.glassBorderDark,
    backgroundColor: COLORS.glassSurface,
  },
  titulo: { fontSize: FONTS.sizes.lg, fontFamily: FONTS.heading, fontWeight: FONTS.weights.bold, color: COLORS.glassTextDark },
  saldo: { fontSize: FONTS.sizes.xl, fontFamily: FONTS.heading, fontWeight: FONTS.weights.bold, color: COLORS.success, marginVertical: SPACING.sm },
  etiqueta: { color: COLORS.ink, fontFamily: FONTS.body, fontSize: FONTS.sizes.sm, marginBottom: SPACING.xs },
  canales: { gap: SPACING.sm, paddingBottom: SPACING.md },
  canal: { minHeight: 48, justifyContent: 'center', paddingHorizontal: SPACING.md, borderRadius: SHAPES.borderRadiusSm, backgroundColor: COLORS.glassBgDark },
  canalActivo: { backgroundColor: COLORS.wineSoft },
  canalTexto: { color: COLORS.glassTextMutedDark, fontFamily: FONTS.body, fontSize: FONTS.sizes.sm },
  canalTextoActivo: { color: COLORS.wine },
  error: { color: COLORS.dangerLight, fontSize: FONTS.sizes.sm, fontFamily: FONTS.body, marginBottom: SPACING.sm },
  aviso: { color: COLORS.success, fontSize: FONTS.sizes.sm, fontFamily: FONTS.body, marginBottom: SPACING.sm },
  subtitulo: { fontSize: FONTS.sizes.base, fontFamily: FONTS.heading, fontWeight: FONTS.weights.semibold, color: COLORS.glassTextDark, marginTop: SPACING.lg },
  fila: { flexDirection: 'row', alignItems: 'center', minHeight: 56, borderBottomWidth: 0.5, borderBottomColor: COLORS.glassBorderDark, gap: SPACING.sm },
  filaTexto: { flex: 1 },
  filaTitulo: { fontSize: FONTS.sizes.sm, fontFamily: FONTS.body, color: COLORS.glassTextDark },
  filaFecha: { fontSize: FONTS.sizes.xs, fontFamily: FONTS.body, color: COLORS.glassTextMutedDark },
  filaMonto: { fontSize: FONTS.sizes.base, fontFamily: FONTS.heading, fontWeight: FONTS.weights.bold },
  positivo: { color: COLORS.success },
  negativo: { color: COLORS.dangerLight },
});
