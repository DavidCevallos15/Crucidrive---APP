import React, { useCallback, useState } from 'react';
import { ActivityIndicator, RefreshControl, ScrollView, StyleSheet, Switch, Text, View } from 'react-native';
import { useFocusEffect, useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { GlassButton } from '../components/GlassButton';
import { GlassInput } from '../components/GlassInput';
import { PressableScale } from '../components/PressableScale';
import { authFetch } from '../utils/authFetch';
import { API_CONFIG } from '../constants/config';
import { COLORS, FONTS, SHAPES, SPACING } from '../constants/theme';
import {
  ETIQUETA_CANAL,
  formatearMonto,
  ingresoNeto,
  leerMonto,
  nombreMes,
  resumirPorMes,
  type CanalRecarga,
  type FilaResumen,
  type ParametrosCobro,
  type ResumenMes,
} from '../utils/creditos';

type CampoMonto = 'comision_viaje' | 'comision_encomienda' | 'bono_bienvenida' | 'recarga_min' | 'recarga_max';

const CAMPOS: { clave: CampoMonto; label: string }[] = [
  { clave: 'comision_viaje', label: 'Comisión por viaje (USD)' },
  { clave: 'comision_encomienda', label: 'Comisión por encomienda (USD)' },
  { clave: 'bono_bienvenida', label: 'Bono de bienvenida (USD)' },
  { clave: 'recarga_min', label: 'Recarga mínima (USD)' },
  { clave: 'recarga_max', label: 'Recarga máxima (USD)' },
];

const aTexto = (p: ParametrosCobro): Record<CampoMonto, string> => ({
  comision_viaje: Number(p.comision_viaje).toFixed(2),
  comision_encomienda: Number(p.comision_encomienda).toFixed(2),
  bono_bienvenida: Number(p.bono_bienvenida).toFixed(2),
  recarga_min: Number(p.recarga_min).toFixed(2),
  recarga_max: Number(p.recarga_max).toFixed(2),
});

/**
 * Cobro de créditos (020, criterios 6, 9 y 10): interruptor de cobro, montos y resumen mensual.
 * Las recargas de cada conductor se acreditan desde su ficha.
 */
export const AdminCreditsScreen: React.FC = () => {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const [parametros, setParametros] = useState<ParametrosCobro | null>(null);
  const [textos, setTextos] = useState<Record<CampoMonto, string> | null>(null);
  const [resumen, setResumen] = useState<ResumenMes[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [aviso, setAviso] = useState<string | null>(null);
  const [guardando, setGuardando] = useState(false);
  const [refrescando, setRefrescando] = useState(false);

  const cargar = useCallback(async () => {
    setError(null);
    try {
      const [rp, rr] = await Promise.all([
        authFetch(API_CONFIG.endpoints.admin.parametrosCobro),
        authFetch(API_CONFIG.endpoints.admin.resumenCreditos),
      ]);
      const [cp, cr] = await Promise.all([rp.json().catch(() => null), rr.json().catch(() => null)]);
      if (!rp.ok || !rr.ok) {
        setError(cp?.message ?? cr?.message ?? 'No se pudo cargar el cobro.');
        return;
      }
      setParametros(cp.data as ParametrosCobro);
      setTextos(aTexto(cp.data as ParametrosCobro));
      setResumen(resumirPorMes((cr?.data?.filas ?? []) as FilaResumen[]));
    } catch {
      setError('Sin conexión con el servidor. Desliza hacia abajo para reintentar.');
    }
  }, []);

  useFocusEffect(useCallback(() => { void cargar(); }, [cargar]));

  const refrescar = useCallback(async () => {
    setRefrescando(true);
    await cargar();
    setRefrescando(false);
  }, [cargar]);

  const guardar = useCallback(async (cambios: Partial<ParametrosCobro>) => {
    setGuardando(true);
    setError(null);
    setAviso(null);
    try {
      const r = await authFetch(API_CONFIG.endpoints.admin.parametrosCobro, { method: 'PATCH', body: JSON.stringify(cambios) });
      const cuerpo = await r.json().catch(() => null);
      if (!r.ok) {
        setError(cuerpo?.message ?? 'No se pudo guardar.');
        return;
      }
      setParametros(cuerpo.data as ParametrosCobro);
      setTextos(aTexto(cuerpo.data as ParametrosCobro));
      setAviso(cuerpo?.message ?? 'Guardado.');
    } catch {
      setError('Sin conexión con el servidor. No se guardó nada.');
    } finally {
      setGuardando(false);
    }
  }, []);

  const guardarMontos = useCallback(() => {
    if (!textos || !parametros) return;
    const cambios: Partial<ParametrosCobro> = {};
    for (const { clave, label } of CAMPOS) {
      const valor = leerMonto(textos[clave]);
      if (valor === null || valor < 0) {
        setError(`Revisa «${label}»: un monto positivo con 2 decimales como máximo.`);
        return;
      }
      if (valor !== Number(parametros[clave])) cambios[clave] = valor;
    }
    if (Object.keys(cambios).length === 0) {
      setAviso('No hay cambios que guardar.');
      return;
    }
    void guardar(cambios);
  }, [textos, parametros, guardar]);

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={[styles.contenido, { paddingTop: insets.top + SPACING.md, paddingBottom: insets.bottom + SPACING.xl }]}
      keyboardShouldPersistTaps="handled"
      refreshControl={<RefreshControl refreshing={refrescando} onRefresh={refrescar} tintColor={COLORS.primaryLight} />}
    >
      <View style={styles.cabecera}>
        <PressableScale onPress={() => router.back()} accessibilityRole="button" accessibilityLabel="Volver" style={styles.volver}>
          <Ionicons name="arrow-back" size={22} color={COLORS.glassTextDark} />
        </PressableScale>
        <Text style={styles.titulo} accessibilityRole="header">Cobro de créditos</Text>
      </View>

      {error && <Text style={styles.error} accessibilityRole="alert">{error}</Text>}
      {aviso && <Text style={styles.aviso} accessibilityLiveRegion="polite">{aviso}</Text>}

      {!parametros || !textos ? (
        !error && <ActivityIndicator color={COLORS.primary} size="large" />
      ) : (
        <>
          <View style={styles.caja}>
            <View style={styles.interruptor}>
              <View style={styles.interruptorTexto}>
                <Text style={styles.subtitulo}>{parametros.cobro_activo ? 'Cobro activo' : 'Cobro apagado'}</Text>
                <Text style={styles.texto}>
                  {parametros.cobro_activo
                    ? 'Cada servicio aceptado descuenta la comisión. Sin saldo mínimo, el conductor no recibe ofertas.'
                    : 'No se descuenta nada ni se exige saldo. Los bonos sí se registran.'}
                </Text>
              </View>
              <Switch
                value={parametros.cobro_activo}
                onValueChange={(v) => void guardar({ cobro_activo: v })}
                disabled={guardando}
                accessibilityLabel="Cobro de comisiones"
                trackColor={{ true: COLORS.success, false: COLORS.glassBorderDark }}
              />
            </View>
          </View>

          <View style={styles.caja}>
            <Text style={styles.subtitulo}>Montos</Text>
            {CAMPOS.map(({ clave, label }) => (
              <GlassInput
                key={clave}
                label={label}
                keyboardType="decimal-pad"
                value={textos[clave]}
                onChangeText={(v) => { setTextos({ ...textos, [clave]: v }); setAviso(null); }}
                maxLength={7}
              />
            ))}
            <GlassButton label="Guardar montos" onPress={guardarMontos} variant="primary" size="lg" loading={guardando} />
          </View>

          <Text style={styles.subtitulo}>Resumen por mes</Text>
          {resumen.length === 0 && <Text style={styles.texto}>Todavía no hay movimientos este año.</Text>}
          {resumen.map((r) => (
            <View key={r.mes} style={styles.caja}>
              <Text style={styles.mes}>{nombreMes(r.mes)}</Text>
              <Text style={styles.texto}>Recargas: {formatearMonto(r.recargas)}{Object.keys(r.porCanal).length > 0
                ? ` (${(Object.entries(r.porCanal) as [CanalRecarga, number][]).map(([c, v]) => `${ETIQUETA_CANAL[c]} ${formatearMonto(v)}`).join(', ')})`
                : ''}</Text>
              <Text style={styles.texto}>Comisiones cobradas: {formatearMonto(r.comisiones)}</Text>
              <Text style={styles.texto}>Devoluciones: {formatearMonto(r.devoluciones)}</Text>
              <Text style={styles.texto}>Bonos: {formatearMonto(r.bonos)} · Ajustes: {formatearMonto(r.ajustes)}</Text>
              <Text style={styles.neto}>Ingreso neto por comisiones: {formatearMonto(ingresoNeto(r))}</Text>
            </View>
          ))}
        </>
      )}
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.darkBg },
  contenido: { paddingHorizontal: SPACING.md },
  cabecera: { flexDirection: 'row', alignItems: 'center', gap: SPACING.sm, marginBottom: SPACING.md },
  volver: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center' },
  titulo: { fontSize: FONTS.sizes.xl, fontFamily: FONTS.heading, fontWeight: FONTS.weights.bold, color: COLORS.glassTextDark },
  subtitulo: { fontSize: FONTS.sizes.lg, fontFamily: FONTS.heading, fontWeight: FONTS.weights.semibold, color: COLORS.glassTextDark, marginBottom: SPACING.sm },
  texto: { fontSize: FONTS.sizes.sm, fontFamily: FONTS.body, color: COLORS.glassTextDark, marginBottom: SPACING.xs },
  mes: { fontSize: FONTS.sizes.base, fontFamily: FONTS.heading, fontWeight: FONTS.weights.semibold, color: COLORS.glassTextDark, marginBottom: SPACING.xs, textTransform: 'capitalize' },
  neto: { fontSize: FONTS.sizes.base, fontFamily: FONTS.heading, fontWeight: FONTS.weights.bold, color: COLORS.success, marginTop: SPACING.xs },
  caja: {
    padding: SPACING.md,
    marginBottom: SPACING.md,
    borderRadius: SHAPES.borderRadiusMd,
    borderWidth: SHAPES.glassBorderWidth,
    borderColor: COLORS.glassBorderDark,
    backgroundColor: COLORS.glassSurface,
  },
  interruptor: { flexDirection: 'row', alignItems: 'center', gap: SPACING.md },
  interruptorTexto: { flex: 1 },
  error: { color: COLORS.dangerLight, fontSize: FONTS.sizes.sm, fontFamily: FONTS.body, marginBottom: SPACING.md },
  aviso: { color: COLORS.success, fontSize: FONTS.sizes.sm, fontFamily: FONTS.body, marginBottom: SPACING.md },
});

export default AdminCreditsScreen;
