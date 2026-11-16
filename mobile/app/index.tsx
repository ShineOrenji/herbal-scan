import React, { useState } from 'react';
import {
  Image,
  Platform,
  StatusBar,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import BotanicalBackdrop from '../components/BotanicalBackdrop';
import { C, R, WELCOME_PLANT_IMAGE } from '../constants/herbalTheme';

/** Ilustrasi tanaman bawaan. Dipakai bila WELCOME_PLANT_IMAGE kosong / gagal dimuat. */
function PlantIllustration() {
  return (
    <View style={styles.illustration}>
      <View style={[styles.haloRing, { width: 300, height: 300, opacity: 0.05 }]} />
      <View style={[styles.haloRing, { width: 240, height: 240, opacity: 0.07 }]} />
      <View style={[styles.haloRing, { width: 180, height: 180, opacity: 0.1 }]} />

      <View style={styles.leafLeft}>
        <Ionicons name="leaf" size={118} color="#3F9B5B" />
      </View>
      <View style={styles.leafRight}>
        <Ionicons name="leaf" size={108} color={C.leafSoft} />
      </View>
      <View style={styles.leafCenter}>
        <Ionicons name="leaf" size={150} color={C.leaf} />
      </View>

      <View style={styles.potRim} />
      <View style={styles.potBody}>
        <View style={styles.potBase} />
      </View>
    </View>
  );
}

export default function WelcomeScreen() {
  const router = useRouter();
  const [imageFailed, setImageFailed] = useState(false);
  const showRemote = Boolean(WELCOME_PLANT_IMAGE) && !imageFailed;

  return (
    <View style={styles.screen}>
      <StatusBar barStyle="light-content" translucent backgroundColor="transparent" />
      <BotanicalBackdrop tone="soft" />

      <View style={styles.heroArea}>
        {showRemote ? (
          <Image
            source={{ uri: WELCOME_PLANT_IMAGE }}
            style={styles.heroImage}
            resizeMode="contain"
            onError={() => setImageFailed(true)}
          />
        ) : (
          <PlantIllustration />
        )}
      </View>

      <View style={styles.bottomBlock}>
        <Text style={styles.title}>Selamat Datang</Text>
        <Text style={styles.subtitle}>
          Pindai tanaman, cek keamanan konsumsinya, dan telusuri jurnal ilmiah dalam satu aplikasi.
        </Text>

        <TouchableOpacity
          activeOpacity={0.9}
          style={styles.primaryBtn}
          onPress={() => router.replace('/(tabs)')}
        >
          <Ionicons name="sparkles" size={17} color={C.ink} />
          <Text style={styles.primaryBtnText}>Mulai Menjelajah</Text>
        </TouchableOpacity>

        <TouchableOpacity
          activeOpacity={0.85}
          style={styles.secondaryBtn}
          onPress={() => router.replace('/(tabs)/search')}
        >
          <Ionicons name="search-outline" size={17} color={C.mint} />
          <Text style={styles.secondaryBtnText}>Lihat Katalog Herbal</Text>
        </TouchableOpacity>

        <Text style={styles.footnote}>
          Informasi bersifat edukatif dan bukan pengganti saran tenaga medis.
        </Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: C.bgSoft },

  heroArea: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingTop: Platform.OS === 'android' ? 44 : 60,
  },
  heroImage: { width: 300, height: 300 },

  illustration: {
    width: 300,
    height: 320,
    alignItems: 'center',
    justifyContent: 'center',
  },
  haloRing: {
    position: 'absolute',
    borderRadius: 999,
    backgroundColor: C.leafSoft,
  },
  leafLeft: {
    position: 'absolute',
    top: 38,
    left: 26,
    transform: [{ rotate: '-28deg' }],
  },
  leafRight: {
    position: 'absolute',
    top: 52,
    right: 30,
    transform: [{ rotate: '24deg' }],
  },
  leafCenter: {
    position: 'absolute',
    top: 8,
    transform: [{ rotate: '-4deg' }],
  },
  potRim: {
    position: 'absolute',
    bottom: 80,
    width: 156,
    height: 22,
    borderRadius: 11,
    backgroundColor: '#F1EFE8',
  },
  potBody: {
    position: 'absolute',
    bottom: 12,
    width: 136,
    height: 76,
    borderBottomLeftRadius: 30,
    borderBottomRightRadius: 30,
    backgroundColor: '#E2DFD5',
    overflow: 'hidden',
    justifyContent: 'flex-end',
  },
  potBase: {
    height: 16,
    backgroundColor: '#4A3F3A',
  },

  bottomBlock: {
    paddingHorizontal: 24,
    paddingBottom: Platform.OS === 'ios' ? 42 : 30,
    alignItems: 'center',
  },
  title: {
    fontSize: 32,
    fontWeight: '700',
    color: C.white,
    letterSpacing: -0.5,
    textAlign: 'center',
  },
  subtitle: {
    marginTop: 10,
    marginBottom: 26,
    maxWidth: 320,
    fontSize: 14.5,
    lineHeight: 22,
    color: C.textSoft,
    textAlign: 'center',
  },
  primaryBtn: {
    width: '100%',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: C.white,
    paddingVertical: 16,
    borderRadius: R.pill,
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.28,
    shadowRadius: 14,
    elevation: 8,
  },
  primaryBtnText: { color: C.ink, fontSize: 15.5, fontWeight: '800' },
  secondaryBtn: {
    width: '100%',
    marginTop: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: C.glass,
    borderWidth: 1,
    borderColor: C.glassBorder,
    paddingVertical: 15,
    borderRadius: R.pill,
  },
  secondaryBtnText: { color: C.mint, fontSize: 15, fontWeight: '700' },
  footnote: {
    marginTop: 18,
    maxWidth: 300,
    fontSize: 11.5,
    lineHeight: 17,
    color: C.textFaint,
    textAlign: 'center',
  },
});
