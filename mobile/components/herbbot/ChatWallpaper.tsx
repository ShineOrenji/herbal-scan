import React, { memo, useMemo } from 'react';
import { StyleSheet, View, ViewStyle, useWindowDimensions } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

type IonName = keyof typeof Ionicons.glyphMap;

const DOODLES: IonName[] = [
  'leaf-outline',
  'flower-outline',
  'flask-outline',
  'water-outline',
  'sparkles-outline',
  'rose-outline',
  'medkit-outline',
  'nutrition-outline',
  'cafe-outline',
  'heart-outline',
  'sunny-outline',
  'bandage-outline',
  'add',
];

const CELL = 84;

/** Cahaya lembut berbentuk lingkaran-konsentris (tanpa library gradien). */
function Glow({
  size,
  color,
  maxOpacity,
  position,
  steps = 10,
}: {
  size: number;
  color: string;
  maxOpacity: number;
  position: ViewStyle;
  steps?: number;
}) {
  return (
    <View pointerEvents="none" style={[{ position: 'absolute', width: size, height: size }, position]}>
      {Array.from({ length: steps }, (_, i) => {
        const d = size * (1 - i / steps);
        return (
          <View
            key={i}
            style={{
              position: 'absolute',
              width: d,
              height: d,
              borderRadius: d / 2,
              top: (size - d) / 2,
              left: (size - d) / 2,
              backgroundColor: color,
              opacity: maxOpacity / steps,
            }}
          />
        );
      })}
    </View>
  );
}

/**
 * Wallpaper chat ala WhatsApp dengan overlay yang sama gayanya dengan banner HerbBOT di Beranda:
 * isian emerald + cahaya hijau lembut + bayangan gelap di bawah + pola ikon botani tipis.
 * Murni dekorasi (pointerEvents none), dipasang di BELAKANG konten.
 */
function ChatWallpaper() {
  const { width, height } = useWindowDimensions();

  const doodles = useMemo(() => {
    const cols = Math.ceil(width / CELL) + 1;
    const rows = Math.ceil(height / CELL) + 1;
    const list: { key: string; name: IonName; size: number; left: number; top: number; rotate: string }[] = [];
    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        const i = r * cols + c;
        const name = DOODLES[(i * 5 + r * 3) % DOODLES.length];
        list.push({
          key: `${r}-${c}`,
          name,
          size: name === 'add' ? 16 : i % 3 === 0 ? 28 : 23,
          left: c * CELL + (r % 2 === 0 ? 0 : CELL / 2) - CELL / 4 + ((i * 13) % 14),
          top: r * CELL + ((i * 7) % 16),
          rotate: name === 'add' ? '0deg' : `${((i * 47) % 70) - 35}deg`,
        });
      }
    }
    return list;
  }, [width, height]);

  return (
    <View pointerEvents="none" style={styles.layer}>
      {/* 1. isian emerald (sama dengan fill banner HerbBOT) */}
      <View style={[StyleSheet.absoluteFill, { backgroundColor: 'rgba(37, 156, 81, 0.30)' }]} />

      {/* 2. cahaya hijau lembut di kiri atas & kanan tengah */}
      <Glow
        size={width * 1.2}
        color="#7CC794"
        maxOpacity={0.22}
        position={{ top: -width * 0.55, left: -width * 0.4 }}
      />
      <Glow
        size={width * 0.9}
        color="#34D399"
        maxOpacity={0.14}
        position={{ top: height * 0.35, right: -width * 0.55 }}
      />

      {/* 3. bayangan gelap bertahap di bagian bawah (kedalaman, tidak flat) */}
      {Array.from({ length: 8 }, (_, i) => (
        <View
          key={`shade-${i}`}
          style={{
            position: 'absolute',
            left: 0,
            right: 0,
            bottom: 0,
            height: height * 0.6 * (1 - i / 8),
            backgroundColor: 'rgba(4, 16, 10, 0.06)',
          }}
        />
      ))}

      {/* 4. pola ikon botani tipis (seperti pola di banner Beranda) */}
      {doodles.map((d) => (
        <Ionicons
          key={d.key}
          name={d.name}
          size={d.size}
          color="rgba(236, 253, 245, 0.13)"
          style={{
            position: 'absolute',
            left: d.left,
            top: d.top,
            transform: [{ rotate: d.rotate }],
          }}
        />
      ))}
    </View>
  );
}

export default memo(ChatWallpaper);

const styles = StyleSheet.create({
  layer: { ...StyleSheet.absoluteFillObject, overflow: 'hidden', backgroundColor: 'transparent' },
});
