import AsyncStorage from "@react-native-async-storage/async-storage";
import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Animated,
  Easing,
  Image,
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  TouchableOpacity,
  useWindowDimensions,
  View,
} from 'react-native';
import { CameraView, useCameraPermissions } from 'expo-camera';
import * as ImagePicker from 'expo-image-picker';
import { useFocusEffect, useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { classifyImage, DetectedPlantItem } from '../../services/classifier';
import BotanicalBackdrop from '../../components/BotanicalBackdrop';
import GlassView from '../../components/GlassView';
import { useTabBarTop } from '../../components/tabBarMetrics';
import { C, R, SCREEN_TOP_PAD, TAB_BAR } from '../../constants/herbalTheme';

let ImageManipulator: any = null;
try {
  ImageManipulator = require('expo-image-manipulator');
} catch {
  ImageManipulator = null;
}

const BOX_PALETTE = [
  { border: '#4ade80', bg: 'rgba(74, 222, 128, 0.18)', badge: '#15803d' },
  { border: '#38bdf8', bg: 'rgba(56, 189, 248, 0.18)', badge: '#0369a1' },
  { border: '#fbbf24', bg: 'rgba(251, 191, 36, 0.18)', badge: '#b45309' },
  { border: '#c084fc', bg: 'rgba(192, 132, 252, 0.18)', badge: '#7e22ce' },
  { border: '#fb7185', bg: 'rgba(251, 113, 133, 0.18)', badge: '#be123c' },
];

const TOXIC_COLOR = {
  border: '#ef4444',
  bg: 'rgba(239, 68, 68, 0.22)',
  badge: '#b91c1c',
};

const SCAN_STEPS = [
  {
    title: 'Menganalisis Morfologi Daun...',
    sub: 'Memetakan bentuk helai, pertulangan, & struktur tangkai',
  },
  {
    title: 'Mencocokkan Taksonomi Spesies...',
    sub: 'Memvalidasi identitas botani & potensi toksisitas',
  },
  {
    title: 'Menyiapkan Monograf Herbal...',
    sub: 'Menyusun ringkasan khasiat & profil tanaman',
  },
];

function ReticleLaser({ size }: { size: number }) {
  const y = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(y, { toValue: 1, duration: 1800, easing: Easing.inOut(Easing.sin), useNativeDriver: true }),
        Animated.timing(y, { toValue: 0, duration: 1800, easing: Easing.inOut(Easing.sin), useNativeDriver: true }),
      ])
    );
    loop.start();
    return () => loop.stop();
  }, [y]);
  const translateY = y.interpolate({ inputRange: [0, 1], outputRange: [size * 0.14, size * 0.86] });
  return (
    <Animated.View style={[styles.laserLine, { transform: [{ translateY }] }]}>
      <View style={styles.laserLineDot} />
      <View style={styles.laserLineBar} />
    </Animated.View>
  );
}


let PersistentFS: any = null;
try { PersistentFS = require("expo-file-system/legacy"); } catch { try { PersistentFS = require("expo-file-system"); } catch { PersistentFS = null; } }

const saveLocalScanPhoto = async (slug: string, uri: string) => {
  if (!slug || !uri) return;
  try {
    let savedPath = uri;
    if (PersistentFS?.documentDirectory && !uri.startsWith("http") && !uri.startsWith("data:")) {
      let sourceUri = uri;
      if (ImageManipulator?.manipulateAsync) {
        const thumb = await ImageManipulator.manipulateAsync(
          uri,
          [{ resize: { width: 420 } }],
          { compress: 0.78, format: ImageManipulator.SaveFormat?.JPEG ?? "jpeg" }
        );
        if (thumb?.uri) sourceUri = thumb.uri;
      }
      const safeSlug = slug.replace(/[^a-z0-9_-]/gi, "_");
      const destUri = `${PersistentFS.documentDirectory}herbal_scan_${safeSlug}.jpg`;
      await PersistentFS.copyAsync({ from: sourceUri, to: destUri });
      savedPath = destUri;
    }
    const raw = await AsyncStorage.getItem("herbal_local_scan_photos");
    const map = raw ? JSON.parse(raw) : {};
    map[slug] = savedPath;
    await AsyncStorage.setItem("herbal_local_scan_photos", JSON.stringify(map));
  } catch {}
};

export default function ScanScreen() {
  const router = useRouter();
  const { width: screenWidth, height: screenHeight } = useWindowDimensions();
  const cameraRef = useRef<CameraView>(null);
  const [permission, requestPermission] = useCameraPermissions();

  const [isScreenFocused, setIsScreenFocused] = useState(true);
  const [flashOn, setFlashOn] = useState(false);
  const [photoUri, setPhotoUri] = useState<string | null>(null);

  const [analyzing, setAnalyzing] = useState(false);
  const [stepIdx, setStepIdx] = useState(0);
  const [rejectNotice, setRejectNotice] = useState<string | null>(null);

  const [detectedPlants, setDetectedPlants] = useState<DetectedPlantItem[]>([]);
  const [detectedFrameUrl, setDetectedFrameUrl] = useState<string | null>(null);
  const [selectedBoxIdx, setSelectedBoxIdx] = useState<number>(0);

  const [pictureSize, setPictureSize] = useState<string | undefined>(undefined);
  const [cameraBox, setCameraBox] = useState<{ width: number; height: number }>({
    width: screenWidth,
    height: screenHeight,
  });

  const handleCameraReady = useCallback(async () => {
    try {
      const sizes = await cameraRef.current?.getAvailablePictureSizesAsync?.();
      if (!sizes || sizes.length === 0) return;

      const targetRatio = cameraBox.height / Math.max(1, cameraBox.width);
      let bestSize = sizes[0];
      let bestScore = Number.POSITIVE_INFINITY;

      for (const s of sizes) {
        const [wStr, hStr] = s.split('x');
        const w = Number(wStr);
        const h = Number(hStr);
        if (!w || !h) continue;
        const longSide = Math.max(w, h);
        const shortSide = Math.min(w, h);
        const ratio = longSide / shortSide;
        const ratioDiff = Math.abs(ratio - targetRatio);
        // Prioritaskan rasio mendekati layar dengan resolusi ~1080p-2K agar cepat & presisi
        const resPenalty = Math.abs(longSide - 1920) / 4000;
        const score = ratioDiff * 10 + resPenalty;
        if (score < bestScore) {
          bestScore = score;
          bestSize = s;
        }
      }
      setPictureSize(bestSize);
    } catch {
      // Gunakan ukuran default perangkat
    }
  }, [cameraBox.width, cameraBox.height]);

  const outerRingSpin = useRef(new Animated.Value(0)).current;
  const innerRingSpin = useRef(new Animated.Value(0)).current;
  const laserSweepY = useRef(new Animated.Value(0)).current;
  const sonarScale = useRef(new Animated.Value(0.75)).current;
  const sonarOpacity = useRef(new Animated.Value(0.8)).current;
  const leafPulse = useRef(new Animated.Value(1)).current;
  const progressBar = useRef(new Animated.Value(0)).current;

  const flashScale = useRef(new Animated.Value(1)).current;
  const flashPulse = useRef(new Animated.Value(1)).current;

  const reticleSize = Math.round(screenWidth * 0.76);
  const reticleLeft = Math.round((screenWidth - reticleSize) / 2);
  const reticleTop = Math.max(
    108,
    Math.round((screenHeight - reticleSize) / 2 - 44)
  );

  useFocusEffect(
    useCallback(() => {
      setIsScreenFocused(true);
      return () => {
        setIsScreenFocused(false);
        setFlashOn(false);
      };
    }, [])
  );

  useEffect(() => {
    if (!flashOn) {
      flashPulse.setValue(1);
      return;
    }

    const glowLoop = Animated.loop(
      Animated.sequence([
        Animated.timing(flashPulse, {
          toValue: 1.15,
          duration: 650,
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: true,
        }),
        Animated.timing(flashPulse, {
          toValue: 1,
          duration: 650,
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: true,
        }),
      ])
    );

    glowLoop.start();
    return () => glowLoop.stop();
  }, [flashOn, flashPulse]);

  useEffect(() => {
    if (!analyzing) {
      outerRingSpin.setValue(0);
      innerRingSpin.setValue(0);
      laserSweepY.setValue(0);
      sonarScale.setValue(0.75);
      sonarOpacity.setValue(0.8);
      leafPulse.setValue(1);
      progressBar.setValue(0);
      setStepIdx(0);
      return;
    }

    const outerSpinLoop = Animated.loop(
      Animated.timing(outerRingSpin, {
        toValue: 1,
        duration: 4200,
        easing: Easing.linear,
        useNativeDriver: true,
      })
    );

    const innerSpinLoop = Animated.loop(
      Animated.timing(innerRingSpin, {
        toValue: 1,
        duration: 2800,
        easing: Easing.linear,
        useNativeDriver: true,
      })
    );

    const laserLoop = Animated.loop(
      Animated.sequence([
        Animated.timing(laserSweepY, {
          toValue: 1,
          duration: 1200,
          easing: Easing.inOut(Easing.sin),
          useNativeDriver: true,
        }),
        Animated.timing(laserSweepY, {
          toValue: 0,
          duration: 1200,
          easing: Easing.inOut(Easing.sin),
          useNativeDriver: true,
        }),
      ])
    );

    const sonarLoop = Animated.loop(
      Animated.parallel([
        Animated.timing(sonarScale, {
          toValue: 1.55,
          duration: 1450,
          easing: Easing.out(Easing.cubic),
          useNativeDriver: true,
        }),
        Animated.timing(sonarOpacity, {
          toValue: 0,
          duration: 1450,
          easing: Easing.out(Easing.cubic),
          useNativeDriver: true,
        }),
      ])
    );

    const leafPulseLoop = Animated.loop(
      Animated.sequence([
        Animated.timing(leafPulse, {
          toValue: 1.14,
          duration: 750,
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: true,
        }),
        Animated.timing(leafPulse, {
          toValue: 1,
          duration: 750,
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: true,
        }),
      ])
    );

    Animated.timing(progressBar, {
      toValue: 0.92,
      duration: 3600,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: false,
    }).start();

    outerSpinLoop.start();
    innerSpinLoop.start();
    laserLoop.start();
    sonarLoop.start();
    leafPulseLoop.start();

    const timer = setInterval(() => {
      setStepIdx((prev) => (prev < SCAN_STEPS.length - 1 ? prev + 1 : prev));
    }, 1150);

    return () => {
      outerSpinLoop.stop();
      innerSpinLoop.stop();
      laserLoop.stop();
      sonarLoop.stop();
      leafPulseLoop.stop();
      clearInterval(timer);
    };
  }, [
    analyzing,
    outerRingSpin,
    innerRingSpin,
    laserSweepY,
    sonarScale,
    sonarOpacity,
    leafPulse,
    progressBar,
  ]);

  const handleToggleFlash = () => {
    Animated.sequence([
      Animated.timing(flashScale, {
        toValue: 0.84,
        duration: 90,
        useNativeDriver: true,
      }),
      Animated.spring(flashScale, {
        toValue: 1,
        friction: 4,
        tension: 180,
        useNativeDriver: true,
      }),
    ]).start();

    setFlashOn((prev) => !prev);
  };

  const resetPreview = () => {
    setPhotoUri(null);
    setRejectNotice(null);
    setDetectedPlants([]);
    setDetectedFrameUrl(null);
    setSelectedBoxIdx(0);
  };

  const cropExactReticleSquare = async (
    uri: string,
    matchScreenReticle: boolean
  ): Promise<string> => {
    if (!ImageManipulator?.manipulateAsync) {
      return uri;
    }

    try {
      // 1. Bake rotasi EXIF Android agar width & height sesuai tampilan portrait sebenarnya
      const normalized = await ImageManipulator.manipulateAsync(uri, [], {
        compress: 1,
        format: ImageManipulator.SaveFormat?.JPEG ?? 'jpeg',
      });

      const workUri = normalized?.uri || uri;
      const imgW = normalized?.width || 0;
      const imgH = normalized?.height || 0;
      const actions: any[] = [];

      const viewW = cameraBox.width || screenWidth;
      const viewH = cameraBox.height || screenHeight;

      if (matchScreenReticle && imgW > 0 && imgH > 0 && viewW > 0 && viewH > 0) {
        const imgAspect = imgW / imgH;
        const viewAspect = viewW / viewH;

        let scale = 1;
        let visibleOriginX = 0;
        let visibleOriginY = 0;

        if (imgAspect > viewAspect) {
          scale = imgH / viewH;
          const visibleImgW = viewW * scale;
          visibleOriginX = (imgW - visibleImgW) / 2;
        } else {
          scale = imgW / viewW;
          const visibleImgH = viewH * scale;
          visibleOriginY = (imgH - visibleImgH) / 2;
        }

        const rawSide = Math.round(reticleSize * scale);
        const safeSide = Math.min(rawSide, imgW, imgH);
        const originX = Math.max(
          0,
          Math.min(imgW - safeSide, Math.round(visibleOriginX + reticleLeft * scale))
        );
        const originY = Math.max(
          0,
          Math.min(imgH - safeSide, Math.round(visibleOriginY + reticleTop * scale))
        );

        actions.push({
          crop: {
            originX,
            originY,
            width: safeSide,
            height: safeSide,
          },
        });
      }

      actions.push({ resize: { width: 896 } });

      const manipulated = await ImageManipulator.manipulateAsync(workUri, actions, {
        compress: 0.82,
        format: ImageManipulator.SaveFormat?.JPEG ?? 'jpeg',
      });

      return manipulated?.uri || workUri;
    } catch {
      return uri;
    }
  };

  const handleCapture = async () => {
    if (!cameraRef.current || analyzing) return;
    setRejectNotice(null);
    setDetectedPlants([]);
    try {
      const shot = await cameraRef.current.takePictureAsync({
        quality: 0.85,
        shutterSound: false,
        skipProcessing: false,
      });
      if (shot?.uri) {
        const matchedSquareUri = await cropExactReticleSquare(shot.uri, true);
        setPhotoUri(matchedSquareUri);
      }
    } catch {
      setRejectNotice('Gagal mengambil gambar dari kamera. Silakan coba lagi.');
    }
  };

  const handlePickGallery = async () => {
    if (analyzing) return;
    setRejectNotice(null);
    setDetectedPlants([]);

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.85,
    });

    if (!result.canceled && result.assets?.[0]?.uri) {
      const croppedUri = await cropExactReticleSquare(result.assets[0].uri, false);
      setPhotoUri(croppedUri);
    }
  };

  const handleIdentify = async () => {
    if (!photoUri || analyzing) return;
    setAnalyzing(true);
    setRejectNotice(null);

    try {
      const data = await classifyImage(photoUri);

      if (!data.is_herbal || data.mode === 'rejected' || data.plants.length === 0) {
        setRejectNotice(
          data.message ||
            'Objek tidak dapat diidentifikasi sebagai tumbuhan segar. Pastikan daun/batang segar terlihat jelas.'
        );
        return;
      }

      if (data.plants.length > 1) {
        setDetectedPlants(data.plants);
        setDetectedFrameUrl(data.scan_image_url || photoUri);
        setSelectedBoxIdx(0);
        return;
      }

      const single = data.plants[0];
      const resolvedPhoto = single.scan_image_url || data.scan_image_url || photoUri;
      await saveLocalScanPhoto(single.slug, photoUri);

      router.push({
        pathname: '/detail/[slug]',
        params: {
          slug: single.slug,
          scannedImage: resolvedPhoto,
          confidence: String(single.confidence),
        },
      } as any);
    } catch (err: any) {
      const errMsg =
        err?.response?.data?.message ||
        err?.message ||
        'Gagal terhubung ke server analisis. Periksa koneksi internet Anda.';
      setRejectNotice(errMsg);
    } finally {
      setAnalyzing(false);
    }
  };

  const openDetectedPlantDetail = (plant: DetectedPlantItem) => {
    const resolvedPhoto = plant.scan_image_url || detectedFrameUrl || photoUri || '';
    if (photoUri) { saveLocalScanPhoto(plant.slug, photoUri); }
    router.push({
      pathname: '/detail/[slug]',
      params: {
        slug: plant.slug,
        scannedImage: resolvedPhoto,
        confidence: String(plant.confidence),
      },
    } as any);
  };

  const screenRef = useRef<View>(null);
  const [sceneH, setSceneH] = useState(0);
  const [sceneBottomY, setSceneBottomY] = useState<number | null>(null);
  const barTopY = useTabBarTop();
  const handleSceneLayout = (e: any) => {
    setSceneH(e.nativeEvent.layout.height);
    screenRef.current?.measureInWindow((_x: number, y: number, _w: number, h: number) =>
      setSceneBottomY(y + h)
    );
  };

  if (!permission) {
    return (
      <View style={styles.centerScreen}>
        <StatusBar barStyle="light-content" translucent backgroundColor="transparent" />
        <ActivityIndicator size="large" color="#4ade80" />
      </View>
    );
  }

  if (!permission.granted) {
    return (
      <View style={styles.centerScreen}>
        <StatusBar barStyle="light-content" translucent backgroundColor="transparent" />
        <BotanicalBackdrop tone="soft" />
        <View style={styles.permIconCircle}>
          <Ionicons name="camera" size={38} color="#4ade80" />
        </View>
        <Text style={styles.permTitle}>Izin Kamera Diperlukan</Text>
        <Text style={styles.permSub}>
          HerbalScan membutuhkan akses kamera untuk memindai daun, batang, dan bunga tumbuhan secara langsung.
        </Text>
        <TouchableOpacity style={styles.permBtn} onPress={requestPermission}>
          <Text style={styles.permBtnText}>Izinkan Kamera</Text>
        </TouchableOpacity>
      </View>
    );
  }

  const isMultiAnnotatedMode = detectedPlants.length > 1;
  const activeStep = SCAN_STEPS[stepIdx] || SCAN_STEPS[0];
  const outerRotate = outerRingSpin.interpolate({
    inputRange: [0, 1],
    outputRange: ['0deg', '360deg'],
  });
  const innerRotate = innerRingSpin.interpolate({
    inputRange: [0, 1],
    outputRange: ['360deg', '0deg'],
  });
  const barWidth = progressBar.interpolate({
    inputRange: [0, 1],
    outputRange: ['12%', '100%'],
  });
  const previewCardSize = Math.round(screenWidth - 36);

  const barClearance =
    sceneBottomY != null && barTopY != null
      ? Math.max(sceneBottomY - barTopY, 0)
      : TAB_BAR.bottom + TAB_BAR.height;
  const dockBottomGap = barClearance + 14;
  const viewH = sceneH || screenHeight;

  const cardSize = Math.max(
    220,
    Math.min(previewCardSize, viewH - (SCREEN_TOP_PAD + 52) - 226 - dockBottomGap)
  );
  const laserTravel = laserSweepY.interpolate({
    inputRange: [0, 1],
    outputRange: [-48, cardSize - 48],
  });
  const cornerScale = leafPulse.interpolate({
    inputRange: [1, 1.14],
    outputRange: [1, 0.95],
  });

  // Ukuran dan koordinat pasti titik tengah kotak 1:1 untuk animasi radar
  const SONAR_SIZE = 120;
  const OUTER_RING_SIZE = 132;
  const INNER_RING_SIZE = 98;
  const CORE_BADGE_SIZE = 64;

  const freeBelowReticle = viewH - dockBottomGap - (reticleTop + reticleSize);

  const SCAN_NODES = [
    { x: 0.24, y: 0.26 },
    { x: 0.7, y: 0.22 },
    { x: 0.46, y: 0.42 },
    { x: 0.3, y: 0.6 },
    { x: 0.76, y: 0.58 },
    { x: 0.56, y: 0.78 },
    { x: 0.2, y: 0.8 },
  ];

  return (
    <View ref={screenRef} onLayout={handleSceneLayout} style={styles.screen}>
      <StatusBar barStyle="light-content" translucent backgroundColor="transparent" />

      {photoUri ? (
        <View style={styles.previewContainer}>
          <BotanicalBackdrop tone="deep" />

          {/* Bilah atas */}
          <View style={styles.topBarFlow}>
            <TouchableOpacity activeOpacity={0.85} onPress={resetPreview} disabled={analyzing}>
              <GlassView radius={22} intensity={45} style={styles.circleGlass} contentStyle={styles.circleInner}>
                <Ionicons name="arrow-back" size={21} color="#ffffff" />
              </GlassView>
            </TouchableOpacity>

            <GlassView radius={22} intensity={45} contentStyle={styles.pillInner}>
              <Ionicons
                name={analyzing ? 'sparkles' : isMultiAnnotatedMode ? 'layers' : 'leaf'}
                size={14}
                color="#4ade80"
              />
              <Text style={styles.pillText}>
                {analyzing
                  ? 'Menganalisis Spesimen'
                  : isMultiAnnotatedMode
                  ? `${detectedPlants.length} Spesimen Terdeteksi`
                  : 'Pratinjau Spesimen 1:1'}
              </Text>
            </GlassView>

            <View style={{ width: 44 }} />
          </View>

          {/* Foto 1:1 di tengah */}
          <View style={styles.previewCenterArea}>
            <View
              style={[
                styles.cardShadow,
                { width: cardSize, height: cardSize },
                analyzing && styles.cardShadowActive,
              ]}
            >
              <View style={styles.previewSquareCard}>
                <Image source={{ uri: photoUri }} style={styles.fullMedia} resizeMode="cover" />

                {isMultiAnnotatedMode &&
                  !analyzing &&
                  detectedPlants.map((plant, idx) => {
                    const box = plant.box_2d;
                    if (!box || box.length < 4) return null;

                    const [ymin, xmin, ymax, xmax] = box;
                    const palette = plant.is_toxic
                      ? TOXIC_COLOR
                      : BOX_PALETTE[idx % BOX_PALETTE.length];

                    const left = (xmin / 1000) * cardSize;
                    const top = (ymin / 1000) * cardSize;
                    const width = Math.max(44, ((xmax - xmin) / 1000) * cardSize);
                    const height = Math.max(44, ((ymax - ymin) / 1000) * cardSize);

                    const isSelected = selectedBoxIdx === idx;
                    const labelAbove = top > 34;

                    return (
                      <TouchableOpacity
                        key={`bbox-${plant.slug}-${idx}`}
                        activeOpacity={0.85}
                        onPress={() => {
                          setSelectedBoxIdx(idx);
                          openDetectedPlantDetail(plant);
                        }}
                        style={[
                          styles.cvBoundingBox,
                          {
                            left,
                            top,
                            width,
                            height,
                            borderColor: palette.border,
                            backgroundColor: isSelected ? palette.bg : 'transparent',
                            borderWidth: isSelected ? 3 : 2,
                            zIndex: isSelected ? 20 : 12,
                          },
                        ]}
                      >
                        <View
                          style={[
                            styles.cvLabelPill,
                            labelAbove ? styles.cvLabelAbove : styles.cvLabelInside,
                            { backgroundColor: palette.badge },
                          ]}
                        >
                          <Text style={styles.cvLabelText} numberOfLines={1}>
                            #{idx + 1} {plant.name} • {plant.confidence}%
                          </Text>
                        </View>
                      </TouchableOpacity>
                    );
                  })}

                {analyzing && (
                  <View
                    pointerEvents="none"
                    style={{ position: 'absolute', top: 0, left: 0, width: cardSize, height: cardSize }}
                  >
                    <View style={styles.scanDim} />

                    <View style={[styles.gridLineV, { left: '33.3%' }]} />
                    <View style={[styles.gridLineV, { left: '66.6%' }]} />
                    <View style={[styles.gridLineH, { top: '33.3%' }]} />
                    <View style={[styles.gridLineH, { top: '66.6%' }]} />

                    <Animated.View
                      style={[
                        { position: 'absolute', top: 0, left: 0, width: cardSize, height: cardSize },
                        { transform: [{ scale: cornerScale }] },
                      ]}
                    >
                      <View style={[styles.scanCorner, styles.scTL]} />
                      <View style={[styles.scanCorner, styles.scTR]} />
                      <View style={[styles.scanCorner, styles.scBL]} />
                      <View style={[styles.scanCorner, styles.scBR]} />
                    </Animated.View>

                    {SCAN_NODES.map((n, i) => {
                      const lo = Math.max(0, n.y - 0.16);
                      const hi = Math.min(1, n.y + 0.16);
                      const nodeOpacity = laserSweepY.interpolate({
                        inputRange: [lo, n.y, hi],
                        outputRange: [0.2, 1, 0.2],
                        extrapolate: 'clamp',
                      });
                      const nodeScale = laserSweepY.interpolate({
                        inputRange: [lo, n.y, hi],
                        outputRange: [0.75, 1.3, 0.75],
                        extrapolate: 'clamp',
                      });
                      return (
                        <Animated.View
                          key={`node-${i}`}
                          style={[
                            styles.node,
                            {
                              left: n.x * cardSize - 13,
                              top: n.y * cardSize - 13,
                              opacity: nodeOpacity,
                              transform: [{ scale: nodeScale }],
                            },
                          ]}
                        >
                          <View style={styles.nodeRing} />
                          <View style={styles.nodeDot} />
                        </Animated.View>
                      );
                    })}

                    <Animated.View
                      style={[styles.laserWrap, { transform: [{ translateY: laserTravel }] }]}
                    >
                      {Array.from({ length: 10 }, (_, i) => {
                        const h = 96 * (1 - i / 10);
                        return (
                          <View
                            key={`lb-${i}`}
                            style={{
                              position: 'absolute',
                              left: 0,
                              right: 0,
                              top: (96 - h) / 2,
                              height: h,
                              backgroundColor: 'rgba(74, 222, 128, 0.04)',
                            }}
                          />
                        );
                      })}
                      <View style={styles.laserCore} />
                      <View style={styles.laserTickL} />
                      <View style={styles.laserTickR} />
                    </Animated.View>

                    {/* Radar & Cincin Putar Presisi di Tengah Kotak Foto */}
                    <Animated.View
                      style={[
                        styles.sonarRing,
                        {
                          width: SONAR_SIZE,
                          height: SONAR_SIZE,
                          borderRadius: SONAR_SIZE / 2,
                          top: (cardSize - SONAR_SIZE) / 2,
                          left: (cardSize - SONAR_SIZE) / 2,
                          opacity: sonarOpacity,
                          transform: [{ scale: sonarScale }],
                        },
                      ]}
                    />

                    <Animated.View
                      style={[
                        styles.arcOuter,
                        {
                          width: OUTER_RING_SIZE,
                          height: OUTER_RING_SIZE,
                          borderRadius: OUTER_RING_SIZE / 2,
                          top: (cardSize - OUTER_RING_SIZE) / 2,
                          left: (cardSize - OUTER_RING_SIZE) / 2,
                          transform: [{ rotate: outerRotate }],
                        },
                      ]}
                    >
                      <View style={styles.orbitDot} />
                    </Animated.View>

                    <Animated.View
                      style={[
                        styles.arcInner,
                        {
                          width: INNER_RING_SIZE,
                          height: INNER_RING_SIZE,
                          borderRadius: INNER_RING_SIZE / 2,
                          top: (cardSize - INNER_RING_SIZE) / 2,
                          left: (cardSize - INNER_RING_SIZE) / 2,
                          transform: [{ rotate: innerRotate }],
                        },
                      ]}
                    />

                    <Animated.View
                      style={{
                        position: 'absolute',
                        width: CORE_BADGE_SIZE,
                        height: CORE_BADGE_SIZE,
                        top: (cardSize - CORE_BADGE_SIZE) / 2,
                        left: (cardSize - CORE_BADGE_SIZE) / 2,
                        transform: [{ scale: leafPulse }],
                      }}
                    >
                      <GlassView
                        radius={CORE_BADGE_SIZE / 2}
                        intensity={40}
                        fill="rgba(74, 222, 128, 0.24)"
                        style={{ width: CORE_BADGE_SIZE, height: CORE_BADGE_SIZE }}
                        contentStyle={styles.circleInner}
                      >
                        <Ionicons name="leaf" size={28} color="#4ade80" />
                      </GlassView>
                    </Animated.View>
                  </View>
                )}
              </View>
            </View>

            {rejectNotice && !analyzing && (
              <GlassView
                radius={22}
                intensity={40}
                fill="rgba(239, 68, 68, 0.22)"
                style={{ width: cardSize, marginTop: 14 }}
                contentStyle={styles.rejectInner}
              >
                <Ionicons name="alert-circle" size={20} color="#fecaca" />
                <Text style={styles.rejectText}>{rejectNotice}</Text>
              </GlassView>
            )}
          </View>

          {analyzing ? (
            <GlassView
              radius={32}
              intensity={55}
              fill="rgba(255, 255, 255, 0.08)"
              style={[styles.bottomBlock, { marginBottom: dockBottomGap }]}
              contentStyle={styles.statusInner}
            >
              <View style={styles.scanPhaseRow}>
                <View style={styles.liveDot} />
                <Text style={styles.scanPhaseLabel}>
                  Tahap {stepIdx + 1} dari {SCAN_STEPS.length}
                </Text>
              </View>

              <Text style={styles.scanStatusTitle}>{activeStep.title}</Text>
              <Text style={styles.scanStatusSub}>{activeStep.sub}</Text>

              <View style={styles.progressTrack}>
                <Animated.View style={[styles.progressFill, { width: barWidth }]} />
              </View>

              <View style={styles.stepsRow}>
                {SCAN_STEPS.map((_: any, i: number) => {
                  const done = i < stepIdx;
                  const current = i === stepIdx;
                  return (
                    <React.Fragment key={`step-${i}`}>
                      <View
                        style={[
                          styles.stepDot,
                          (done || current) && styles.stepDotOn,
                          current && styles.stepDotCurrent,
                        ]}
                      >
                        {done ? (
                          <Ionicons name="checkmark" size={13} color="#0f2d1c" />
                        ) : (
                          <Text style={[styles.stepDotText, (done || current) && { color: '#0f2d1c' }]}>
                            {i + 1}
                          </Text>
                        )}
                      </View>
                      {i < SCAN_STEPS.length - 1 && (
                        <View style={[styles.stepLine, done && styles.stepLineOn]} />
                      )}
                    </React.Fragment>
                  );
                })}
              </View>
            </GlassView>
          ) : isMultiAnnotatedMode ? (
            <GlassView
              radius={32}
              intensity={55}
              style={[styles.bottomBlock, { marginBottom: dockBottomGap }]}
              contentStyle={styles.drawerInner}
            >
              <View style={styles.multiDrawerHeader}>
                <Text style={styles.multiDrawerTitle}>Ketuk kotak di foto atau kartu untuk detail</Text>
                <TouchableOpacity onPress={resetPreview} style={styles.scanAgainMiniBtn}>
                  <Ionicons name="camera-outline" size={14} color="#0f2d1c" />
                  <Text style={styles.scanAgainMiniText}>Scan Ulang</Text>
                </TouchableOpacity>
              </View>

              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={styles.multiHorizontalCards}
              >
                {detectedPlants.map((plant, idx) => {
                  const palette = plant.is_toxic
                    ? TOXIC_COLOR
                    : BOX_PALETTE[idx % BOX_PALETTE.length];
                  const isSelected = selectedBoxIdx === idx;

                  return (
                    <TouchableOpacity
                      key={`chip-${plant.slug}-${idx}`}
                      activeOpacity={0.86}
                      onPress={() => {
                        setSelectedBoxIdx(idx);
                        openDetectedPlantDetail(plant);
                      }}
                      style={[
                        styles.detectedChipCard,
                        isSelected && { borderColor: palette.badge, borderWidth: 2 },
                      ]}
                    >
                      <View style={[styles.indexCircle, { backgroundColor: palette.badge }]}>
                        <Text style={styles.indexCircleText}>#{idx + 1}</Text>
                      </View>

                      <View style={{ flex: 1 }}>
                        <Text style={styles.chipPlantName} numberOfLines={1}>
                          {plant.name}
                        </Text>
                        <Text style={styles.chipPlantLatin} numberOfLines={1}>
                          {plant.scientific_name}
                        </Text>
                        <Text style={styles.chipConfText}>
                          Akurasi {plant.confidence}% • Lihat Detail →
                        </Text>
                      </View>
                    </TouchableOpacity>
                  );
                })}
              </ScrollView>
            </GlassView>
          ) : (
            <View style={[styles.actionBar, { marginBottom: dockBottomGap }]}>
              <TouchableOpacity activeOpacity={0.85} onPress={resetPreview} style={{ flex: 1 }}>
                <GlassView radius={30} intensity={50} contentStyle={styles.retakeInner}>
                  <Ionicons name="refresh" size={19} color="#ffffff" />
                  <Text style={styles.retakeText}>Foto Ulang</Text>
                </GlassView>
              </TouchableOpacity>

              <TouchableOpacity style={styles.analyzePillBtn} onPress={handleIdentify}>
                <Ionicons name="scan" size={20} color="#0f2d1c" />
                <Text style={styles.analyzePillText}>Identifikasi Spesimen</Text>
              </TouchableOpacity>
            </View>
          )}
        </View>
      ) : (
        <View
          style={styles.fullCameraWrapper}
          onLayout={(e) => {
            const { width, height } = e.nativeEvent.layout;
            if (width > 0 && height > 0) {
              setCameraBox({ width, height });
            }
          }}
        >
          {isScreenFocused && (
            <CameraView
              ref={cameraRef}
              style={StyleSheet.absoluteFill}
              facing="back"
              zoom={0}
              enableTorch={flashOn}
              pictureSize={pictureSize}
              onCameraReady={handleCameraReady}
            />
          )}

          <View pointerEvents="none" style={StyleSheet.absoluteFill}>
            <View style={[styles.maskPanel, { top: 0, left: 0, right: 0, height: reticleTop }]} />
            <View
              style={[styles.maskPanel, { top: reticleTop + reticleSize, left: 0, right: 0, bottom: 0 }]}
            />
            <View
              style={[styles.maskPanel, { top: reticleTop, left: 0, width: reticleLeft, height: reticleSize }]}
            />
            <View
              style={[styles.maskPanel, { top: reticleTop, right: 0, width: reticleLeft, height: reticleSize }]}
            />

            <View
              style={[
                styles.reticleFrame,
                { top: reticleTop, left: reticleLeft, width: reticleSize, height: reticleSize },
              ]}
            >
              <ReticleLaser size={reticleSize} />
              <View style={[styles.corner, styles.cornerTL]} />
              <View style={[styles.corner, styles.cornerTR]} />
              <View style={[styles.corner, styles.cornerBL]} />
              <View style={[styles.corner, styles.cornerBR]} />
            </View>
          </View>

          {/* Bilah atas bersih: hanya tombol Flash di kanan atas */}
          <View style={styles.topBarAbs}>
            <Animated.View style={{ transform: [{ scale: flashScale }] }}>
              <TouchableOpacity
                activeOpacity={0.8}
                style={[styles.topIconBtn, flashOn && styles.topIconBtnOn]}
                onPress={handleToggleFlash}
              >
                <Animated.View style={{ transform: [{ scale: flashPulse }] }}>
                  <Ionicons
                    name={flashOn ? 'flash' : 'flash-outline'}
                    size={22}
                    color={flashOn ? '#0f2d1c' : '#ffffff'}
                  />
                </Animated.View>
              </TouchableOpacity>
            </Animated.View>
          </View>

          {freeBelowReticle > 145 && (
            <Text
              pointerEvents="none"
              style={[styles.reticleHint, { top: reticleTop + reticleSize + 18 }]}
              numberOfLines={1}
            >
              Posisikan daun atau bunga di dalam bingkai
            </Text>
          )}

          {/* Kontrol bawah sejajar: Galeri (Kiri) - Cekrek (Tengah) - Riwayat (Kanan) */}
          <View pointerEvents="box-none" style={[styles.shutterWrap, { bottom: dockBottomGap }]}>
            <View style={styles.controlsRow}>
              <TouchableOpacity
                activeOpacity={0.82}
                style={styles.sideControlItem}
                onPress={handlePickGallery}
              >
                <View style={styles.sideActionBtn}>
                  <Ionicons name="images-outline" size={23} color="#ffffff" />
                </View>
                <Text style={styles.sideActionLabel}>Galeri</Text>
              </TouchableOpacity>

              <TouchableOpacity activeOpacity={0.85} style={styles.shutterRing} onPress={handleCapture}>
                <View style={styles.shutterCore}>
                  <Ionicons name="scan" size={30} color="#0f2d1c" />
                </View>
              </TouchableOpacity>

              <TouchableOpacity
                activeOpacity={0.82}
                style={styles.sideControlItem}
                onPress={() => router.push('/(tabs)/history')}
              >
                <View style={styles.sideActionBtn}>
                  <Ionicons name="time-outline" size={23} color="#ffffff" />
                </View>
                <Text style={styles.sideActionLabel}>Riwayat</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: C.bgSoft },
  centerScreen: {
    flex: 1,
    backgroundColor: C.bgSoft,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 28,
    gap: 12,
  },
  permIconCircle: {
    width: 88,
    height: 88,
    borderRadius: 44,
    backgroundColor: 'rgba(74, 222, 128, 0.16)',
    borderWidth: 1,
    borderColor: 'rgba(134, 239, 172, 0.38)',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 6,
  },
  permTitle: { fontSize: 22, fontWeight: '800', color: C.white },
  permSub: {
    fontSize: 13.5,
    color: C.textSoft,
    textAlign: 'center',
    lineHeight: 21,
    maxWidth: 320,
  },
  permBtn: {
    backgroundColor: C.white,
    paddingHorizontal: 30,
    paddingVertical: 15,
    borderRadius: R.pill,
    marginTop: 10,
  },
  permBtnText: { color: C.ink, fontSize: 14.5, fontWeight: '800' },

  circleGlass: { width: 44, height: 44 },
  circleInner: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  pillInner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 7,
    paddingHorizontal: 15,
    paddingVertical: 11,
  },
  pillText: { color: C.mint, fontSize: 12.5, fontWeight: '700' },
  fullMedia: { width: '100%', height: '100%' },

  fullCameraWrapper: { flex: 1, backgroundColor: '#000000' },
  maskPanel: { position: 'absolute', backgroundColor: 'rgba(3, 16, 9, 0.64)' },
  reticleFrame: { position: 'absolute', borderRadius: 30 },
  corner: { position: 'absolute', width: 56, height: 56, borderColor: C.leaf },
  cornerTL: { top: -3, left: -3, borderTopWidth: 7, borderLeftWidth: 7, borderTopLeftRadius: 30 },
  cornerTR: { top: -3, right: -3, borderTopWidth: 7, borderRightWidth: 7, borderTopRightRadius: 30 },
  cornerBL: { bottom: -3, left: -3, borderBottomWidth: 7, borderLeftWidth: 7, borderBottomLeftRadius: 30 },
  cornerBR: { bottom: -3, right: -3, borderBottomWidth: 7, borderRightWidth: 7, borderBottomRightRadius: 30 },

  laserLine: {
    position: 'absolute',
    left: 16,
    right: 16,
    top: 0,
    height: 12,
    flexDirection: 'row',
    alignItems: 'center',
  },
  laserLineDot: {
    width: 12,
    height: 12,
    borderRadius: 6,
    backgroundColor: C.leaf,
    zIndex: 2,
    shadowColor: C.leaf,
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 1,
    shadowRadius: 8,
  },
  laserLineBar: {
    flex: 1,
    height: 3,
    marginLeft: -6,
    borderRadius: 2,
    backgroundColor: C.leaf,
    shadowColor: C.leaf,
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.9,
    shadowRadius: 8,
  },

  topBarAbs: {
    position: 'absolute',
    top: SCREEN_TOP_PAD - 4,
    left: 20,
    right: 20,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-end',
  },
  topIconBtn: {
    width: 46,
    height: 46,
    borderRadius: 23,
    backgroundColor: 'rgba(8, 28, 17, 0.58)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.22)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  topIconBtnOn: { backgroundColor: C.leaf, borderColor: C.leaf },

  reticleHint: {
    position: 'absolute',
    left: 0,
    right: 0,
    textAlign: 'center',
    color: C.mint,
    fontSize: 12.5,
    fontWeight: '600',
  },

  shutterWrap: {
    position: 'absolute',
    left: 0,
    right: 0,
    alignItems: 'center',
  },
  controlsRow: {
    width: '100%',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-evenly',
    paddingHorizontal: 28,
  },
  sideControlItem: {
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    minWidth: 64,
  },
  sideActionBtn: {
    width: 54,
    height: 54,
    borderRadius: 27,
    backgroundColor: 'rgba(8, 28, 17, 0.64)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.24)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  sideActionLabel: {
    color: C.mint,
    fontSize: 11.5,
    fontWeight: '700',
  },
  shutterRing: {
    width: 88,
    height: 88,
    borderRadius: 44,
    backgroundColor: 'rgba(6, 20, 13, 0.92)',
    borderWidth: 1.5,
    borderColor: 'rgba(255, 255, 255, 0.25)',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: C.leaf,
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.35,
    shadowRadius: 16,
    elevation: 8,
  },
  shutterCore: {
    width: 66,
    height: 66,
    borderRadius: 33,
    backgroundColor: C.leaf,
    alignItems: 'center',
    justifyContent: 'center',
  },

  previewContainer: { flex: 1, backgroundColor: C.bgSoft },
  topBarFlow: {
    paddingTop: SCREEN_TOP_PAD - 4,
    paddingHorizontal: 16,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  previewCenterArea: { flex: 1, alignItems: 'center', justifyContent: 'center' },

  cardShadow: {
    borderRadius: 34,
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 16 },
    shadowOpacity: 0.4,
    shadowRadius: 24,
  },
  cardShadowActive: {
    shadowColor: C.leaf,
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.55,
    shadowRadius: 30,
  },
  previewSquareCard: {
    flex: 1,
    borderRadius: 34,
    overflow: 'hidden',
    borderWidth: 1.5,
    borderColor: 'rgba(255, 255, 255, 0.35)',
    backgroundColor: '#06140c',
  },

  cvBoundingBox: { position: 'absolute', borderRadius: 14 },
  cvLabelPill: {
    position: 'absolute',
    left: -2,
    maxWidth: 220,
    paddingHorizontal: 9,
    paddingVertical: 4,
    borderRadius: 9,
  },
  cvLabelAbove: { top: -30 },
  cvLabelInside: { top: 4, left: 4 },
  cvLabelText: { color: '#ffffff', fontSize: 11, fontWeight: '800' },

  scanDim: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(4, 20, 11, 0.34)' },
  gridLineV: {
    position: 'absolute',
    top: 0,
    bottom: 0,
    width: 1,
    backgroundColor: 'rgba(255, 255, 255, 0.12)',
  },
  gridLineH: {
    position: 'absolute',
    left: 0,
    right: 0,
    height: 1,
    backgroundColor: 'rgba(255, 255, 255, 0.12)',
  },
  scanCorner: { position: 'absolute', width: 42, height: 42, borderColor: C.leaf },
  scTL: { top: 14, left: 14, borderTopWidth: 4, borderLeftWidth: 4, borderTopLeftRadius: 20 },
  scTR: { top: 14, right: 14, borderTopWidth: 4, borderRightWidth: 4, borderTopRightRadius: 20 },
  scBL: { bottom: 14, left: 14, borderBottomWidth: 4, borderLeftWidth: 4, borderBottomLeftRadius: 20 },
  scBR: { bottom: 14, right: 14, borderBottomWidth: 4, borderRightWidth: 4, borderBottomRightRadius: 20 },

  node: {
    position: 'absolute',
    width: 26,
    height: 26,
    alignItems: 'center',
    justifyContent: 'center',
  },
  nodeRing: {
    position: 'absolute',
    width: 26,
    height: 26,
    borderRadius: 13,
    borderWidth: 1.5,
    borderColor: 'rgba(187, 247, 208, 0.9)',
  },
  nodeDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: '#bbf7d0' },

  laserWrap: { position: 'absolute', left: 0, right: 0, top: 0, height: 96, justifyContent: 'center' },
  laserCore: {
    height: 3,
    backgroundColor: '#d9fbe5',
    shadowColor: C.leaf,
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 1,
    shadowRadius: 10,
  },
  laserTickL: {
    position: 'absolute',
    left: 0,
    width: 16,
    height: 14,
    borderTopRightRadius: 7,
    borderBottomRightRadius: 7,
    backgroundColor: C.leaf,
  },
  laserTickR: {
    position: 'absolute',
    right: 0,
    width: 16,
    height: 14,
    borderTopLeftRadius: 7,
    borderBottomLeftRadius: 7,
    backgroundColor: C.leaf,
  },

  sonarRing: {
    position: 'absolute',
    borderWidth: 2,
    borderColor: C.leaf,
  },
  arcOuter: {
    position: 'absolute',
    borderWidth: 2.5,
    borderColor: 'rgba(255, 255, 255, 0.14)',
    borderTopColor: C.leaf,
  },
  orbitDot: {
    position: 'absolute',
    top: -6,
    left: 66 - 6 - 1.25,
    width: 12,
    height: 12,
    borderRadius: 6,
    backgroundColor: '#d9fbe5',
    shadowColor: C.leaf,
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 1,
    shadowRadius: 8,
  },
  arcInner: {
    position: 'absolute',
    borderWidth: 2,
    borderColor: 'rgba(255, 255, 255, 0.1)',
    borderBottomColor: '#bbf7d0',
  },

  rejectInner: { flexDirection: 'row', alignItems: 'center', gap: 10, padding: 14 },
  rejectText: { flex: 1, color: '#fee2e2', fontSize: 12.5, fontWeight: '600', lineHeight: 18 },

  bottomBlock: { marginHorizontal: 16 },
  statusInner: { padding: 20, alignItems: 'center' },
  scanPhaseRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 8 },
  liveDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: C.leaf },
  scanPhaseLabel: { color: C.leafSoft, fontSize: 12, fontWeight: '800' },
  scanStatusTitle: { color: C.white, fontSize: 18, fontWeight: '800', textAlign: 'center' },
  scanStatusSub: {
    color: C.textSoft,
    fontSize: 12.5,
    textAlign: 'center',
    marginTop: 4,
    lineHeight: 18,
  },
  progressTrack: {
    width: '100%',
    height: 6,
    borderRadius: 3,
    backgroundColor: 'rgba(255, 255, 255, 0.16)',
    overflow: 'hidden',
    marginTop: 16,
  },
  progressFill: { height: '100%', borderRadius: 3, backgroundColor: C.leaf },
  stepsRow: { flexDirection: 'row', alignItems: 'center', marginTop: 16, width: '70%' },
  stepDot: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: 'rgba(255, 255, 255, 0.14)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.25)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  stepDotOn: { backgroundColor: C.leaf, borderColor: C.leaf },
  stepDotCurrent: {
    shadowColor: C.leaf,
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.8,
    shadowRadius: 8,
  },
  stepDotText: { color: C.textSoft, fontSize: 11, fontWeight: '800' },
  stepLine: { flex: 1, height: 2, backgroundColor: 'rgba(255, 255, 255, 0.18)', marginHorizontal: 4 },
  stepLineOn: { backgroundColor: C.leaf },

  drawerInner: { paddingTop: 16, paddingBottom: 16 },
  multiDrawerHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 10,
    paddingHorizontal: 18,
    marginBottom: 12,
  },
  multiDrawerTitle: { flex: 1, color: C.mint, fontSize: 12, fontWeight: '700', lineHeight: 17 },
  scanAgainMiniBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    backgroundColor: C.white,
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: R.pill,
  },
  scanAgainMiniText: { color: C.ink, fontSize: 11.5, fontWeight: '800' },
  multiHorizontalCards: { gap: 10, paddingHorizontal: 16 },
  detectedChipCard: {
    width: 252,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 11,
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    borderRadius: 22,
    padding: 12,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.2)',
  },
  indexCircle: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  indexCircleText: { color: '#ffffff', fontSize: 12, fontWeight: '800' },
  chipPlantName: { color: C.white, fontSize: 14, fontWeight: '800' },
  chipPlantLatin: { color: C.leafSoft, fontSize: 11.5, fontStyle: 'italic' },
  chipConfText: { color: C.textSoft, fontSize: 11, marginTop: 2, fontWeight: '600' },

  actionBar: { flexDirection: 'row', gap: 10, paddingHorizontal: 16 },
  retakeInner: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 7,
    paddingVertical: 16,
  },
  retakeText: { color: C.white, fontSize: 14, fontWeight: '700' },
  analyzePillBtn: {
    flex: 1.6,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: C.white,
    paddingVertical: 16,
    borderRadius: 999,
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.3,
    shadowRadius: 14,
    elevation: 8,
  },
  analyzePillText: { color: C.ink, fontSize: 14.5, fontWeight: '800' },
});