import React, { useCallback, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Dimensions,
  Image,
  Platform,
  StatusBar,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { CameraView, useCameraPermissions } from 'expo-camera';
import * as ImagePicker from 'expo-image-picker';
import { useFocusEffect, useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { classifyImage } from '../../services/classifier';

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const SQUARE_SIZE = SCREEN_WIDTH - 36;

interface Candidate {
  slug: string;
  confidence: number;
}

export default function ScanScreen() {
  const router = useRouter();
  const cameraRef = useRef<CameraView>(null);

  const [permission, requestPermission] = useCameraPermissions();
  const [isFocused, setIsFocused] = useState(true);
  const [torch, setTorch] = useState(false);
  const [photoUri, setPhotoUri] = useState<string | null>(null);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [candidates, setCandidates] = useState<Candidate[]>([]);

  useFocusEffect(
    useCallback(() => {
      setIsFocused(true);
      return () => {
        setIsFocused(false);
        setTorch(false);
      };
    }, [])
  );

  if (!permission) {
    return <View style={styles.screen} />;
  }

  if (!permission.granted) {
    return (
      <View style={styles.permissionContainer}>
        <View style={styles.permissionIconCircle}>
          <Ionicons name="leaf" size={42} color="#16a34a" />
        </View>
        <Text style={styles.permissionTitle}>Izin Kamera Diperlukan</Text>
        <Text style={styles.permissionText}>
          Aktifkan akses kamera untuk memindai daun tanaman herbal secara langsung.
        </Text>
        <TouchableOpacity
          style={styles.primaryBtn}
          activeOpacity={0.85}
          onPress={requestPermission}
        >
          <Ionicons name="camera" size={20} color="#ffffff" />
          <Text style={styles.primaryBtnText}>Izinkan Kamera</Text>
        </TouchableOpacity>
      </View>
    );
  }

  const resetCapture = () => {
    setPhotoUri(null);
    setCandidates([]);
  };

  const handleTakePicture = async () => {
    if (!cameraRef.current) return;
    try {
      const photo = await cameraRef.current.takePictureAsync({
        quality: 0.5,
      });
      if (photo?.uri) {
        setTorch(false);
        setCandidates([]);
        setPhotoUri(photo.uri);
      }
    } catch {
      Alert.alert('Gagal Memotret', 'Silakan tekan tombol kamera kembali.');
    }
  };

  const handlePickGallery = async () => {
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.5,
    });

    if (!result.canceled && result.assets[0]?.uri) {
      setTorch(false);
      setCandidates([]);
      setPhotoUri(result.assets[0].uri);
    }
  };

  const handleIdentify = async () => {
    if (!photoUri || isAnalyzing) return;

    setIsAnalyzing(true);
    setCandidates([]);

    try {
      const response: any = await classifyImage(photoUri);
      const data = response?.data ?? response;

      const topSlug: string = data?.slug ?? 'bukan_herbal';
      const confidence: number = data?.confidence ?? 0;
      const top3: Candidate[] = Array.isArray(data?.top_3) ? data.top_3 : [];

      // 1. Terdeteksi valid oleh TFLite lokal maupun Hybrid Gemini Vision
      if (data?.is_herbal && topSlug !== 'bukan_herbal') {
        router.push(`/detail/${topSlug}` as any);
        return;
      }

      // 2. Kandidat menengah (40% - 69%) jika tersedia
      const validHerbalCandidates = top3.filter(
        (item) => item.slug !== 'bukan_herbal' && item.confidence >= 15
      );

      if (
        topSlug !== 'bukan_herbal' &&
        confidence >= 40 &&
        validHerbalCandidates.length > 0
      ) {
        setCandidates(validHerbalCandidates);
        return;
      }

      // 3. Ditolak (bukan tanaman herbal / beracun / tidak dikenali)
      const alertTitle = data?.is_toxic
        ? 'Peringatan Tanaman Beracun'
        : 'Tanaman Tidak Dikenali';

      const alertBody =
        data?.message ||
        `Objek tidak terdeteksi sebagai tanaman herbal yang didukung (Keyakinan: ${confidence}%).\n\nPastikan tanaman atau daun terlihat jelas di dalam kotak dengan pencahayaan terang.`;

      Alert.alert(alertTitle, alertBody);
    } catch (error: any) {
      const detailError =
        error?.response?.data?.message ||
        error?.message ||
        'Koneksi ke server terputus';

      Alert.alert(
        'Gagal Memproses Gambar',
        `Detail: ${detailError}\n\nPastikan server Laravel aktif dan HP terhubung ke Wi-Fi yang sama.`
      );
    } finally {
      setIsAnalyzing(false);
    }
  };

  const formatPlantName = (slug: string) =>
    slug
      .split('_')
      .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
      .join(' ');

  if (photoUri) {
    return (
      <View style={styles.screen}>
        <StatusBar barStyle="dark-content" />

        <View style={styles.header}>
          <TouchableOpacity
            style={styles.iconCircleBtn}
            onPress={resetCapture}
            disabled={isAnalyzing}
          >
            <Ionicons name="arrow-back" size={20} color="#0f172a" />
          </TouchableOpacity>
          <View style={styles.headerCenter}>
            <Text style={styles.headerTitle}>Hasil Pemindaian</Text>
            <Text style={styles.headerSub}>Area persegi yang dianalisis AI</Text>
          </View>
          <View style={{ width: 40 }} />
        </View>

        <View style={styles.squareCard}>
          <Image
            source={{ uri: photoUri }}
            style={styles.squareImage}
            resizeMode="cover"
          />
        </View>

        {candidates.length > 0 ? (
          <View style={styles.candidateBox}>
            <Text style={styles.candidateTitle}>
              Pilih Tanaman yang Paling Sesuai:
            </Text>
            {candidates.map((item, idx) => (
              <TouchableOpacity
                key={item.slug}
                style={[
                  styles.candidateRow,
                  idx === 0 && styles.candidateRowPrimary,
                ]}
                activeOpacity={0.8}
                onPress={() => router.push(`/detail/${item.slug}` as any)}
              >
                <View style={styles.candidateLeft}>
                  <Ionicons
                    name="leaf"
                    size={18}
                    color={idx === 0 ? '#16a34a' : '#64748b'}
                  />
                  <Text style={styles.candidateName}>
                    {formatPlantName(item.slug)}
                  </Text>
                </View>
                <View style={styles.candidateRight}>
                  <Text style={styles.candidateScore}>{item.confidence}%</Text>
                  <Ionicons name="chevron-forward" size={18} color="#64748b" />
                </View>
              </TouchableOpacity>
            ))}

            <TouchableOpacity style={styles.retakeFullBtn} onPress={resetCapture}>
              <Text style={styles.retakeBtnText}>Foto Ulang Daun</Text>
            </TouchableOpacity>
          </View>
        ) : (
          <View style={styles.footerActions}>
            <TouchableOpacity
              style={styles.retakeBtn}
              activeOpacity={0.8}
              onPress={resetCapture}
              disabled={isAnalyzing}
            >
              <Ionicons name="refresh" size={20} color="#334155" />
              <Text style={styles.retakeBtnText}>Foto Ulang</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.primaryBtn, styles.analyzeBtn]}
              activeOpacity={0.85}
              onPress={handleIdentify}
              disabled={isAnalyzing}
            >
              {isAnalyzing ? (
                <>
                  <ActivityIndicator color="#ffffff" size="small" />
                  <Text style={styles.primaryBtnText}>Menganalisis...</Text>
                </>
              ) : (
                <>
                  <Ionicons name="sparkles" size={19} color="#ffffff" />
                  <Text style={styles.primaryBtnText}>Identifikasi Daun</Text>
                </>
              )}
            </TouchableOpacity>
          </View>
        )}
      </View>
    );
  }

  return (
    <View style={styles.screen}>
      <StatusBar barStyle="dark-content" />

      <View style={styles.header}>
        <View>
          <Text style={styles.headerTitle}>Scan Daun Herbal</Text>
          <Text style={styles.headerSub}>Tampilkan daun atau tanaman secara jelas</Text>
        </View>

        <TouchableOpacity
          style={[styles.flashBtn, torch && styles.flashBtnActive]}
          activeOpacity={0.8}
          onPress={() => setTorch((prev) => !prev)}
        >
          <Ionicons
            name={torch ? 'flash' : 'flash-outline'}
            size={18}
            color={torch ? '#854d0e' : '#334155'}
          />
          <Text style={[styles.flashText, torch && styles.flashTextActive]}>
            {torch ? 'Flash ON' : 'Flash'}
          </Text>
        </TouchableOpacity>
      </View>

      <View style={styles.squareCameraWrapper}>
        {isFocused && (
          <CameraView
            ref={cameraRef}
            style={styles.camera}
            facing="back"
            enableTorch={torch}
          />
        )}

        <View style={styles.frameGuide} pointerEvents="none">
          <View style={[styles.corner, styles.cTopLeft]} />
          <View style={[styles.corner, styles.cTopRight]} />
          <View style={[styles.corner, styles.cBottomLeft]} />
          <View style={[styles.corner, styles.cBottomRight]} />
        </View>
      </View>

      <View style={styles.controlsArea}>
        <View style={styles.tipBanner}>
          <Ionicons name="scan-outline" size={16} color="#15803d" />
          <Text style={styles.tipBannerText}>
            Posisikan tanaman di dalam kotak dengan cahaya terang
          </Text>
        </View>

        <View style={styles.shutterRow}>
          <TouchableOpacity
            style={styles.sideActionBtn}
            activeOpacity={0.75}
            onPress={handlePickGallery}
          >
            <View style={styles.sideActionIcon}>
              <Ionicons name="images-outline" size={22} color="#1e293b" />
            </View>
            <Text style={styles.sideActionLabel}>Galeri</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.shutterOuter}
            activeOpacity={0.85}
            onPress={handleTakePicture}
          >
            <View style={styles.shutterInner}>
              <Ionicons name="camera" size={28} color="#ffffff" />
            </View>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.sideActionBtn}
            activeOpacity={0.75}
            onPress={() =>
              Alert.alert(
                'Panduan Pemindaian',
                '1. Arahkan kotak kamera ke tanaman herbal atau 1–2 helai daun utama.\n2. Pastikan objek fokus dan pencahayaan terang.\n3. Gunakan tombol Flash jika memotret di tempat teduh.'
              )
            }
          >
            <View style={styles.sideActionIcon}>
              <Ionicons name="help-circle-outline" size={23} color="#1e293b" />
            </View>
            <Text style={styles.sideActionLabel}>Panduan</Text>
          </TouchableOpacity>
        </View>
      </View>
    </View>
  );
}

const CORNER_SIZE = 28;
const CORNER_THICKNESS = 3.5;

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: '#f8fafc',
    paddingTop: Platform.OS === 'android' ? 42 : 54,
    paddingBottom: 20,
    paddingHorizontal: 18,
    justifyContent: 'space-between',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  headerCenter: {
    alignItems: 'center',
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: '#0f172a',
  },
  headerSub: {
    fontSize: 13,
    color: '#64748b',
    marginTop: 2,
  },
  iconCircleBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#e2e8f0',
    alignItems: 'center',
    justifyContent: 'center',
  },
  flashBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    backgroundColor: '#e2e8f0',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 999,
  },
  flashBtnActive: {
    backgroundColor: '#fef08a',
  },
  flashText: {
    fontSize: 12.5,
    fontWeight: '600',
    color: '#334155',
  },
  flashTextActive: {
    color: '#854d0e',
  },
  squareCameraWrapper: {
    width: SQUARE_SIZE,
    height: SQUARE_SIZE,
    alignSelf: 'center',
    borderRadius: 24,
    overflow: 'hidden',
    backgroundColor: '#0f172a',
  },
  camera: {
    width: '100%',
    height: '100%',
  },
  frameGuide: {
    position: 'absolute',
    top: 22,
    left: 22,
    right: 22,
    bottom: 22,
  },
  corner: {
    position: 'absolute',
    width: CORNER_SIZE,
    height: CORNER_SIZE,
    borderColor: '#4ade80',
  },
  cTopLeft: {
    top: 0,
    left: 0,
    borderTopWidth: CORNER_THICKNESS,
    borderLeftWidth: CORNER_THICKNESS,
    borderTopLeftRadius: 14,
  },
  cTopRight: {
    top: 0,
    right: 0,
    borderTopWidth: CORNER_THICKNESS,
    borderRightWidth: CORNER_THICKNESS,
    borderTopRightRadius: 14,
  },
  cBottomLeft: {
    bottom: 0,
    left: 0,
    borderBottomWidth: CORNER_THICKNESS,
    borderLeftWidth: CORNER_THICKNESS,
    borderBottomLeftRadius: 14,
  },
  cBottomRight: {
    bottom: 0,
    right: 0,
    borderBottomWidth: CORNER_THICKNESS,
    borderRightWidth: CORNER_THICKNESS,
    borderBottomRightRadius: 14,
  },
  controlsArea: {
    gap: 14,
  },
  tipBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    backgroundColor: '#dcfce7',
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 12,
  },
  tipBannerText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#166534',
  },
  shutterRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-around',
  },
  sideActionBtn: {
    alignItems: 'center',
    gap: 5,
    width: 64,
  },
  sideActionIcon: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: '#e2e8f0',
    alignItems: 'center',
    justifyContent: 'center',
  },
  sideActionLabel: {
    fontSize: 12,
    fontWeight: '600',
    color: '#475569',
  },
  shutterOuter: {
    width: 76,
    height: 76,
    borderRadius: 38,
    borderWidth: 3.5,
    borderColor: '#16a34a',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#dcfce7',
  },
  shutterInner: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: '#16a34a',
    alignItems: 'center',
    justifyContent: 'center',
  },
  squareCard: {
    width: SQUARE_SIZE,
    height: SQUARE_SIZE,
    alignSelf: 'center',
    backgroundColor: '#ffffff',
    borderRadius: 24,
    padding: 8,
    shadowColor: '#0f172a',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.06,
    shadowRadius: 12,
    elevation: 3,
  },
  squareImage: {
    width: '100%',
    height: '100%',
    borderRadius: 18,
    backgroundColor: '#e2e8f0',
  },
  candidateBox: {
    backgroundColor: '#ffffff',
    borderRadius: 20,
    padding: 14,
    gap: 8,
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
  candidateTitle: {
    fontSize: 13.5,
    fontWeight: '700',
    color: '#0f172a',
    marginBottom: 2,
  },
  candidateRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderRadius: 12,
    backgroundColor: '#f8fafc',
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
  candidateRowPrimary: {
    backgroundColor: '#f0fdf4',
    borderColor: '#86efac',
  },
  candidateLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  candidateName: {
    fontSize: 14.5,
    fontWeight: '700',
    color: '#0f172a',
  },
  candidateRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  candidateScore: {
    fontSize: 13.5,
    fontWeight: '700',
    color: '#16a34a',
  },
  retakeFullBtn: {
    alignItems: 'center',
    paddingVertical: 10,
    marginTop: 2,
  },
  footerActions: {
    flexDirection: 'row',
    gap: 12,
  },
  retakeBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#e2e8f0',
    paddingVertical: 15,
    borderRadius: 16,
    gap: 6,
  },
  retakeBtnText: {
    fontSize: 15,
    fontWeight: '700',
    color: '#334155',
  },
  primaryBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#16a34a',
    paddingVertical: 15,
    paddingHorizontal: 20,
    borderRadius: 16,
    gap: 8,
  },
  analyzeBtn: {
    flex: 1.6,
  },
  primaryBtnText: {
    color: '#ffffff',
    fontSize: 15,
    fontWeight: '700',
  },
  permissionContainer: {
    flex: 1,
    backgroundColor: '#f8fafc',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 28,
  },
  permissionIconCircle: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: '#dcfce7',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
  },
  permissionTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: '#0f172a',
    marginBottom: 8,
  },
  permissionText: {
    fontSize: 14,
    color: '#475569',
    textAlign: 'center',
    lineHeight: 20,
    marginBottom: 24,
  },
});
