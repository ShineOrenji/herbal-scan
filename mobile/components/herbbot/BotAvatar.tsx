import React from 'react';
import { Image, StyleSheet, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { BOT_CHAT_AVATAR_SOURCE, BOT_HEADER_AVATAR_SOURCE } from './botAvatar';
import { C, HB } from './theme';

interface BotAvatarProps {
  size?: number;
  error?: boolean;
  /** 'chat' = bulat kecil untuk bubble; 'header' = logo polos untuk heading (seperti logo di Beranda) */
  variant?: 'chat' | 'header';
}

export default function BotAvatar({ size = 30, error, variant = 'chat' }: BotAvatarProps) {
  const box = { width: size, height: size, borderRadius: size / 2 };

  if (error) {
    return (
      <View style={[box, styles.center, styles.error]}>
        <Ionicons name="alert" size={size * 0.5} color={HB.danger} />
      </View>
    );
  }

  // Heading: logo polos tanpa lingkaran
  if (variant === 'header') {
    const src = BOT_HEADER_AVATAR_SOURCE ?? BOT_CHAT_AVATAR_SOURCE;
    if (src) {
      return <Image source={src} resizeMode="contain" style={{ width: size, height: size }} />;
    }
    return (
      <View style={[box, styles.center, styles.fallback]}>
        <Ionicons name="sparkles" size={size * 0.46} color={C.white} />
      </View>
    );
  }

  if (BOT_CHAT_AVATAR_SOURCE) {
    return (
      <View style={[box, styles.center, styles.imageBase]}>
        <Image
          source={BOT_CHAT_AVATAR_SOURCE}
          resizeMode="contain"
          style={{ width: size * 1.5, height: size * 1.5 }}
        />
      </View>
    );
  }

  return (
    <View style={[box, styles.center, styles.fallback]}>
      <Ionicons name="leaf" size={size * 0.5} color={C.white} />
    </View>
  );
}

/** Maskot besar tanpa lingkaran (sapaan tengah layar). */
export function BotMascot({ size = 120 }: { size?: number }) {
  return (
    <View style={{ width: size, height: size, alignItems: 'center', justifyContent: 'center' }}>
      <View
        pointerEvents="none"
        style={{
          position: 'absolute',
          width: size * 1,
          height: size * 1,
          borderRadius: size,
          backgroundColor: 'rgba(74, 222, 128, 0.16)',
        }}
      />
      {BOT_CHAT_AVATAR_SOURCE ? (
        <Image
          source={BOT_CHAT_AVATAR_SOURCE}
          resizeMode="contain"
          style={{ width: 150, height: 150 }}
        />
      ) : (
        <View
          style={[
            styles.center,
            styles.fallback,
            { width: size * 0.62, height: size * 0.62, borderRadius: size * 0.31 },
          ]}
        >
          <Ionicons name="sparkles" size={size * 0.3} color={C.white} />
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  center: { alignItems: 'center', justifyContent: 'center' },
  fallback: {
    backgroundColor: C.emerald,
    borderWidth: 1,
    borderColor: 'rgba(187, 247, 208, 0.55)',
  },
  imageBase: {
    transform: [{ scale: -1 }, { scaleY: -1 }],
    backgroundColor: 'rgba(255, 255, 255, 0.10)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.22)',
  },
  error: {
    backgroundColor: HB.dangerTint,
    borderWidth: 1,
    borderColor: HB.dangerBorder,
  },
});
