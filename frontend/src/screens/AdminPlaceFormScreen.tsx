import React, { useMemo, useState } from 'react';
import { Platform, ScrollView, StyleSheet, Switch, Text, View } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import * as Location from 'expo-location';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import MapView, { Marker } from '../components/Map';
import { GlassButton } from '../components/GlassButton';
import { GlassInput } from '../components/GlassInput';
import { PressableScale } from '../components/PressableScale';
import { authFetch } from '../utils/authFetch';
import { API_CONFIG } from '../constants/config';
import { COLORS, FONTS, SHAPES, SPACING } from '../constants/theme';
import { useLugaresAdminStore } from '../store/useLugaresAdminStore';
import {
  CATEGORIAS,
  ID_NUEVO,
  NOMBRE_LUGAR_MAX,
  cambiosLugar,
  formularioDesde,
  validarLugar,
  type ErroresLugar,
  type FormularioLugar,
  type LugarAdmin,
} from '../utils/lugaresAdmin';
import { nombreSector } from '../utils/solicitud';

const CENTRO_CRUCITA = { latitude: -0.842, longitude: -80.531, latitudeDelta: 0.06, longitudeDelta: 0.04 };
const TOCAR_MAPA = Platform.OS !== 'web';

/**
 * Crear o corregir un lugar del catálogo (paso 003, T15, criterio 24). La ubicación se marca
 * tocando el mapa en Android o, en web, con "Usar mi ubicación" o latitud y longitud (plan).
 * La BD fija el sector (centro más cercano) y marca el lugar como editado por el admin, así
 * una nueva importación de OpenStreetMap no lo pisa (criterio 22).
 */
export const AdminPlaceFormScreen: React.FC = () => {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { id } = useLocalSearchParams<{ id: string }>();
  const esNuevo = id === ID_NUEVO;
  const original = useLugaresAdminStore((s) => s.lugares.find((l) => l.id === id) ?? null);
  const guardado = useLugaresAdminStore((s) => s.guardado);

  const [form, setForm] = useState<FormularioLugar>(() => formularioDesde(esNuevo ? null : original));
  const [errores, setErrores] = useState<ErroresLugar>({});
  const [mensaje, setMensaje] = useState<string | null>(null);
  const [guardando, setGuardando] = useState(false);
  const [ubicando, setUbicando] = useState(false);

  const cambiar = (campos: Partial<FormularioLugar>) => {
    setForm((f) => ({ ...f, ...campos }));
    setMensaje(null);
  };

  const punto = useMemo(() => {
    const lat = Number(form.lat.replace(',', '.'));
    const lng = Number(form.lng.replace(',', '.'));
    return form.lat && form.lng && Number.isFinite(lat) && Number.isFinite(lng) ? { latitude: lat, longitude: lng } : null;
  }, [form.lat, form.lng]);

  const fijarPunto = (lat: number, lng: number) => cambiar({ lat: lat.toFixed(6), lng: lng.toFixed(6) });

  const usarMiUbicacion = async () => {
    setUbicando(true);
    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') {
        setErrores((e) => ({ ...e, ubicacion: 'Sin permiso de ubicación. Márcalo en el mapa o escribe latitud y longitud.' }));
        return;
      }
      const pos = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.High });
      fijarPunto(pos.coords.latitude, pos.coords.longitude);
    } catch {
      setErrores((e) => ({ ...e, ubicacion: 'No se pudo obtener tu ubicación.' }));
    } finally {
      setUbicando(false);
    }
  };

  const guardar = async () => {
    const validado = validarLugar(form);
    if (!validado.ok) {
      setErrores(validado.errores);
      return;
    }
    setErrores({});
    const cuerpo = esNuevo || !original ? validado.cuerpo : cambiosLugar(original, validado.cuerpo);
    if (Object.keys(cuerpo).length === 0) {
      setMensaje('No hay cambios que guardar.');
      return;
    }
    setGuardando(true);
    try {
      const r = await authFetch(
        esNuevo ? API_CONFIG.endpoints.admin.places : API_CONFIG.endpoints.admin.place(id),
        { method: esNuevo ? 'POST' : 'PATCH', body: JSON.stringify(cuerpo) }
      );
      const respuesta = await r.json().catch(() => null);
      if (!r.ok) {
        setMensaje(respuesta?.message ?? 'No se pudo guardar el lugar.');
        return;
      }
      guardado(respuesta.data as LugarAdmin);
      router.back();
    } catch {
      setMensaje('Sin conexión con el servidor. Inténtalo de nuevo.');
    } finally {
      setGuardando(false);
    }
  };

  // Al editar, el lugar sale de la lista; si se abrió el enlace directo, no hay de dónde leerlo.
  if (!esNuevo && !original) {
    return (
      <View style={[styles.container, styles.centro, { paddingTop: insets.top }]}>
        <Text style={styles.mensaje}>No se encontró el lugar. Vuelve a la lista.</Text>
        <GlassButton label="Volver" onPress={() => router.back()} variant="ghost" size="md" />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <View style={[styles.cabecera, { paddingTop: insets.top + SPACING.md }]}>
        <PressableScale onPress={() => router.back()} accessibilityRole="button" accessibilityLabel="Volver" style={styles.volver}>
          <Ionicons name="arrow-back" size={22} color={COLORS.glassTextDark} />
        </PressableScale>
        <Text style={styles.titulo} accessibilityRole="header">{esNuevo ? 'Nuevo lugar' : 'Corregir lugar'}</Text>
      </View>

      <ScrollView
        contentContainerStyle={[styles.cuerpo, { paddingBottom: insets.bottom + SPACING.xl }]}
        keyboardShouldPersistTaps="handled"
      >
        {!esNuevo && original && (
          <Text style={styles.origen}>
            Sector actual: {nombreSector(original.sector_id) || 'sin sector'}
            {original.fuente === 'osm' ? ' · Viene de OpenStreetMap' : ''}
          </Text>
        )}

        <GlassInput
          label="Nombre"
          required
          placeholder="Farmacia Santa Martha"
          value={form.nombre}
          onChangeText={(nombre) => cambiar({ nombre })}
          maxLength={NOMBRE_LUGAR_MAX}
          error={errores.nombre}
        />

        <Text style={styles.etiqueta}>Categoría</Text>
        <View style={styles.categorias} accessibilityRole="radiogroup" accessibilityLabel="Categoría">
          {CATEGORIAS.map((c) => {
            const activa = form.categoria === c.value;
            return (
              <PressableScale
                key={c.value}
                onPress={() => cambiar({ categoria: c.value })}
                accessibilityRole="radio"
                accessibilityState={{ checked: activa }}
                style={[styles.chip, activa && styles.chipActivo]}
              >
                <Text style={[styles.chipTexto, activa && styles.chipTextoActivo]}>{c.label}</Text>
              </PressableScale>
            );
          })}
        </View>
        {errores.categoria && <Text style={styles.error} accessibilityRole="alert">{errores.categoria}</Text>}

        <Text style={styles.etiqueta}>Ubicación</Text>
        <Text style={styles.ayuda}>
          {TOCAR_MAPA
            ? 'Toca el mapa donde está el lugar, usa tu ubicación o escribe latitud y longitud.'
            : 'Usa tu ubicación (si estás en el lugar) o escribe latitud y longitud.'}
        </Text>
        <View style={styles.mapa}>
          <MapView
            style={StyleSheet.absoluteFill}
            initialRegion={punto ? { ...CENTRO_CRUCITA, ...punto, latitudeDelta: 0.01, longitudeDelta: 0.008 } : CENTRO_CRUCITA}
            onPress={(e: { nativeEvent: { coordinate: { latitude: number; longitude: number } } }) =>
              fijarPunto(e.nativeEvent.coordinate.latitude, e.nativeEvent.coordinate.longitude)
            }
          >
            {punto && <Marker coordinate={punto} />}
          </MapView>
        </View>
        <GlassButton
          label="Usar mi ubicación"
          onPress={usarMiUbicacion}
          variant="ghost"
          size="md"
          loading={ubicando}
          leftIcon={<Ionicons name="navigate" size={18} color={COLORS.white} />}
          style={styles.botonUbicacion}
        />
        <View style={styles.fila}>
          <GlassInput
            label="Latitud"
            placeholder="-0.871400"
            value={form.lat}
            onChangeText={(lat) => cambiar({ lat })}
            keyboardType="numbers-and-punctuation"
            containerStyle={styles.columna}
          />
          <GlassInput
            label="Longitud"
            placeholder="-80.540100"
            value={form.lng}
            onChangeText={(lng) => cambiar({ lng })}
            keyboardType="numbers-and-punctuation"
            containerStyle={styles.columna}
          />
        </View>
        {errores.ubicacion && <Text style={styles.error} accessibilityRole="alert">{errores.ubicacion}</Text>}

        <View style={styles.visible}>
          <View style={styles.visibleTexto}>
            <Text style={styles.etiqueta}>Visible en la búsqueda</Text>
            <Text style={styles.ayuda}>Apágalo para ocultar un lugar cerrado o repetido. No se borra.</Text>
          </View>
          <Switch
            value={form.visible}
            onValueChange={(visible) => cambiar({ visible })}
            trackColor={{ false: 'rgba(255, 255, 255, 0.1)', true: COLORS.success }}
            thumbColor={COLORS.white}
            accessibilityLabel="Visible en la búsqueda"
          />
        </View>

        {mensaje && <Text style={styles.mensaje} accessibilityRole="alert">{mensaje}</Text>}

        <GlassButton
          label={esNuevo ? 'Crear lugar' : 'Guardar cambios'}
          onPress={guardar}
          variant="secondary"
          size="lg"
          loading={guardando}
          style={styles.guardar}
        />
      </ScrollView>
    </View>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.darkBg },
  centro: { alignItems: 'center', justifyContent: 'center', padding: SPACING.lg, gap: SPACING.md },
  cabecera: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: SPACING.md,
    paddingBottom: SPACING.md,
    borderBottomWidth: 0.5,
    borderBottomColor: COLORS.glassBorderDark,
    gap: SPACING.sm,
  },
  volver: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center' },
  titulo: { fontSize: FONTS.sizes.xl, fontFamily: FONTS.heading, fontWeight: FONTS.weights.bold, color: COLORS.glassTextDark },
  cuerpo: { padding: SPACING.md, width: '100%', maxWidth: 560, alignSelf: 'center' },
  origen: { fontSize: FONTS.sizes.sm, fontFamily: FONTS.body, color: COLORS.glassTextMutedDark, marginBottom: SPACING.md },
  etiqueta: {
    fontSize: FONTS.sizes.sm,
    fontFamily: FONTS.heading,
    fontWeight: FONTS.weights.semibold,
    color: COLORS.glassTextDark,
    marginTop: SPACING.sm,
    marginBottom: SPACING.xs,
  },
  ayuda: { fontSize: FONTS.sizes.sm, fontFamily: FONTS.body, color: COLORS.glassTextMutedDark, marginBottom: SPACING.sm },
  categorias: { flexDirection: 'row', flexWrap: 'wrap', gap: SPACING.sm },
  chip: {
    minHeight: 44,
    paddingHorizontal: SPACING.md,
    justifyContent: 'center',
    borderRadius: SHAPES.borderRadiusFull,
    borderWidth: 1,
    borderColor: COLORS.glassBorderDark,
  },
  chipActivo: { backgroundColor: COLORS.primary, borderColor: COLORS.primary },
  chipTexto: { fontSize: FONTS.sizes.sm, fontFamily: FONTS.body, color: COLORS.glassTextDark },
  chipTextoActivo: { color: COLORS.white, fontWeight: FONTS.weights.semibold },
  mapa: {
    height: 220,
    borderRadius: SHAPES.borderRadiusMd,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: COLORS.glassBorderDark,
  },
  botonUbicacion: { marginTop: SPACING.sm, alignSelf: 'flex-start' },
  fila: { flexDirection: 'row', gap: SPACING.sm, marginTop: SPACING.sm },
  columna: { flex: 1 },
  visible: { flexDirection: 'row', alignItems: 'center', gap: SPACING.md, marginTop: SPACING.md },
  visibleTexto: { flex: 1 },
  error: { color: COLORS.dangerLight, fontSize: FONTS.sizes.sm, fontFamily: FONTS.body, marginTop: SPACING.xs },
  mensaje: { color: COLORS.dangerLight, fontSize: FONTS.sizes.base, fontFamily: FONTS.body, marginTop: SPACING.md },
  guardar: { alignSelf: 'stretch', marginTop: SPACING.lg },
});

export default AdminPlaceFormScreen;
