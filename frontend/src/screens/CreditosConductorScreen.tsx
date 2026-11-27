import React, { useCallback, useState } from 'react';
import { ActivityIndicator, FlatList, Linking, RefreshControl, StyleSheet, Text, View } from 'react-native';
import { useFocusEffect } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { GlassButton } from '../components/GlassButton';
import { authFetch } from '../utils/authFetch';
import { API_CONFIG } from '../constants/config';
import { COLORS, FONTS, SHAPES, SPACING } from '../constants/theme';
import {
  COMO_RECARGAR,
  SOPORTE_CORREO,
  detalleMovimiento,
  fechaCorta,
  formatearMonto,
  leerEstadoCreditos,
  necesitaRecarga,
  type EstadoCreditos,
  type Movimiento,
} from '../utils/creditos';

const SIN_CONEXION = 'Sin conexión con el servidor. Desliza hacia abajo para reintentar.';

/**
 * Créditos del conductor (020, criterio 7): saldo, reglas, historial y cómo recargar.
 * Sin enlaces de pago, QR ni datos bancarios: la recarga se coordina con soporte. Sin blur
 * (regla 6): superficies opacas, números grandes y contraste alto para leer al sol.
 */
export const CreditosConductorScreen: React.FC = () => {
  const insets = useSafeAreaInsets();
  const [estado, setEstado] = useState<EstadoCreditos | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [refrescando, setRefrescando] = useState(false);

  const cargar = useCallback(async () => {
    setError(null);
    try {
      const r = await authFetch(API_CONFIG.endpoints.driver.creditos);
      const cuerpo = await r.json().catch(() => null);
      if (!r.ok) {
        setError(cuerpo?.message ?? 'No se pudo cargar tus créditos.');
        return;
      }
      setEstado(leerEstadoCreditos(cuerpo?.data));
    } catch {
      setError(SIN_CONEXION);
    }
  }, []);

  // Al entrar a la pestaña (por ejemplo, después de un viaje) se ve el saldo al día.
  useFocusEffect(useCallback(() => { void cargar(); }, [cargar]));

  const refrescar = useCallback(async () => {
    setRefrescando(true);
    await cargar();
    setRefrescando(false);
  }, [cargar]);

  const escribirASoporte = useCallback(() => {
    const asunto = encodeURIComponent('Recarga de créditos CruciDrive');
    void Linking.openURL(`mailto:${SOPORTE_CORREO}?subject=${asunto}`).catch(() => {
      setError(`No se pudo abrir el correo. Escribe a ${SOPORTE_CORREO}.`);
    });
  }, []);

  const bajo = estado ? necesitaRecarga(estado) : false;

  const cabecera = (
    <View>
      <Text style={styles.titulo} accessibilityRole="header">Mis créditos</Text>

      {error && (
        <View style={styles.errorCaja}>
          <Text style={styles.error} accessibilityRole="alert">{error}</Text>
          <GlassButton label="Reintentar" variant="ghost" size="sm" onPress={() => void refrescar()} loading={refrescando} />
        </View>
      )}

      {estado && (
        <>
          <View
            style={[styles.saldoCaja, bajo && styles.saldoCajaBajo]}
            accessible
            accessibilityLabel={`Saldo disponible: ${formatearMonto(estado.saldo)} dólares`}
          >
            <Text style={styles.saldoEtiqueta}>Saldo disponible</Text>
            <Text style={[styles.saldo, bajo && styles.saldoBajo]}>{formatearMonto(estado.saldo)}</Text>
            {bajo ? (
              <Text style={styles.alerta} accessibilityRole="alert">
                Necesitas al menos {formatearMonto(estado.minimo)} para recibir viajes y encomiendas.
              </Text>
            ) : null}
          </View>

          <View style={styles.reglas}>
            {estado.cobroActivo ? (
              <>
                <Text style={styles.regla}>Al aceptar un viaje se descuentan {formatearMonto(estado.comisionViaje)}.</Text>
                <Text style={styles.regla}>Al aceptar una encomienda se descuentan {formatearMonto(estado.comisionEncomienda)}.</Text>
                <Text style={styles.regla}>Si el pasajero cancela antes de iniciar, se te devuelve la comisión.</Text>
              </>
            ) : (
              <Text style={styles.regla}>Por ahora CruciDrive no cobra comisiones. Tu saldo se guarda para cuando empiece el cobro.</Text>
            )}
          </View>

          <View style={styles.recargar}>
            <Text style={styles.subtitulo}>Cómo recargar</Text>
            <Text style={styles.texto}>{COMO_RECARGAR}</Text>
            <GlassButton
              label="Escribir a soporte"
              onPress={escribirASoporte}
              variant="secondary"
              size="lg"
              leftIcon={<Ionicons name="mail" size={20} color={COLORS.ink} />}
            />
          </View>

          <Text style={styles.subtitulo}>Movimientos</Text>
        </>
      )}
    </View>
  );

  if (!estado && !error) {
    return (
      <View style={[styles.container, styles.centro]}>
        <ActivityIndicator color={COLORS.primary} size="large" />
      </View>
    );
  }

  return (
    <FlatList<Movimiento>
      style={styles.container}
      contentContainerStyle={[styles.contenido, { paddingTop: insets.top + SPACING.md, paddingBottom: insets.bottom + SPACING.xl }]}
      data={estado?.movimientos ?? []}
      keyExtractor={(m) => m.id}
      ListHeaderComponent={cabecera}
      refreshControl={<RefreshControl refreshing={refrescando} onRefresh={refrescar} tintColor={COLORS.primaryLight} />}
      ListEmptyComponent={estado ? <Text style={styles.texto}>Todavía no tienes movimientos.</Text> : null}
      renderItem={({ item }) => {
        const monto = Number(item.monto);
        return (
          <View style={styles.fila} accessible accessibilityLabel={`${detalleMovimiento(item)}, ${formatearMonto(monto, true)}`}>
            <View style={styles.filaTexto}>
              <Text style={styles.filaTitulo} numberOfLines={2}>{detalleMovimiento(item)}</Text>
              <Text style={styles.filaFecha}>{fechaCorta(item.creado_en)}</Text>
            </View>
            <Text style={[styles.filaMonto, monto < 0 ? styles.negativo : styles.positivo]}>{formatearMonto(monto, true)}</Text>
          </View>
        );
      }}
    />
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.darkBg },
  centro: { alignItems: 'center', justifyContent: 'center' },
  contenido: { paddingHorizontal: SPACING.md, flexGrow: 1 },
  titulo: {
    fontSize: FONTS.sizes.xl,
    fontFamily: FONTS.heading,
    fontWeight: FONTS.weights.bold,
    color: COLORS.glassTextDark,
    marginBottom: SPACING.md,
  },
  subtitulo: {
    fontSize: FONTS.sizes.lg,
    fontFamily: FONTS.heading,
    fontWeight: FONTS.weights.semibold,
    color: COLORS.glassTextDark,
    marginTop: SPACING.lg,
    marginBottom: SPACING.sm,
  },
  texto: { fontSize: FONTS.sizes.base, fontFamily: FONTS.body, color: COLORS.glassTextDark, marginBottom: SPACING.md },
  saldoCaja: {
    padding: SPACING.lg,
    borderRadius: SHAPES.borderRadiusMd,
    borderWidth: 2,
    borderColor: COLORS.success,
    backgroundColor: COLORS.glassSurface,
    alignItems: 'center',
  },
  saldoCajaBajo: { borderColor: COLORS.dangerLight },
  saldoEtiqueta: { fontSize: FONTS.sizes.base, fontFamily: FONTS.body, color: COLORS.glassTextMutedDark },
  saldo: { fontSize: 44, fontFamily: FONTS.heading, fontWeight: FONTS.weights.bold, color: COLORS.success, marginTop: SPACING.xs },
  saldoBajo: { color: COLORS.dangerLight },
  alerta: { fontSize: FONTS.sizes.base, fontFamily: FONTS.body, color: COLORS.dangerLight, textAlign: 'center', marginTop: SPACING.sm },
  reglas: { marginTop: SPACING.md, gap: SPACING.xs },
  regla: { fontSize: FONTS.sizes.base, fontFamily: FONTS.body, color: COLORS.glassTextDark },
  recargar: {
    marginTop: SPACING.lg,
    padding: SPACING.md,
    borderRadius: SHAPES.borderRadiusMd,
    borderWidth: SHAPES.glassBorderWidth,
    borderColor: COLORS.glassBorderDark,
    backgroundColor: COLORS.glassSurface,
  },
  errorCaja: { marginBottom: SPACING.md },
  error: { color: COLORS.dangerLight, fontSize: FONTS.sizes.base, fontFamily: FONTS.body, marginBottom: SPACING.sm },
  fila: {
    flexDirection: 'row',
    alignItems: 'center',
    minHeight: 64,
    paddingVertical: SPACING.sm,
    borderBottomWidth: 0.5,
    borderBottomColor: COLORS.glassBorderDark,
    gap: SPACING.sm,
  },
  filaTexto: { flex: 1 },
  filaTitulo: { fontSize: FONTS.sizes.base, fontFamily: FONTS.body, color: COLORS.glassTextDark },
  filaFecha: { fontSize: FONTS.sizes.sm, fontFamily: FONTS.body, color: COLORS.glassTextMutedDark, marginTop: 2 },
  filaMonto: { fontSize: FONTS.sizes.lg, fontFamily: FONTS.heading, fontWeight: FONTS.weights.bold },
  positivo: { color: COLORS.success },
  negativo: { color: COLORS.dangerLight },
});

export default CreditosConductorScreen;
