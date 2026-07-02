import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  StyleSheet,
  View,
  Text,
  FlatList,
  KeyboardAvoidingView,
  Platform,
  type ListRenderItem,
} from 'react-native';
import Animated, { FadeInDown, FadeInUp } from 'react-native-reanimated';
import { Ionicons } from '@expo/vector-icons';
import { StatusBar } from 'expo-status-bar';
import { BlurContainer } from '../../components/BlurContainer';
import { GlassInput } from '../../components/GlassInput';
import { GlassCard } from '../../components/GlassCard';
import { useSocket } from '../../hooks/useSocket';
import { useAuthStore } from '../../store/useAuthStore';
import { useRideStore } from '../../store/useRideStore';
import { API_CONFIG } from '../../constants/config';
import { COLORS, FONTS, SPACING, SHAPES } from '../../constants/theme';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import {
  useSharedValue,
  useAnimatedStyle,
  withSpring,
} from 'react-native-reanimated';
import { ANIMATION } from '../../constants/theme';

/**
 * Estructura de un mensaje de chat.
 */
interface ChatMessage {
  id: string;
  thread_id: string;
  sender_id: string;
  content: string;
  created_at: string;
  perfiles?: {
    nombre: string;
    rol: string;
  };
}

/**
 * Pantalla de Chat en Tiempo Real.
 *
 * Funcionalidades:
 * - Burbujas translúcidas diferenciadas (enviados: verde-cian, recibidos: gris)
 * - Barra de entrada de cristal fija en la base
 * - Conexión a sala de chat vía Socket.io
 * - Scroll automático al último mensaje
 *
 * Diseño: DESIGN.md §3.D — Chat de Viaje
 */
export const ChatScreen: React.FC = () => {
  const { user } = useAuthStore();
  const activeRide = useRideStore((s) => s.activeRide);
  const { joinChat, sendMessage, onEvent } = useSocket();

  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [inputText, setInputText] = useState('');
  const [isLoadingHistory, setIsLoadingHistory] = useState(true);
  const flatListRef = useRef<FlatList>(null);
  const session = useAuthStore((s) => s.session);

  const threadId = activeRide?.chatThreadId;

  // ─── Cargar historial de mensajes ──────────────────────────
  useEffect(() => {
    if (!threadId) return;

    const loadHistory = async () => {
      try {
        setIsLoadingHistory(true);
        const response = await fetch(
          `${API_CONFIG.baseUrl}${API_CONFIG.endpoints.chat.messages(threadId)}`,
          {
            headers: {
              Authorization: `Bearer ${session?.access_token}`,
            },
          }
        );

        if (response.ok) {
          const data = await response.json();
          setMessages(data.messages ?? []);
        }
      } catch (error) {
        console.error('[Chat] Error al cargar historial:', error);
      } finally {
        setIsLoadingHistory(false);
      }
    };

    loadHistory();
  }, [threadId, session]);

  // ─── Unirse a la sala de chat ──────────────────────────────
  useEffect(() => {
    if (!threadId) return;
    joinChat(threadId);
  }, [threadId, joinChat]);

  // ─── Escuchar mensajes nuevos ──────────────────────────────
  useEffect(() => {
    const unsubscribe = onEvent('message_received', (data) => {
      const newMessage: ChatMessage = {
        id: data.id,
        thread_id: data.thread_id,
        sender_id: data.sender_id,
        content: data.content,
        created_at: data.created_at,
        perfiles: data.perfiles,
      };

      setMessages((prev) => [...prev, newMessage]);
    });

    return unsubscribe;
  }, [onEvent]);

  // ─── Auto-scroll al último mensaje ────────────────────────
  useEffect(() => {
    if (messages.length > 0) {
      setTimeout(() => {
        flatListRef.current?.scrollToEnd({ animated: true });
      }, 100);
    }
  }, [messages.length]);

  // ─── Enviar mensaje ───────────────────────────────────────
  const handleSend = useCallback(() => {
    if (!inputText.trim() || !threadId) return;

    sendMessage(threadId, inputText.trim());
    setInputText('');
  }, [inputText, threadId, sendMessage]);

  // ─── Botón de enviar con micro-animación ──────────────────
  const sendScale = useSharedValue(1);
  const sendAnimatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: sendScale.value }],
  }));

  const sendGesture = Gesture.Tap()
    .enabled(inputText.trim().length > 0)
    .onBegin(() => {
      sendScale.value = withSpring(ANIMATION.pressScale, ANIMATION.spring);
    })
    .onFinalize(() => {
      sendScale.value = withSpring(1, ANIMATION.spring);
    })
    .onEnd(() => {
      handleSend();
    });

  // ─── Renderizar burbuja de mensaje ────────────────────────
  const renderMessage: ListRenderItem<ChatMessage> = useCallback(
    ({ item, index }) => {
      const isSelf = item.sender_id === user?.id;
      const senderName = item.perfiles?.nombre ?? (isSelf ? 'Tú' : 'Usuario');
      const time = new Date(item.created_at).toLocaleTimeString('es-EC', {
        hour: '2-digit',
        minute: '2-digit',
      });

      return (
        <Animated.View
          entering={FadeInDown.delay(index * 30).duration(300)}
          style={[
            styles.bubbleWrapper,
            isSelf ? styles.bubbleSelf : styles.bubbleOther,
          ]}
        >
          <View
            style={[
              styles.bubble,
              isSelf ? styles.bubbleSelfBg : styles.bubbleOtherBg,
            ]}
          >
            {!isSelf && (
              <Text style={styles.senderName}>{senderName}</Text>
            )}
            <Text style={styles.messageText}>{item.content}</Text>
            <Text style={styles.messageTime}>{time}</Text>
          </View>
        </Animated.View>
      );
    },
    [user?.id]
  );

  // ─── Estado vacío: no hay chat activo ─────────────────────
  if (!threadId) {
    return (
      <View style={styles.emptyContainer}>
        <StatusBar style="light" />
        <Ionicons name="chatbubbles-outline" size={64} color={COLORS.glassTextMutedDark} />
        <Text style={styles.emptyTitle}>Sin chat activo</Text>
        <Text style={styles.emptySubtitle}>
          El chat se habilitará cuando tengas un viaje en curso con un conductor asignado.
        </Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <StatusBar style="light" />

      {/* ─── HEADER DEL CHAT ──────────────────────────────── */}
      <BlurContainer intensity={25} style={styles.chatHeader}>
        <View style={styles.chatHeaderContent}>
          <View style={styles.chatHeaderInfo}>
            <Text style={styles.chatHeaderName}>
              {activeRide?.driver?.nombre ?? 'Chat del viaje'}
            </Text>
            <Text style={styles.chatHeaderStatus}>
              {activeRide?.status === 'en_curso' ? 'En camino' : 'Conectado'}
            </Text>
          </View>
        </View>
      </BlurContainer>

      {/* ─── LISTA DE MENSAJES ─────────────────────────────── */}
      <FlatList
        ref={flatListRef}
        data={messages}
        renderItem={renderMessage}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.messagesList}
        showsVerticalScrollIndicator={false}
        keyboardDismissMode="interactive"
      />

      {/* ─── BARRA DE ENTRADA ─────────────────────────────── */}
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        keyboardVerticalOffset={90}
      >
        <BlurContainer intensity={30} style={styles.inputBar}>
          <View style={styles.inputBarContent}>
            <View style={styles.inputWrapper}>
              <GlassInput
                label=""
                placeholder="Escribir mensaje..."
                value={inputText}
                onChangeText={setInputText}
                containerStyle={styles.chatInputContainer}
                returnKeyType="send"
                onSubmitEditing={handleSend}
              />
            </View>

            {/* Botón de enviar */}
            <GestureDetector gesture={sendGesture}>
              <Animated.View
                style={[
                  styles.sendButton,
                  inputText.trim()
                    ? styles.sendButtonActive
                    : styles.sendButtonInactive,
                  sendAnimatedStyle,
                ]}
                accessibilityRole="button"
                accessibilityLabel="Enviar mensaje"
              >
                <Ionicons
                  name="send"
                  size={20}
                  color={inputText.trim() ? COLORS.white : COLORS.glassTextMutedDark}
                />
              </Animated.View>
            </GestureDetector>
          </View>
        </BlurContainer>
      </KeyboardAvoidingView>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.darkBg,
  },

  // ─── Header ──────────────────────────────────────────────
  chatHeader: {
    paddingTop: 60,
    paddingBottom: SPACING.md,
    paddingHorizontal: SPACING.md,
    borderBottomWidth: 0.5,
    borderBottomColor: COLORS.glassBorderDark,
  },
  chatHeaderContent: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  chatHeaderInfo: {
    flex: 1,
  },
  chatHeaderName: {
    fontSize: FONTS.sizes.lg,
    fontFamily: FONTS.heading,
    fontWeight: FONTS.weights.bold,
    color: COLORS.glassTextDark,
  },
  chatHeaderStatus: {
    fontSize: FONTS.sizes.xs,
    fontFamily: FONTS.body,
    color: COLORS.success,
    marginTop: 2,
  },

  // ─── Lista de mensajes ────────────────────────────────────
  messagesList: {
    paddingHorizontal: SPACING.md,
    paddingTop: SPACING.md,
    paddingBottom: SPACING.lg,
  },

  // ─── Burbujas ─────────────────────────────────────────────
  bubbleWrapper: {
    marginBottom: SPACING.sm,
    maxWidth: '80%',
  },
  bubbleSelf: {
    alignSelf: 'flex-end',
  },
  bubbleOther: {
    alignSelf: 'flex-start',
  },
  bubble: {
    borderRadius: SHAPES.borderRadiusMd,
    padding: SPACING.sm,
    paddingHorizontal: SPACING.md,
  },
  bubbleSelfBg: {
    backgroundColor: 'rgba(13, 148, 136, 0.4)',
    borderWidth: 0.5,
    borderColor: COLORS.primary,
  },
  bubbleOtherBg: {
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    borderWidth: 0.5,
    borderColor: COLORS.glassBorderDark,
  },
  senderName: {
    fontSize: FONTS.sizes.xs,
    fontFamily: FONTS.body,
    fontWeight: FONTS.weights.semibold,
    color: COLORS.primaryLight,
    marginBottom: 2,
  },
  messageText: {
    fontSize: FONTS.sizes.base,
    fontFamily: FONTS.body,
    color: COLORS.glassTextDark,
    lineHeight: FONTS.sizes.base * FONTS.lineHeights.normal,
  },
  messageTime: {
    fontSize: 10,
    fontFamily: FONTS.body,
    color: COLORS.glassTextMutedDark,
    alignSelf: 'flex-end',
    marginTop: 4,
  },

  // ─── Barra de entrada ────────────────────────────────────
  inputBar: {
    borderTopWidth: 0.5,
    borderTopColor: COLORS.glassBorderDark,
    paddingHorizontal: SPACING.sm,
    paddingVertical: SPACING.sm,
    paddingBottom: 34, // Safe area bottom
  },
  inputBarContent: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  inputWrapper: {
    flex: 1,
  },
  chatInputContainer: {
    marginBottom: 0,
  },
  sendButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
    marginLeft: SPACING.sm,
  },
  sendButtonActive: {
    backgroundColor: COLORS.primary,
  },
  sendButtonInactive: {
    backgroundColor: 'rgba(255, 255, 255, 0.08)',
  },

  // ─── Estado vacío ────────────────────────────────────────
  emptyContainer: {
    flex: 1,
    backgroundColor: COLORS.darkBg,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: SPACING.xl,
  },
  emptyTitle: {
    fontSize: FONTS.sizes.xxl,
    fontFamily: FONTS.heading,
    fontWeight: FONTS.weights.bold,
    color: COLORS.glassTextDark,
    marginTop: SPACING.md,
  },
  emptySubtitle: {
    fontSize: FONTS.sizes.sm,
    fontFamily: FONTS.body,
    color: COLORS.glassTextMutedDark,
    textAlign: 'center',
    marginTop: SPACING.sm,
    lineHeight: FONTS.sizes.sm * FONTS.lineHeights.relaxed,
  },
});

export default ChatScreen;
