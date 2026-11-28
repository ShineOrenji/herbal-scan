import React from 'react';
import { Platform, StyleProp, StyleSheet, View, ViewStyle } from 'react-native';

/**
 * Kaca cair buram (Frosted Liquid Glass) untuk iOS & Android.
 * - Menggunakan `expo-blur` (`dimezisBlurView` di Android) agar konten di belakang kartu/navbar terblur halus.
 * - Tingkat keburaman menyesuaikan prop `intensity` sehingga teks di atas kaca tetap kontras.
 */
let BlurViewImpl: any = null;
try {
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  BlurViewImpl = require('expo-blur').BlurView;
} catch {
  BlurViewImpl = null;
}

interface GlassViewProps {
  radius?: number;
  intensity?: number;
  tint?: 'dark' | 'light' | 'default';
  /** Warna isian tambahan di atas blur (untuk aksen hijau / merah / navbar). */
  fill?: string;
  shadow?: boolean;
  /** Style luar: margin, width, flex, height. */
  style?: StyleProp<ViewStyle>;
  /** Style isi: padding, flexDirection, gap. */
  contentStyle?: StyleProp<ViewStyle>;
  children?: React.ReactNode;
}

export default function GlassView({
  radius = 28,
  intensity = 45,
  tint = 'dark',
  fill = 'rgba(255, 255, 255, 0.06)',
  shadow = false,
  style,
  contentStyle,
  children,
}: GlassViewProps) {
  // Menjaga keterbacaan teks di atas blur tanpa menutupi efek frosted glass
  const baseOpacity = BlurViewImpl
    ? Math.min(0.56, Math.max(0.26, intensity / 155))
    : Math.min(0.82, Math.max(0.55, intensity / 105));

  return (
    <View style={[shadow && styles.shadow, { borderRadius: radius }, style]}>
      <View style={[styles.clip, { borderRadius: radius }]}>
        {BlurViewImpl ? (
          <BlurViewImpl
            intensity={intensity}
            tint={tint}
            experimentalBlurMethod={Platform.OS === 'android' ? 'dimezisBlurView' : undefined}
            style={StyleSheet.absoluteFill}
          />
        ) : null}

        <View
          pointerEvents="none"
          style={[
            StyleSheet.absoluteFill,
            { backgroundColor: `rgba(8, 28, 17, ${baseOpacity.toFixed(2)})` },
          ]}
        />

        <View pointerEvents="none" style={[StyleSheet.absoluteFill, { backgroundColor: fill }]} />
        <View pointerEvents="none" style={styles.sheen} />
        <View
          pointerEvents="none"
          style={[
            StyleSheet.absoluteFill,
            {
              borderRadius: radius,
              borderWidth: 1,
              borderColor: 'rgba(255, 255, 255, 0.22)',
              borderTopColor: 'rgba(255, 255, 255, 0.54)',
              borderBottomColor: 'rgba(255, 255, 255, 0.09)',
            },
          ]}
        />

        <View style={[styles.content, contentStyle]}>{children}</View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  shadow: {
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.32,
    shadowRadius: 18,
    elevation: 10,
  },
  clip: { overflow: 'hidden', flexGrow: 1 },
  content: { flexGrow: 1 },
  sheen: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: '48%',
    backgroundColor: 'rgba(255, 255, 255, 0.02)',
  },
});