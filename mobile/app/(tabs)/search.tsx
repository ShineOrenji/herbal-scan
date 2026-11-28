import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Image,
  Platform,
  RefreshControl,
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  useWindowDimensions,
  View,
} from 'react-native';
import { useFocusEffect, useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import * as ApiModule from '../../services/api';
import * as ClassifierModule from '../../services/classifier';
import { HerbalItem } from '../../types/herbal';
import BotanicalBackdrop from '../../components/BotanicalBackdrop';
import GlassView from '../../components/GlassView';
import { C, R, SCREEN_BOTTOM_PAD, SCREEN_TOP_PAD, glass } from '../../constants/herbalTheme';

let ExpoConstants: any = null;
try {
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const mod = require('expo-constants');
  ExpoConstants = mod?.default ?? mod;
} catch {
  ExpoConstants = null;
}

const GRID_GAP = 14;

type FilterCategory = {
  key: string;
  label: string;
  icon: keyof typeof Ionicons.glyphMap;
  count: number;
};

const FILTER_DEFINITIONS: {
  key: string;
  label: string;
  icon: keyof typeof Ionicons.glyphMap;
}[] = [
  { key: 'semua', label: 'Semua', icon: 'apps-outline' },
  { key: 'daun', label: 'Daun', icon: 'leaf-outline' },
  { key: 'rimpang', label: 'Rimpang & Akar', icon: 'flower-outline' },
  { key: 'buah_bunga', label: 'Buah & Bunga', icon: 'rose-outline' },
  { key: 'antioksidan', label: 'Antioksidan', icon: 'shield-checkmark-outline' },
  { key: 'antiinflamasi', label: 'Antiinflamasi', icon: 'bandage-outline' },
  { key: 'imunitas', label: 'Imunitas', icon: 'fitness-outline' },
  { key: 'pencernaan', label: 'Pencernaan', icon: 'nutrition-outline' },
  { key: 'metabolisme', label: 'Metabolisme', icon: 'pulse-outline' },
  { key: 'kulit', label: 'Kulit & Luka', icon: 'sparkles-outline' },
  { key: 'beracun', label: 'Beracun', icon: 'warning-outline' },
];

function getMetroHostIp(): string | null {
  const hostUri: string | undefined =
    ExpoConstants?.expoConfig?.hostUri ||
    ExpoConstants?.manifest2?.extra?.expoGo?.debuggerHost ||
    ExpoConstants?.manifest?.debuggerHost;

  if (typeof hostUri === 'string' && hostUri.length > 0) {
    const host = hostUri.split(':')[0];
    if (host) return host;
  }

  const linkingUri: string | undefined = ExpoConstants?.linkingUri;
  if (typeof linkingUri === 'string') {
    const match = linkingUri.match(/^(?:exp|https?):\/\/([^:/]+)/i);
    if (match?.[1]) return match[1];
  }

  return null;
}

function getCandidateApiBases(): string[] {
  const bases: string[] = [];

  // IP lokal dipindahkan ke urutan akhir setelah server produksi

  const modules = [ApiModule, ClassifierModule];
  for (const mod of modules) {
    if (!mod) continue;
    for (const exp of Object.values(mod)) {
      if (exp && (typeof exp === 'object' || typeof exp === 'function')) {
        const base = (exp as any)?.defaults?.baseURL || (exp as any)?.baseURL;
        if (typeof base === 'string' && base.startsWith('http')) {
          const clean = base.replace(/\/+$/, '');
          bases.push(clean);
          if (!clean.endsWith('/v1')) bases.push(`${clean}/v1`);
        }
      }
      if (typeof exp === 'string' && exp.startsWith('http')) {
        const clean = exp.replace(/\/+$/, '');
        bases.push(clean);
        if (!clean.endsWith('/v1')) bases.push(`${clean}/v1`);
      }
    }
  }

  const envUrl =
    process.env.EXPO_PUBLIC_API_URL ||
    process.env.EXPO_PUBLIC_BASE_URL ||
    process.env.EXPO_PUBLIC_BACKEND_URL;
  if (typeof envUrl === 'string' && envUrl.startsWith('http')) {
    const clean = envUrl.replace(/\/+$/, '');
    bases.push(clean);
    if (!clean.endsWith('/v1')) bases.push(`${clean}/v1`);
  }

  bases.unshift('https://herbal-scan-api.vercel.app/api/v1');
  const fallbackHost = Platform.OS === 'android' ? '10.0.2.2' : '127.0.0.1';
  bases.push(`http://${fallbackHost}:8000/api/v1`, `http://${fallbackHost}:8000/api`);

  return Array.from(new Set(bases));
}

function resolveDisplayImageUrl(rawUrl?: string | null, activeOrigin?: string | null): string | null {
  if (!rawUrl || typeof rawUrl !== 'string') return null;
  const trimmed = rawUrl.trim();
  if (!trimmed) return null;

  const origin =
    activeOrigin ||
    (getMetroHostIp() ? `http://${getMetroHostIp()}:8000` : null);

  if (trimmed.startsWith('/')) {
    return origin ? `${origin}${trimmed}` : trimmed;
  }

  if (origin && /^https?:\/\/(localhost|127\.0\.0\.1|10\.0\.2\.2)(:\d+)?/i.test(trimmed)) {
    return trimmed.replace(/^https?:\/\/(localhost|127\.0\.0\.1|10\.0\.2\.2)(:\d+)?/i, origin);
  }

  return trimmed;
}

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

function classifyHerbalItem(item: any): {
  isToxic: boolean;
  categories: Set<string>;
  badgeLabel: string;
} {
  const categories = new Set<string>(['semua']);
  const name = String(item?.name || '');
  const parts = String(item?.plant_parts_used || '');
  const evidenceText = `${item?.traditional_usage || ''} ${item?.lab_evidence || ''} ${
    item?.clinical_evidence || ''
  }`.toLowerCase();

  const isToxic =
    Boolean(item?.is_toxic) ||
    /\bberacun\b/i.test(name) ||
    /tidak untuk dikonsumsi/i.test(parts);

  if (Boolean(item?.is_curated)) {
    categories.add('terkurasi');
  }

  if (isToxic) {
    categories.add('beracun');
    return {
      isToxic: true,
      categories,
      badgeLabel: 'Beracun',
    };
  }

  if (/\bdaun\b/i.test(parts)) categories.add('daun');
  if (/\b(rimpang|akar)\b/i.test(parts)) categories.add('rimpang');
  if (/\b(buah|bunga|biji)\b/i.test(parts)) categories.add('buah_bunga');

  const benefitRules: { key: string; label: string; regex: RegExp }[] = [
    {
      key: 'antioksidan',
      label: 'Antioksidan',
      regex: /antioksidan|radikal bebas|flavonoid|polifenol|fenolik/,
    },
    {
      key: 'antiinflamasi',
      label: 'Antiinflamasi',
      regex: /antiinflamasi|anti-inflamasi|peradangan|radang|nyeri|bengkak|analgesik/,
    },
    {
      key: 'imunitas',
      label: 'Imunitas',
      regex: /imun|daya tahan|stamina|imunomodulator|infeksi|antibakteri|antimikroba/,
    },
    {
      key: 'pencernaan',
      label: 'Pencernaan',
      regex: /pencernaan|lambung|diare|mual|perut|maag|kembung|sembelit/,
    },
    {
      key: 'metabolisme',
      label: 'Metabolisme',
      regex: /gula darah|diabetes|kolesterol|tekanan darah|hipertensi|metabolisme/,
    },
    {
      key: 'kulit',
      label: 'Kulit & Luka',
      regex: /kulit|luka|gatal|eksim|jerawat|antiseptik|luka bakar/,
    },
  ];

  let primaryBenefitLabel = '';
  for (const rule of benefitRules) {
    if (rule.regex.test(evidenceText)) {
      categories.add(rule.key);
      if (!primaryBenefitLabel) {
        primaryBenefitLabel = rule.label;
      }
    }
  }

  const cleanPart = parts
    .replace(/\s*\([^)]*\)/g, '')
    .split(',')[0]
    .trim();

  const badgeLabel =
    primaryBenefitLabel ||
    (cleanPart && !/tidak|dilarang/i.test(cleanPart) ? `${cleanPart} Herbal` : 'Herbal Alami');

  return {
    isToxic: false,
    categories,
    badgeLabel,
  };
}

export default function SearchScreen() {
  const router = useRouter();
  const { width: screenWidth } = useWindowDimensions();
  const cardW = (screenWidth - 40 - GRID_GAP) / 2;

  const [allHerbals, setAllHerbals] = useState<HerbalItem[]>([]);
  const [activeOrigin, setActiveOrigin] = useState<string | null>(null);
  const [query, setQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('semua');
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [connectionError, setConnectionError] = useState<string | null>(null);

  const loadHerbals = useCallback(
    async (isRefresh = false) => {
      if (isRefresh) setRefreshing(true);

      try {
        let list: HerbalItem[] = [];
        let matchedOrigin: string | null = null;

        const apiAny = ApiModule as any;
        const fnCandidates = [
          apiAny.getHerbalsApi,
          apiAny.getHerbals,
          apiAny.getHerbalList,
          apiAny.fetchHerbals,
          apiAny.getAllHerbals,
        ].filter((fn) => typeof fn === 'function');

        for (const fn of fnCandidates) {
          try {
            const res = await fn();
            const extracted = deepExtractArray(res);
            if (extracted.length > 0) {
              list = extracted;
              break;
            }
          } catch {
            // Lanjut ke kandidat URL berikutnya
          }
        }

        if (list.length === 0) {
          const bases = getCandidateApiBases();
          for (const base of bases) {
            const endpoint = base.endsWith('/herbals') ? base : `${base}/herbals`;
            const controller = new AbortController();
            const timer = setTimeout(() => controller.abort(), 8000);

            try {
              const response = await fetch(endpoint, {
                method: 'GET',
                headers: { Accept: 'application/json' },
                signal: controller.signal,
              });
              clearTimeout(timer);

              if (!response.ok) continue;

              const json = await response.json();
              const extracted = deepExtractArray(json);
              if (extracted.length > 0) {
                list = extracted;
                const originMatch = endpoint.match(/^(https?:\/\/[^/]+)/i);
                if (originMatch?.[1]) {
                  matchedOrigin = originMatch[1];
                }
                break;
              }
            } catch {
              clearTimeout(timer);
            }
          }
        }

        if (matchedOrigin) {
          setActiveOrigin(matchedOrigin);
        }

        if (list.length > 0) {
          setAllHerbals(list);
          setConnectionError(null);
        } else if (allHerbals.length === 0) {
          setConnectionError(
            'Tidak dapat terhubung ke server HerbalScan. Periksa koneksi internet Anda lalu coba lagi.'
          );
        }
      } finally {
        setLoading(false);
        setRefreshing(false);
      }
    },
    [allHerbals.length]
  );

  useFocusEffect(
    useCallback(() => {
      loadHerbals(false);
    }, [loadHerbals])
  );

  useEffect(() => {
    loadHerbals(false);
  }, [loadHerbals]);

  const classifiedItems = useMemo(() => {
    return allHerbals.map((item: any) => ({
      item,
      meta: classifyHerbalItem(item),
    }));
  }, [allHerbals]);

  const availableFilters: FilterCategory[] = useMemo(() => {
    if (classifiedItems.length === 0) {
      return [{ key: 'semua', label: 'Semua', icon: 'apps-outline', count: 0 }];
    }

    const result: FilterCategory[] = [];
    for (const def of FILTER_DEFINITIONS) {
      const count = classifiedItems.filter(({ meta }) => meta.categories.has(def.key)).length;
      if (def.key === 'terkurasi' && count === classifiedItems.length) {
        continue;
      }
      if (def.key === 'semua' || def.key === 'beracun' || count > 0) {
        result.push({
          key: def.key,
          label: def.label,
          icon: def.icon,
          count,
        });
      }
    }
    return result;
  }, [classifiedItems]);

  useEffect(() => {
    if (!availableFilters.some((f) => f.key === selectedCategory)) {
      setSelectedCategory('semua');
    }
  }, [availableFilters, selectedCategory]);

  const curatedCount = useMemo(
    () => allHerbals.filter((item: any) => Boolean(item?.is_curated)).length,
    [allHerbals]
  );

  const filteredList = useMemo(() => {
    const q = query.trim().toLowerCase();

    return classifiedItems.filter(({ item, meta }) => {
      if (selectedCategory !== 'semua' && !meta.categories.has(selectedCategory)) {
        return false;
      }

      if (!q) return true;

      const searchable = `${item.name || ''} ${item.scientific_name || ''} ${
        item.local_name || ''
      } ${item.plant_parts_used || ''} ${item.traditional_usage || ''} ${
        item.description || ''
      } ${item.lab_evidence || ''} ${meta.badgeLabel}`.toLowerCase();

      return searchable.includes(q);
    });
  }, [classifiedItems, query, selectedCategory]);

  const activeFilterObj = availableFilters.find((f) => f.key === selectedCategory);

  return (
    <View style={styles.screen}>
      <StatusBar barStyle="light-content" translucent backgroundColor="transparent" />

      <BotanicalBackdrop tone="soft" />

      <ScrollView
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={() => loadHerbals(true)}
            tintColor="#4ade80"
            colors={['#4ade80']}
          />
        }
        contentContainerStyle={styles.scrollContent}
      >
        {/* Header Judul & Statistik Katalog */}
        <View style={styles.titleBlock}>
          <View style={styles.titleRow}>
            <Text style={styles.largeTitle}>Katalog</Text>
            {allHerbals.length > 0 && (
              <View style={styles.catalogPill}>
                <Ionicons name="library-outline" size={13} color="#86efac" />
                <Text style={styles.catalogPillText}>
                  {allHerbals.length} Spesies
                </Text>
              </View>
            )}
          </View>
          <Text style={styles.largeSub}>
            Cari berdasarkan nama lokal, nama latin, bagian tanaman, atau khasiat farmakologis.
          </Text>
        </View>

        {/* Bilah Pencarian + Filter Kategori (Diam di atas, transparan tanpa menempel saat scroll) */}
        <View style={styles.controlsBlock}>
          <View style={styles.searchBarWrap}>
            <GlassView
              radius={26}
              intensity={45}
              fill="rgba(255, 255, 255, 0.09)"
              contentStyle={styles.searchRow}
            >
              <Ionicons name="search" size={19} color="#bbf7d0" />
              <TextInput
                value={query}
                onChangeText={setQuery}
                placeholder="Ketik nama tanaman, latin, atau khasiat..."
                placeholderTextColor="rgba(236, 253, 245, 0.52)"
                style={styles.searchInput}
                returnKeyType="search"
              />
              {query.length > 0 ? (
                <TouchableOpacity onPress={() => setQuery('')} hitSlop={10}>
                  <Ionicons name="close-circle" size={19} color="#bbf7d0" />
                </TouchableOpacity>
              ) : (
                <View style={styles.countDot}>
                  <Text style={styles.countDotText}>{filteredList.length}</Text>
                </View>
              )}
            </GlassView>
          </View>

          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.chipsRow}
          >
            {availableFilters.map((cat) => {
              const active = selectedCategory === cat.key;
              const isToxicChip = cat.key === 'beracun';

              return (
                <TouchableOpacity
                  key={cat.key}
                  activeOpacity={0.85}
                  style={[
                    styles.chip,
                    isToxicChip && !active && styles.chipToxicOutline,
                    active && (isToxicChip ? styles.chipToxicActive : styles.chipActive),
                  ]}
                  onPress={() => setSelectedCategory(cat.key)}
                >
                  <Ionicons
                    name={cat.icon}
                    size={14}
                    color={
                      active
                        ? isToxicChip
                          ? '#ffffff'
                          : '#0f2d1c'
                        : isToxicChip
                        ? '#fca5a5'
                        : '#bbf7d0'
                    }
                  />
                  <Text
                    numberOfLines={1}
                    style={[
                      styles.chipText,
                      isToxicChip && !active && { color: '#fecaca' },
                      active && (isToxicChip ? { color: '#ffffff' } : styles.chipTextActive),
                    ]}
                  >
                    {cat.label}
                  </Text>
                  <View
                    style={[
                      styles.chipCountBadge,
                      active &&
                        (isToxicChip
                          ? { backgroundColor: 'rgba(0,0,0,0.22)' }
                          : styles.chipCountBadgeActive),
                    ]}
                  >
                    <Text
                      style={[
                        styles.chipCountText,
                        active &&
                          (isToxicChip
                            ? { color: '#ffffff' }
                            : styles.chipCountTextActive),
                      ]}
                    >
                      {cat.count}
                    </Text>
                  </View>
                </TouchableOpacity>
              );
            })}
          </ScrollView>
        </View>

        {/* Daftar Hasil Katalog */}
        <View style={styles.resultsBlock}>
          <View style={styles.resultHeadRow}>
            <Text style={styles.resultHead}>
              {query.trim()
                ? `Hasil "${query.trim()}"`
                : selectedCategory !== 'semua'
                ? `Kategori ${activeFilterObj?.label || ''}`
                : 'Koleksi Botani'}
            </Text>
            <Text style={styles.resultCount}>{filteredList.length} spesies</Text>
          </View>

          {loading ? (
            <GlassView radius={28} contentStyle={styles.stateBox}>
              <ActivityIndicator size="large" color="#4ade80" />
              <Text style={styles.stateText}>Memuat katalog botani dari server...</Text>
            </GlassView>
          ) : connectionError && allHerbals.length === 0 ? (
            <GlassView radius={28} contentStyle={styles.stateBox}>
              <View style={[styles.stateIcon, { backgroundColor: 'rgba(250, 204, 21, 0.16)' }]}>
                <Ionicons name="cloud-offline-outline" size={30} color="#fde047" />
              </View>
              <Text style={styles.stateTitle}>Katalog Belum Terjangkau</Text>
              <Text style={styles.stateText}>{connectionError}</Text>
              <TouchableOpacity style={styles.resetBtn} onPress={() => loadHerbals(true)}>
                <Text style={styles.resetBtnText}>Muat Ulang Katalog</Text>
              </TouchableOpacity>
            </GlassView>
          ) : filteredList.length === 0 ? (
            <GlassView radius={28} contentStyle={styles.stateBox}>
              <View style={styles.stateIcon}>
                <Ionicons name="leaf-outline" size={30} color="#86efac" />
              </View>
              <Text style={styles.stateTitle}>Spesimen Tidak Ditemukan</Text>
              <Text style={styles.stateText}>
                Coba kata kunci lain, atur ulang filter, atau pindai langsung tanaman baru menggunakan kamera.
              </Text>
              <View style={styles.emptyActionsRow}>
                {(query.length > 0 || selectedCategory !== 'semua') && (
                  <TouchableOpacity
                    style={styles.resetBtn}
                    onPress={() => {
                      setQuery('');
                      setSelectedCategory('semua');
                    }}
                  >
                    <Text style={styles.resetBtnText}>Atur Ulang Filter</Text>
                  </TouchableOpacity>
                )}
                <TouchableOpacity
                  style={styles.scanCtaBtn}
                  onPress={() => router.push('/(tabs)/scan' as any)}
                >
                  <Ionicons name="scan-outline" size={15} color="#bbf7d0" />
                  <Text style={styles.scanCtaText}>Pindai Tanaman</Text>
                </TouchableOpacity>
              </View>
            </GlassView>
          ) : (
            <View style={styles.grid}>
              {filteredList.map(({ item, meta }, idx) => {
                const resolvedImage = resolveDisplayImageUrl(item.image_url, activeOrigin);
                const refCount = Number(item.references_count || 0);
                const cleanPart = (item.plant_parts_used || '')
                  .replace(/\s*\([^)]*\)/g, '')
                  .split(',')[0]
                  .trim();

                return (
                  <TouchableOpacity
                    key={item.slug || String(item.id ?? idx)}
                    activeOpacity={0.88}
                    style={{ width: cardW }}
                    onPress={() =>
                      router.push({
                        pathname: '/detail/[slug]',
                        params: { slug: item.slug },
                      } as any)
                    }
                  >
                    <GlassView radius={26} intensity={32} contentStyle={styles.cardInner}>
                      <View style={[styles.media, { height: cardW * 0.88 }]}>
                        {resolvedImage ? (
                          <Image
                            source={{ uri: resolvedImage }}
                            style={styles.mediaImg}
                            resizeMode="cover"
                          />
                        ) : (
                          <View
                            style={[
                              styles.mediaFallback,
                              meta.isToxic && { backgroundColor: 'rgba(239, 68, 68, 0.22)' },
                            ]}
                          >
                            <Ionicons
                              name={meta.isToxic ? 'warning' : 'leaf'}
                              size={38}
                              color={meta.isToxic ? '#fca5a5' : '#4ade80'}
                            />
                          </View>
                        )}

                        <View
                          style={[
                            styles.badge,
                            { maxWidth: cardW - 34 },
                            meta.isToxic && styles.badgeToxic,
                          ]}
                        >
                          <Text style={styles.badgeText} numberOfLines={1}>
                            {meta.badgeLabel}
                          </Text>
                        </View>

                        <View style={styles.mediaBottomRow}>
                          {cleanPart ? (
                            <View style={styles.partTag}>
                              <Text style={styles.partTagText} numberOfLines={1}>
                                {cleanPart}
                              </Text>
                            </View>
                          ) : (
                            <View />
                          )}
                          {refCount > 0 && (
                            <View style={styles.journalTag}>
                              <Ionicons name="book-outline" size={10} color="#bbf7d0" />
                              <Text style={styles.journalTagText}>{refCount}</Text>
                            </View>
                          )}
                        </View>
                      </View>

                      <View style={styles.cardText}>
                        <Text style={styles.name} numberOfLines={1}>
                          {item.name}
                        </Text>
                        <Text style={styles.latin} numberOfLines={1}>
                          {item.scientific_name}
                        </Text>
                        <Text style={styles.usage} numberOfLines={2}>
                          {item.traditional_usage || item.description}
                        </Text>
                      </View>
                    </GlassView>
                  </TouchableOpacity>
                );
              })}
            </View>
          )}
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: C.bgSoft },
  scrollContent: { paddingBottom: SCREEN_BOTTOM_PAD },

  titleBlock: {
    paddingTop: SCREEN_TOP_PAD,
    paddingHorizontal: 20,
    paddingBottom: 16,
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 10,
  },
  largeTitle: {
    fontSize: 38,
    fontWeight: '800',
    color: C.white,
    letterSpacing: -1,
  },
  catalogPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 11,
    paddingVertical: 6,
    borderRadius: R.pill,
    backgroundColor: 'rgba(74, 222, 128, 0.14)',
    borderWidth: 1,
    borderColor: 'rgba(134, 239, 172, 0.28)',
  },
  catalogPillText: {
    color: '#bbf7d0',
    fontSize: 11,
    fontWeight: '700',
  },
  largeSub: {
    marginTop: 6,
    fontSize: 13.5,
    lineHeight: 20,
    color: C.textSoft,
    maxWidth: 345,
  },

  controlsBlock: {
    paddingTop: 2,
    paddingBottom: 8,
    backgroundColor: 'transparent',
  },
  searchBarWrap: {
    paddingHorizontal: 20,
    marginBottom: 16,
  },
  searchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 11,
    paddingHorizontal: 18,
    height: 54,
  },
  searchInput: { flex: 1, color: C.white, fontSize: 14.5, paddingVertical: 0 },
  countDot: {
    minWidth: 28,
    height: 28,
    borderRadius: 14,
    paddingHorizontal: 8,
    backgroundColor: 'rgba(74, 222, 128, 0.2)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  countDotText: { color: '#bbf7d0', fontSize: 12, fontWeight: '800' },

  chipsRow: {
    paddingHorizontal: 20,
    gap: 10,
  },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 7,
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: R.pill,
    ...glass,
  },
  chipActive: {
    backgroundColor: C.white,
    borderColor: C.white,
  },
  chipToxicOutline: {
    borderColor: 'rgba(248, 113, 113, 0.35)',
    backgroundColor: 'rgba(220, 38, 38, 0.12)',
  },
  chipToxicActive: {
    backgroundColor: '#dc2626',
    borderColor: '#f87171',
  },
  chipText: {
    color: C.mint,
    fontSize: 12.5,
    fontWeight: '700',
  },
  chipTextActive: {
    color: C.ink,
    fontWeight: '800',
  },
  chipCountBadge: {
    paddingHorizontal: 6,
    paddingVertical: 1.5,
    borderRadius: 10,
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
  },
  chipCountBadgeActive: {
    backgroundColor: 'rgba(15, 45, 28, 0.14)',
  },
  chipCountText: {
    color: '#bbf7d0',
    fontSize: 10.5,
    fontWeight: '800',
  },
  chipCountTextActive: {
    color: C.ink,
  },

  resultsBlock: {
    paddingHorizontal: 20,
    paddingTop: 18,
  },
  resultHeadRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
    justifyContent: 'space-between',
    marginBottom: 14,
  },
  resultHead: { fontSize: 18, fontWeight: '800', color: C.white },
  resultCount: { fontSize: 12.5, color: C.leafSoft, fontWeight: '700' },

  stateBox: { padding: 28, alignItems: 'center', gap: 10 },
  stateIcon: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: 'rgba(74, 222, 128, 0.16)',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 4,
  },
  stateTitle: { color: C.white, fontSize: 16, fontWeight: '800' },
  stateText: {
    color: C.textSoft,
    fontSize: 12.5,
    textAlign: 'center',
    lineHeight: 19,
  },
  emptyActionsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'center',
    gap: 10,
    marginTop: 8,
  },
  resetBtn: {
    backgroundColor: C.white,
    paddingHorizontal: 20,
    paddingVertical: 11,
    borderRadius: R.pill,
  },
  resetBtnText: { color: C.ink, fontSize: 12.5, fontWeight: '800' },
  scanCtaBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 18,
    paddingVertical: 11,
    borderRadius: R.pill,
    backgroundColor: 'rgba(74, 222, 128, 0.18)',
    borderWidth: 1,
    borderColor: 'rgba(134, 239, 172, 0.35)',
  },
  scanCtaText: { color: '#bbf7d0', fontSize: 12.5, fontWeight: '800' },

  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: GRID_GAP },
  cardInner: { padding: 9 },
  media: {
    width: '100%',
    borderRadius: 19,
    overflow: 'hidden',
    backgroundColor: 'rgba(255, 255, 255, 0.08)',
  },
  mediaImg: { width: '100%', height: '100%' },
  mediaFallback: {
    flex: 1,
    backgroundColor: 'rgba(74, 222, 128, 0.18)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  badge: {
    position: 'absolute',
    top: 8,
    left: 8,
    backgroundColor: 'rgba(9, 29, 18, 0.78)',
    borderWidth: 1,
    borderColor: 'rgba(134, 239, 172, 0.4)',
    paddingHorizontal: 9,
    paddingVertical: 3.5,
    borderRadius: R.pill,
  },
  badgeToxic: {
    backgroundColor: 'rgba(220, 38, 38, 0.92)',
    borderColor: 'rgba(252, 165, 165, 0.6)',
  },
  badgeText: { color: C.white, fontSize: 9.5, fontWeight: '800' },
  mediaBottomRow: {
    position: 'absolute',
    left: 8,
    right: 8,
    bottom: 8,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 6,
  },
  partTag: {
    backgroundColor: 'rgba(6, 22, 13, 0.76)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.12)',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: R.pill,
    maxWidth: '68%',
  },
  partTagText: {
    color: 'rgba(236, 253, 245, 0.92)',
    fontSize: 9.5,
    fontWeight: '700',
  },
  journalTag: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    backgroundColor: 'rgba(20, 83, 45, 0.85)',
    borderWidth: 1,
    borderColor: 'rgba(134, 239, 172, 0.35)',
    paddingHorizontal: 7,
    paddingVertical: 3,
    borderRadius: R.pill,
  },
  journalTagText: {
    color: '#bbf7d0',
    fontSize: 9.5,
    fontWeight: '800',
  },
  cardText: { paddingHorizontal: 5, paddingTop: 10, paddingBottom: 5, gap: 2 },
  name: { fontSize: 14.5, fontWeight: '800', color: C.white },
  latin: { fontSize: 11.5, fontStyle: 'italic', color: C.leafSoft, fontWeight: '600' },
  usage: { fontSize: 11.5, lineHeight: 16.5, color: C.textSoft, marginTop: 3 },
});