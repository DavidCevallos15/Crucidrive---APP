import React, { useRef, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { GlassButton } from './GlassButton';
import { GlassInput } from './GlassInput';
import { useAuthStore } from '../store/useAuthStore';
import { useRideStore } from '../store/useRideStore';
import { authFetch } from '../utils/authFetch';
import { captureAccountScope } from '../utils/accountScope';
import { supabase } from '../utils/supabaseClient';
import { detenerSeguimientoFondo } from '../tareas/ubicacionFondo';
import { registroAvisos } from '../servicios/avisos';
import { COLORS, FONTS, SPACING } from '../constants/theme';

export function DeleteAccountPanel() {
  const [open, setOpen] = useState(false);
  const [password, setPassword] = useState('');
  const [confirmation, setConfirmation] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const lock = useRef(false);
  const router = useRouter();
  const remove = async () => {
    if (lock.current || confirmation !== 'ELIMINAR' || !password) return;
    const account = captureAccountScope(useAuthStore.getState);
    if (!account.isCurrent()) return;
    lock.current = true; setBusy(true); setError(null);
    try {
      const response = await authFetch('/api/auth/cuenta', { method: 'DELETE', body: JSON.stringify({ password, confirmacion: confirmation }) });
      const body = await response.json().catch(() => null);
      if (!account.isCurrent()) return;
      if (!response.ok) { setError(body?.message ?? 'No se pudo eliminar la cuenta. Inténtalo de nuevo.'); return; }
      await Promise.allSettled([detenerSeguimientoFondo(), registroAvisos.olvidar()]);
      if (!account.isCurrent()) return;
      await supabase.auth.signOut({ scope: 'local' });
      const currentUser = useAuthStore.getState().user;
      if (currentUser && currentUser.id !== account.userId) return;
      useRideStore.getState().clearRide();
      useAuthStore.getState().clearSession();
      router.replace('/');
    } catch { setError('No se pudo confirmar la eliminación. Revisa tu conexión e inténtalo de nuevo.'); }
    finally { setPassword(''); setBusy(false); lock.current = false; }
  };
  return <View style={styles.section}>
    <Text style={styles.title} accessibilityRole="header">Eliminar mi cuenta</Text>
    <Text style={styles.body}>Elimina el acceso, tu perfil, fotos de verificación, avisos y mensajes enviados. Los registros de servicios quedan sin el vínculo con tu cuenta. Debes terminar o cancelar cualquier servicio activo antes de continuar. Esta acción es permanente.</Text>
    {!open ? <GlassButton label="Eliminar mi cuenta" variant="ghost" onPress={() => setOpen(true)} /> : <>
      <GlassInput label="Confirma tu contraseña" secureTextEntry value={password} onChangeText={setPassword} autoComplete="current-password" editable={!busy} />
      <GlassInput label="Escribe ELIMINAR para confirmar" value={confirmation} onChangeText={setConfirmation} autoCapitalize="characters" autoCorrect={false} editable={!busy} />
      <GlassButton label="Eliminar cuenta permanentemente" variant="danger" loading={busy} disabled={confirmation !== 'ELIMINAR' || !password} onPress={() => void remove()} />
      <GlassButton label="Conservar mi cuenta" variant="ghost" disabled={busy} onPress={() => { setOpen(false); setPassword(''); setConfirmation(''); setError(null); }} style={styles.cancel} />
    </>}
    {error && <Text style={styles.error} accessibilityRole="alert">{error}</Text>}
  </View>;
}
const styles = StyleSheet.create({
  section: { marginTop: SPACING.xl, paddingTop: SPACING.lg, borderTopWidth: 1, borderTopColor: COLORS.glassBorderDark },
  title: { fontFamily: 'Outfit-SemiBold', fontSize: FONTS.sizes.lg, color: COLORS.glassTextDark, marginBottom: SPACING.sm },
  body: { fontFamily: FONTS.body, fontSize: FONTS.sizes.sm, color: COLORS.glassTextMutedDark, lineHeight: 23, marginBottom: SPACING.lg },
  cancel: { marginTop: SPACING.sm },
  error: { fontFamily: FONTS.body, fontSize: FONTS.sizes.sm, color: COLORS.dangerLight, lineHeight: 22, marginTop: SPACING.md },
});
