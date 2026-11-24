import React from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { C, HB, R, glass } from './theme';

export default function LoginGate({ onLogin }: { onLogin: () => void }) {
  return (
    <View style={styles.box}>
      <View style={styles.card}>
        <View style={styles.iconWrap}>
          <Ionicons name="lock-closed" size={28} color={C.mint} />
        </View>
        <Text style={styles.title}>Masuk untuk memakai HerbBOT</Text>
        <Text style={styles.desc}>
          Login ke akun HerbalScan agar riwayat konsultasi herbal Anda tersimpan otomatis dan bisa
          dibuka kapan saja.
        </Text>
        <TouchableOpacity style={styles.cta} activeOpacity={0.9} onPress={onLogin}>
          <Ionicons name="log-in-outline" size={18} color={C.ink} />
          <Text style={styles.ctaText}>Masuk / Daftar Akun</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  box: { flex: 1, justifyContent: 'center', paddingHorizontal: 20 },
  card: {
    ...glass,
    borderRadius: 28,
    padding: 24,
    alignItems: 'center',
    gap: 10,
  },
  iconWrap: {
    width: 64,
    height: 64,
    borderRadius: 22,
    backgroundColor: HB.emeraldTint,
    borderWidth: 1,
    borderColor: HB.emeraldBorder,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 4,
  },
  title: { color: C.white, fontSize: 18, fontWeight: '800', textAlign: 'center' },
  desc: { color: C.textSoft, fontSize: 13, lineHeight: 20, textAlign: 'center' },
  cta: {
    marginTop: 10,
    alignSelf: 'stretch',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: C.white,
    paddingVertical: 15,
    borderRadius: R.pill,
  },
  ctaText: { color: C.ink, fontSize: 14.5, fontWeight: '800' },
});
