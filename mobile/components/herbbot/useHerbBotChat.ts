import { useCallback, useEffect, useRef, useState } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import {
  askHerbBotApi,
  deleteHerbBotMessageApi,
  deleteHerbBotSessionApi,
  getHerbBotSessionsApi,
  getHerbBotThreadApi,
  HerbBotSessionSummary,
  resetPlantHerbBotApi,
} from '../../services/api';
import { HerbalDetail } from '../../types/herbal';
import { ChatBubble } from './types';

interface Options {
  visible: boolean;
  plant?: HerbalDetail | null;
}

/**
 * Seluruh state & pemanggilan API HerbBOT ada di sini.
 * `messages` hanya berisi percakapan asli — sapaan ditampilkan terpisah (EmptyChat) di tengah layar.
 */
export function useHerbBotChat({ visible, plant }: Options) {
  const { user, token } = useAuth();
  const isAuthenticated = Boolean(user && token);
  const isPlantMode = Boolean(plant?.slug);
  const isToxic = Boolean(
    (plant as any)?.is_toxic ||
      /beracun|toksik/i.test(`${plant?.name ?? ''} ${plant?.safety_warning ?? ''}`)
  );

  const [sessionId, setSessionIdState] = useState<number | undefined>(undefined);
  const sessionRef = useRef<number | undefined>(undefined);
  const setSessionId = useCallback((id?: number) => {
    sessionRef.current = id;
    setSessionIdState(id);
  }, []);

  const [messages, setMessages] = useState<ChatBubble[]>([]);
  const [suggestions, setSuggestions] = useState<string[]>([]);
  const [sessions, setSessions] = useState<HerbBotSessionSummary[]>([]);
  const [loadingThread, setLoadingThread] = useState(false);
  const [loadingHistory, setLoadingHistory] = useState(false);
  const [sending, setSending] = useState(false);
  const sendingRef = useRef(false);
  // Naik setiap kali satu thread selesai dimuat (untuk scroll instan ke pesan terbaru)
  const [threadVersion, setThreadVersion] = useState(0);

  // ---------- Sapaan (ditampilkan di tengah layar, bukan sebagai bubble) ----------
  const firstName = user?.name ? user.name.trim().split(' ')[0] : '';
  const welcome = {
    greeting: firstName ? `Halo, ${firstName}!` : 'Halo!',
    subtitle: plant
      ? `Saya HerbBOT, asisten botani Anda. Tanyakan apa saja tentang ${plant.name} (${plant.scientific_name}): cara pengolahan, takaran aman, kontraindikasi, hingga perawatannya.`
      : 'Saya HerbBOT, asisten edukasi tanaman herbal Anda. Tanyakan khasiat, cara meracik yang aman, atau perbandingan antar spesies herbal.',
  };

  const buildSuggestions = (): string[] => {
    if (!plant) {
      return [
        'Apa perbedaan kunyit dan temulawak?',
        'Herbal apa yang aman untuk melegakan tenggorokan?',
        'Tanaman herbal apa yang mudah ditanam di pot rumah?',
      ];
    }
    if (isToxic) {
      return [
        `Kenapa ${plant.name.replace(/\s*\(Beracun\)/i, '')} berbahaya?`,
        'Apa pertolongan pertama jika getahnya terkena kulit?',
        'Apakah aman ditanam sebagai tanaman hias?',
      ];
    }
    return [
      `Bagaimana cara mengolah ${plant.name} yang benar?`,
      `Siapa saja yang dilarang mengonsumsi ${plant.name}?`,
      `Apakah ${plant.name} aman diminum setiap hari?`,
    ];
  };

  // Disimpan di ref agar perubahan nama user tidak memicu fetch ulang
  const builders = useRef({ buildSuggestions });
  builders.current = { buildSuggestions };

  // ---------- Setiap modal dibuka: MULAI DARI AWAL (tidak melanjutkan chat sebelumnya) ----------
  // Chat lama tetap tersimpan & bisa dibuka lewat tombol Riwayat.
  useEffect(() => {
    if (!visible || !isAuthenticated) return;
    setSessionId(undefined);
    setMessages([]);
    setSuggestions(builders.current.buildSuggestions());
    setLoadingThread(false);
    setThreadVersion((v) => v + 1);
  }, [visible, isAuthenticated, isPlantMode, plant?.slug, setSessionId]);

  // ---------- Riwayat ----------
  const loadHistory = useCallback(async () => {
    setLoadingHistory(true);
    try {
      setSessions(await getHerbBotSessionsApi());
    } catch {
      // abaikan; daftar lama tetap tampil
    } finally {
      setLoadingHistory(false);
    }
  }, []);

  const selectSession = useCallback(
    async (target: HerbBotSessionSummary) => {
      setLoadingThread(true);
      try {
        const thread = await getHerbBotThreadApi({ session_id: target.id });
        setSessionId(target.id);
        setMessages(thread.messages);
        setSuggestions(builders.current.buildSuggestions());
      } catch {
        // tetap di percakapan sebelumnya
      } finally {
        setLoadingThread(false);
        setThreadVersion((v) => v + 1);
      }
    },
    [setSessionId]
  );

  const startNewChat = useCallback(() => {
    if (sendingRef.current) return;
    setSessionId(undefined);
    setMessages([]);
    setSuggestions(builders.current.buildSuggestions());
    setThreadVersion((v) => v + 1);
  }, [setSessionId]);

  // ---------- Aksi yang boleh melempar error (dipakai dialog konfirmasi) ----------
  const resetPlantChat = useCallback(async () => {
    if (!plant?.slug) return;
    await resetPlantHerbBotApi(plant.slug);
    setSessionId(undefined);
    setMessages([]);
    setSuggestions(builders.current.buildSuggestions());
  }, [plant?.slug, setSessionId]);

  const deleteSession = useCallback(
    async (target: HerbBotSessionSummary) => {
      await deleteHerbBotSessionApi(target.id);
      setSessions((prev) => prev.filter((s) => s.id !== target.id));
      if (sessionRef.current === target.id) {
        setSessionId(undefined);
        setMessages([]);
      }
    },
    [setSessionId]
  );

  const deleteMessage = useCallback(async (id: number) => {
    await deleteHerbBotMessageApi(id);
    setMessages((prev) => prev.filter((m) => m.id !== id));
  }, []);

  const removeLocalMessage = useCallback((id: string | number) => {
    setMessages((prev) => prev.filter((m) => m.id !== id));
  }, []);

  // ---------- Kirim pesan ----------
  const send = useCallback(
    async (text: string) => {
      const clean = text.trim();
      if (!clean || sendingRef.current || !isAuthenticated) return;

      const tempId = `temp_${Date.now()}`;
      sendingRef.current = true;
      setSending(true);
      setMessages((prev) => [...prev, { id: tempId, role: 'user', text: clean }]);

      try {
        const res = await askHerbBotApi({
          message: clean,
          plant_slug: plant?.slug,
          session_id: isPlantMode ? undefined : sessionRef.current,
        });
        if (res.session?.id) setSessionId(res.session.id);

        setMessages((prev) => [
          ...prev.filter((m) => m.id !== tempId),
          res.user_message,
          res.assistant_message,
        ]);
        if (Array.isArray(res.suggestions) && res.suggestions.length > 0) {
          setSuggestions(res.suggestions);
        }
      } catch (err: any) {
        const errText =
          err?.response?.data?.message ||
          'HerbBOT sedang padat sesaat atau koneksi terputus. Silakan coba lagi.';
        setMessages((prev) => [
          ...prev,
          {
            id: `err_${Date.now()}`,
            role: 'assistant',
            text: errText,
            isError: true,
            retryText: clean,
            retryTempId: tempId,
          },
        ]);
      } finally {
        sendingRef.current = false;
        setSending(false);
      }
    },
    [isAuthenticated, isPlantMode, plant?.slug, setSessionId]
  );

  const retry = useCallback(
    (errBubble: ChatBubble) => {
      if (!errBubble.retryText) return;
      setMessages((prev) =>
        prev.filter((m) => m.id !== errBubble.id && m.id !== errBubble.retryTempId)
      );
      send(errBubble.retryText);
    },
    [send]
  );

  return {
    isAuthenticated,
    isPlantMode,
    isToxic,
    welcome,
    sessionId,
    messages,
    suggestions,
    sessions,
    loadingThread,
    loadingHistory,
    sending,
    threadVersion,
    loadHistory,
    selectSession,
    startNewChat,
    resetPlantChat,
    deleteSession,
    deleteMessage,
    removeLocalMessage,
    send,
    retry,
  };
}
