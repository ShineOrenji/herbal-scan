import React, { memo, useMemo } from 'react';
import { Image, StyleSheet, View, ViewStyle, useWindowDimensions } from 'react-native';
import { BACKDROP_IMAGE, PLANT_OVERLAY_IMAGE } from '../constants/herbalTheme';

function hexToRgb(h: string): [number, number, number] {
  const v = h.replace('#', '');
  return [parseInt(v.slice(0, 2), 16), parseInt(v.slice(2, 4), 16), parseInt(v.slice(4, 6), 16)];
}
function mixColor(a: string, b: string, t: number) {
  const A = hexToRgb(a);
  const B = hexToRgb(b);
  const m = A.map((x, i) => Math.round(x + (B[i] - x) * t));
  return `rgb(${m[0]}, ${m[1]}, ${m[2]})`;
}
function gradientAt(stops: [number, string][], t: number) {
  for (let i = 0; i < stops.length - 1; i++) {
    const [t0, c0] = stops[i];
    const [t1, c1] = stops[i + 1];
    if (t >= t0 && t <= t1) return mixColor(c0, c1, (t - t0) / (t1 - t0));
  }
  return stops[stops.length - 1][1];
}

/** Gradien vertikal: setiap baris flex:1 sehingga SELALU pas memenuhi layar (tanpa celah di bawah). */
const GradientBase = memo(function GradientBase({ stops }: { stops: [number, string][] }) {
  const N = 72;
  const rows = useMemo(
    () => Array.from({ length: N }, (_, i) => gradientAt(stops, i / (N - 1))),
    [stops]
  );
  return (
    <View style={StyleSheet.absoluteFill}>
      {rows.map((c, i) => (
        <View key={i} style={{ flex: 1, backgroundColor: c }} />
      ))}
    </View>
  );
});

const Glow = memo(function Glow({
  size,
  color,
  maxOpacity,
  position,
  steps = 34,
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
});

function Leaf({
  s,
  color,
  vein,
  angle,
  ax,
  ay,
  opacity,
}: {
  s: number;
  color: string;
  vein: string;
  angle: number;
  ax: number;
  ay: number;
  opacity: number;
}) {
  const py = s * 0.7071;
  return (
    <View
      pointerEvents="none"
      style={{
        position: 'absolute',
        width: s,
        height: s,
        left: ax - s / 2,
        top: ay - py - s / 2,
        opacity,
        transform: [
          { translateY: py },
          { rotate: `${angle}deg` },
          { translateY: -py },
          { rotate: '-45deg' },
        ],
      }}
    >
      <View
        style={{
          flex: 1,
          backgroundColor: color,
          borderTopLeftRadius: s,
          borderBottomRightRadius: s,
          borderTopRightRadius: s * 0.1,
          borderBottomLeftRadius: s * 0.1,
        }}
      />
      <View
        style={{
          position: 'absolute',
          width: 1.5,
          height: s * 1.28,
          left: s / 2 - 0.75,
          top: s / 2 - s * 0.64,
          backgroundColor: vein,
          transform: [{ rotate: '45deg' }],
        }}
      />
    </View>
  );
}

interface BotanicalBackdropProps {
  /**
   * "soft"  = terang di atas + overlay daun di pojok kanan atas (Beranda, Cari, Riwayat, Sambutan).
   * "deep"  = polos & bersih tanpa overlay (Detail, Pindai) agar tidak ada bentuk di balik kartu.
   */
  tone?: 'soft' | 'deep';
}

export default function BotanicalBackdrop({ tone = 'soft' }: BotanicalBackdropProps) {
  const { width: W } = useWindowDimensions();
  const deep = tone === 'deep';

  const stops = useMemo<[number, string][]>(
    () =>
      deep
        ? [[0, '#0F3622'], [0.5, '#0A2216'], [1, '#06140D']]
        : [[0, '#1B6340'], [0.38, '#0E3822'], [0.75, '#09211A'], [1, '#06140D']],
    [deep]
  );

  const s = Math.min(W, 460) * 0.46;

  return (
    <View pointerEvents="none" style={[StyleSheet.absoluteFill, { overflow: 'hidden' }]}>
      <GradientBase stops={stops} />

      {BACKDROP_IMAGE ? (
        <Image
          source={{ uri: BACKDROP_IMAGE }}
          blurRadius={28}
          resizeMode="cover"
          style={[StyleSheet.absoluteFill, { opacity: deep ? 0.18 : 0.3 }]}
        />
      ) : null}

      {/* cahaya lembut di atas saja, tidak ada bentuk di bagian bawah */}
      <Glow size={W * 1.3} color="#7CC794" maxOpacity={deep ? 0.16 : 0.28} position={{ top: -W * 0.7, left: -W * 0.45 }} />
      {!deep && (
        <Glow size={W * 0.9} color="#34D399" maxOpacity={0.12} position={{ top: -W * 0.25, right: -W * 0.5 }} />
      )}

      {/* overlay tanaman: hanya di layar "soft", pojok kanan atas, halus */}
      {!deep &&
        (PLANT_OVERLAY_IMAGE ? (
          <Image
            source={{ uri: PLANT_OVERLAY_IMAGE }}
            resizeMode="contain"
            style={{ position: 'absolute', top: -W * 0.12, right: -W * 0.22, width: W * 0.9, height: W * 0.9, opacity: 0.5 }}
          />
        ) : (
          <>
            {[-56, -28, 0, 28, 56].map((a, i) => (
              <Leaf
                key={`b${i}`}
                s={s * 1.25 * (i % 2 === 0 ? 1 : 0.84)}
                color="#2C7A4D"
                vein="rgba(190,247,208,0.22)"
                angle={228 + a}
                ax={W + 14}
                ay={-14}
                opacity={0.1}
              />
            ))}
            {[-46, -16, 14, 44].map((a, i) => (
              <Leaf
                key={`f${i}`}
                s={s * (i % 2 === 0 ? 1 : 0.82)}
                color="#3FA06A"
                vein="rgba(220,252,231,0.3)"
                angle={222 + a}
                ax={W + 4}
                ay={-6}
                opacity={0.16}
              />
            ))}
          </>
        ))}
    </View>
  );
}
