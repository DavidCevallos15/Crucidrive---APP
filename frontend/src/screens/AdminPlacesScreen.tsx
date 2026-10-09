import React, { useCallback, useEffect, useRef, useState } from 'react';
import { ActivityIndicator, FlatList, RefreshControl, StyleSheet, Text, View } from 'react-native';
import { useFocusEffect, useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { GlassButton } from '../components/GlassButton';
import { GlassInput } from '../components/GlassInput';
import { PressableScale } from '../components/PressableScale';
import { SegmentedControl } from '../components/SegmentedControl';
import { authFetch } from '../utils/authFetch';
import { API_CONFIG } from '../constants/config';
import { COLORS, FONTS, SHAPES, SPACING } from '../constants/theme';
import { useLugaresAdminStore } from '../store/useLugaresAdminStore';
import { ATRIBUCION_OSM, ICONO_CATEGORIA } from '../utils/lugares';
import { CATEGORIAS, ID_NUEVO, type LugarAdmin } from '../utils/lugaresAdmin';
import { nombreSector } from '../utils/solicitud';

type Filtro = 'todos' | 'visibles' | 'ocultos';

const FILTROS: { value: Filtro; label: string }[] = [
  { value: 'todos', label: 'Todos' },
  { value: 'visibles', label: 'Visibles' },
  { value: 'ocultos', label: 'Ocultos' },
];

const ETIQUETA_FUENTE: Record<LugarAdmin['fuente'], string> = {
  osm: 'OpenStreetMap',
  admin: 'Administrador',
  david: 'David',
};

const etiquetaCategoria = (c: string) => CATEGORIAS.find((x) => x.value === c)?.label ?? c;

/**
 * Catálogo de lugares para el administrador (paso 003, T15, criterio 24): buscar, crear,
 * corregir y ocultar. No hay borrado: un lugar se oculta y deja de salir en la búsqueda.
 */
export const AdminPlacesScreen: React.FC = () => {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const lugares = useLugaresAdminStore((s) => s.lugares);
  const setLugares = useLugaresAdminStore((s) => s.setLugares);

  const [texto, setTexto] = useState('');
  const [filtro, setFiltro] = useState<Filtro>('todos');
  const [cargado, setCargado] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [refrescando, setRefrescando] = useState(false);
  const turno = useRef(0);

  const cargar = useCallback(async (q: string, f: Filtro) => {
    const miTurno = ++turno.current;
    setError(null);
    const params = new URLSearchParams();
    if (q.trim()) params.set('q', q.trim());
    if (f !== 'todos') params.set('visible', f === 'visibles' ? 'true' : 'false');
    const query = params.toString();
    try {
      const r = await authFetch(`${API_CONFIG.endpoints.admin.places}${query ? `?${query}` : ''}`);
      const cuerpo = await r.json().catch(() => null);
      // Si el administrador siguió escribiendo, una respuesta vieja no pisa la nueva.
      if (miTurno !== turno.current) return;
      if (!r.ok) {
        setError(cuerpo?.message ?? 'No se pudo cargar la lista.');
        return;
      }
      setLugares((cuerpo?.data ?? []) as LugarAdmin[]);
    } catch {
      if (miTurno === turno.current) setError('Sin conexión con el servidor. Desliza hacia abajo para reintentar.');
    } finally {
      if (miTurno === turno.current) setCargado(true);
    }
  }, [setLugares]);

  // Espera 300 ms entre teclas antes de consultar.
  useEffect(() => {
    const id = setTimeout(() => void cargar(texto, filtro), 300);
    return () => clearTimeout(id);
  }, [texto, filtro, cargar]);

  // Al volver del formulario, la lista refleja lo guardado (con el filtro que había).
  const actual = useRef({ texto, filtro });
  actual.current = { texto, filtro };
  useFocusEffect(useCallback(() => { void cargar(actual.current.texto, actual.current.filtro); }, [cargar]));

  const refrescar = useCallback(async () => {
    setRefrescando(true);
    await cargar(texto, filtro);
    setRefrescando(false);
  }, [cargar, texto, filtro]);

  return (
    <View style={styles.container}>
      <View style={[styles.cabecera, { paddingTop: insets.top + SPACING.md }]}>
        <PressableScale
          onPress={() => router.back()}
          accessibilityRole="button"
          accessibilityLabel="Volver"
          style={styles.volver}
        >
          <Ionicons name="arrow-back" size={22} color={COLORS.glassTextDark} />
        </PressableScale>
        <View style={styles.cabeceraTexto}>
          <Text style={styles.titulo} accessibilityRole="header">Lugares</Text>
          <Text style={styles.subtitulo}>Lo que el pasajero encuentra al buscar</Text>
        </View>
        <GlassButton
          label="Nuevo"
          onPress={() => router.push(`/(app)/(admin)/lugares/${ID_NUEVO}` as never)}
          variant="secondary"
          size="sm"
          leftIcon={<Ionicons name="add" size={18} color={COLORS.darkBg} />}
        />
      </View>

      <View style={styles.filtros}>
        <GlassInput
          label="Buscar por nombre"
          placeholder="Farmacia, muelle…"
          value={texto}
          onChangeText={setTexto}
          autoCorrect={false}
          maxLength={80}
        />
        <SegmentedControl label="Mostrar" opciones={FILTROS} value={filtro} onChange={setFiltro} />
      </View>

      {!cargado && !error ? (
        <View style={styles.centro}>
          <ActivityIndicator color={COLORS.primary} size="large" />
        </View>
      ) : (
        <FlatList
          data={lugares}
          keyExtractor={(l) => l.id}
          contentContainerStyle={[styles.lista, { paddingBottom: insets.bottom + SPACING.lg }]}
          refreshControl={
            <RefreshControl refreshing={refrescando} onRefresh={refrescar} tintColor={COLORS.primaryLight} />
          }
          ListHeaderComponent={
            error ? (
              <Text style={styles.error} accessibilityRole="alert">{error}</Text>
            ) : null
          }
          ListEmptyComponent={
            error ? null : (
              <View style={styles.vacio}>
                <Ionicons name="search" size={36} color={COLORS.glassTextMutedDark} />
                <Text style={styles.vacioTitulo}>Sin lugares con ese filtro</Text>
                <Text style={styles.vacioTexto}>Si falta un lugar de Crucita, créalo con «Nuevo».</Text>
              </View>
            )
          }
          ListFooterComponent={lugares.length > 0 ? <Text style={styles.atribucion}>{ATRIBUCION_OSM}</Text> : null}
          renderItem={({ item }) => (
            <PressableScale
              onPress={() => router.push(`/(app)/(admin)/lugares/${item.id}` as never)}
              accessibilityRole="button"
              accessibilityLabel={`Editar ${item.nombre}${item.visible ? '' : ', oculto'}`}
              pressedScale={0.98}
              style={[styles.tarjeta, !item.visible && styles.tarjetaOculta]}
            >
              <Ionicons
                name={ICONO_CATEGORIA[item.categoria] as keyof typeof Ionicons.glyphMap}
                size={20}
                color={item.visible ? COLORS.primaryLight : COLORS.glassTextMutedDark}
              />
              <View style={styles.tarjetaTexto}>
                <Text style={styles.nombre} numberOfLines={1}>{item.nombre}</Text>
                <Text style={styles.detalle} numberOfLines={1}>
                  {etiquetaCategoria(item.categoria)} · {nombreSector(item.sector_id) || 'Sin sector'} · {ETIQUETA_FUENTE[item.fuente]}
                </Text>
                <View style={styles.insignias}>
                  {!item.visible && <Text style={[styles.insignia, styles.insigniaOculta]}>Oculto</Text>}
                  {item.editado_por_admin && <Text style={styles.insignia}>Editado</Text>}
                </View>
              </View>
              <Ionicons name="chevron-forward" size={22} color={COLORS.glassTextMutedDark} />
            </PressableScale>
          )}
        />
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.darkBg },
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
  cabeceraTexto: { flex: 1 },
  titulo: {
    fontSize: FONTS.sizes.xl,
    fontFamily: FONTS.heading,
    fontWeight: FONTS.weights.bold,
    color: COLORS.glassTextDark,
  },
  subtitulo: { fontSize: FONTS.sizes.sm, fontFamily: FONTS.body, color: COLORS.glassTextMutedDark, marginTop: 2 },
  filtros: { paddingHorizontal: SPACING.md, paddingTop: SPACING.md },
  centro: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  lista: { padding: SPACING.md, flexGrow: 1 },
  tarjeta: {
    flexDirection: 'row',
    alignItems: 'center',
    minHeight: 72,
    padding: SPACING.md,
    marginBottom: SPACING.sm,
    gap: SPACING.sm,
    borderRadius: SHAPES.borderRadiusMd,
    borderWidth: SHAPES.glassBorderWidth,
    borderColor: COLORS.glassBorderDark,
    backgroundColor: COLORS.glassSurface,
  },
  tarjetaOculta: { opacity: 0.7 },
  tarjetaTexto: { flex: 1 },
  nombre: { fontSize: FONTS.sizes.base, fontFamily: FONTS.heading, fontWeight: FONTS.weights.semibold, color: COLORS.glassTextDark },
  detalle: { fontSize: FONTS.sizes.sm, fontFamily: FONTS.body, color: COLORS.glassTextMutedDark, marginTop: 2 },
  insignias: { flexDirection: 'row', gap: SPACING.xs, marginTop: 4 },
  insignia: {
    fontSize: FONTS.sizes.xs,
    fontFamily: FONTS.body,
    color: COLORS.glassTextDark,
    paddingHorizontal: SPACING.sm,
    paddingVertical: 2,
    borderRadius: SHAPES.borderRadiusFull,
    backgroundColor: COLORS.glassBgDark,
    overflow: 'hidden',
  },
  insigniaOculta: { backgroundColor: COLORS.danger, color: COLORS.white },
  vacio: { alignItems: 'center', paddingTop: SPACING.xl, paddingHorizontal: SPACING.lg },
  vacioTitulo: {
    fontSize: FONTS.sizes.lg,
    fontFamily: FONTS.heading,
    fontWeight: FONTS.weights.semibold,
    color: COLORS.glassTextDark,
    marginTop: SPACING.md,
  },
  vacioTexto: { fontSize: FONTS.sizes.sm, fontFamily: FONTS.body, color: COLORS.glassTextMutedDark, textAlign: 'center', marginTop: SPACING.xs },
  atribucion: { fontSize: FONTS.sizes.xs, fontFamily: FONTS.body, color: COLORS.glassTextMutedDark, textAlign: 'right', marginTop: SPACING.sm },
  error: { color: COLORS.dangerLight, fontSize: FONTS.sizes.sm, fontFamily: FONTS.body, marginBottom: SPACING.md },
});

export default AdminPlacesScreen;
