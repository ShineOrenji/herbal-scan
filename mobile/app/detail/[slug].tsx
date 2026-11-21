import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Animated,
  Image,
  Linking,
  Platform,
  RefreshControl,
  ScrollView,
  Share,
  StatusBar,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { getCachedHerbalBySlug, getHerbalBySlug, getPersistedHerbalBySlug } from '../../services/api';
import { HerbalDetail } from '../../types/herbal';
import BotanicalBackdrop from '../../components/BotanicalBackdrop';
import GlassView from '../../components/GlassView';
import { C, R, glass } from '../../constants/herbalTheme';

let BlurViewImpl: any = null;
try {
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  BlurViewImpl = require('expo-blur').BlurView;
} catch {
  BlurViewImpl = null;
}

type DetailTab = 'all' | 'botany' | 'clinical' | 'journals';

export default function HerbalDetailScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{
    slug: string;
    scannedImage?: string;
    confidence?: string;
  }>();

  const slug = Array.isArray(params.slug) ? params.slug[0] : params.slug;
  const scannedImage = Array.isArray(params.scannedImage)
    ? params.scannedImage[0]
    : params.scannedImage;
  const confidence = Array.isArray(params.confidence)
    ? params.confidence[0]
    : params.confidence;

  const initialCached = slug ? getCachedHerbalBySlug(slug) : null;
  const [herbal, setHerbal] = useState<HerbalDetail | null>(initialCached);
  const [loading, setLoading] = useState<boolean>(!initialCached);
  const [refreshing, setRefreshing] = useState<boolean>(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<DetailTab>('all');

  const loadDetail = useCallback(async () => {
    if (!slug) return;
    setErrorMsg(null);
    const diskCached = await getPersistedHerbalBySlug(slug);
    if (diskCached) {
      setHerbal((prev) => prev || diskCached);
      setLoading(false);
    }
    try {
      const res: any = await getHerbalBySlug(slug);
      const unwrapped = res?.data?.data ?? res?.data ?? res;
      setHerbal(unwrapped);
    } catch (err: any) {
      setErrorMsg(
        err?.response?.data?.message ||
          'Gagal memuat profil botani dari server. Tarik ke bawah untuk mencoba lagi.'
      );
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [slug]);

  useEffect(() => {
    loadDetail();
  }, [loadDetail]);

  const onRefresh = () => {
    setRefreshing(true);
    loadDetail();
  };

  const handleShare = async () => {
    if (!herbal) return;
    try {
      await Share.share({
        message: `${herbal.name} (${herbal.scientific_name})\n\nKhasiat: ${
          herbal.traditional_usage || herbal.description
        }\n\nDipindai melalui HerbalScan`,
      });
    } catch {
      // Abaikan jika dibatalkan
    }
  };

  const openDoiLink = async (rawUrl?: string, rawDoi?: string) => {
    const target =
      rawUrl && rawUrl.startsWith('http')
        ? rawUrl
        : rawDoi
        ? `https://doi.org/${rawDoi.replace(/^https?:\/\/doi\.org\//i, '')}`
        : '';

    if (!target) return;
    try {
      await Linking.openURL(target);
    } catch {
      // Abaikan jika browser gagal dibuka
    }
  };

  if (loading) {
    return (
      <View style={styles.centerScreen}>
        <Stack.Screen options={{ headerShown: false }} />
        <StatusBar barStyle="light-content" translucent backgroundColor="transparent" />
        <BotanicalBackdrop />
        <ActivityIndicator size="large" color="#4ade80" />
        <Text style={styles.loadingText}>Menyusun monograf botani & jurnal DOI...</Text>
      </View>
    );
  }

  if (errorMsg || !herbal) {
    return (
      <View style={styles.centerScreen}>
        <Stack.Screen options={{ headerShown: false }} />
        <StatusBar barStyle="light-content" translucent backgroundColor="transparent" />
        <BotanicalBackdrop />
        <View style={styles.errorGlassCard}>
          <View style={styles.errorIconCircle}>
            <Ionicons name="cloud-offline-outline" size={34} color="#fca5a5" />
          </View>
          <Text style={styles.errorTitle}>Data Belum Termuat</Text>
          <Text style={styles.errorSub}>{errorMsg || 'Spesimen tidak ditemukan.'}</Text>
          <View style={styles.errorBtnRow}>
            <TouchableOpacity style={styles.backOutlineBtn} onPress={() => router.back()}>
              <Text style={styles.backOutlineText}>Kembali</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.retryPillBtn} onPress={loadDetail}>
              <Text style={styles.retryPillText}>Muat Ulang</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    );
  }

  return (
    <DetailBody
      herbal={herbal}
      scannedImage={scannedImage}
      confidence={confidence}
      refreshing={refreshing}
      onRefresh={onRefresh}
      handleShare={handleShare}
      openDoiLink={openDoiLink}
      activeTab={activeTab}
      setActiveTab={setActiveTab}
      onBack={() => router.back()}
    />
  );
}

interface DetailBodyProps {
  herbal: HerbalDetail;
  scannedImage?: string;
  confidence?: string;
  refreshing: boolean;
  onRefresh: () => void;
  handleShare: () => void;
  openDoiLink: (rawUrl?: string, rawDoi?: string) => void;
  activeTab: DetailTab;
  setActiveTab: (t: DetailTab) => void;
  onBack: () => void;
}

const HERO_H = 380;

const TABS: { key: DetailTab; label: string; icon: keyof typeof Ionicons.glyphMap }[] = [
  { key: 'all', label: 'Semua', icon: 'grid-outline' },
  { key: 'botany', label: 'Botani', icon: 'flower-outline' },
  { key: 'clinical', label: 'Klinis & Lab', icon: 'flask-outline' },
  { key: 'journals', label: 'Jurnal', icon: 'school-outline' },
];

function SectionHead({
  icon,
  tint = 'rgba(74, 222, 128, 0.2)',
  color = '#4ade80',
  title,
  caption,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  tint?: string;
  color?: string;
  title: string;
  caption?: string;
}) {
  return (
    <View style={styles.sectionTitleRow}>
      <View style={[styles.sectionIconBadge, { backgroundColor: tint }]}>
        <Ionicons name={icon} size={17} color={color} />
      </View>
      <View style={{ flex: 1 }}>
        <Text style={styles.sectionTitle}>{title}</Text>
        {caption ? <Text style={styles.journalSubCaption}>{caption}</Text> : null}
      </View>
    </View>
  );
}

function DetailBody({
  herbal,
  scannedImage,
  confidence,
  refreshing,
  onRefresh,
  handleShare,
  openDoiLink,
  activeTab,
  setActiveTab,
  onBack,
}: DetailBodyProps) {
  const scrollY = useRef(new Animated.Value(0)).current;

  const isToxic = Boolean((herbal as any).is_toxic) || (herbal.name || '').toLowerCase().includes('beracun');
  const heroImage = scannedImage || herbal.image_url || null;
  const references = Array.isArray(herbal.references) ? herbal.references : [];

  const rawPart = (herbal.plant_parts_used || 'Daun').trim();
  const isRestrictedPart = isToxic || /tidak|dilarang|beracun/i.test(rawPart);
  const displayPlantPart = isRestrictedPart
    ? 'Dilarang'
    : rawPart.replace(/\s*\([^)]*\)/g, '').trim() || 'Daun';

  const showBotany = activeTab === 'all' || activeTab === 'botany';
  const showClinical = activeTab === 'all' || activeTab === 'clinical';
  const showJournals = activeTab === 'all' || activeTab === 'journals';

  const heroScale = scrollY.interpolate({
    inputRange: [-HERO_H, 0],
    outputRange: [2.0, 1],
    extrapolateRight: 'clamp',
  });
  const heroShift = scrollY.interpolate({
    inputRange: [0, HERO_H],
    outputRange: [0, HERO_H * 0.42],
    extrapolate: 'clamp',
  });
  const miniOpacity = scrollY.interpolate({
    inputRange: [HERO_H - 140, HERO_H - 70],
    outputRange: [0, 1],
    extrapolate: 'clamp',
  });

  const hasScore = Boolean(confidence && Number(confidence) > 0);

  return (
    <View style={styles.screen}>
      <Stack.Screen options={{ headerShown: false }} />
      <StatusBar barStyle="light-content" translucent backgroundColor="transparent" />

      {/* Background daun botani persis seperti di Beranda */}
      <BotanicalBackdrop />

      <Animated.ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.scrollContent}
        scrollEventThrottle={16}
        onScroll={Animated.event([{ nativeEvent: { contentOffset: { y: scrollY } } }], {
          useNativeDriver: true,
        })}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor="#4ade80"
            colors={['#16a34a']}
            progressViewOffset={Platform.OS === 'android' ? 80 : 0}
          />
        }
      >
        {/* 1. GAMBAR (Hero penuh & bersih) */}
        <View style={styles.heroWrapper}>
          <Animated.View
            style={[
              StyleSheet.absoluteFill,
              { transform: [{ translateY: heroShift }, { scale: heroScale }] },
            ]}
          >
            {heroImage ? (
              <Image source={{ uri: heroImage }} style={styles.heroImage} resizeMode="cover" />
            ) : (
              <View style={styles.heroPlaceholder}>
                <Ionicons name="leaf" size={84} color="#4ade80" />
              </View>
            )}
          </Animated.View>
        </View>

        {/* 2. PANEL SHEET MELENGKUNG MENYATU DENGAN GAMBAR */}
        <View style={styles.sheetContainer}>
          {BlurViewImpl ? (
            <BlurViewImpl
              intensity={45}
              tint="dark"
              experimentalBlurMethod={Platform.OS === 'android' ? 'dimezisBlurView' : undefined}
              style={StyleSheet.absoluteFill}
            />
          ) : null}

          {/* Lapisan kaca semi-transparan agar background daun tetap terasa & teks tajam */}
          <View
            pointerEvents="none"
            style={[
              StyleSheet.absoluteFill,
              {
                backgroundColor: isToxic
                  ? 'rgba(26, 12, 16, 0.84)'
                  : 'rgba(10, 34, 21, 0.80)',
              },
            ]}
          />

          {/* Garis Handle Pill di Tengah Atas Sheet (sesuai sketsa) */}
          <View style={styles.handleWrap}>
            <View style={styles.sheetHandle} />
          </View>

          {/* HEADING SPESIMEN */}
          <View style={styles.headingSection}>
            <View style={[styles.statusBadge, isToxic && styles.statusBadgeToxic]}>
              <Ionicons
                name={isToxic ? 'warning' : hasScore ? 'sparkles' : 'book-outline'}
                size={13}
                color={isToxic ? '#ffffff' : '#0f2d1c'}
              />
              <Text style={[styles.statusBadgeText, !isToxic && { color: '#0f2d1c' }]}>
                {isToxic
                  ? hasScore
                    ? 'Spesimen Beracun'
                    : 'Peringatan Toksik'
                  : hasScore
                  ? `Tingkat Kecocokan ${confidence}%`
                  : 'Katalog Herbal Resmi'}
              </Text>
            </View>

            <Text style={[styles.plantTitle, isToxic && { color: '#fca5a5' }]}>{herbal.name}</Text>
            <Text style={styles.latinSubtitle}>{herbal.scientific_name}</Text>

            {herbal.local_name ? (
              <View style={styles.localAliasRow}>
                <Ionicons name="pricetag-outline" size={14} color="#86efac" />
                <Text style={styles.localAliasText} numberOfLines={2}>
                  Nama Daerah: {herbal.local_name}
                </Text>
              </View>
            ) : null}
          </View>

          <View style={styles.headingDivider} />

          {/* ISI KONTEN MONOGRAF */}
          <View style={styles.sheetBody}>
            {/* 3 Statistik Bento */}
            <View style={styles.bentoRow}>
              <GlassView radius={22} intensity={35} style={{ flex: 1 }} contentStyle={styles.bentoInner}>
                <View
                  style={[
                    styles.bentoIconBox,
                    {
                      backgroundColor: isRestrictedPart
                        ? 'rgba(239, 68, 68, 0.24)'
                        : 'rgba(74, 222, 128, 0.22)',
                    },
                  ]}
                >
                  <Ionicons
                    name={isRestrictedPart ? 'ban-outline' : 'leaf-outline'}
                    size={18}
                    color={isRestrictedPart ? '#fca5a5' : '#4ade80'}
                  />
                </View>
                <Text style={styles.bentoLabel}>Bagian Pakai</Text>
                <Text
                  style={[styles.bentoValue, isRestrictedPart && { color: '#fca5a5' }]}
                  numberOfLines={2}
                  adjustsFontSizeToFit
                  minimumFontScale={0.85}
                >
                  {displayPlantPart}
                </Text>
              </GlassView>

              <GlassView radius={22} intensity={35} style={{ flex: 1 }} contentStyle={styles.bentoInner}>
                <View
                  style={[
                    styles.bentoIconBox,
                    {
                      backgroundColor: isToxic
                        ? 'rgba(239, 68, 68, 0.24)'
                        : 'rgba(56, 189, 248, 0.22)',
                    },
                  ]}
                >
                  <Ionicons
                    name={isToxic ? 'alert-circle-outline' : 'shield-checkmark-outline'}
                    size={18}
                    color={isToxic ? '#fca5a5' : '#7dd3fc'}
                  />
                </View>
                <Text style={styles.bentoLabel}>Keamanan</Text>
                <Text
                  style={[styles.bentoValue, isToxic && { color: '#fca5a5' }]}
                  numberOfLines={1}
                  adjustsFontSizeToFit
                  minimumFontScale={0.85}
                >
                  {isToxic ? 'Beracun' : 'Herbal Aman'}
                </Text>
              </GlassView>

              <GlassView radius={22} intensity={35} style={{ flex: 1 }} contentStyle={styles.bentoInner}>
                <View style={[styles.bentoIconBox, { backgroundColor: 'rgba(251, 191, 36, 0.22)' }]}>
                  <Ionicons name="document-text-outline" size={18} color="#fcd34d" />
                </View>
                <Text style={styles.bentoLabel}>Publikasi</Text>
                <Text
                  style={styles.bentoValue}
                  numberOfLines={1}
                  adjustsFontSizeToFit
                  minimumFontScale={0.85}
                >
                  {references.length} Jurnal
                </Text>
              </GlassView>
            </View>

            {/* Segmen Tab */}
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.tabScrollRow}
            >
              {TABS.map((tab) => {
                const isActive = activeTab === tab.key;
                return (
                  <TouchableOpacity
                    key={tab.key}
                    activeOpacity={0.85}
                    style={[styles.tabPill, isActive && styles.tabPillActive]}
                    onPress={() => setActiveTab(tab.key)}
                  >
                    <Ionicons name={tab.icon} size={14} color={isActive ? '#0f2d1c' : '#ecfdf5'} />
                    <Text style={[styles.tabPillText, isActive && styles.tabPillTextActive]}>
                      {tab.label}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </ScrollView>

            {/* Catatan Keamanan */}
            {herbal.safety_warning ? (
              <GlassView
                radius={24}
                intensity={40}
                fill={isToxic ? 'rgba(239, 68, 68, 0.2)' : 'rgba(251, 191, 36, 0.13)'}
                contentStyle={styles.safetyInner}
              >
                <View
                  style={[
                    styles.safetyIconCircle,
                    {
                      backgroundColor: isToxic
                        ? 'rgba(239, 68, 68, 0.3)'
                        : 'rgba(251, 191, 36, 0.28)',
                    },
                  ]}
                >
                  <Ionicons
                    name={isToxic ? 'warning' : 'information-circle'}
                    size={20}
                    color={isToxic ? '#fca5a5' : '#fde047'}
                  />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={[styles.safetyHeading, isToxic && { color: '#fecaca' }]}>
                    {isToxic ? 'Peringatan Toksisitas Tinggi' : 'Catatan Keamanan Konsumsi'}
                  </Text>
                  <Text style={[styles.safetyDesc, isToxic && { color: '#fee2e2' }]}>
                    {herbal.safety_warning}
                  </Text>
                </View>
              </GlassView>
            ) : null}

            {/* BOTANI */}
            {showBotany && (
              <>
                {scannedImage && herbal.image_url && scannedImage !== herbal.image_url && (
                  <GlassView radius={26} intensity={32} contentStyle={styles.blockInner}>
                    <SectionHead icon="images-outline" title="Perbandingan Visual Spesimen" />
                    <View style={styles.compareGrid}>
                      <View style={styles.compareCol}>
                        <Image source={{ uri: scannedImage }} style={styles.compareImg} />
                        <Text style={styles.compareLabel}>Hasil Kamera Anda</Text>
                      </View>
                      <View style={styles.compareCol}>
                        <Image source={{ uri: herbal.image_url }} style={styles.compareImg} />
                        <Text style={styles.compareLabel}>Referensi Taksonomi</Text>
                      </View>
                    </View>
                  </GlassView>
                )}

                <GlassView radius={26} intensity={32} contentStyle={styles.blockInner}>
                  <SectionHead icon="reader-outline" title="Deskripsi Botani & Morfologi" />
                  <Text style={styles.paragraphText}>{herbal.description}</Text>
                </GlassView>

                {herbal.traditional_usage ? (
                  <GlassView radius={26} intensity={32} contentStyle={styles.blockInner}>
                    <SectionHead icon="medkit-outline" title="Khasiat & Pemanfaatan Empiris" />
                    <Text style={styles.paragraphText}>{herbal.traditional_usage}</Text>
                  </GlassView>
                ) : null}
              </>
            )}

            {/* KLINIS */}
            {showClinical && (herbal.lab_evidence || herbal.clinical_evidence) && (
              <GlassView radius={26} intensity={32} contentStyle={styles.blockInner}>
                <SectionHead
                  icon="flask-outline"
                  tint="rgba(56, 189, 248, 0.22)"
                  color="#7dd3fc"
                  title="Bukti Fitokimia & Uji Klinis"
                />

                {herbal.lab_evidence ? (
                  <View style={styles.evidenceSubCard}>
                    <View style={styles.evidenceBadgeRow}>
                      <View style={styles.evidenceDot} />
                      <Text style={styles.evidenceSubTitle}>Uji Laboratorium (In Vitro / In Vivo)</Text>
                    </View>
                    <Text style={styles.paragraphText}>{herbal.lab_evidence}</Text>
                  </View>
                ) : null}

                {herbal.clinical_evidence ? (
                  <View style={[styles.evidenceSubCard, { marginTop: 10 }]}>
                    <View style={styles.evidenceBadgeRow}>
                      <View style={[styles.evidenceDot, { backgroundColor: '#38bdf8' }]} />
                      <Text style={[styles.evidenceSubTitle, { color: '#7dd3fc' }]}>
                        Kajian Uji Klinis Manusia
                      </Text>
                    </View>
                    <Text style={styles.paragraphText}>{herbal.clinical_evidence}</Text>
                  </View>
                ) : null}
              </GlassView>
            )}

            {/* JURNAL */}
            {showJournals && (
              <GlassView radius={26} intensity={32} contentStyle={styles.blockInner}>
                <SectionHead
                  icon="school-outline"
                  tint="rgba(251, 191, 36, 0.22)"
                  color="#fcd34d"
                  title="Referensi Jurnal Ilmiah"
                  caption="Publikasi 2020 – Terbaru (Europe PMC & Crossref)"
                />

                {references.length === 0 ? (
                  <View style={styles.emptyJournalBox}>
                    <Ionicons name="document-outline" size={28} color="#86efac" />
                    <Text style={styles.emptyJournalText}>
                      Belum ada publikasi DOI (2020–terbaru) yang tersinkron untuk spesies ini.
                    </Text>
                    <TouchableOpacity style={styles.syncNowPillBtn} onPress={onRefresh}>
                      <Ionicons name="refresh" size={14} color="#0f2d1c" />
                      <Text style={styles.syncNowPillText}>Sinkronkan Jurnal</Text>
                    </TouchableOpacity>
                  </View>
                ) : (
                  <View style={styles.journalList}>
                    {references.map((ref: any, idx: number) => {
                      const doiHref =
                        ref.doi_or_url || ref.url || (ref.doi ? `https://doi.org/${ref.doi}` : '');
                      const rawDoiCode = doiHref.replace(/^https?:\/\/doi\.org\//i, '');
                      const authorInfo =
                        ref.author_year ||
                        (ref.authors
                          ? `${ref.authors}${ref.year ? ` (${ref.year})` : ''}`
                          : 'Peneliti Botani');

                      return (
                        <View key={`ref-${ref.id ?? idx}`} style={styles.journalItemCard}>
                          <View style={styles.journalItemTop}>
                            <View style={styles.journalNumberBadge}>
                              <Text style={styles.journalNumberText}>
                                {String(idx + 1).padStart(2, '0')}
                              </Text>
                            </View>
                            <View style={styles.evidenceLevelPill}>
                              <Text style={styles.evidenceLevelText}>
                                {ref.evidence_level || 'Peer-Reviewed'}
                              </Text>
                            </View>
                          </View>

                          <Text style={styles.journalPaperTitle}>{ref.title}</Text>

                          <View style={styles.journalMetaLine}>
                            <Ionicons name="people-outline" size={13} color="#86efac" />
                            <Text style={styles.journalAuthorText} numberOfLines={2}>
                              {authorInfo}
                            </Text>
                          </View>

                          {ref.journal ? (
                            <View style={styles.journalMetaLine}>
                              <Ionicons name="book-outline" size={13} color="#86efac" />
                              <Text style={styles.journalSourceText} numberOfLines={1}>
                                {ref.journal}
                              </Text>
                            </View>
                          ) : null}

                          {doiHref ? (
                            <View style={styles.journalFooterRow}>
                              <Text style={styles.doiCodeText} numberOfLines={1}>
                                DOI: {rawDoiCode}
                              </Text>
                              <TouchableOpacity
                                style={styles.openDoiPillBtn}
                                activeOpacity={0.85}
                                onPress={() => openDoiLink(doiHref, ref.doi)}
                              >
                                <Text style={styles.openDoiPillText}>Buka Jurnal</Text>
                                <Ionicons name="open-outline" size={13} color="#0f2d1c" />
                              </TouchableOpacity>
                            </View>
                          ) : null}
                        </View>
                      );
                    })}
                  </View>
                )}
              </GlassView>
            )}
          </View>
        </View>
      </Animated.ScrollView>

      {/* Bilah atas melayang: kembali, judul (muncul saat scroll), bagikan */}
      <View pointerEvents="box-none" style={styles.floatingTopBar}>
        <TouchableOpacity activeOpacity={0.85} onPress={onBack}>
          <GlassView radius={22} intensity={70} shadow style={styles.circleGlass} contentStyle={styles.circleInner}>
            <Ionicons name="arrow-back" size={20} color="#ffffff" />
          </GlassView>
        </TouchableOpacity>

        <Animated.View pointerEvents="none" style={[styles.miniTitleWrap, { opacity: miniOpacity }]}>
          <GlassView radius={20} intensity={70} shadow contentStyle={styles.miniTitleInner}>
            <Text style={styles.miniTitle} numberOfLines={1}>
              {herbal.name}
            </Text>
          </GlassView>
        </Animated.View>

        <TouchableOpacity activeOpacity={0.85} onPress={handleShare}>
          <GlassView radius={22} intensity={70} shadow style={styles.circleGlass} contentStyle={styles.circleInner}>
            <Ionicons name="share-social-outline" size={19} color="#ffffff" />
          </GlassView>
        </TouchableOpacity>
      </View>
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
    padding: 24,
    gap: 12,
  },
  loadingText: { fontSize: 13.5, color: C.textSoft, fontWeight: '600' },
  errorGlassCard: {
    width: '100%',
    maxWidth: 360,
    borderRadius: 30,
    padding: 24,
    alignItems: 'center',
    gap: 8,
    ...glass,
  },
  errorIconCircle: {
    width: 70,
    height: 70,
    borderRadius: 35,
    backgroundColor: C.dangerBg,
    borderWidth: 1,
    borderColor: 'rgba(252, 165, 165, 0.4)',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 6,
  },
  errorTitle: { fontSize: 18, fontWeight: '800', color: C.white },
  errorSub: { fontSize: 13, color: C.textSoft, textAlign: 'center', lineHeight: 20 },
  errorBtnRow: { flexDirection: 'row', gap: 10, marginTop: 12, width: '100%' },
  backOutlineBtn: {
    flex: 1,
    paddingVertical: 13,
    borderRadius: R.pill,
    borderWidth: 1,
    borderColor: C.glassBorderHi,
    alignItems: 'center',
    justifyContent: 'center',
  },
  backOutlineText: { color: C.white, fontSize: 13.5, fontWeight: '700' },
  retryPillBtn: {
    flex: 1,
    paddingVertical: 13,
    borderRadius: R.pill,
    backgroundColor: C.white,
    alignItems: 'center',
    justifyContent: 'center',
  },
  retryPillText: { color: C.ink, fontSize: 13.5, fontWeight: '800' },

  scrollContent: { paddingBottom: 0 },

  heroWrapper: {
    height: HERO_H,
    width: '100%',
    backgroundColor: 'transparent',
    overflow: 'hidden',
  },
  heroImage: { width: '100%', height: '100%' },
  heroPlaceholder: {
    width: '100%',
    height: '100%',
    backgroundColor: 'rgba(19, 56, 35, 0.55)',
    alignItems: 'center',
    justifyContent: 'center',
  },

  floatingTopBar: {
    position: 'absolute',
    top: Platform.OS === 'android' ? 42 : 54,
    left: 16,
    right: 16,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 10,
  },
  circleGlass: { width: 44, height: 44 },
  circleInner: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  miniTitleWrap: { flex: 1 },
  miniTitleInner: { paddingHorizontal: 16, paddingVertical: 11, alignItems: 'center' },
  miniTitle: { color: C.white, fontSize: 14, fontWeight: '800' },

  /* Panel Sheet Melengkung Menyatu dengan Gambar */
  sheetContainer: {
    marginTop: -44,
    borderTopLeftRadius: 36,
    borderTopRightRadius: 36,
    overflow: 'hidden',
    borderTopWidth: 1.5,
    borderLeftWidth: 1,
    borderRightWidth: 1,
    borderTopColor: 'rgba(167, 243, 208, 0.42)',
    borderLeftColor: 'rgba(255, 255, 255, 0.14)',
    borderRightColor: 'rgba(255, 255, 255, 0.14)',
    paddingBottom: 48,
    minHeight: 540,
  },
  handleWrap: {
    alignItems: 'center',
    paddingTop: 12,
    paddingBottom: 8,
  },
  sheetHandle: {
    width: 44,
    height: 5,
    borderRadius: 3,
    backgroundColor: 'rgba(236, 253, 245, 0.32)',
  },
  headingSection: {
    paddingHorizontal: 22,
    paddingTop: 6,
    paddingBottom: 18,
  },
  statusBadge: {
    alignSelf: 'flex-start',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: C.leaf,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: R.pill,
    marginBottom: 12,
  },
  statusBadgeToxic: { backgroundColor: C.dangerDeep },
  statusBadgeText: { color: C.white, fontSize: 11.5, fontWeight: '800' },
  plantTitle: {
    fontSize: 30,
    fontWeight: '800',
    color: C.white,
    letterSpacing: -0.6,
    lineHeight: 35,
  },
  latinSubtitle: {
    fontSize: 15.5,
    fontStyle: 'italic',
    color: C.leafSoft,
    fontWeight: '600',
    marginTop: 3,
  },
  localAliasRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 7,
    marginTop: 10,
  },
  localAliasText: { flex: 1, fontSize: 12.5, color: C.textSoft, lineHeight: 18 },
  headingDivider: {
    height: 1,
    marginHorizontal: 20,
    marginBottom: 16,
    backgroundColor: 'rgba(255, 255, 255, 0.12)',
  },

  sheetBody: {
    paddingHorizontal: 18,
    gap: 14,
  },
  bentoRow: { flexDirection: 'row', gap: 10 },
  bentoInner: { paddingVertical: 14, paddingHorizontal: 8, alignItems: 'center', gap: 4 },
  bentoIconBox: {
    width: 40,
    height: 40,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 4,
  },
  bentoLabel: { fontSize: 10.5, color: C.textFaint, fontWeight: '600' },
  bentoValue: { fontSize: 13, fontWeight: '800', color: C.white, textAlign: 'center' },

  tabScrollRow: { gap: 8, paddingRight: 8 },
  tabPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 15,
    paddingVertical: 10,
    borderRadius: R.pill,
    ...glass,
  },
  tabPillActive: { backgroundColor: C.white, borderColor: C.white },
  tabPillText: { color: C.mint, fontSize: 12.5, fontWeight: '700' },
  tabPillTextActive: { color: C.ink, fontWeight: '800' },

  safetyInner: { flexDirection: 'row', gap: 12, padding: 16 },
  safetyIconCircle: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  safetyHeading: { fontSize: 13.5, fontWeight: '800', color: '#fef08a', marginBottom: 3 },
  safetyDesc: { fontSize: 12.5, lineHeight: 19, color: '#fef9c3' },

  blockInner: { padding: 18 },
  sectionTitleRow: { flexDirection: 'row', alignItems: 'center', gap: 11, marginBottom: 13 },
  sectionIconBadge: {
    width: 36,
    height: 36,
    borderRadius: 13,
    alignItems: 'center',
    justifyContent: 'center',
  },
  sectionTitle: { fontSize: 15, fontWeight: '800', color: C.white },
  journalSubCaption: { fontSize: 11, color: C.textFaint, marginTop: 1 },
  paragraphText: { fontSize: 13.5, lineHeight: 23, color: 'rgba(236, 253, 245, 0.88)' },

  compareGrid: { flexDirection: 'row', gap: 10 },
  compareCol: { flex: 1, gap: 7 },
  compareImg: {
    width: '100%',
    aspectRatio: 1,
    borderRadius: 20,
    backgroundColor: C.glassHi,
  },
  compareLabel: { fontSize: 11, fontWeight: '700', color: C.textSoft, textAlign: 'center' },

  evidenceSubCard: {
    borderRadius: 20,
    padding: 14,
    backgroundColor: 'rgba(255, 255, 255, 0.06)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.12)',
  },
  evidenceBadgeRow: { flexDirection: 'row', alignItems: 'center', gap: 7, marginBottom: 6 },
  evidenceDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: C.leaf },
  evidenceSubTitle: { fontSize: 12.5, fontWeight: '800', color: C.leafSoft },

  emptyJournalBox: { alignItems: 'center', gap: 10, paddingVertical: 14 },
  emptyJournalText: { fontSize: 12.5, color: C.textSoft, textAlign: 'center', lineHeight: 19 },
  syncNowPillBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: C.white,
    paddingHorizontal: 18,
    paddingVertical: 10,
    borderRadius: R.pill,
  },
  syncNowPillText: { color: C.ink, fontSize: 12.5, fontWeight: '800' },

  journalList: { gap: 10 },
  journalItemCard: {
    borderRadius: 22,
    padding: 14,
    gap: 8,
    backgroundColor: 'rgba(255, 255, 255, 0.06)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.12)',
  },
  journalItemTop: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  journalNumberBadge: {
    minWidth: 34,
    height: 26,
    paddingHorizontal: 8,
    borderRadius: 9,
    backgroundColor: 'rgba(251, 191, 36, 0.2)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  journalNumberText: { color: C.amber, fontSize: 11.5, fontWeight: '800' },
  evidenceLevelPill: {
    backgroundColor: 'rgba(74, 222, 128, 0.16)',
    borderWidth: 1,
    borderColor: 'rgba(134, 239, 172, 0.3)',
    paddingHorizontal: 10,
    paddingVertical: 3,
    borderRadius: R.pill,
  },
  evidenceLevelText: { color: C.leafSoft, fontSize: 10.5, fontWeight: '800' },
  journalPaperTitle: { fontSize: 14, fontWeight: '800', color: C.white, lineHeight: 20 },
  journalMetaLine: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  journalAuthorText: { flex: 1, fontSize: 12, color: C.textSoft },
  journalSourceText: { flex: 1, fontSize: 12, color: C.textSoft, fontStyle: 'italic' },
  journalFooterRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 10,
    marginTop: 4,
  },
  doiCodeText: { flex: 1, fontSize: 11, color: C.textFaint },
  openDoiPillBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: C.white,
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: R.pill,
  },
  openDoiPillText: { color: C.ink, fontSize: 12, fontWeight: '800' },
});