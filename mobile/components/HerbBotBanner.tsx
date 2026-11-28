import React from 'react';
import { Image, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import GlassView from './GlassView';
import { BOT_AVATAR_SOURCE } from './herbbot/botAvatar';
import { C, R } from '../constants/herbalTheme';

interface HerbBotBannerProps {
  onPress: () => void;
}

type IonName = React.ComponentProps<typeof Ionicons>['name'];

// Pola ikon botani tipis di latar banner (pengganti pola peta pada gambar referensi)
const PATTERN: { name: IonName; top: number; left: `${number}%`; size: number; rotate?: string }[] = [
  { name: 'leaf-outline', top: 10, left: '4%', size: 26, rotate: '-20deg' },
  { name: 'add', top: 14, left: '36%', size: 16 },
  { name: 'flower-outline', top: 6, left: '52%', size: 28 },
  { name: 'sparkles-outline', top: 70, left: '44%', size: 20 },
  { name: 'flask-outline', top: 118, left: '8%', size: 24, rotate: '12deg' },
  { name: 'add', top: 128, left: '40%', size: 14 },
  { name: 'rose-outline', top: 128, left: '30%', size: 24 },
  { name: 'leaf-outline', top: 140, left: '54%', size: 24, rotate: '35deg' },
];

const MASCOT_W = 142;
const POP_OUT = 20; // maskot sedikit keluar dari tepi atas kartu

export default function HerbBotBanner({ onPress }: HerbBotBannerProps) {
  return (
    <TouchableOpacity activeOpacity={0.92} onPress={onPress} style={styles.wrap}>
      <GlassView
        radius={28}
        intensity={55}
        fill="rgba(37, 156, 81, 0.46)"
        style={styles.card}
        contentStyle={styles.inner}
      >
        {/* Pola latar */}
        <View pointerEvents="none" style={StyleSheet.absoluteFill}>
          {PATTERN.map((p, i) => (
            <Ionicons
              key={i}
              name={p.name}
              size={p.size}
              color="rgba(236, 253, 245, 0.16)"
              style={{
                position: 'absolute',
                top: p.top,
                left: p.left,
                transform: p.rotate ? [{ rotate: p.rotate }] : undefined,
              }}
            />
          ))}
        </View>

        {/* Teks kiri */}
        <View style={styles.textCol}>

          <Text style={styles.title}>
            Bingung soal herbal?{'\n'}Tanya HerbBOT.
          </Text>
          <Text style={styles.sub}>
            Konsultasi khasiat, cara olah yang aman, dan perbandingan herbal secara interaktif.
          </Text>

          <View style={styles.cta}>
            <Text style={styles.ctaText}>Mulai tanya</Text>
            <Ionicons name="chatbubble-ellipses" size={15} color={C.ink} />
          </View>
        </View>
      </GlassView>

      {/* Maskot (di luar GlassView agar boleh keluar dari tepi kartu) */}
      <View pointerEvents="none" style={styles.mascotSlot}>
        {BOT_AVATAR_SOURCE ? (
          <Image source={BOT_AVATAR_SOURCE} resizeMode="contain" style={styles.mascotImg} />
        ) : (
          <View style={styles.mascotFallback}>
            <Ionicons name="sparkles" size={44} color={C.white} />
          </View>
        )}
      </View>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  wrap: {
    marginTop: 5,
    marginBottom: 15,
  },
  card: {
    shadowColor: C.emerald,
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.35,
    shadowRadius: 18,
    elevation: 8,
  },
  inner: {
    minHeight: 186,
    paddingVertical: 18,
    paddingLeft: 18,
    paddingRight: MASCOT_W - 8,
    justifyContent: 'center',
  },
  textCol: { gap: 6 },

  title: {
    color: C.white,
    fontSize: 20,
    lineHeight: 25,
    fontWeight: '800',
    letterSpacing: -0.4,
    marginTop: 2,
  },
  sub: { color: 'rgba(236, 253, 245, 0.86)', fontSize: 12, lineHeight: 18 },
  cta: {
    alignSelf: 'flex-start',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 7,
    marginTop: 8,
    backgroundColor: C.white,
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: R.pill,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.25,
    shadowRadius: 10,
    elevation: 6,
  },
  ctaText: { color: C.ink, fontSize: 13, fontWeight: '800' },

  mascotSlot: {
    position: 'absolute',
    right: 6,
    bottom: 0,
    top: -POP_OUT,
    width: MASCOT_W,
    alignItems: 'center',
    justifyContent: 'flex-end',
  },
  mascotImg: { width: '240%', height: '90%' },
  mascotFallback: {
    width: 92,
    height: 92,
    borderRadius: 46,
    marginBottom: 46,
    backgroundColor: C.emerald,
    borderWidth: 2,
    borderColor: 'rgba(187, 247, 208, 0.75)',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.3,
    shadowRadius: 12,
    elevation: 8,
  },
});
