import React, { useCallback, useState } from 'react';
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
import BotanicalBackdrop from '../../components/BotanicalBackdrop';
import HerbalConfirmModal from '../../components/HerbalConfirmModal';
import {
  C,
  R,
  SCREEN_BOTTOM_PAD,
  SCREEN_TOP_PAD,
  TAB_BAR,
  glass,
} from '../../constants/herbalTheme';

interface HistoryEntry {
  id: number;
  detected_slug: string;
  confidence_score: number;
  image_url: string | null;
  created_at: string;
  plant_name: string;
  scientific_name: string;
  is_toxic: boolean;
}

function deepExtractArray(raw: any, depth = 0): any[] {
  if (!raw || depth > 4) return [];
  if (Array.isArray(raw)) return raw;
  if (typeof raw === 'object') {
    const priorityKeys = [
      'data',
      'histories',
      'scan_histories',
      'scans',
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

function normalizeHistoryItem(raw: any, index: number): HistoryEntry {
  const herbal = raw?.herbal || {};
  const plantName =
    raw?.plant_name || herbal?.name || raw?.name || raw?.detected_slug || 'Spesimen Herbal';
  const isToxic =
    Boolean(raw?.is_toxic) ||
    Boolean(herbal?.is_toxic) ||
    plantName.toLowerCase().includes('beracun');

  return {
    id: Number(raw?.id ?? index + 1),
    detected_slug: raw?.detected_slug || herbal?.slug || raw?.slug || '',
    confidence_score: Number(raw?.confidence_score ?? raw?.confidence ?? 0),
    image_url: raw?.image_url || raw?.scan_image_url || herbal?.image_url || null,
    created_at: raw?.created_at || '',
    plant_name: plantName,
    scientific_name: raw?.scientific_name || herbal?.scientific_name || '',
    is_toxic: isToxic,
  };
}

export default function HistoryScreen() {
  const router = useRouter();
  const [items, setItems] = useState<HistoryEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const [confirmModal, setConfirmModal] = useState<{
    visible: boolean;
    mode: 'single' | 'all';
    targetItem?: HistoryEntry;
  }>({ visible: false, mode: 'all' });
  const [deleting, setDeleting] = useState(false);
  const [toastMsg, setToastMsg] = useState<string | null>(null);

  const openConfirmModal = (
    mode: 'single' | 'all',
    targetItem?: HistoryEntry
  ) => {
    setConfirmModal({ visible: true, mode, targetItem });
  };

  const closeConfirmModal = () => {
    if (deleting) return;
    setConfirmModal((prev) => ({ ...prev, visible: false }));
  };

  const showToast = (msg: string) => {
    setToastMsg(msg);
    setTimeout(() => {
      setToastMsg((prev) => (prev === msg ? null : prev));
    }, 2400);
  };

  const loadHistories = useCallback(async () => {
    try {
      const apiAny = ApiModule as any;
      const dynamicFns = Object.entries(apiAny)
        .filter(([key, val]) => {
          if (typeof val !== 'function') return false;
          const k = key.toLowerCase();
          return (
            (k.includes('histor') || k.includes('scans')) &&
            !k.includes('delete') &&
            !k.includes('clear') &&
            !k.includes('remove')
          );
        })
        .map(([, val]) => val as () => Promise<any>);

      const explicitFns = [
        apiAny.getHistories,
        apiAny.getScanHistories,
        apiAny.getScanHistory,
        apiAny.getHistory,
        apiAny.fetchHistories,
        apiAny.fetchScanHistories,
        apiAny.fetchHistory,
      ].filter((fn) => typeof fn === 'function');

      const fnCandidates = Array.from(new Set([...explicitFns, ...dynamicFns]));
      let rawList: any[] = [];

      for (const fn of fnCandidates) {
        try {
          const res = await fn();
          rawList = deepExtractArray(res);
          if (rawList.length > 0) break;
        } catch {
          // Lanjut ke kandidat berikutnya
        }
      }

      if (rawList.length === 0) {
        const client = findAxiosClient();
        if (client?.get) {
          for (const endpoint of [
            '/histories',
            '/scan-histories',
            '/scan-history',
            '/history',
            '/scans',
          ]) {
            try {
              const res = await client.get(endpoint);
              rawList = deepExtractArray(res);
              if (rawList.length > 0) break;
            } catch {
              // Coba endpoint berikutnya
            }
          }
        }
      }

      setItems(rawList.map(normalizeHistoryItem));
    } catch {
      // Abaikan jika gagal sementara
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      loadHistories();
    }, [loadHistories])
  );

  const executeConfirmAction = async () => {
    setDeleting(true);
    const apiAny = ApiModule as any;
    const client = findAxiosClient();

    try {
      if (confirmModal.mode === 'single' && confirmModal.targetItem) {
        const targetId = confirmModal.targetItem.id;
        const deleteFn =
          apiAny.deleteHistory || apiAny.deleteScanHistory || apiAny.removeHistory;

        let deleted = false;
        if (typeof deleteFn === 'function') {
          try {
            await deleteFn(targetId);
            deleted = true;
          } catch {
            deleted = false;
          }
        }

        if (!deleted && client?.delete) {
          for (const ep of [
            `/histories/${targetId}`,
            `/scan-histories/${targetId}`,
            `/history/${targetId}`,
          ]) {
            try {
              await client.delete(ep);
              deleted = true;
              break;
            } catch {
              // Coba endpoint berikutnya
            }
          }
        }

        if (!deleted) throw new Error('Delete failed');

        setItems((prev) => prev.filter((item) => item.id !== targetId));
        showToast('Catatan riwayat dihapus');
      } else if (confirmModal.mode === 'all') {
        const clearFn =
          apiAny.clearHistories ||
          apiAny.clearScanHistories ||
          apiAny.deleteAllHistories;

        let cleared = false;
        if (typeof clearFn === 'function') {
          try {
            await clearFn();
            cleared = true;
          } catch {
            cleared = false;
          }
        }

        if (!cleared && client?.delete) {
          for (const ep of ['/histories', '/scan-histories', '/history']) {
            try {
              await client.delete(ep);
              cleared = true;
              break;
            } catch {
              // Coba endpoint berikutnya
            }
          }
        }

        if (!cleared) throw new Error('Clear failed');

        setItems([]);
        showToast('Seluruh riwayat berhasil dibersihkan');
      }
    } catch {
      showToast('Gagal menghapus catatan riwayat');
    } finally {
      setDeleting(false);
      setConfirmModal((prev) => ({ ...prev, visible: false }));
    }
  };

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
            onRefresh={() => {
              setRefreshing(true);
              loadHistories();
            }}
            tintColor="#4ade80"
            colors={['#16a34a']}
          />
        }
      >
        <View style={styles.headerRow}>
          <View style={styles.headerTitleCol}>
            <Text style={styles.pageTitle}>
              Riwayat{'\n'}
              <Text style={styles.pageTitleBold}>Pindai</Text>
            </Text>
            <Text style={styles.pageSubtitle} numberOfLines={2}>
              Arsip spesimen yang pernah Anda identifikasi
            </Text>
          </View>

          {items.length > 0 && (
            <TouchableOpacity
              activeOpacity={0.85}
              style={styles.clearGlassBtn}
              onPress={() => openConfirmModal('all')}
            >
              <Ionicons name="trash-outline" size={14} color="#fecaca" />
              <Text style={styles.clearGlassText}>Hapus Semua</Text>
            </TouchableOpacity>
          )}
        </View>

        {loading ? (
          <View style={styles.centerBox}>
            <ActivityIndicator size="large" color="#4ade80" />
            <Text style={styles.loadingText}>Memuat arsip pemindaian...</Text>
          </View>
        ) : items.length === 0 ? (
          <View style={styles.emptyGlassCard}>
            <View style={styles.emptyIconCircle}>
              <Ionicons name="scan-outline" size={32} color="#4ade80" />
            </View>
            <Text style={styles.emptyTitle}>Belum Ada Riwayat</Text>
            <Text style={styles.emptySub}>
              Foto tanaman herbal menggunakan kamera untuk menyimpan catatan identifikasi di sini.
            </Text>
            <TouchableOpacity
              style={styles.scanNowPill}
              onPress={() => router.push('/(tabs)/scan')}
            >
              <Text style={styles.scanNowPillText}>Pindai Sekarang</Text>
            </TouchableOpacity>
          </View>
        ) : (
          <View style={styles.listStack}>
            {items.map((item) => (
              <TouchableOpacity
                key={item.id}
                activeOpacity={0.86}
                style={styles.historyGlassCard}
                onPress={() => {
                  if (!item.detected_slug) return;
                  router.push({
                    pathname: '/detail/[slug]',
                    params: {
                      slug: item.detected_slug,
                      scannedImage: item.image_url || undefined,
                      confidence: String(item.confidence_score),
                    },
                  } as any);
                }}
              >
                {item.image_url ? (
                  <Image
                    source={{ uri: item.image_url }}
                    style={styles.thumbImg}
                    resizeMode="cover"
                  />
                ) : (
                  <View style={styles.thumbFallback}>
                    <Ionicons name="leaf" size={24} color="#4ade80" />
                  </View>
                )}

                <View style={styles.infoCol}>
                  <Text style={styles.plantTitle} numberOfLines={1}>
                    {item.plant_name}
                  </Text>
                  {item.scientific_name ? (
                    <Text style={styles.latinSub} numberOfLines={1}>
                      {item.scientific_name}
                    </Text>
                  ) : null}

                  <View style={styles.badgeRow}>
                    <View
                      style={[
                        styles.confBadge,
                        item.is_toxic && { backgroundColor: 'rgba(239, 68, 68, 0.25)' },
                      ]}
                    >
                      <Text
                        style={[
                          styles.confBadgeText,
                          item.is_toxic && { color: '#fca5a5' },
                        ]}
                      >
                        {item.is_toxic
                          ? 'Spesimen Beracun'
                          : `Kecocokan ${item.confidence_score}%`}
                      </Text>
                    </View>
                  </View>
                </View>

                <TouchableOpacity
                  activeOpacity={0.8}
                  style={styles.deleteTrashBtn}
                  onPress={() => openConfirmModal('single', item)}
                >
                  <Ionicons name="trash-outline" size={17} color="#fca5a5" />
                </TouchableOpacity>
              </TouchableOpacity>
            ))}
          </View>
        )}
      </ScrollView>

      {toastMsg && (
        <View pointerEvents="none" style={styles.toastPill}>
          <Ionicons name="checkmark-circle" size={16} color="#4ade80" />
          <Text style={styles.toastText}>{toastMsg}</Text>
        </View>
      )}

      <HerbalConfirmModal
        visible={confirmModal.visible}
        variant={confirmModal.mode === 'all' ? 'danger-all' : 'single'}
        title={
          confirmModal.mode === 'all'
            ? 'Hapus Semua Riwayat?'
            : 'Hapus Catatan Pindai?'
        }
        message={
          confirmModal.mode === 'all'
            ? 'Seluruh arsip pemindaian tanaman akan dihapus permanen dari daftar riwayat.'
            : 'Catatan identifikasi spesimen ini akan dihapus dari riwayat pindai Anda.'
        }
        itemLabel={
          confirmModal.mode === 'single'
            ? confirmModal.targetItem?.plant_name
            : `${items.length} Catatan Pindai`
        }
        confirmText={confirmModal.mode === 'all' ? 'Hapus Semua' : 'Ya, Hapus'}
        cancelText="Batal"
        loading={deleting}
        onConfirm={executeConfirmAction}
        onCancel={closeConfirmModal}
      />
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
  headerRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: 12,
    marginBottom: 22,
  },
  headerTitleCol: { flex: 1 },
  pageTitle: {
    fontSize: 31,
    fontWeight: '300',
    color: C.white,
    lineHeight: 38,
    letterSpacing: -0.5,
  },
  pageTitleBold: { fontWeight: '800' },
  pageSubtitle: {
    marginTop: 8,
    fontSize: 13,
    color: C.textSoft,
    lineHeight: 19,
  },
  clearGlassBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: 6,
    paddingHorizontal: 13,
    paddingVertical: 8,
    borderRadius: R.pill,
    backgroundColor: 'rgba(239, 68, 68, 0.16)',
    borderWidth: 1,
    borderColor: 'rgba(252, 165, 165, 0.38)',
  },
  clearGlassText: { color: '#fecaca', fontSize: 12, fontWeight: '800' },

  centerBox: { paddingVertical: 44, alignItems: 'center', gap: 10 },
  loadingText: { color: C.textSoft, fontSize: 13 },

  emptyGlassCard: {
    borderRadius: R.card,
    padding: 28,
    alignItems: 'center',
    gap: 8,
    ...glass,
  },
  emptyIconCircle: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: 'rgba(74, 222, 128, 0.16)',
    borderWidth: 1,
    borderColor: 'rgba(134, 239, 172, 0.35)',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 6,
  },
  emptyTitle: { color: C.white, fontSize: 16, fontWeight: '800' },
  emptySub: {
    color: C.textSoft,
    fontSize: 12.5,
    textAlign: 'center',
    lineHeight: 19,
    maxWidth: 290,
  },
  scanNowPill: {
    marginTop: 10,
    backgroundColor: C.white,
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: R.pill,
  },
  scanNowPillText: { color: C.ink, fontSize: 13.5, fontWeight: '800' },

  listStack: { gap: 12 },
  historyGlassCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    borderRadius: 26,
    padding: 12,
    ...glass,
  },
  thumbImg: {
    width: 72,
    height: 72,
    borderRadius: R.thumb,
    backgroundColor: C.glassHi,
  },
  thumbFallback: {
    width: 72,
    height: 72,
    borderRadius: R.thumb,
    backgroundColor: 'rgba(74, 222, 128, 0.18)',
    borderWidth: 1,
    borderColor: 'rgba(134, 239, 172, 0.32)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  infoCol: { flex: 1, gap: 2 },
  plantTitle: { fontSize: 15.5, fontWeight: '800', color: C.white },
  latinSub: {
    fontSize: 12.5,
    fontStyle: 'italic',
    color: C.leafSoft,
    fontWeight: '600',
  },
  badgeRow: { flexDirection: 'row', marginTop: 6 },
  confBadge: {
    backgroundColor: 'rgba(74, 222, 128, 0.2)',
    borderWidth: 1,
    borderColor: 'rgba(134, 239, 172, 0.3)',
    paddingHorizontal: 9,
    paddingVertical: 3,
    borderRadius: 8,
  },
  confBadgeText: { color: C.leafSoft, fontSize: 10.5, fontWeight: '800' },
  deleteTrashBtn: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: 'rgba(239, 68, 68, 0.14)',
    borderWidth: 1,
    borderColor: 'rgba(252, 165, 165, 0.3)',
    alignItems: 'center',
    justifyContent: 'center',
  },

  toastPill: {
    position: 'absolute',
    alignSelf: 'center',
    bottom: TAB_BAR.bottom + TAB_BAR.height + 40,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: 'rgba(10, 34, 22, 0.96)',
    borderWidth: 1,
    borderColor: 'rgba(134, 239, 172, 0.4)',
    paddingHorizontal: 16,
    paddingVertical: 11,
    borderRadius: R.pill,
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.3,
    shadowRadius: 12,
    elevation: 10,
  },
  toastText: { color: C.white, fontSize: 13, fontWeight: '700' },
});
