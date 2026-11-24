import React, { useEffect, useRef, useState } from 'react';
import {
  Animated,
  Dimensions,
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

// Logo aplikasi (ganti file ini jika ingin logo lain)
const HERBAL_LOGO = require('../assets/herbal_icon.png');

/** Daun kecil yang melayang naik perlahan di latar splash (dekorasi). */
function LeafParticle({ x, size, delay, duration }: { x: number; size: number; delay: number; duration: number }) {
  const p = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.delay(delay),
        Animated.timing(p, { toValue: 1, duration, easing: Easing.linear, useNativeDriver: true }),
        Animated.timing(p, { toValue: 0, duration: 0, useNativeDriver: true }),
      ])
    );
    loop.start();
    return () => loop.stop();
  }, [p, delay, duration]);

  const H = Dimensions.get('window').height;
  return (
    <Animated.View
      pointerEvents="none"
      style={{
        position: 'absolute',
        left: x,
        bottom: -30,
        opacity: p.interpolate({ inputRange: [0, 0.15, 0.8, 1], outputRange: [0, 0.38, 0.3, 0] }),
        transform: [
          { translateY: p.interpolate({ inputRange: [0, 1], outputRange: [0, -H * 0.75] }) },
          { translateX: p.interpolate({ inputRange: [0, 0.5, 1], outputRange: [0, 18, -10] }) },
          { rotate: p.interpolate({ inputRange: [0, 1], outputRange: ['-20deg', '40deg'] }) },
        ],
      }}
    >
      <Ionicons name="leaf" size={size} color={C.leafSoft} />
    </Animated.View>
  );
}

function FloatingLeaves() {
  const W = Dimensions.get('window').width;
  const items = [
    { x: W * 0.08, size: 18, delay: 0, duration: 7200 },
    { x: W * 0.26, size: 26, delay: 1800, duration: 8600 },
    { x: W * 0.46, size: 16, delay: 900, duration: 6800 },
    { x: W * 0.64, size: 24, delay: 2600, duration: 8200 },
    { x: W * 0.82, size: 18, delay: 1300, duration: 7600 },
    { x: W * 0.92, size: 14, delay: 3400, duration: 6400 },
  ];
  return (
    <View pointerEvents="none" style={StyleSheet.absoluteFill}>
      {items.map((it, i) => (
        <LeafParticle key={i} {...it} />
      ))}
    </View>
  );
}

const LOADING_MESSAGES = [
  'Menyiapkan katalog botani...',
  'Memuat data fitokimia & jurnal...',
  'Menyelaraskan pemindai tanaman...',
  'Hampir siap...',
];

function RotatingCaption() {
  const [i, setI] = useState(0);
  useEffect(() => {
    const t = setInterval(() => setI((p) => Math.min(p + 1, LOADING_MESSAGES.length - 1)), 650);
    return () => clearInterval(t);
  }, []);
  return <Text style={styles.footerCaption}>{LOADING_MESSAGES[i]}</Text>;
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
        <FloatingLeaves />

        <View style={styles.centerContent}>
          <View style={styles.emblemWrap}>
            <Image source={HERBAL_LOGO} resizeMode="contain" style={styles.logoImg} />
          </View>

          <Animated.View
            style={[
              styles.titleBlock,
              { opacity: textOpacity, transform: [{ translateY: textTranslateY }] },
            ]}
          >
            <Text style={styles.brandTitle}>
              Herbal<Text style={styles.brandTitleBold}>Scan</Text>
            </Text>

            <View style={styles.pillTag}>
              <Ionicons name="sparkles" size={12} color={C.leaf} />
              <Text style={styles.pillTagText}>BOTANICAL AI & DOI MONOGRAPH</Text>
            </View>

            <Text style={styles.brandSubtitle}>
              Identifikasi tanaman herbal secara presisi lengkap dengan kajian fitokimia & jurnal ilmiah
            </Text>
          </Animated.View>
        </View>

        <View style={styles.footerWrap}>
          <GlassView radius={R.pill} intensity={40} style={styles.progressGlass} contentStyle={styles.progressGlassInner}>
            <Animated.View style={[styles.progressFill, { width: barWidth }]} />
          </GlassView>
          <RotatingCaption />
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
        <Image
          source={hasPlantImage && plantImageSource ? plantImageSource : HERBAL_LOGO}
          style={styles.heroImage}
          resizeMode="contain"
          onError={() => setImageFailed(true)}
        />
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
  splashScreen: { flex: 1, backgroundColor: C.bgSoft, justifyContent: 'space-between' },
  centerContent: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 32 },
  emblemWrap: { alignItems: 'center', justifyContent: 'center', marginBottom: 22 },
  logoImg: { width: 210, height: 210 },
  titleBlock: { alignItems: 'center' },
  brandTitle: { fontSize: 42, fontWeight: '700', color: C.white, letterSpacing: -1 },
  brandTitleBold: { fontWeight: '800', color: C.leaf },
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
    marginTop: 12,
  },
  pillTagText: { color: C.leafSoft, fontSize: 10.5, fontWeight: '800', letterSpacing: 0.8 },
  brandSubtitle: {
    marginTop: 14,
    fontSize: 13.5,
    color: C.textSoft,
    textAlign: 'center',
    lineHeight: 20,
    maxWidth: 300,
  },
  footerWrap: { paddingHorizontal: 56, paddingBottom: 56, alignItems: 'center', gap: 12 },
  progressGlass: { width: '100%', height: 8 },
  progressGlassInner: { flex: 1, justifyContent: 'center' },
  progressFill: { height: '100%', borderRadius: 4, backgroundColor: C.leaf },
  footerCaption: { fontSize: 12, color: C.textFaint, fontWeight: '600' },

  // Welcome Screen (Menu Awal)
  screen: { flex: 1, backgroundColor: C.bgSoft },

  heroArea: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingTop: Platform.OS === 'android' ? 44 : 60,
  },
  heroImage: { width: 290, height: 290 },

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