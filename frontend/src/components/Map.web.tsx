import React, { createContext, useContext, useEffect, useRef, useState } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { COLORS } from '../constants/theme';
import { regionToBbox, type MapRegionLike } from '../utils/mapBbox';
import { ESTILO_MAPA } from '../utils/estiloMapa';
import {
  REGION_CRUCITA,
  eventoToque,
  urlScriptGoogleMaps,
  usarGoogleMaps,
  vistaDesdeRegion,
} from '../utils/mapaWeb';
import {
  allowsGoogleMapsByPreferences,
  readWebPreferences,
  subscribeWebPreferences,
} from '../utils/preferenciasWeb';

/**
 * Mapa de la app web (spec 018, Enmienda 1). Con la clave web de Google se ve Google Maps con el
 * mismo estilo que Android, y con los marcadores. Sin clave, o si Google no carga o rechaza la
 * clave, se usa OpenStreetMap como antes (criterio 15). Misma interfaz que react-native-maps en
 * lo que usan las pantallas: initialRegion, region, onPress, showsUserLocation y Marker.
 */
export const PROVIDER_GOOGLE = 'google';
export type Region = MapRegionLike;

const CLAVE = process.env.EXPO_PUBLIC_GOOGLE_MAPS_WEB_KEY;
const CALLBACK = '__crucidriveMapsListo';

type Google = any;
const ventana = () => window as unknown as Record<string, any>;

// ─── Carga única del script de Google ──────────────────────────────────────
let carga: Promise<Google> | null = null;
let claveRechazada = false;
const alRechazar = new Set<() => void>();

const cargarGoogleMaps = (clave: string): Promise<Google> => {
  if (carga) return carga;
  carga = new Promise<Google>((resolve, reject) => {
    const w = ventana();
    if (w.google?.maps?.Map) return resolve(w.google.maps);
    w[CALLBACK] = async () => {
      try {
        // Con loading=async las clases llegan por importLibrary.
        if (w.google.maps.importLibrary) {
          await w.google.maps.importLibrary('maps');
          await w.google.maps.importLibrary('marker');
        }
        resolve(w.google.maps);
      } catch (err) {
        reject(err);
      }
    };
    // Google llama a esta función global si la clave no es válida para este sitio.
    w.gm_authFailure = () => {
      claveRechazada = true;
      alRechazar.forEach((f) => f());
    };
    const script = document.createElement('script');
    script.src = urlScriptGoogleMaps(clave, CALLBACK);
    script.async = true;
    script.onerror = () => reject(new Error('No se pudo cargar Google Maps'));
    document.head.appendChild(script);
  }).catch((err) => {
    carga = null; // sin red: se reintenta la próxima vez que se abra un mapa
    throw err;
  });
  return carga;
};

// ─── Marcadores ────────────────────────────────────────────────────────────
const MapaContexto = createContext<Google | null>(null);

type Coordenada = { latitude: number; longitude: number };
type MarkerProps = { coordinate: Coordenada; title?: string; description?: string; children?: React.ReactNode };

/**
 * Un marcador con contenido propio (la tricimoto) se dibuja como círculo blanco con borde vino;
 * uno sin contenido, como el pin de Google. En el respaldo de OpenStreetMap no se dibujan.
 */
export const Marker = ({ coordinate, title, children }: MarkerProps) => {
  const mapa = useContext(MapaContexto);
  const marcador = useRef<Google | null>(null);
  const conContenido = Boolean(children);

  useEffect(() => {
    if (!mapa) return undefined;
    const g = ventana().google.maps;
    const m = new g.Marker({
      map: mapa,
      icon: conContenido
        ? { path: g.SymbolPath.CIRCLE, scale: 11, fillColor: '#FFFFFF', fillOpacity: 1, strokeColor: COLORS.primary, strokeWeight: 4 }
        : undefined,
    });
    marcador.current = m;
    return () => {
      m.setMap(null);
      marcador.current = null;
    };
  }, [mapa, conContenido]);

  useEffect(() => {
    marcador.current?.setPosition({ lat: coordinate.latitude, lng: coordinate.longitude });
    marcador.current?.setTitle(title ?? null);
  }, [mapa, conContenido, coordinate.latitude, coordinate.longitude, title]);

  return null;
};

// ─── Mapa ──────────────────────────────────────────────────────────────────
type MapViewProps = {
  children?: React.ReactNode;
  style?: any;
  initialRegion?: MapRegionLike;
  region?: MapRegionLike;
  showsUserLocation?: boolean;
  onPress?: (e: ReturnType<typeof eventoToque>) => void;
  [otra: string]: unknown;
};

const MapView = (props: MapViewProps) => {
  const { children, style, initialRegion, region, showsUserLocation, onPress } = props;
  const [mapaAutorizado, setMapaAutorizado] = useState<boolean>(() => allowsGoogleMapsByPreferences(readWebPreferences()));
  const [modo, setModo] = useState<'google' | 'osm'>(
    usarGoogleMaps(CLAVE) && !claveRechazada && allowsGoogleMapsByPreferences(readWebPreferences()) ? 'google' : 'osm',
  );
  const [mapa, setMapa] = useState<Google | null>(null);
  const contenedor = useRef<HTMLDivElement | null>(null);
  const alTocar = useRef(onPress);
  alTocar.current = onPress;

  // Escucha cambios en las preferencias web (spec 019, criterio 11).
  useEffect(() => subscribeWebPreferences((prefs) => {
    const allowed = allowsGoogleMapsByPreferences(prefs);
    setMapaAutorizado(allowed);
    if (!allowed) {
      setMapa(null);
      setModo('osm');
    } else if (usarGoogleMaps(CLAVE) && !claveRechazada) {
      setModo('google');
    }
  }), []);

  // Crear el mapa una vez que Google cargó.
  useEffect(() => {
    if (modo !== 'google' || !CLAVE || !mapaAutorizado) return undefined;
    let vivo = true;
    const volverAOsm = () => { if (vivo) setModo('osm'); };
    alRechazar.add(volverAOsm);
    cargarGoogleMaps(CLAVE)
      .then((g) => {
        if (!vivo || !contenedor.current) return;
        const vista = vistaDesdeRegion(region ?? initialRegion, contenedor.current.clientHeight || undefined);
        const m = new g.Map(contenedor.current, {
          ...vista,
          styles: ESTILO_MAPA,
          disableDefaultUI: true,
          clickableIcons: false,
          gestureHandling: 'greedy',
          keyboardShortcuts: false,
        });
        m.addListener('click', (e: Google) => {
          if (e?.latLng) alTocar.current?.(eventoToque(e.latLng.lat(), e.latLng.lng()));
        });
        setMapa(m);
      })
      .catch(volverAOsm);
    return () => {
      vivo = false;
      alRechazar.delete(volverAOsm);
    };
    // initialRegion solo sirve al crear; region se sigue en el efecto de abajo.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [modo, mapaAutorizado]);

  // region controlada (consola del conductor): mover el mapa cuando cambia.
  useEffect(() => {
    if (!mapa || !region) return;
    const vista = vistaDesdeRegion(region, contenedor.current?.clientHeight || undefined);
    mapa.panTo(vista.center);
    mapa.setZoom(vista.zoom);
  }, [mapa, region?.latitude, region?.longitude, region?.latitudeDelta]); // eslint-disable-line react-hooks/exhaustive-deps

  // Punto azul «Tú» con la ubicación del navegador.
  useEffect(() => {
    if (!mapa || !showsUserLocation || typeof navigator === 'undefined' || !navigator.geolocation) return undefined;
    const g = ventana().google.maps;
    const punto = new g.Marker({
      map: null,
      clickable: false,
      zIndex: 999,
      title: 'Tú',
      icon: { path: g.SymbolPath.CIRCLE, scale: 8, fillColor: '#1A73E8', fillOpacity: 1, strokeColor: '#FFFFFF', strokeWeight: 3 },
    });
    const id = navigator.geolocation.watchPosition(
      (pos) => {
        punto.setPosition({ lat: pos.coords.latitude, lng: pos.coords.longitude });
        if (!punto.getMap()) punto.setMap(mapa);
      },
      () => punto.setMap(null),
      { enableHighAccuracy: true, maximumAge: 10_000 },
    );
    return () => {
      navigator.geolocation.clearWatch(id);
      punto.setMap(null);
    };
  }, [mapa, showsUserLocation]);

  if (modo === 'osm') return <MapaOsm style={style} region={region ?? initialRegion}>{children}</MapaOsm>;

  return (
    <View style={[styles.container, style]}>
      {React.createElement('div', {
        ref: contenedor,
        role: 'region',
        'aria-label': 'Mapa de Crucita',
        style: { width: '100%', height: '100%' },
      })}
      <MapaContexto.Provider value={mapa}>{children}</MapaContexto.Provider>
    </View>
  );
};

/** Respaldo de OpenStreetMap (criterio 15): sin clave, sin Google o con la clave rechazada. */
const MapaOsm = ({ children, style, region }: { children?: React.ReactNode; style?: any; region?: MapRegionLike }) => (
  <View style={[styles.container, style]}>
    {React.createElement('iframe', {
      title: 'Mapa de Crucita',
      src: `https://www.openstreetmap.org/export/embed.html?bbox=${regionToBbox(region ?? REGION_CRUCITA)}&layer=mapnik`,
      style: { border: 0, width: '100%', height: '100%' },
    })}
    <View style={styles.scrim} pointerEvents="none" />
    <Text style={styles.attribution} pointerEvents="none">
      © Colaboradores de OpenStreetMap
    </Text>
    {/* Fuera de Google no hay contexto: los Marker no dibujan nada. */}
    {children}
  </View>
);

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.blueLight,
    overflow: 'hidden',
  },
  scrim: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'transparent',
  },
  // La licencia ODbL exige atribución visible; el aviso del propio mapa queda tapado por las fichas.
  attribution: {
    position: 'absolute',
    left: 16,
    top: 76,
    fontSize: 11,
    color: COLORS.ink,
    backgroundColor: COLORS.surface,
    padding: 4,
    borderRadius: 4,
  },
});

export default MapView;
