import React, { useState } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { COLORS, FONTS, SPACING } from '../constants/theme';
import { BrandLockup } from '../components/BrandLockup';
import { GlassButton } from '../components/GlassButton';
import { GlassInput } from '../components/GlassInput';
import { TricimotoIcon } from '../components/TricimotoIcon';
import { CheckboxRow } from '../components/CheckboxRow';
import { CoastalScene } from '../components/CoastalScene';

/** Catálogo solicitado por el propietario. Sus muestras no envían solicitudes de servicio. */
export function DesignSystemScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const [checked, setChecked] = useState(false);
  const [value, setValue] = useState('');
  const [message, setMessage] = useState('Muestras interactivas; no se envían datos.');
  const title = (text: string, detail: string) => <View style={styles.section}><Text style={styles.heading} accessibilityRole="header">{text}</Text><Text style={styles.body}>{detail}</Text></View>;
  return <ScrollView style={styles.screen} contentContainerStyle={[styles.content, { paddingTop: insets.top + 24, paddingBottom: insets.bottom + 48 }]}>
    <View style={styles.top}><BrandLockup compact /><GlassButton label="Ver bienvenida" size="sm" variant="ghost" onPress={() => router.push('/bienvenida')} /></View>
    <Text style={styles.title} accessibilityRole="header">Un solo lenguaje.{ '\n' }Todo CruciDrive.</Text>
    <Text style={styles.intro}>Sistema costero 2.0 · Paleta, componentes y movimiento para pasajeros, conductores y encomiendas.</Text>
    {title('Color con propósito', 'Crema para calidez, vino para actuar y azul para el paisaje. El texto siempre usa una combinación de contraste comprobado.')}
    <View style={styles.swatches}>{([
      ['Silk Mango', COLORS.sand, COLORS.ink], ['Neon Candy', COLORS.wine, COLORS.white], ['Wild Navy', COLORS.blue, COLORS.ink],
      ['Papel', COLORS.paper, COLORS.ink], ['Tinta', COLORS.ink, COLORS.white], ['Azul suave', COLORS.blueLight, COLORS.ink],
    ]).map(([name, color, ink]) => <View key={name} style={[styles.swatch, { backgroundColor: color }]}><Text style={[styles.swatchName, { color: ink }]}>{name}</Text><Text style={[styles.swatchCode, { color: ink }]}>{color}</Text></View>)}</View>
    {title('Acciones que se sienten', 'Toque inmediato, foco visible y carga honesta. Tamaños de 44, 48 y 56 puntos; las etiquetas pueden crecer.')}
    <View style={styles.samples}>
      <GlassButton label="Acción principal" onPress={() => setMessage('Acción de muestra completada.')} />
      <GlassButton label="Acción secundaria" variant="secondary" onPress={() => setMessage('Variante arena seleccionada.')} />
      <GlassButton label="Acción discreta" variant="ghost" onPress={() => setMessage('Variante discreta seleccionada.')} />
      <GlassButton label="Acción irreversible" variant="danger" onPress={() => setMessage('Solo es una muestra visual. No se elimina ningún dato.')} />
      <GlassButton label="Deshabilitado" disabled onPress={() => {}} />
      <GlassButton label="Enviando" loading onPress={() => {}} />
    </View>
    <Text style={styles.feedback} accessibilityLiveRegion="polite">{message}</Text>
    {title('Campos y estados', 'Etiqueta persistente, ayuda específica, error anunciado y consentimiento separado de la acción.')}
    <View style={styles.form}>
      <GlassInput label="Referencia de recogida" value={value} onChangeText={setValue} placeholder="Frente al muelle" helperText="Muestra de un campo editable." />
      <GlassInput label="Destinatario · ejemplo de error" value="" editable={false} error="Escribe quién recibe la encomienda." />
      <CheckboxRow label="Autorización de muestra" checked={checked} onChange={setChecked} />
    </View>
    {title('Iconos de aquí', 'Tricimoto propia para servicios y marcadores. Ionicons en contorno para las acciones; siempre con etiqueta en navegación.')}
    <View style={styles.icons}><View style={styles.iconItem}><TricimotoIcon size={48} /><Text style={styles.caption}>Tricimoto</Text></View>{([
      ['cube-outline', 'Encomienda'], ['map-outline', 'Mapa'], ['chatbubble-outline', 'Chat'], ['person-outline', 'Cuenta'], ['settings-outline', 'Ajustes'], ['shield-checkmark-outline', 'Seguridad'],
    ] as const).map(([icon, label]) => <View key={label} style={styles.iconItem}><Ionicons name={icon} size={28} color={COLORS.wine} /><Text style={styles.caption}>{label}</Text></View>)}</View>
    {title('Tipografía y ritmo', 'Outfit construye la identidad; Inter hace fácil leer y actuar. Espaciado de 4, 8, 16, 24, 32 y 48 puntos.')}
    <Text style={styles.typeTitle}>Cada camino empieza aquí.</Text><Text style={styles.body}>Cuerpo 16 / 24 · Etiqueta 14 / 20 · Ayuda 12 / 18. Los precios usan números tabulares.</Text>
    {title('Modelos de pantalla', 'Bienvenida: escena + saludo + acciones. Mapa: lienzo + ficha inferior. Cuenta y ajustes: encabezado + lista. Formularios: etiquetas + errores + acción. No se inventan personas, valoraciones ni tiempos de llegada.')}
    <View style={styles.scene}><CoastalScene /></View>
    {title('Movimiento con intención', 'Pulsación 100 / 140 ms. Panel 220 / 140 ms. Espuma 2.400 ms una vez, con Omitir. Sin audio, rebotes ni bucles ornamentales. Reducir movimiento elimina el desplazamiento de bienvenida.')}
    <GlassButton label="Ir al mapa" variant="ghost" onPress={() => router.replace('/')} />
  </ScrollView>;
}
const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: COLORS.paper }, content: { width: '100%', maxWidth: 1040, alignSelf: 'center', paddingHorizontal: 24 },
  top: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8, flexWrap: 'wrap' },
  title: { fontFamily: 'Outfit-SemiBold', fontSize: 42, lineHeight: 46, letterSpacing: -1, color: COLORS.ink, marginTop: 48 },
  intro: { fontFamily: FONTS.body, color: COLORS.glassTextMutedDark, fontSize: 16, lineHeight: 26, marginTop: 16, maxWidth: 600 },
  section: { marginTop: 48, marginBottom: 20, maxWidth: 680 }, heading: { fontFamily: 'Outfit-SemiBold', fontSize: 24, color: COLORS.ink, marginBottom: 8 },
  body: { fontFamily: FONTS.body, color: COLORS.glassTextMutedDark, fontSize: 14, lineHeight: 24 },
  swatches: { flexDirection: 'row', flexWrap: 'wrap', gap: 12 }, swatch: { width: 148, minHeight: 132, borderRadius: 16, padding: 16, justifyContent: 'flex-end' },
  swatchName: { fontFamily: 'Outfit-SemiBold', fontSize: 16 }, swatchCode: { fontFamily: FONTS.body, fontSize: 12, marginTop: 4 },
  samples: { flexDirection: 'row', flexWrap: 'wrap', gap: 12 }, feedback: { fontFamily: FONTS.body, fontSize: 13, color: COLORS.wine, marginTop: 16 },
  form: { maxWidth: 480 }, icons: { flexDirection: 'row', flexWrap: 'wrap', gap: 24 }, iconItem: { minWidth: 84, minHeight: 80, alignItems: 'center', justifyContent: 'space-between', padding: 8 },
  caption: { color: COLORS.glassTextMutedDark, fontFamily: FONTS.body, fontSize: 12, marginTop: 12 },
  typeTitle: { color: COLORS.wine, fontFamily: 'Outfit-SemiBold', fontSize: 32, marginBottom: 12 }, scene: { maxWidth: 480 },
});
