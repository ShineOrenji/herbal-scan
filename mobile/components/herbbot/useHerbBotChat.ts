import { useCallback, useEffect, useRef, useState } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
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
  const [threadVersion, setThreadVersion] = useState(0);

  const getCacheKey = useCallback(
    (overrideSessionId?: number) => {
      const uid = user?.id ?? 'guest';
      if (isPlantMode && plant?.slug) {
        return `@herbbot_thread_${uid}_plant_${plant.slug}`;
      }
      const sid = overrideSessionId ?? sessionRef.current ?? 'latest';
      return `@herbbot_thread_${uid}_general_${sid}`;
    },
    [user?.id, isPlantMode, plant?.slug]
  );

  const saveLocalCache = useCallback(
    async (msgs: ChatBubble[], overrideSessionId?: number) => {
      try {
        const cleanMsgs = msgs.filter((m) => m.id !== 'welcome' && !m.isError);
        await AsyncStorage.setItem(getCacheKey(overrideSessionId), JSON.stringify(cleanMsgs));
      } catch {
        // abaikan error storage
      }
    },
    [getCacheKey]
  );

  const readLocalCache = useCallback(
    async (overrideSessionId?: number): Promise<ChatBubble[]> => {
      try {
        const raw = await AsyncStorage.getItem(getCacheKey(overrideSessionId));
        if (!raw) return [];
        const parsed = JSON.parse(raw);
        return Array.isArray(parsed) ? parsed : [];
      } catch {
        return [];
      }
    },
    [getCacheKey]
  );

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

  const buildWelcome = (): ChatBubble => {
    const firstName = user?.name ? ` ${user.name.split(' ')[0]}` : '';
    return {
      id: 'welcome',
      role: 'assistant',
      text: plant
        ? `Halo${firstName}! Saya **HerbBOT**, asisten botani Anda.\n\nSaya sudah mempelajari profil lengkap **${plant.name}** (*${plant.scientific_name}*). Silakan tanyakan cara pengolahan, takaran aman, kontraindikasi, atau perawatannya.`
        : `Halo${firstName}! Saya **HerbBOT**, asisten edukasi tanaman herbal Anda.\n\nTanyakan khasiat tumbuhan obat, cara meracik yang aman, atau perbandingan antar spesies herbal.`,
    };
  };

  const builders = useRef({ buildSuggestions, buildWelcome });
  builders.current = { buildSuggestions, buildWelcome };

  useEffect(() => {
    if (!visible || !isAuthenticated) return;
    let cancelled = false;
    const { buildSuggestions: sugg, buildWelcome: welcome } = builders.current;

    setSuggestions(sugg());
    setLoadingThread(true);

    (async () => {
      const cached = await readLocalCache();
      if (!cancelled && cached.length > 0) {
        setMessages([welcome(), ...cached]);
        setLoadingThread(false);
        setThreadVersion((v) => v + 1);
      }

      let next: ChatBubble[] = cached.length > 0 ? [welcome(), ...cached] : [welcome()];
      try {
        if (isPlantMode && plant?.slug) {
          const data = await getHerbBotThreadApi({ plant_slug: plant.slug });
          if (cancelled) return;
          setSessionId(data.session?.id);
          if (data.messages.length > 0 || cached.length === 0) {
            next = [welcome(), ...data.messages];
            await saveLocalCache(next);
          }
        } else {
          const list = await getHerbBotSessionsApi();
          if (cancelled) return;
          setSessions(list);
          if (list.length > 0) {
            const target = sessionRef.current
              ? list.find((s) => s.id === sessionRef.current) ?? list[0]
              : list[0];
            const thread = await getHerbBotThreadApi({ session_id: target.id });
            if (cancelled) return;
            setSessionId(target.id);
            next = [welcome(), ...thread.messages];
            await saveLocalCache(next, target.id);
            await saveLocalCache(next, undefined);
          }
        }
      } catch {
        if (cancelled) return;
      }

      if (!cancelled) {
        setMessages(next);
        setLoadingThread(false);
        setThreadVersion((v) => v + 1);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [visible, isAuthenticated, isPlantMode, plant?.slug, setSessionId, readLocalCache, saveLocalCache]);

  const loadHistory = useCallback(async () => {
    setLoadingHistory(true);
    try {
      setSessions(await getHerbBotSessionsApi());
    } catch {
      // abaikan
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
        const next = [builders.current.buildWelcome(), ...thread.messages];
        setMessages(next);
        setSuggestions(builders.current.buildSuggestions());
        await saveLocalCache(next, target.id);
        await saveLocalCache(next, undefined);
      } catch {
        // tetap di sesi sebelumnya
      } finally {
        setLoadingThread(false);
        setThreadVersion((v) => v + 1);
      }
    },
    [setSessionId, saveLocalCache]
  );

  const startNewChat = useCallback(() => {
    if (sendingRef.current) return;
    setSessionId(undefined);
    const fresh = [builders.current.buildWelcome()];
    setMessages(fresh);
    setSuggestions(builders.current.buildSuggestions());
    setThreadVersion((v) => v + 1);
    saveLocalCache([], undefined);
  }, [setSessionId, saveLocalCache]);

  const resetPlantChat = useCallback(async () => {
    if (!plant?.slug) return;
    await resetPlantHerbBotApi(plant.slug);
    setSessionId(undefined);
    setMessages([builders.current.buildWelcome()]);
    setSuggestions(builders.current.buildSuggestions());
    await saveLocalCache([]);
  }, [plant?.slug, setSessionId, saveLocalCache]);

  const deleteSession = useCallback(
    async (target: HerbBotSessionSummary) => {
      await deleteHerbBotSessionApi(target.id);
      setSessions((prev) => prev.filter((s) => s.id !== target.id));
      await AsyncStorage.removeItem(getCacheKey(target.id)).catch(() => {});
      if (sessionRef.current === target.id) {
        setSessionId(undefined);
        setMessages([builders.current.buildWelcome()]);
        await saveLocalCache([], undefined);
      }
    },
    [setSessionId, getCacheKey, saveLocalCache]
  );

  const deleteMessage = useCallback(
    async (id: number) => {
      await deleteHerbBotMessageApi(id);
      setMessages((prev) => {
        const updated = prev.filter((m) => m.id !== id);
        saveLocalCache(updated);
        return updated;
      });
    },
    [saveLocalCache]
  );

  const removeLocalMessage = useCallback(
    (id: string | number) => {
      setMessages((prev) => {
        const updated = prev.filter((m) => m.id !== id);
        saveLocalCache(updated);
        return updated;
      });
    },
    [saveLocalCache]
  );

  const send = useCallback(
    async (text: string) => {
      const clean = text.trim();
      if (!clean || sendingRef.current || !isAuthenticated) return;

      const tempId = `temp_${Date.now()}`;
      sendingRef.current = true;
      setSending(true);
      setMessages((prev) => [...prev, { id: tempId, role: 'user', text: clean }]);

      try {
        let res: Awaited<ReturnType<typeof askHerbBotApi>> | null = null;
        let lastErr: any = null;
        for (let attempt = 0; attempt < 2; attempt++) {
          try {
            res = await askHerbBotApi({
              message: clean,
              plant_slug: plant?.slug,
              session_id: isPlantMode ? undefined : sessionRef.current,
            });
            break;
          } catch (e: any) {
            lastErr = e;
            const status = e?.response?.status;
            if (status === 401 || status === 422 || attempt === 1) {
              throw e;
            }
          }
        }
        if (!res) throw lastErr;

        const activeSid = res.session?.id ?? sessionRef.current;
        if (res.session?.id) setSessionId(res.session.id);

        setMessages((prev) => {
          const updated = [
            ...prev.filter((m) => m.id !== tempId),
            res.user_message,
            res.assistant_message,
          ];
          saveLocalCache(updated, activeSid);
          if (!isPlantMode) {
            saveLocalCache(updated, undefined);
          }
          return updated;
        });

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
    [isAuthenticated, isPlantMode, plant?.slug, setSessionId, saveLocalCache]
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
