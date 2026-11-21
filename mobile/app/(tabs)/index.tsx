import AsyncStorage from "@react-native-async-storage/async-storage";
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Image,
  RefreshControl,
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { useFocusEffect, useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import * as ApiModule from '../../services/api';
import * as ClassifierModule from '../../services/classifier';
import { HerbalItem } from '../../types/herbal';
import BotanicalBackdrop from '../../components/BotanicalBackdrop';
import {
  C,
  R,
  SCREEN_BOTTOM_PAD,
  SCREEN_TOP_PAD,
  glass,
} from '../../constants/herbalTheme';

type FilterCategory = 'all' | 'safe' | 'toxic' | 'leaf' | 'journal';

function deepExtractArray(raw: any, depth = 0): any[] {
  if (!raw || depth > 4) return [];
  if (Array.isArray(raw)) return raw;
  if (typeof raw === 'object') {
    const priorityKeys = [
      'data',
      'herbals',
      'items',
      'results',
      'records',
      'list',
      'payload',
    ];
    for (const key of priorityKeys) {
      if (key in raw && raw[key] !== undefined && raw[key] !== null) {
        const found = deepExtractArray(raw[key], depth + 1);
        if (found.length > 0) return found;
      }
    }
    for (const val of Object.values(raw)) {
      if (Array.isArray(val) && val.length > 0) return val;
    }
    for (const val of Object.values(raw)) {
      if (val && typeof val === 'object') {
        const found = deepExtractArray(val, depth + 1);
        if (found.length > 0) return found;
      }
    }
  }
  return [];
}

function findAxiosClient() {
  const exportsPool = [
    ...Object.values(ApiModule || {}),
    ...Object.values(ClassifierModule || {}),
  ];
  return (
    exportsPool.find(
      (exp: any) =>
        exp &&
        (typeof exp === 'object' || typeof exp === 'function') &&
        typeof exp.get === 'function'
    ) || null
  );
}

function getHerbalKeywordBadge(item: any): { label: string; toxic: boolean } {
  const name = (item?.name || '').toLowerCase();
  const isToxic = Boolean(item?.is_toxic) || name.includes('beracun');
  if (isToxic) {
    return { label: 'Beracun', toxic: true };
  }

  const text = `${item?.traditional_usage || ''} ${item?.description || ''}`.toLowerCase();
  const keywordMap: [RegExp, string][] = [
    [/antioksidan|radikal bebas/, 'Antioksidan'],
    [/imun|daya tahan|stamina/, 'Imunitas'],
    [/pencernaan|lambung|diare|mual|perut/, 'Pencernaan'],
    [/radang|antiinflamasi|nyeri|bengkak/, 'Antiinflamasi'],
    [/demam|panas|flu|batuk/, 'Pereda Demam'],
    [/kulit|luka|gatal/, 'Kesehatan Kulit'],
    [/gula|diabetes|kolesterol|darah/, 'Metabolisme'],
    [/relaksasi|tidur|tenang/, 'Relaksasi'],
  ];

  for (const [pattern, badge] of keywordMap) {
    if (pattern.test(text)) {
      return { label: badge, toxic: false };
    }
  }

  const cleanPart = (item?.plant_parts_used || '')
    .replace(/\s*\([^)]*\)/g, '')
    .split(',')[0]
    .trim();

  if (cleanPart && !/tidak|dilarang/i.test(cleanPart)) {
    return { label: `${cleanPart} Herbal`, toxic: false };
  }

  return { label: 'Herbal Alami', toxic: false };
}

const HOME_CATALOG_CACHE_KEY = "herbal_home_catalog_cache_v1";

export default function HomeScreen() {
  const router = useRouter();
  const [allHerbals, setAllHerbals] = useState<HerbalItem[]>([]);
  const [activeFilter, setActiveFilter] = useState<FilterCategory>('all');
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [fetchError, setFetchError] = useState<string | null>(null);

  useEffect(() => {
    AsyncStorage.getItem(HOME_CATALOG_CACHE_KEY)
      .then((raw) => {
        if (!raw) return;
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed) && parsed.length > 0) {
          setAllHerbals((prev) => (prev.length > 0 ? prev : parsed));
          setLoading(false);
          parsed.slice(0, 16).forEach((it: any) => {
            if (it?.image_url && typeof it.image_url === "string" && it.image_url.startsWith("http")) {
              Image.prefetch(it.image_url).catch(() => {});
            }
          });
        }
      })
      .catch(() => {});
  }, []);

  const fetchHerbals = useCallback(async () => {
    setFetchError(null);
    try {
      const apiAny = ApiModule as any;
      const dynamicFns = Object.entries(apiAny)
        .filter(([key, val]) => {
          if (typeof val !== 'function') return false;
          const k = key.toLowerCase();
          return (
            (k.includes('herbal') || k.includes('plant')) &&
            !k.includes('slug') &&
            !k.includes('detail') &&
            !k.includes('byid') &&
            !k.includes('delete') &&
            !k.includes('classify')
          );
        })
        .map(([, val]) => val as () => Promise<any>);

      const explicitFns = [
        apiAny.getHerbals,
        apiAny.getHerbalList,
        apiAny.fetchHerbals,
        apiAny.getAllHerbals,
        apiAny.searchHerbals,
      ].filter((fn) => typeof fn === 'function');

      const fnCandidates = Array.from(new Set([...explicitFns, ...dynamicFns]));
      let parsedList: HerbalItem[] = [];
      let lastErr: any = null;

      for (const fn of fnCandidates) {
        try {
          const res = await fn();
          parsedList = deepExtractArray(res);
          if (parsedList.length > 0) break;
        } catch (e) {
          lastErr = e;
        }
      }

      if (parsedList.length === 0) {
        const client = findAxiosClient();
        if (client?.get) {
          for (const endpoint of ['/herbals']) {
            try {
              const res = await client.get(endpoint);
              parsedList = deepExtractArray(res);
              if (parsedList.length > 0) break;
            } catch (e) {
              lastErr = e;
            }
          }
        }
      }

      if (parsedList.length === 0 && lastErr) {
        throw lastErr;
      }

      setAllHerbals(parsedList);
      AsyncStorage.setItem(HOME_CATALOG_CACHE_KEY, JSON.stringify(parsedList)).catch(() => {});
      parsedList.slice(0, 16).forEach((it: any) => {
        if (it?.image_url && typeof it.image_url === "string" && it.image_url.startsWith("http")) {
          Image.prefetch(it.image_url).catch(() => {});
        }
      });
    } catch (err: any) {
      setFetchError(
        err?.response?.data?.message ||
          err?.message ||
          'Gagal memuat katalog tanaman dari server.'
      );
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      fetchHerbals();
    }, [fetchHerbals])
  );

  useEffect(() => {
    fetchHerbals();
  }, [fetchHerbals]);

  const onRefresh = () => {
    setRefreshing(true);
    fetchHerbals();
  };

  const displayedHerbals = useMemo(() => {
    return allHerbals.filter((item: any) => {
      const badge = getHerbalKeywordBadge(item);
      const refCount = Number(item.references_count ?? 0);
      const part = (item.plant_parts_used || '').toLowerCase();

      if (activeFilter === 'safe' && badge.toxic) return false;
      if (activeFilter === 'toxic' && !badge.toxic) return false;
      if (activeFilter === 'journal' && refCount <= 0) return false;
      if (
        activeFilter === 'leaf' &&
        !part.includes('daun') &&
        !part.includes('rimpang') &&
        !part.includes('herba')
      ) {
        return false;
      }

      return true;
    });
  }, [allHerbals, activeFilter]);

  const featuredHerbals = useMemo(() => allHerbals.slice(0, 6), [allHerbals]);

  const totalJournals = useMemo(
    () =>
      allHerbals.reduce(
        (sum, item: any) => sum + Number(item.references_count ?? 0),
        0
      ),
    [allHerbals]
  );

  const filterChips: {
    key: FilterCategory;
    label: string;
    icon: keyof typeof Ionicons.glyphMap;
  }[] = [
    { key: 'all', label: `Semua (${allHerbals.length})`, icon: 'apps-outline' },
    { key: 'safe', label: 'Herbal Aman', icon: 'shield-checkmark-outline' },
    { key: 'toxic', label: 'Beracun', icon: 'warning-outline' },
    { key: 'leaf', label: 'Daun & Rimpang', icon: 'leaf-outline' },
    { key: 'journal', label: 'Berjurnal Ilmiah', icon: 'school-outline' },
  ];

  return (
    <View style={styles.screen}>
      <StatusBar barStyle="light-content" translucent backgroundColor="transparent" />

      <BotanicalBackdrop tone="soft" />

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.scrollContent}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor="#4ade80"
            colors={['#16a34a']}
          />
        }
      >
        {/* Header */}
        <View style={styles.topHeader}>
          <View style={styles.brandRow}>
            <View style={styles.logoCircle}>
              <Ionicons name="leaf" size={18} color={C.leaf} />
            </View>
            <Text style={styles.brandText}>HerbalScan Botani</Text>
          </View>

          <TouchableOpacity
            style={styles.glassIconCircle}
            onPress={() => router.push('/(tabs)/history')}
          >
            <Ionicons name="time-outline" size={20} color="#ecfdf5" />
          </TouchableOpacity>
        </View>

        {/* Judul */}
        <View style={styles.heroTitleBlock}>
          <Text style={styles.heroTitle}>
            Asisten Botani &{'\n'}
            <Text style={styles.heroTitleBold}>Herbal Cerdas</Text>
          </Text>
          <Text style={styles.heroSubtitle}>
            Identifikasi tanaman secara presisi, cek keamanan konsumsi, dan telusuri jurnal ilmiah terkurasi.
          </Text>
        </View>

        {/* 3 kartu fitur */}
        <View style={styles.featureGridRow}>
          <View style={styles.glassSquareCard}>
            <Text style={styles.squareCardTitle}>Deteksi Instan</Text>
            <Text style={styles.squareCardSub}>Kamera Presisi 1:1</Text>
            <View style={styles.squareIconGlow}>
              <Ionicons name="search" size={22} color={C.leaf} />
            </View>
          </View>

          <View style={[styles.glassSquareCard, styles.glassSquareCardActive]}>
            <Text style={styles.squareCardTitleActive}>Scan Herbal</Text>
            <Text style={styles.squareCardSubActive}>Multi-spesimen</Text>
            <View style={styles.squareIconGlowActive}>
              <Ionicons name="scan" size={22} color="#15803d" />
            </View>
          </View>

          <View style={styles.glassSquareCard}>
            <Text style={styles.squareCardTitle}>Jurnal Ilmiah</Text>
            <Text style={styles.squareCardSub}>
              {totalJournals > 0 ? `${totalJournals} Publikasi` : 'Rujukan Terkurasi'}
            </Text>
            <View style={styles.squareIconGlow}>
              <Ionicons name="checkmark-circle" size={22} color={C.leaf} />
            </View>
          </View>
        </View>

        {/* 2 kartu lebar */}
        <TouchableOpacity
          activeOpacity={0.88}
          style={styles.wideCard}
          onPress={() => router.push('/(tabs)/scan')}
        >
          <View style={styles.wideTextCol}>
            <Text style={styles.wideTitle}>Cek Keamanan Konsumsi</Text>
            <Text style={styles.wideSub}>
              Kenali tanaman beracun dan lihat ringkasan khasiatnya sebelum digunakan.
            </Text>
          </View>
          <View style={styles.wideGem}>
            <Ionicons name="shield-checkmark" size={30} color="#ffffff" />
          </View>
        </TouchableOpacity>

        <TouchableOpacity
          activeOpacity={0.88}
          style={[styles.wideCard, { marginBottom: 18 }]}
          onPress={() => router.push('/(tabs)/history')}
        >
          <View style={styles.wideTextCol}>
            <Text style={styles.wideTitle}>Jejak Pindai Anda</Text>
            <Text style={styles.wideSub}>
              Buka kembali spesimen yang pernah Anda identifikasi kapan saja.
            </Text>
          </View>
          <View style={[styles.wideGem, styles.wideGemAlt]}>
            <Ionicons name="albums" size={28} color="#ffffff" />
          </View>
        </TouchableOpacity>

        {/* CTA utama */}
        <TouchableOpacity
          activeOpacity={0.9}
          style={styles.primaryPillCta}
          onPress={() => router.push('/(tabs)/scan')}
        >
          <Ionicons name="sparkles" size={14} color="#15803d" />
          <Text style={styles.primaryPillCtaText}>Mulai Pindai Tanaman</Text>
        </TouchableOpacity>

        {/* Carousel sorotan */}
        {!loading && featuredHerbals.length > 0 && (
          <View style={styles.featuredSection}>
            <View style={styles.sectionHeaderRow}>
              <Text style={styles.sectionTitle}>Sorotan Spesies Terkurasi</Text>
              <Text style={styles.swipeHintText}>Geser →</Text>
            </View>

            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.featuredHorizontalList}
            >
              {featuredHerbals.map((item: any, idx: number) => {
                const badge = getHerbalKeywordBadge(item);
                return (
                  <TouchableOpacity
                    key={`feat-${item.slug || idx}`}
                    activeOpacity={0.88}
                    style={styles.featuredCard}
                    onPress={() =>
                      router.push({
                        pathname: '/detail/[slug]',
                        params: { slug: item.slug },
                      } as any)
                    }
                  >
                    {item.image_url ? (
                      <Image
                        source={{ uri: item.image_url }}
                        style={styles.featuredImg}
                        resizeMode="cover"
                      />
                    ) : (
                      <View style={styles.featuredFallback}>
                        <Ionicons
                          name={badge.toxic ? 'warning' : 'leaf'}
                          size={30}
                          color={badge.toxic ? '#fca5a5' : '#4ade80'}
                        />
                      </View>
                    )}

                    <View
                      style={[
                        styles.featuredBadge,
                        badge.toxic && { backgroundColor: 'rgba(220, 38, 38, 0.92)' },
                      ]}
                    >
                      <Text style={styles.featuredBadgeText} numberOfLines={1}>
                        {badge.label}
                      </Text>
                    </View>

                    <Text style={styles.featuredName} numberOfLines={1}>
                      {item.name}
                    </Text>
                    <Text style={styles.featuredLatin} numberOfLines={1}>
                      {item.scientific_name}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </ScrollView>
          </View>
        )}

        {/* Katalog */}
        <View style={styles.sectionHeaderRow}>
          <Text style={styles.sectionTitle}>Katalog Monograf Botani</Text>
          <View style={styles.countGlassPill}>
            <Text style={styles.countGlassText}>{displayedHerbals.length} Spesies</Text>
          </View>
        </View>

        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.filterScrollRow}
        >
          {filterChips.map((chip) => {
            const active = activeFilter === chip.key;
            return (
              <TouchableOpacity
                key={chip.key}
                activeOpacity={0.85}
                style={[styles.filterChip, active && styles.filterChipActive]}
                onPress={() => setActiveFilter(chip.key)}
              >
                <Ionicons
                  name={chip.icon}
                  size={14}
                  color={active ? '#0f2d1c' : '#86efac'}
                />
                <Text
                  style={[styles.filterChipText, active && styles.filterChipTextActive]}
                >
                  {chip.label}
                </Text>
              </TouchableOpacity>
            );
          })}
        </ScrollView>

        {loading ? (
          <View style={styles.loadingBox}>
            <ActivityIndicator size="large" color="#4ade80" />
            <Text style={styles.loadingText}>Memuat katalog botani...</Text>
          </View>
        ) : fetchError && allHerbals.length === 0 ? (
          <View style={styles.emptyGlassCard}>
            <Ionicons name="cloud-offline-outline" size={32} color="#fca5a5" />
            <Text style={styles.emptyTitle}>Gagal Memuat Katalog</Text>
            <Text style={styles.emptySub}>{fetchError}</Text>
            <TouchableOpacity
              style={styles.retryPillBtn}
              onPress={() => {
                setLoading(true);
                fetchHerbals();
              }}
            >
              <Text style={styles.retryPillText}>Coba Lagi</Text>
            </TouchableOpacity>
          </View>
        ) : displayedHerbals.length === 0 ? (
          <View style={styles.emptyGlassCard}>
            <Ionicons name="leaf-outline" size={32} color="#86efac" />
            <Text style={styles.emptyTitle}>Spesimen Belum Ditemukan</Text>
            <Text style={styles.emptySub}>
              Pilih filter kategori lain atau gunakan menu Cari di bilah navigasi bawah.
            </Text>
            {activeFilter !== 'all' && (
              <TouchableOpacity
                style={styles.retryPillBtn}
                onPress={() => setActiveFilter('all')}
              >
                <Text style={styles.retryPillText}>Tampilkan Semua</Text>
              </TouchableOpacity>
            )}
          </View>
        ) : (
          <View style={styles.cardsStack}>
            {displayedHerbals.map((item: any, idx: number) => {
              const badge = getHerbalKeywordBadge(item);
              return (
                <TouchableOpacity
                  key={item.slug || String(item.id ?? idx)}
                  activeOpacity={0.86}
                  style={styles.plantGlassCard}
                  onPress={() =>
                    router.push({
                      pathname: '/detail/[slug]',
                      params: { slug: item.slug },
                    } as any)
                  }
                >
                  {item.image_url ? (
                    <Image
                      source={{ uri: item.image_url }}
                      style={styles.plantThumb}
                      resizeMode="cover"
                    />
                  ) : (
                    <View
                      style={[
                        styles.plantFallbackBadge,
                        badge.toxic && { backgroundColor: 'rgba(239, 68, 68, 0.24)' },
                      ]}
                    >
                      <Ionicons
                        name={badge.toxic ? 'warning' : 'leaf'}
                        size={26}
                        color={badge.toxic ? '#fca5a5' : '#4ade80'}
                      />
                    </View>
                  )}

                  <View style={styles.plantCardContent}>
                    <View style={styles.plantCardTopRow}>
                      <Text style={styles.plantName} numberOfLines={1}>
                        {item.name}
                      </Text>
                      {(badge.toxic || (item.name || "").length <= 20) && (
                        <View
                          style={[
                            styles.keywordTagBadge,
                            badge.toxic && styles.keywordTagBadgeToxic,
                          ]}
                        >
                          <Text
                            numberOfLines={1}
                            style={[
                              styles.keywordTagText,
                              badge.toxic && { color: '#ffffff' },
                            ]}
                          >
                            {badge.label}
                          </Text>
                        </View>
                      )}
                    </View>

                    <Text style={styles.plantScientific} numberOfLines={1}>
                      {item.scientific_name}
                    </Text>

                    <Text style={styles.plantDesc} numberOfLines={2}>
                      {item.traditional_usage || item.description}
                    </Text>
                  </View>

                  <Ionicons name="chevron-forward" size={18} color={C.textFaint} />
                </TouchableOpacity>
              );
            })}
          </View>
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: C.bgSoft },

  scrollContent: {
    paddingTop: SCREEN_TOP_PAD,
    paddingHorizontal: 20,
    paddingBottom: SCREEN_BOTTOM_PAD,
  },
  topHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 22,
  },
  brandRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  logoCircle: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    ...glass,
  },
  brandText: { color: C.mint, fontSize: 14.5, fontWeight: '700' },
  glassIconCircle: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    ...glass,
  },

  heroTitleBlock: { marginBottom: 22 },
  heroTitle: {
    fontSize: 31,
    fontWeight: '300',
    color: C.white,
    lineHeight: 38,
    letterSpacing: -0.5,
  },
  heroTitleBold: { fontWeight: '800' },
  heroSubtitle: {
    marginTop: 10,
    fontSize: 14,
    color: C.textSoft,
    lineHeight: 21,
    maxWidth: 340,
  },

  featureGridRow: { flexDirection: 'row', gap: 10, marginBottom: 12 },
  glassSquareCard: {
    flex: 1,
    borderRadius: 24,
    padding: 12,
    alignItems: 'center',
    justifyContent: 'space-between',
    minHeight: 124,
    ...glass,
  },
  glassSquareCardActive: {
    backgroundColor: C.emerald,
    borderColor: 'rgba(187, 247, 208, 0.75)',
    shadowColor: C.emerald,
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.4,
    shadowRadius: 14,
    elevation: 8,
  },
  squareCardTitle: {
    fontSize: 12,
    fontWeight: '800',
    color: C.white,
    textAlign: 'center',
  },
  squareCardSub: {
    fontSize: 10,
    color: C.textSoft,
    textAlign: 'center',
    marginTop: 2,
  },
  squareCardTitleActive: {
    fontSize: 12,
    fontWeight: '800',
    color: C.white,
    textAlign: 'center',
  },
  squareCardSubActive: {
    fontSize: 10,
    color: C.mint,
    textAlign: 'center',
    marginTop: 2,
  },
  squareIconGlow: {
    width: 44,
    height: 44,
    borderRadius: 15,
    backgroundColor: 'rgba(74, 222, 128, 0.16)',
    borderWidth: 1,
    borderColor: 'rgba(134, 239, 172, 0.38)',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 8,
  },
  squareIconGlowActive: {
    width: 44,
    height: 44,
    borderRadius: 15,
    backgroundColor: C.white,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 8,
  },

  wideCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    borderRadius: 24,
    paddingVertical: 16,
    paddingHorizontal: 18,
    marginBottom: 10,
    ...glass,
  },
  wideTextCol: { flex: 1 },
  wideTitle: { color: C.white, fontSize: 15, fontWeight: '800' },
  wideSub: { color: C.textSoft, fontSize: 12, lineHeight: 18, marginTop: 4 },
  wideGem: {
    width: 58,
    height: 58,
    borderRadius: 19,
    backgroundColor: C.emerald,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: C.emerald,
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.4,
    shadowRadius: 10,
    elevation: 6,
  },
  wideGemAlt: { backgroundColor: '#16A34A' },

  primaryPillCta: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: C.white,
    paddingVertical: 16,
    borderRadius: R.pill,
    marginBottom: 24,
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.28,
    shadowRadius: 14,
    elevation: 8,
  },
  primaryPillCtaText: { color: C.ink, fontSize: 15, fontWeight: '800' },

  featuredSection: { marginBottom: 22 },
  swipeHintText: { color: C.leafSoft, fontSize: 11.5, fontWeight: '700' },
  featuredHorizontalList: { gap: 12, paddingRight: 8 },
  featuredCard: {
    width: 158,
    borderRadius: 26,
    padding: 10,
    position: 'relative',
    ...glass,
  },
  featuredImg: {
    width: '100%',
    height: 108,
    borderRadius: 18,
    backgroundColor: C.glassHi,
    marginBottom: 10,
  },
  featuredFallback: {
    width: '100%',
    height: 108,
    borderRadius: 18,
    backgroundColor: 'rgba(74, 222, 128, 0.16)',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 10,
  },
  featuredBadge: {
    position: 'absolute',
    top: 17,
    right: 17,
    maxWidth: 116,
    backgroundColor: 'rgba(9, 29, 18, 0.82)',
    borderWidth: 1,
    borderColor: 'rgba(134, 239, 172, 0.35)',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 8,
  },
  featuredBadgeText: { color: C.mint, fontSize: 9.5, fontWeight: '800' },
  featuredName: { fontSize: 14, fontWeight: '800', color: C.white },
  featuredLatin: {
    fontSize: 11,
    fontStyle: 'italic',
    color: C.leafSoft,
    marginTop: 1,
  },

  sectionHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  sectionTitle: { fontSize: 17, fontWeight: '800', color: C.white },
  countGlassPill: {
    backgroundColor: 'rgba(74, 222, 128, 0.16)',
    borderWidth: 1,
    borderColor: 'rgba(74, 222, 128, 0.35)',
    paddingHorizontal: 11,
    paddingVertical: 4,
    borderRadius: R.pill,
  },
  countGlassText: { color: C.leafSoft, fontSize: 11.5, fontWeight: '700' },
  filterScrollRow: { gap: 8, paddingBottom: 16, paddingRight: 8 },
  filterChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 14,
    paddingVertical: 9,
    borderRadius: R.pill,
    ...glass,
  },
  filterChipActive: { backgroundColor: C.white, borderColor: C.white },
  filterChipText: { color: C.mint, fontSize: 12, fontWeight: '700' },
  filterChipTextActive: { color: C.ink, fontWeight: '800' },

  loadingBox: { paddingVertical: 36, alignItems: 'center', gap: 10 },
  loadingText: { color: C.textSoft, fontSize: 13 },
  emptyGlassCard: {
    borderRadius: R.card,
    padding: 24,
    alignItems: 'center',
    gap: 8,
    ...glass,
  },
  emptyTitle: { color: C.white, fontSize: 15.5, fontWeight: '800' },
  emptySub: {
    color: C.textSoft,
    fontSize: 12.5,
    textAlign: 'center',
    lineHeight: 18,
  },
  retryPillBtn: {
    marginTop: 6,
    backgroundColor: C.white,
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: R.pill,
  },
  retryPillText: { color: C.ink, fontSize: 12.5, fontWeight: '800' },

  cardsStack: { gap: 12 },
  plantGlassCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    borderRadius: 26,
    padding: 12,
    ...glass,
  },
  plantCardContent: { flex: 1, gap: 3 },
  plantCardTopRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  plantName: {
    flex: 1,
    flexShrink: 1,
    fontSize: 15,
    fontWeight: "800",
    color: C.white,
  },
  keywordTagBadge: {
    flexShrink: 0,
    maxWidth: 104,
    flexShrink: 0,
    maxWidth: 108,
    backgroundColor: 'rgba(74, 222, 128, 0.2)',
    borderWidth: 1,
    borderColor: 'rgba(134, 239, 172, 0.35)',
    paddingHorizontal: 8,
    paddingVertical: 2.5,
    borderRadius: 8,
  },
  keywordTagBadgeToxic: {
    backgroundColor: 'rgba(220, 38, 38, 0.88)',
    borderColor: 'rgba(252, 165, 165, 0.5)',
  },
  keywordTagText: { color: C.leafSoft, fontSize: 10, fontWeight: '800' },
  plantScientific: {
    fontSize: 12.5,
    fontStyle: 'italic',
    color: C.leafSoft,
    fontWeight: '600',
  },
  plantDesc: {
    fontSize: 12,
    color: C.textSoft,
    lineHeight: 17.5,
    marginTop: 2,
  },
  plantThumb: {
    width: 70,
    height: 70,
    borderRadius: R.thumb,
    backgroundColor: C.glassHi,
  },
  plantFallbackBadge: {
    width: 70,
    height: 70,
    borderRadius: R.thumb,
    backgroundColor: 'rgba(74, 222, 128, 0.18)',
    borderWidth: 1,
    borderColor: 'rgba(134, 239, 172, 0.32)',
    alignItems: 'center',
    justifyContent: 'center',
  },
});
