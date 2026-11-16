import React, { useEffect, useRef, useState } from 'react';
import { Animated, Keyboard, Platform, Pressable, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import type { BottomTabBarProps } from '@react-navigation/bottom-tabs';
import GlassView from './GlassView';
import { setTabBarTop } from './tabBarMetrics';
import { C, TAB_BAR } from '../constants/herbalTheme';

type IconName = keyof typeof Ionicons.glyphMap;

const ICONS: Record<string, { on: IconName; off: IconName }> = {
  index: { on: 'leaf', off: 'leaf-outline' },
  search: { on: 'search', off: 'search-outline' },
  scan: { on: 'scan', off: 'scan-outline' },
  history: { on: 'time', off: 'time-outline' },
};
const FALLBACK = { on: 'ellipse' as IconName, off: 'ellipse-outline' as IconName };

const PAD = 6; // jarak lensa ke tepi bar

/** Tab bar frosted glass: latar terblur kuat agar menu tidak saru dengan konten di belakangnya. */
export default function CurvedTabBar({ state, descriptors, navigation }: BottomTabBarProps) {
  const router = useRouter();
  const wrapRef = useRef<View>(null);
  const [barWidth, setBarWidth] = useState(0);
  const [keyboardOpen, setKeyboardOpen] = useState(false);

  const count = state.routes.length;
  const innerW = Math.max(0, barWidth - PAD * 2);
  const tabW = innerW / count;

  const lensX = useRef(new Animated.Value(0)).current;
  const lensScale = useRef(new Animated.Value(1)).current;
  const didInit = useRef(false);

  useEffect(() => {
    const showEvt = Platform.OS === 'ios' ? 'keyboardWillShow' : 'keyboardDidShow';
    const hideEvt = Platform.OS === 'ios' ? 'keyboardWillHide' : 'keyboardDidHide';
    const a = Keyboard.addListener(showEvt, () => setKeyboardOpen(true));
    const b = Keyboard.addListener(hideEvt, () => setKeyboardOpen(false));
    return () => {
      a.remove();
      b.remove();
    };
  }, []);

  useEffect(() => {
    if (!tabW) return;
    const target = PAD + state.index * tabW;
    if (!didInit.current) {
      didInit.current = true;
      lensX.setValue(target);
      return;
    }
    Animated.spring(lensX, {
      toValue: target,
      damping: 17,
      stiffness: 190,
      mass: 0.9,
      useNativeDriver: true,
    }).start();
    // efek "tetes cairan": lensa memanjang sebentar saat berpindah
    lensScale.setValue(1.14);
    Animated.spring(lensScale, {
      toValue: 1,
      friction: 6,
      tension: 140,
      useNativeDriver: true,
    }).start();
  }, [state.index, tabW, lensX, lensScale]);

  if (keyboardOpen) return null;

  const lensH = TAB_BAR.height - PAD * 2;

  return (
    <View
      ref={wrapRef}
      pointerEvents="box-none"
      style={styles.wrap}
      onLayout={() => {
        wrapRef.current?.measureInWindow((_x, y) => setTabBarTop(y));
      }}
    >
      <GlassView
        radius={TAB_BAR.height / 2}
        intensity={85}
        tint="dark"
        fill="rgba(7, 26, 16, 0.36)"
        shadow
        style={styles.glass}
        contentStyle={styles.glassContent}
      >
        <View style={styles.row} onLayout={(e) => setBarWidth(e.nativeEvent.layout.width)}>
          {tabW > 0 && (
            <Animated.View
              pointerEvents="none"
              style={[
                styles.lens,
                {
                  width: tabW,
                  height: lensH,
                  borderRadius: lensH / 2,
                  transform: [{ translateX: lensX }, { scaleX: lensScale }],
                },
              ]}
            >
              <View style={styles.lensSheen} />
            </Animated.View>
          )}

          {state.routes.map((route, index) => {
            const { options } = descriptors[route.key];
            const label = typeof options.title === 'string' ? options.title : route.name;
            const focused = state.index === index;
            const icons = ICONS[route.name] || FALLBACK;

            const onPress = () => {
              const nav: any = navigation ?? (descriptors[route.key] as any)?.navigation;
              if (nav?.emit && nav?.navigate) {
                const event = nav.emit({
                  type: 'tabPress',
                  target: route.key,
                  canPreventDefault: true,
                });
                if (!focused && !event?.defaultPrevented) {
                  nav.navigate(route.name, route.params);
                }
                return;
              }
              if (!focused) {
                router.navigate(
                  (route.name === 'index' ? '/(tabs)' : `/(tabs)/${route.name}`) as any
                );
              }
            };
            const onLongPress = () => {
              const nav: any = navigation ?? (descriptors[route.key] as any)?.navigation;
              nav?.emit?.({ type: 'tabLongPress', target: route.key });
            };

            return (
              <Pressable
                key={route.key}
                accessibilityRole="button"
                accessibilityState={focused ? { selected: true } : {}}
                accessibilityLabel={label}
                onPress={onPress}
                onLongPress={onLongPress}
                style={[styles.tab, tabW > 0 ? { width: tabW } : { flex: 1 }]}
              >
                <Ionicons
                  name={focused ? icons.on : icons.off}
                  size={focused ? 23 : 22}
                  color={focused ? C.leaf : 'rgba(236, 253, 245, 0.82)'}
                />
                <Text numberOfLines={1} style={[styles.label, focused && styles.labelActive]}>
                  {label}
                </Text>
              </Pressable>
            );
          })}
        </View>
      </GlassView>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    position: 'absolute',
    left: TAB_BAR.sideInset,
    right: TAB_BAR.sideInset,
    bottom: TAB_BAR.bottom,
    height: TAB_BAR.height,
  },
  glass: { flex: 1 },
  glassContent: { flex: 1 },
  row: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: PAD,
  },
  lens: {
    position: 'absolute',
    left: 0,
    backgroundColor: 'rgba(74, 222, 128, 0.18)',
    borderWidth: 1,
    borderColor: 'rgba(134, 239, 172, 0.42)',
    borderTopColor: 'rgba(255, 255, 255, 0.6)',
    overflow: 'hidden',
  },
  lensSheen: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: '48%',
    backgroundColor: 'rgba(255, 255, 255, 0.10)',
  },
  tab: {
    height: '100%',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 2,
  },
  label: { fontSize: 10.5, fontWeight: '600', color: 'rgba(236, 253, 245, 0.78)' },
  labelActive: { color: C.white, fontWeight: '800' },
});