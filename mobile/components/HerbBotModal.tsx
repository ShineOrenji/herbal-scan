import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Animated,
  Keyboard,
  KeyboardAvoidingView,
  Modal,
  PanResponder,
  Platform,
  Pressable,
  ScrollView,
  Share,
  StyleSheet,
  Text,
  useWindowDimensions,
  View,
} from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { HerbalDetail } from '../types/herbal';
import GlassView from './GlassView';
import HerbalConfirmModal from './HerbalConfirmModal';
import { C, HB, R } from './herbbot/theme';
import { ChatBubble, ConfirmState } from './herbbot/types';
import { sanitizeDisplayText } from './herbbot/utils';
import { useHerbBotChat } from './herbbot/useHerbBotChat';
import { useKeyboardVisible } from './herbbot/useKeyboardVisible';
import HerbBotHeader from './herbbot/HerbBotHeader';
import HistoryPanel from './herbbot/HistoryPanel';
import LoginGate from './herbbot/LoginGate';
import MessageBubble from './herbbot/MessageBubble';
import TypingIndicator from './herbbot/TypingIndicator';
import ChatInputBar from './herbbot/ChatInputBar';
import MessageActionsSheet from './herbbot/MessageActionsSheet';
import { SuggestionChips, SuggestionList } from './herbbot/Suggestions';

interface HerbBotModalProps {
  visible: boolean;
  onClose: () => void;
  plant?: HerbalDetail | null;
}

export default function HerbBotModal({ visible, onClose, plant }: HerbBotModalProps) {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { height: screenH } = useWindowDimensions();
  const kbVisible = useKeyboardVisible();
  const chat = useHerbBotChat({ visible, plant });

  const [showHistory, setShowHistory] = useState(false);
  const [input, setInput] = useState('');
  const [selectedMessage, setSelectedMessage] = useState<ChatBubble | null>(null);

  // Konfirmasi memakai HerbalConfirmModal (sama dengan layar Riwayat & Profil)
  const [confirm, setConfirm] = useState<ConfirmState | null>(null);
  const [confirmVisible, setConfirmVisible] = useState(false);
  const [confirmBusy, setConfirmBusy] = useState(false);

  const [toast, setToast] = useState<string | null>(null);
  const toastTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const scrollRef = useRef<ScrollView>(null);
  const instantScroll = useRef(false);

  const showToast = useCallback((msg: string) => {
    setToast(msg);
    if (toastTimer.current) clearTimeout(toastTimer.current);
    toastTimer.current = setTimeout(() => setToast(null), 2400);
  }, []);

  useEffect(
    () => () => {
      if (toastTimer.current) clearTimeout(toastTimer.current);
    },
    []
  );

  /* ------------------------- Animasi sheet (buka / tutup / drag) ------------------------- */
  const [rendered, setRendered] = useState(visible);
  const translateY = useRef(new Animated.Value(screenH)).current;
  const dimOpacity = useRef(new Animated.Value(0)).current;
  const screenHRef = useRef(screenH);
  screenHRef.current = screenH;
  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;

  useEffect(() => {
    if (visible) {
      setShowHistory(false);
      setSelectedMessage(null);
      setConfirmVisible(false);
      setRendered(true);
      translateY.setValue(screenHRef.current);
      dimOpacity.setValue(0);
      Animated.parallel([
        Animated.spring(translateY, { toValue: 0, friction: 11, tension: 70, useNativeDriver: true }),
        Animated.timing(dimOpacity, { toValue: 1, duration: 220, useNativeDriver: true }),
      ]).start();
    } else {
      Keyboard.dismiss();
      Animated.parallel([
        Animated.timing(translateY, {
          toValue: screenHRef.current,
          duration: 230,
          useNativeDriver: true,
        }),
        Animated.timing(dimOpacity, { toValue: 0, duration: 230, useNativeDriver: true }),
      ]).start(({ finished }) => {
        if (finished) setRendered(false);
      });
    }
  }, [visible, translateY, dimOpacity]);

  // Tarik grabber/header ke bawah untuk menutup (seperti sheet iOS)
  const dragResponder = useRef(
    PanResponder.create({
      onMoveShouldSetPanResponder: (_, g) => g.dy > 6 && g.dy > Math.abs(g.dx),
      onPanResponderMove: (_, g) => {
        if (g.dy > 0) translateY.setValue(g.dy);
      },
      onPanResponderRelease: (_, g) => {
        if (g.dy > 110 || g.vy > 0.9) {
          onCloseRef.current();
        } else {
          Animated.spring(translateY, { toValue: 0, friction: 9, useNativeDriver: true }).start();
        }
      },
      onPanResponderTerminate: () => {
        Animated.spring(translateY, { toValue: 0, friction: 9, useNativeDriver: true }).start();
      },
    })
  ).current;

  /* ------------------------------------ Efek ringan ------------------------------------ */
  useEffect(() => {
    instantScroll.current = true;
  }, [chat.threadVersion]);

  useEffect(() => {
    if (selectedMessage || confirmVisible) Keyboard.dismiss();
  }, [selectedMessage, confirmVisible]);

  /* ------------------------------------- Aksi UI ------------------------------------- */
  const submit = useCallback(
    (text?: string) => {
      const value = (text ?? input).trim();
      if (!value || chat.sending) return;
      setInput('');
      chat.send(value);
    },
    [input, chat]
  );

  const openHistory = () => {
    setShowHistory(true);
    chat.loadHistory();
  };

  const handleNewChat = () => {
    setShowHistory(false);
    setInput('');
    chat.startNewChat();
  };

  const handleSelectSession = (s: Parameters<typeof chat.selectSession>[0]) => {
    setShowHistory(false);
    chat.selectSession(s);
  };

  const openConfirm = (c: ConfirmState) => {
    setConfirm(c);
    setConfirmVisible(true);
  };

  const askResetPlant = () => {
    if (!plant?.slug || chat.sending) return;
    openConfirm({
      variant: 'danger-all',
      title: 'Reset Percakapan?',
      description: `Seluruh riwayat tanya jawab tentang ${plant.name} akan dihapus permanen dari akun Anda.`,
      itemLabel: plant.name,
      confirmLabel: 'Ya, Reset',
      successMessage: 'Percakapan direset',
      onConfirm: chat.resetPlantChat,
    });
  };

  const askDeleteSession = (s: Parameters<typeof chat.deleteSession>[0]) => {
    openConfirm({
      variant: 'single',
      title: 'Hapus Riwayat Chat?',
      description: 'Percakapan ini akan dihapus permanen dari riwayat Anda.',
      itemLabel: s.title,
      confirmLabel: 'Ya, Hapus',
      successMessage: 'Riwayat chat dihapus',
      onConfirm: () => chat.deleteSession(s),
    });
  };

  const askDeleteMessage = (msg: ChatBubble) => {
    setSelectedMessage(null);
    if (msg.id === 'welcome') return;
    if (typeof msg.id !== 'number') {
      chat.removeLocalMessage(msg.id);
      return;
    }
    const id = msg.id;
    openConfirm({
      variant: 'single',
      title: 'Hapus Pesan Ini?',
      description: 'Pesan yang dipilih akan dihapus permanen dari percakapan ini.',
      confirmLabel: 'Ya, Hapus',
      successMessage: 'Pesan dihapus',
      onConfirm: () => chat.deleteMessage(id),
    });
  };

  const runConfirm = async () => {
    if (!confirm || confirmBusy) return;
    setConfirmBusy(true);
    try {
      await confirm.onConfirm();
      showToast(confirm.successMessage);
    } catch {
      showToast('Gagal memproses. Periksa koneksi Anda.');
    } finally {
      setConfirmBusy(false);
      setConfirmVisible(false);
    }
  };

  const cancelConfirm = () => {
    if (!confirmBusy) setConfirmVisible(false);
  };

  const shareSelected = async () => {
    if (!selectedMessage) return;
    const text = sanitizeDisplayText(selectedMessage.text);
    setSelectedMessage(null);
    try {
      await Share.share({ message: text });
    } catch {
      // dibatalkan pengguna
    }
  };

  const goToLogin = () => {
    onClose();
    router.push('/auth');
  };

  /* --------------------------------------- Render --------------------------------------- */
  const onlyWelcome = chat.messages.length <= 1;
  const showChips =
    !onlyWelcome && chat.suggestions.length > 0 && !chat.sending && !chat.loadingThread;
  const bottomPad = kbVisible ? 10 : Math.max(insets.bottom, 12);
  const lastIndex = chat.messages.length - 1;

  return (
    <Modal
      visible={rendered}
      transparent
      animationType="none"
      statusBarTranslucent
      onRequestClose={onClose}
    >
      <View style={styles.root}>
        <Animated.View style={[StyleSheet.absoluteFill, styles.dim, { opacity: dimOpacity }]} />

        <KeyboardAvoidingView
          style={styles.kav}
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        >
          {/* Ketuk area di atas sheet untuk menutup */}
          <Pressable style={{ height: insets.top + 28, flexShrink: 1 }} onPress={onClose} />

          <Animated.View style={[styles.sheet, { transform: [{ translateY }] }]}>
            {/* Latar kaca: memakai GlassView yang sama dengan layar lain */}
            <GlassView
              radius={0}
              intensity={90}
              fill={chat.isToxic && plant ? HB.sheetFillToxic : HB.sheetFill}
              style={StyleSheet.absoluteFill}
            />

            {/* Zona tarik: grabber + header */}
            <View {...dragResponder.panHandlers}>
              <View style={styles.grabberWrap}>
                <View style={styles.grabber} />
              </View>
              <HerbBotHeader
                plantName={plant?.name}
                isToxic={chat.isToxic}
                isAuthenticated={chat.isAuthenticated}
                isPlantMode={chat.isPlantMode}
                canReset={chat.messages.length > 1}
                historyOpen={showHistory && !chat.isPlantMode}
                onNewChat={handleNewChat}
                onToggleHistory={() => (showHistory ? setShowHistory(false) : openHistory())}
                onReset={askResetPlant}
                onClose={onClose}
              />
            </View>

            {/* Konten */}
            {!chat.isAuthenticated ? (
              <LoginGate onLogin={goToLogin} />
            ) : showHistory && !chat.isPlantMode ? (
              <HistoryPanel
                sessions={chat.sessions}
                loading={chat.loadingHistory}
                currentId={chat.sessionId}
                onSelect={handleSelectSession}
                onDelete={askDeleteSession}
                onNewChat={handleNewChat}
                bottomPad={bottomPad}
              />
            ) : (
              <>
                {chat.loadingThread ? (
                  <View style={styles.center}>
                    <ActivityIndicator size="small" color={C.mint} />
                    <Text style={styles.loadingText}>Memuat percakapan…</Text>
                  </View>
                ) : (
                  <ScrollView
                    ref={scrollRef}
                    style={{ flex: 1 }}
                    contentContainerStyle={styles.chatContent}
                    showsVerticalScrollIndicator={false}
                    keyboardShouldPersistTaps="handled"
                    keyboardDismissMode={Platform.OS === 'ios' ? 'interactive' : 'on-drag'}
                    onContentSizeChange={() => {
                      scrollRef.current?.scrollToEnd({ animated: !instantScroll.current });
                      instantScroll.current = false;
                    }}
                  >
                    {chat.messages.map((msg, index) => (
                      <MessageBubble
                        key={String(msg.id)}
                        msg={msg}
                        onLongPress={
                          msg.id === 'welcome' ? undefined : () => setSelectedMessage(msg)
                        }
                        onRetry={
                          msg.isError && index === lastIndex && !chat.sending
                            ? () => chat.retry(msg)
                            : undefined
                        }
                      />
                    ))}

                    {chat.sending && <TypingIndicator />}

                    {onlyWelcome && !chat.sending && chat.suggestions.length > 0 && (
                      <SuggestionList items={chat.suggestions} onPick={(q) => submit(q)} />
                    )}
                  </ScrollView>
                )}

                {showChips && (
                  <SuggestionChips items={chat.suggestions} onPick={(q) => submit(q)} />
                )}

                <ChatInputBar
                  value={input}
                  onChange={setInput}
                  onSend={() => submit()}
                  sending={chat.sending}
                  placeholder={plant ? `Tanya seputar ${plant.name}…` : 'Tulis pertanyaan herbal Anda…'}
                  bottomPad={bottomPad}
                  compact={kbVisible}
                />
              </>
            )}
          </Animated.View>
        </KeyboardAvoidingView>

        {/* Toast hasil aksi (gaya sama dengan Riwayat/Profil) */}
        {toast ? (
          <View
            pointerEvents="none"
            style={[styles.toastPill, { bottom: Math.max(insets.bottom, 12) + 96 }]}
          >
            <Ionicons name="checkmark-circle" size={16} color={C.leaf} />
            <Text style={styles.toastText}>{toast}</Text>
          </View>
        ) : null}

        {/* Opsi pesan: bottom sheet bergaya HerbalConfirmModal */}
        <MessageActionsSheet
          visible={Boolean(selectedMessage)}
          preview={selectedMessage ? sanitizeDisplayText(selectedMessage.text) : ''}
          onShare={shareSelected}
          onDelete={() => selectedMessage && askDeleteMessage(selectedMessage)}
          onCancel={() => setSelectedMessage(null)}
        />
      </View>

      {/* Konfirmasi hapus / reset: komponen yang sama dengan layar Riwayat & Profil */}
      <HerbalConfirmModal
        visible={confirmVisible}
        variant={confirm?.variant ?? 'single'}
        title={confirm?.title ?? ''}
        message={confirm?.description ?? ''}
        itemLabel={confirm?.itemLabel}
        confirmText={confirm?.confirmLabel ?? 'Hapus'}
        cancelText="Batal"
        loading={confirmBusy}
        onConfirm={runConfirm}
        onCancel={cancelConfirm}
      />
    </Modal>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  dim: { backgroundColor: HB.dim },
  kav: { flex: 1, justifyContent: 'flex-end' },
  sheet: {
    flex: 1,
    borderTopLeftRadius: 34,
    borderTopRightRadius: 34,
    overflow: 'hidden',
    borderWidth: 1,
    borderBottomWidth: 0,
    borderColor: HB.specular,
  },
  grabberWrap: { alignItems: 'center', paddingTop: 8, paddingBottom: 10 },
  grabber: {
    width: 38,
    height: 5,
    borderRadius: 3,
    backgroundColor: 'rgba(255,255,255,0.28)',
  },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 10 },
  loadingText: { color: C.textSoft, fontSize: 12.5 },
  chatContent: {
    paddingHorizontal: 14,
    paddingTop: 16,
    paddingBottom: 14,
    gap: 12,
  },
  toastPill: {
    position: 'absolute',
    alignSelf: 'center',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: 'rgba(10, 34, 22, 0.96)',
    borderWidth: 1,
    borderColor: 'rgba(134, 239, 172, 0.4)',
    paddingHorizontal: 16,
    paddingVertical: 11,
    borderRadius: R.pill,
    zIndex: 90,
    elevation: 12,
  },
  toastText: { color: C.white, fontSize: 13, fontWeight: '700' },
});
