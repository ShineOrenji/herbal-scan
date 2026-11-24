import React, { useRef } from 'react';
import {
  Animated,
  Image,
  ImageSourcePropType,
  PanResponder,
  StyleSheet,
  Text,
  TouchableOpacity,
  useWindowDimensions,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { C, glass } from './herbbot/theme';

// NANTI GANTI BARIS INI DENGAN ILUSTRASI BOT KAMU, CONTOH:
// const BOT_AVATAR_SOURCE: ImageSourcePropType | null = require('../assets/images/herbbot.png');
const BOT_AVATAR_SOURCE: ImageSourcePropType | null = require('../assets/herbbot.png');

interface DraggableBotFabProps {
  onPress: () => void;
  bottomOffset?: number;
}

const FAB_SIZE = 60;
const BLOCK_H = FAB_SIZE + 26; // FAB + label
const EDGE_MARGIN = 16;

export default function DraggableBotFab({ onPress, bottomOffset = 28 }: DraggableBotFabProps) {
  const { width: screenW, height: screenH } = useWindowDimensions();
  const insets = useSafeAreaInsets();

  // Batas terbaru disimpan di ref agar PanResponder (dibuat sekali) selalu memakai nilai aktual
  const bounds = useRef({ screenW, screenH, top: insets.top, bottom: insets.bottom });
  bounds.current = { screenW, screenH, top: insets.top, bottom: insets.bottom };

  const initialX = screenW - FAB_SIZE - EDGE_MARGIN;
  const initialY = screenH - BLOCK_H - bottomOffset - insets.bottom;

  const pan = useRef(new Animated.ValueXY({ x: initialX, y: initialY })).current;
  const currentPos = useRef({ x: initialX, y: initialY });
  const isDragging = useRef(false);

  const panResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => false,
      onMoveShouldSetPanResponder: (_, g) => Math.abs(g.dx) > 6 || Math.abs(g.dy) > 6,
      onPanResponderGrant: () => {
        isDragging.current = true;
        pan.setOffset({ x: currentPos.current.x, y: currentPos.current.y });
        pan.setValue({ x: 0, y: 0 });
      },
      onPanResponderMove: Animated.event([null, { dx: pan.x, dy: pan.y }], {
        useNativeDriver: false,
      }),
      onPanResponderRelease: (_, g) => {
        pan.flattenOffset();
        const b = bounds.current;

        const rawX = currentPos.current.x + g.dx;
        const rawY = currentPos.current.y + g.dy;

        // Jaga agar tidak keluar area aman atas/bawah
        const minY = b.top + 12;
        const maxY = b.screenH - BLOCK_H - b.bottom - 8;
        const y = Math.max(minY, Math.min(maxY, rawY));

        // Snap ke sisi kiri/kanan terdekat
        const snapLeft = rawX + FAB_SIZE / 2 < b.screenW / 2;
        const x = snapLeft ? EDGE_MARGIN : b.screenW - FAB_SIZE - EDGE_MARGIN;

        currentPos.current = { x, y };
        Animated.spring(pan, {
          toValue: { x, y },
          useNativeDriver: false,
          friction: 7,
          tension: 70,
        }).start(() => {
          isDragging.current = false;
        });
      },
    })
  ).current;

  const handlePress = () => {
    if (!isDragging.current) onPress();
  };

  return (
    <Animated.View
      style={[styles.container, { transform: pan.getTranslateTransform() }]}
      {...panResponder.panHandlers}
    >
      <TouchableOpacity
        accessibilityRole="button"
        accessibilityLabel="Buka HerbBOT"
        activeOpacity={0.88}
        onPress={handlePress}
        style={styles.fabCircle}
      >
        {BOT_AVATAR_SOURCE ? (
          <Image source={BOT_AVATAR_SOURCE} style={styles.avatarImg} resizeMode="cover" />
        ) : (
          <Ionicons name="sparkles" size={26} color={C.white} />
        )}
        <View style={styles.onlineDot} />
      </TouchableOpacity>

      <View style={styles.labelPill} pointerEvents="none">
        <Text style={styles.labelText}>HerbBOT</Text>
      </View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    top: 0,
    left: 0,
    zIndex: 999,
    alignItems: 'center',
  },
  fabCircle: {
    width: 70,
    height: 70,
    borderRadius: '100%',
    ...glass,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#18972e',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.45,
    shadowRadius: 14,
    elevation: 10,
  },
  avatarImg: {
    width: 70,
    height: 70,
  },
  onlineDot: {
    position: 'absolute',
    top: 2,
    right: 2,
    width: 13,
    height: 13,
    borderRadius: 7,
    backgroundColor: '#4ade80',
    borderWidth: 2,
    borderColor: '#0a2215',
  },
  labelPill: {
    ...glass,
    marginTop: 5,
    paddingHorizontal: 9,
    paddingVertical: 3,
    borderRadius: 10,
  },
  labelText: {
    color: C.white,
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 0.2,
  },
});
