import React, { useEffect, useRef, useState } from 'react';
import {
  Animated,
  Easing,
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
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import BotanicalBackdrop from '../components/BotanicalBackdrop';
import GlassView from '../components/GlassView';
import { useAuth } from '../contexts/AuthContext';
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

export default function WelcomeEntryScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const auth = useAuth() as any;
  const isReady = Boolean(auth?.isReady);
  const isLoggedIn = Boolean(auth?.user || auth?.token || auth?.isAuthenticated);

  const [splashDone, setSplashDone] = useState(false);
  const [imageFailed, setImageFailed] = useState(false);

  const logoScale = useRef(new Animated.Value(0.82)).current;
  const logoOpacity = useRef(new Animated.Value(0)).current;
  const textTranslateY = useRef(new Animated.Value(18)).current;
  const textOpacity = useRef(new Animated.Value(0)).current;
  const pulseRing = useRef(new Animated.Value(1)).current;
  const progressAnim = useRef(new Animated.Value(0)).current;
  const minDelayDone = useRef(false);

  useEffect(() => {
    Animated.parallel([
      Animated.spring(logoScale, {
        toValue: 1,
        friction: 6,
        tension: 95,
        useNativeDriver: true,
      }),
      Animated.timing(logoOpacity, {
        toValue: 1,
        duration: 600,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true,
      }),
      Animated.timing(textTranslateY, {
        toValue: 0,
        duration: 650,
        delay: 180,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true,
      }),
      Animated.timing(textOpacity, {
        toValue: 1,
        duration: 650,
        delay: 180,
        useNativeDriver: true,
      }),
    ]).start();

    const pulseLoop = Animated.loop(
      Animated.sequence([
        Animated.timing(pulseRing, {
          toValue: 1.09,
          duration: 1200,
          easing: Easing.inOut(Easing.sin),
          useNativeDriver: true,
        }),
        Animated.timing(pulseRing, {
          toValue: 1,
          duration: 1200,
          easing: Easing.inOut(Easing.sin),
          useNativeDriver: true,
        }),
      ])
    );
    pulseLoop.start();

    Animated.timing(progressAnim, {
      toValue: 1,
      duration: 1750,
      easing: Easing.inOut(Easing.cubic),
      useNativeDriver: false,
    }).start(() => {
      minDelayDone.current = true;
    });

    const timer = setTimeout(() => {
      minDelayDone.current = true;
    }, 1800);

    return () => {
      pulseLoop.stop();
      clearTimeout(timer);
    };
  }, [logoOpacity, logoScale, progressAnim, pulseRing, textOpacity, textTranslateY]);

  useEffect(() => {
    if (!isReady) return;
    const check = setInterval(() => {
      if (minDelayDone.current) {
        clearInterval(check);
        if (isLoggedIn) {
          router.replace('/(tabs)');
        } else {
          setSplashDone(true);
        }
      }
    }, 80);
    return () => clearInterval(check);
  }, [isReady, isLoggedIn, router]);

  // Otomatis arahkan ke Beranda jika pengguna baru saja selesai login/register dari halaman /auth
  useEffect(() => {
    if (splashDone && isLoggedIn) {
      router.replace('/(tabs)');
    }
  }, [splashDone, isLoggedIn, router]);

  const barWidth = progressAnim.interpolate({
    inputRange: [0, 1],
    outputRange: ['10%', '100%'],
  });

  // 1. SPLASH SCREEN
  if (!splashDone) {
    return (
      <View style={styles.splashScreen}>
        <StatusBar barStyle="light-content" translucent backgroundColor="transparent" />
        <BotanicalBackdrop />

        <View style={styles.centerContent}>
          <Animated.View
            style={[
              styles.emblemWrap,
              {
                opacity: logoOpacity,
                transform: [{ scale: logoScale }],
              },
            ]}
          >
            <Animated.View
              style={[
                styles.outerHalo,
                {
                  transform: [{ scale: pulseRing }],
                },
              ]}
            />
            <GlassView
              radius={38}
              intensity={55}
              fill="rgba(74, 222, 128, 0.16)"
              shadow
              style={styles.logoCard}
              contentStyle={styles.logoCardInner}
            >
              <Ionicons name="leaf" size={50} color={C.leaf} />
            </GlassView>
          </Animated.View>

          <Animated.View
            style={[
              styles.titleBlock,
              {
                opacity: textOpacity,
                transform: [{ translateY: textTranslateY }],
              },
            ]}
          >
            <View style={styles.pillTag}>
              <Ionicons name="sparkles" size={12} color={C.leaf} />
              <Text style={styles.pillTagText}>BOTANICAL AI & DOI MONOGRAPH</Text>
            </View>

            <Text style={styles.brandTitle}>
              Herbal<Text style={styles.brandTitleBold}>Scan</Text>
            </Text>

            <Text style={styles.brandSubtitle}>
              Identifikasi tanaman herbal secara presisi lengkap dengan kajian fitokimia & jurnal ilmiah
            </Text>
          </Animated.View>
        </View>

        <View style={styles.footerWrap}>
          <View style={styles.progressTrack}>
            <Animated.View style={[styles.progressFill, { width: barWidth }]} />
          </View>
          <Text style={styles.footerCaption}>Menyiapkan katalog botani...</Text>
        </View>
      </View>
    );
  }

  // 2. MENU AWAL (WELCOME SCREEN)
  const hasPlantImage = Boolean(WELCOME_PLANT_IMAGE) && !imageFailed;
  const plantImageSource =
    typeof WELCOME_PLANT_IMAGE === 'string'
      ? { uri: WELCOME_PLANT_IMAGE }
      : WELCOME_PLANT_IMAGE;

  return (
    <View style={styles.screen}>
      <StatusBar barStyle="light-content" translucent backgroundColor="transparent" />
      <BotanicalBackdrop tone="soft" />

      <View style={styles.heroArea}>
        {hasPlantImage && plantImageSource ? (
          <Image
            source={plantImageSource}
            style={styles.heroImage}
            resizeMode="contain"
            onError={() => setImageFailed(true)}
          />
        ) : (
          <PlantIllustration />
        )}
      </View>

      <View
        style={[
          styles.bottomBlock,
          { paddingBottom: Math.max(insets.bottom, 20) + 14 },
        ]}
      >
        <Text style={styles.title}>Selamat Datang</Text>
        <Text style={styles.subtitle}>
          Pindai tanaman, cek keamanan konsumsinya, dan telusuri jurnal ilmiah dalam satu aplikasi.
        </Text>

        <TouchableOpacity
          activeOpacity={0.9}
          style={styles.primaryBtn}
          onPress={() => router.push('/auth')}
        >
          <Ionicons name="person-circle-outline" size={20} color={C.ink} />
          <Text style={styles.primaryBtnText}>Masuk / Daftar Akun</Text>
        </TouchableOpacity>

        <TouchableOpacity
          activeOpacity={0.85}
          style={styles.secondaryBtn}
          onPress={() => router.replace('/(tabs)')}
        >
          <Ionicons name="compass-outline" size={19} color={C.mint} />
          <Text style={styles.secondaryBtnText}>Masuk Tanpa Akun</Text>
        </TouchableOpacity>

        <Text style={styles.footnote}>
          Informasi bersifat edukatif dan bukan pengganti saran tenaga medis.
        </Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  // Splash Screen
  splashScreen: {
    flex: 1,
    backgroundColor: C.bgSoft,
    justifyContent: 'space-between',
  },
  centerContent: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 32,
  },
  emblemWrap: {
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 28,
  },
  outerHalo: {
    position: 'absolute',
    width: 142,
    height: 142,
    borderRadius: 46,
    borderWidth: 1.5,
    borderColor: 'rgba(74, 222, 128, 0.34)',
    backgroundColor: 'rgba(74, 222, 128, 0.06)',
  },
  logoCard: {
    width: 112,
    height: 112,
  },
  logoCardInner: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  titleBlock: {
    alignItems: 'center',
  },
  pillTag: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: 'rgba(74, 222, 128, 0.14)',
    borderWidth: 1,
    borderColor: 'rgba(134, 239, 172, 0.32)',
    paddingHorizontal: 13,
    paddingVertical: 6,
    borderRadius: R.pill,
    marginBottom: 14,
  },
  pillTagText: {
    color: C.leafSoft,
    fontSize: 10.5,
    fontWeight: '800',
    letterSpacing: 0.8,
  },
  brandTitle: {
    fontSize: 40,
    fontWeight: '300',
    color: C.white,
    letterSpacing: -0.8,
  },
  brandTitleBold: {
    fontWeight: '800',
    color: C.leaf,
  },
  brandSubtitle: {
    marginTop: 10,
    fontSize: 13.5,
    color: C.textSoft,
    textAlign: 'center',
    lineHeight: 20,
    maxWidth: 300,
  },
  footerWrap: {
    paddingHorizontal: 48,
    paddingBottom: 52,
    alignItems: 'center',
    gap: 10,
  },
  progressTrack: {
    width: '100%',
    height: 5,
    borderRadius: 3,
    backgroundColor: 'rgba(255, 255, 255, 0.14)',
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    borderRadius: 3,
    backgroundColor: C.leaf,
  },
  footerCaption: {
    fontSize: 12,
    color: C.textFaint,
    fontWeight: '600',
  },

  // Welcome Screen (Menu Awal)
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