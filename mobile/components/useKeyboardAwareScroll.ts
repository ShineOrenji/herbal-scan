import { useCallback, useEffect, useRef, useState } from 'react';
import { Dimensions, Keyboard, Platform, ScrollView, TextInput } from 'react-native';

/**
 * Membuat ScrollView otomatis menggulir agar input yang sedang fokus
 * TIDAK PERNAH tertutup keyboard (Android & iOS), tanpa angka posisi manual.
 *
 * Pakai:
 *   const kb = useKeyboardAwareScroll();
 *   <ScrollView {...kb.scrollProps} contentContainerStyle={{ paddingBottom: kb.keyboardHeight + 32 }}>
 *     <TextInput onFocus={kb.onInputFocus} ... />
 */
export function useKeyboardAwareScroll(gap = 28) {
  const scrollRef = useRef<ScrollView>(null);
  const scrollY = useRef(0);
  const kbTop = useRef<number | null>(null);
  const [keyboardHeight, setKeyboardHeight] = useState(0);

  const ensureVisible = useCallback(() => {
    const input: any = (TextInput as any).State?.currentlyFocusedInput?.();
    if (!input?.measureInWindow || kbTop.current == null) return;

    input.measureInWindow((_x: number, y: number, _w: number, h: number) => {
      const bottom = y + h + gap;
      const overlap = bottom - (kbTop.current as number);
      if (overlap > 0) {
        scrollRef.current?.scrollTo({ y: scrollY.current + overlap, animated: true });
      } else if (y < 110) {
        // input terlalu dekat bagian atas layar
        scrollRef.current?.scrollTo({ y: Math.max(0, scrollY.current - (110 - y)), animated: true });
      }
    });
  }, [gap]);

  useEffect(() => {
    const showEvt = Platform.OS === 'ios' ? 'keyboardWillShow' : 'keyboardDidShow';
    const hideEvt = Platform.OS === 'ios' ? 'keyboardWillHide' : 'keyboardDidHide';

    const showSub = Keyboard.addListener(showEvt, (e) => {
      const h = e.endCoordinates?.height || 300;
      kbTop.current = e.endCoordinates?.screenY || Dimensions.get('window').height - h;
      setKeyboardHeight(h);
      setTimeout(ensureVisible, Platform.OS === 'ios' ? 60 : 160);
    });
    const hideSub = Keyboard.addListener(hideEvt, () => {
      kbTop.current = null;
      setKeyboardHeight(0);
    });
    return () => {
      showSub.remove();
      hideSub.remove();
    };
  }, [ensureVisible]);

  /** Pasang ke onFocus tiap TextInput (juga menangani pindah antar-input saat keyboard sudah terbuka). */
  const onInputFocus = useCallback(() => {
    setTimeout(ensureVisible, 140);
  }, [ensureVisible]);

  const scrollProps = {
    ref: scrollRef,
    onScroll: (e: any) => {
      scrollY.current = e.nativeEvent.contentOffset.y;
    },
    scrollEventThrottle: 16,
    keyboardShouldPersistTaps: 'handled' as const,
    keyboardDismissMode: (Platform.OS === 'ios' ? 'interactive' : 'on-drag') as 'interactive' | 'on-drag',
    showsVerticalScrollIndicator: false,
  };

  return { scrollRef, scrollProps, keyboardHeight, onInputFocus };
}
