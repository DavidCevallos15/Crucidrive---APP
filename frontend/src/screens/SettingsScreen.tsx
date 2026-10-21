import React, { useCallback, useEffect, useState } from 'react';
import { AppState, Linking, Platform, ScrollView, Share, StyleSheet, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import * as Location from 'expo-location';
import Constants from 'expo-constants';
import { AppMenuButton } from '../components/AppMenuButton';
import { PressableScale } from '../components/PressableScale';
import { GlassButton } from '../components/GlassButton';
import { BrandLockup } from '../components/BrandLockup';
import { COLORS, FONTS, SPACING } from '../constants/theme';
import { CONSENTIMIENTO, CONSENT_VERSION } from '../constants/consentimiento';
import { useAuthStore } from '../store/useAuthStore';
import { notificaciones } from '../servicios/notificaciones';
import { registroAvisos, configurarCanales } from '../servicios/avisos';
import { DeleteAccountPanel } from '../components/DeleteAccountPanel';

export type SettingsPage = 'configuracion' | 'cuenta' | 'privacidad' | 'seguridad' | 'ayuda' | 'acerca';
const titles: Record<SettingsPage, string> = { configuracion: 'Configuración', cuenta: 'Mi cuenta', privacidad: 'Privacidad y mis datos', seguridad: 'Seguridad y emergencias', ayuda: '¿Cómo te ayudamos?', acerca: 'Acerca de CruciDrive' };

export default function SettingsScreen({ page }: { page: SettingsPage }) {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { profile, user } = useAuthStore();
  const [location, setLocation] = useState('Consultando…');
  const [notifications, setNotifications] = useState('Consultando…');
  const [feedback, setFeedback] = useState<string | null>(null);
  const refresh = useCallback(async () => {
    try { const p = await Location.getForegroundPermissionsAsync(); setLocation(p.granted ? 'Permitida' : p.canAskAgain ? 'Sin activar' : 'Desactivada'); }
    catch { setLocation('No disponible'); }
    try { const n = notificaciones(); setNotifications(n ? (await n.getPermissionsAsync()).granted ? 'Permitidas' : 'Sin activar' : Platform.OS === 'web' ? 'En la app móvil' : 'Requiere versión instalada'); }
    catch { setNotifications('No disponibles'); }
  }, []);
  useEffect(() => {
    void refresh();
    const listener = AppState.addEventListener('change', (state) => { if (state === 'active') void refresh(); });
    return () => listener.remove();
  }, [refresh]);
  const openSystem = async () => {
    if (Platform.OS === 'web') { setFeedback('En el navegador, abre los permisos de este sitio desde el icono junto a la dirección. En Android o iOS puedes abrir los ajustes del sistema desde esta pantalla.'); return; }
    try { await Linking.openSettings(); } catch { setFeedback('No se pudieron abrir los ajustes. Busca CruciDrive en los ajustes de tu teléfono.'); }
  };
  const requestLocation = async () => {
    try {
      const status = await Location.getForegroundPermissionsAsync();
      if (status.granted || !status.canAskAgain) await openSystem();
      else { await Location.requestForegroundPermissionsAsync(); await refresh(); }
    } catch { setFeedback('No se pudo solicitar ubicación. Puedes elegir origen y destino por sector.'); }
  };
  const requestNotifications = async () => {
    try {
    if (Platform.OS === 'web' || !notificaciones()) { setFeedback('Los avisos de viajes se habilitan en la versión móvil instalada de CruciDrive.'); return; }
    if (!user) { router.push('/(auth)/login'); return; }
    const status = await notificaciones()!.getPermissionsAsync();
    if (!status.canAskAgain && !status.granted) await openSystem();
    else {
      await configurarCanales();
      if (!status.granted) await notificaciones()!.requestPermissionsAsync();
      await registroAvisos.registrar(user.id);
      await refresh();
    }
    } catch { setFeedback('No se pudieron cambiar los avisos. Revisa los permisos del teléfono e inténtalo de nuevo.'); }
  };
  const go = (next: SettingsPage) => router.push(`/(settings)/${next}` as never);
  const row = (label: string, detail: string, icon: keyof typeof Ionicons.glyphMap, action: () => void) => (
    <PressableScale onPress={action} accessibilityRole="button" accessibilityLabel={`${label}. ${detail}`} style={styles.row}>
      <Ionicons name={icon} size={22} color={COLORS.primaryLight} />
      <View style={styles.flex}><Text style={styles.rowTitle}>{label}</Text><Text style={styles.detail}>{detail}</Text></View>
      <Ionicons name="chevron-forward" size={18} color={COLORS.glassTextMutedDark} />
    </PressableScale>
  );
  const paragraph = (title: string, body: string) => <View key={title} style={styles.section}><Text style={styles.sectionTitle} accessibilityRole="header">{title}</Text><Text style={styles.body}>{body}</Text></View>;
  const shareProfile = async () => {
    const text = JSON.stringify({ nombre: profile?.nombre ?? null, telefono: profile?.telefono ?? null, correo: user?.email ?? null, rol: profile?.rol ?? null }, null, 2);
    try {
      if (Platform.OS === 'web') {
        const url = URL.createObjectURL(new Blob([text], { type: 'application/json' }));
        const link = document.createElement('a'); link.href = url; link.download = 'crucidrive-mi-perfil.json'; link.click(); URL.revokeObjectURL(url);
      } else await Share.share({ message: text, title: 'Mis datos de perfil en CruciDrive' });
    }
    catch { setFeedback('No se pudieron compartir los datos del perfil en este dispositivo.'); }
  };
  return <View style={styles.screen}>
    <View style={[styles.header, { paddingTop: insets.top + SPACING.sm }]}>
      <AppMenuButton edgeSwipe={false} />
      <Text style={styles.headerTitle}>{page === 'configuracion' ? 'Tu CruciDrive' : 'Configuración'}</Text>
      <PressableScale onPress={() => router.canGoBack() ? router.back() : router.replace('/')} accessibilityRole="button" accessibilityLabel="Volver" style={styles.iconButton}><Ionicons name="arrow-back" size={24} color={COLORS.glassTextDark} /></PressableScale>
    </View>
    <ScrollView contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + SPACING.xxl }]} showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
      <Text style={styles.title} accessibilityRole="header">{titles[page]}</Text>
      {page === 'configuracion' && <>
        <Text style={styles.intro}>Tu cuenta, tus permisos y lo que necesitas para moverte por Crucita.</Text>
        <Text style={styles.group}>Cuenta</Text>
        {row('Mi cuenta', user ? profile?.nombre ?? user.email ?? 'Cuenta registrada' : 'Iniciar sesión o crear una cuenta', 'person-circle-outline', () => go('cuenta'))}
        <Text style={styles.group}>Permisos del dispositivo</Text>
        {row('Ubicación', location, 'location-outline', () => void requestLocation())}
        {row('Notificaciones', notifications, 'notifications-outline', () => void requestNotifications())}
        <Text style={styles.explanation}>Estos estados vienen del dispositivo. Puedes cambiarlos desde sus ajustes. No solicitamos cámara ni galería hasta que las necesitas para verificar tu perfil de conductor.</Text>
        <Text style={styles.group}>Información y asistencia</Text>
        {row('Seguridad', 'Cuenta, conductor y emergencias', 'shield-checkmark-outline', () => go('seguridad'))}
        {row('Privacidad y mis datos', 'Uso de datos, consentimiento y cuenta', 'lock-closed-outline', () => go('privacidad'))}
        {row('Ayuda', 'Viajes, encomiendas y solución de problemas', 'help-circle-outline', () => go('ayuda'))}
        {row('Acerca de la app', 'Servicios, tarifas y versión', 'information-circle-outline', () => go('acerca'))}
      </>}
      {page === 'cuenta' && <>
        <Text style={styles.intro}>Administra la cuenta con la que solicitas o realizas tus servicios.</Text>
        {user ? <>
          {paragraph('Tus datos', `Nombre: ${profile?.nombre ?? 'Pendiente de completar'}\nCorreo: ${user.email ?? 'No disponible'}\nTeléfono: ${profile?.telefono ?? 'Pendiente de completar'}\nTipo de cuenta: ${profile?.rol ?? 'Sin perfil'}`)}
          {row('Compartir datos de mi perfil', 'Solo nombre, correo, teléfono y tipo de cuenta', 'share-outline', () => void shareProfile())}
          <DeleteAccountPanel />
        </> : <GlassButton label="Iniciar sesión o crear cuenta" onPress={() => router.push('/(auth)/login')} size="lg" variant="secondary" />}
      </>}
      {page === 'privacidad' && <>
        <Text style={styles.intro}>Aviso de privacidad · Versión {CONSENT_VERSION}. El texto actual está pendiente de revisión legal antes de publicar.</Text>
        {CONSENTIMIENTO.map((s) => paragraph(s.titulo, s.texto))}
        {row('Gestionar mi cuenta', 'Consultar mi perfil y eliminar mi cuenta', 'person-circle-outline', () => go('cuenta'))}
      </>}
      {page === 'seguridad' && <>
        <Text style={styles.intro}>Antes de subir o entregar un paquete, confirma con quién vas a realizar el servicio.</Text>
        {paragraph('Confirma tu conductor', 'Cuando acepta tu solicitud, revisa su nombre y la placa de la tricimoto. Si no coinciden con quien llega, no subas ni entregues la encomienda.')}
        {paragraph('Acuerda la entrega', 'Para una encomienda, acuerda el precio por el chat con el conductor antes de entregar el paquete. Confirma el lugar de recogida y la persona que lo recibe.')}
        {paragraph('Protege tu acceso', 'Nunca compartas tu contraseña ni códigos de acceso. Las solicitudes de permiso se hacen desde el sistema de tu teléfono. Cierra sesión desde el menú cuando termines de usar un dispositivo compartido.')}
        {paragraph('Ante una emergencia', 'El SOS del mapa abre la llamada al 911 después de mantenerlo pulsado. CruciDrive no envía una alerta automática a una central ni sustituye a los servicios de emergencia.')}
        <GlassButton label="Abrir llamada al 911" variant="danger" onPress={() => { void Linking.openURL('tel:911').catch(() => setFeedback('Marca 911 desde el teléfono para solicitar ayuda.')); }} size="lg" />
      </>}
      {page === 'ayuda' && <>
        <Text style={styles.intro}>Respuestas para usar los servicios que CruciDrive ofrece en Crucita.</Text>
        {paragraph('¿Cómo solicito una tricimoto?', 'Elige Tricimoto, indica desde dónde sales y a dónde vas. Revisa el número de pasajeros y el total antes de solicitar. Necesitas una cuenta para confirmar.')}
        {paragraph('¿Cómo envío una encomienda?', 'Elige Encomienda. Indica recogida, destino, contenido y quién recibe. Una vez que un conductor acepte, usa el chat para acordar el precio antes de entregar el paquete.')}
        {paragraph('No hay conductores', 'La app te avisará si nadie acepta. Puedes volver a pedir la solicitud o cambiar el destino. No se garantiza un tiempo de llegada hasta que un conductor acepte.')}
        {paragraph('El mapa no conoce mi ubicación', 'Activa el permiso de ubicación desde Configuración. También puedes elegir el sector de recogida y escribir una referencia sin usar GPS.')}
        {paragraph('Problemas con avisos o conexión', 'Revisa tus datos móviles y los permisos de notificaciones. Si conduces, comprueba la ubicación en segundo plano y el ahorro de batería en los ajustes de tu teléfono.')}
        {paragraph('Cancelar una solicitud', 'Mientras buscas conductor puedes cancelarla desde la ficha del mapa. Si el servicio ya fue aceptado, coordina con el conductor por el chat.')}
        {row('Revisar permisos', 'Ubicación y avisos', 'settings-outline', () => go('configuracion'))}
      </>}
      {page === 'acerca' && <>
        <View style={styles.brand}><BrandLockup /></View>
        {paragraph('Hecho para Crucita', 'CruciDrive conecta pasajeros con conductores de tricimoto y permite solicitar encomiendas dentro de su zona de servicio. No ofrece automóviles, viajes interprovinciales ni transporte de carga pesada.')}
        {paragraph('Precio del servicio', 'Los viajes de pasajeros usan la tarifa configurada por persona y muestran el total antes de solicitar. En las encomiendas, el precio se acuerda directamente con el conductor por el chat antes de entregar el paquete. La app no procesa cobros electrónicos.')}
        {paragraph('Antes de enviar', 'La encomienda debe ser adecuada para transportarse en tricimoto. Consulta al conductor el espacio disponible y las condiciones de entrega antes de entregarla. No envíes objetos peligrosos, prohibidos o que no puedas embalar de forma segura.')}
        {paragraph('Versión', `CruciDrive ${Constants.expoConfig?.version ?? '1.0.0'} · ${Platform.OS === 'web' ? 'Web' : Platform.OS === 'android' ? 'Android' : 'iOS'}\nCrucita, Manabí, Ecuador`)}
      </>}
      {feedback && <View style={styles.feedback} accessibilityRole="alert"><Text style={styles.body}>{feedback}</Text></View>}
    </ScrollView>
  </View>;
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: COLORS.darkBg },
  header: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: SPACING.md, paddingBottom: SPACING.sm, borderBottomWidth: 1, borderBottomColor: COLORS.glassBorderDark },
  iconButton: { width: 48, height: 48, alignItems: 'center', justifyContent: 'center' },
  headerTitle: { flex: 1, fontFamily: 'Outfit-SemiBold', fontSize: FONTS.sizes.base, color: COLORS.glassTextDark, marginLeft: SPACING.sm },
  content: { width: '100%', maxWidth: 680, alignSelf: 'center', padding: SPACING.lg },
  title: { color: COLORS.glassTextDark, fontSize: FONTS.sizes.title, fontFamily: 'Outfit-SemiBold', letterSpacing: -0.6, marginTop: SPACING.md },
  intro: { color: COLORS.glassTextMutedDark, fontFamily: FONTS.body, fontSize: FONTS.sizes.sm, lineHeight: 23, marginTop: SPACING.sm, marginBottom: SPACING.lg },
  group: { fontFamily: 'Outfit-SemiBold', fontSize: FONTS.sizes.lg, color: COLORS.glassTextDark, marginTop: SPACING.lg, marginBottom: SPACING.sm },
  row: { flexDirection: 'row', alignItems: 'center', gap: SPACING.md, paddingVertical: SPACING.md, minHeight: 76, borderBottomWidth: 1, borderBottomColor: COLORS.glassBorderDark },
  flex: { flex: 1 },
  rowTitle: { color: COLORS.glassTextDark, fontFamily: FONTS.body, fontSize: FONTS.sizes.base },
  detail: { color: COLORS.glassTextMutedDark, fontFamily: FONTS.body, fontSize: FONTS.sizes.xs, lineHeight: 19, marginTop: SPACING.xs },
  explanation: { color: COLORS.glassTextMutedDark, fontFamily: FONTS.body, fontSize: FONTS.sizes.xs, lineHeight: 20, marginTop: SPACING.md },
  section: { marginBottom: SPACING.lg, marginTop: SPACING.md },
  sectionTitle: { color: COLORS.glassTextDark, fontFamily: 'Outfit-SemiBold', fontSize: FONTS.sizes.lg, marginBottom: SPACING.sm },
  body: { color: COLORS.glassTextMutedDark, fontFamily: FONTS.body, fontSize: FONTS.sizes.sm, lineHeight: 24 },
  brand: { marginVertical: SPACING.xl },
  feedback: { backgroundColor: COLORS.glassBgDark, padding: SPACING.md, borderRadius: 12, marginTop: SPACING.lg },
});
