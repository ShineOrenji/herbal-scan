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
import {
  clearAllScanHistories,
  deleteScanHistory,
  getScanHistories,
} from '../../services/api';
import { useAuth } from '../../contexts/AuthContext';
import BotanicalBackdrop from '../../components/BotanicalBackdrop';
import GlassView from '../../components/GlassView';
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

export default function HistoryScreen() {
  const router = useRouter();
  const { user, refreshUser } = useAuth();

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

  const openConfirmModal = (mode: 'single' | 'all', targetItem?: HistoryEntry) => {
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
    if (!user) {
      setItems([]);
      setLoading(false);
      setRefreshing(false);
      return;
    }

    try {
      const list = await getScanHistories();
      const normalized: HistoryEntry[] = (Array.isArray(list) ? list : []).map(
        (raw: any, index: number) => {
          const plantName = raw?.plant_name || raw?.detected_slug || 'Spesimen Herbal';
          return {
            id: Number(raw?.id ?? index + 1),
            detected_slug: raw?.detected_slug || '',
            confidence_score: Number(raw?.confidence_score ?? 0),
            image_url: raw?.image_url || null,
            created_at: raw?.created_at || '',
            plant_name: plantName,
            scientific_name: raw?.scientific_name || '',
            is_toxic: Boolean(raw?.is_toxic) || plantName.toLowerCase().includes('beracun'),
          };
        }
      );
      setItems(normalized);
    } catch {
      // Abaikan jika gagal sementara
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [user]);

  useFocusEffect(
    useCallback(() => {
      loadHistories();
    }, [loadHistories])
  );

  const executeConfirmAction = async () => {
    setDeleting(true);
    try {
      if (confirmModal.mode === 'single' && confirmModal.targetItem) {
        const targetId = confirmModal.targetItem.id;
        await deleteScanHistory(targetId);
        setItems((prev) => prev.filter((item) => item.id !== targetId));
        refreshUser();
        showToast('Catatan riwayat dihapus');
      } else if (confirmModal.mode === 'all') {
        await clearAllScanHistories();
        setItems([]);
        refreshUser();
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
              {user
                ? `Arsip spesimen pribadi milik ${user.name}`
                : 'Masuk dengan akun untuk menyimpan riwayat pemindaian Anda'}
            </Text>
          </View>

          {user && items.length > 0 && (
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

        {!user ? (
          <GlassView
            radius={R.card}
            intensity={50}
            style={styles.guestCard}
            contentStyle={styles.guestCardInner}
          >
            <View style={styles.emptyIconCircle}>
              <Ionicons name="lock-closed-outline" size={32} color="#4ade80" />
            </View>
            <Text style={styles.emptyTitle}>Riwayat Khusus Pengguna Terdaftar</Text>
            <Text style={styles.emptySub}>
              Sebagai tamu, hasil pindaian Anda tetap berkontribusi ke katalog global, namun riwayat pribadi tidak tersimpan. Masuk sekarang agar catatan pindai Anda tersimpan otomatis.
            </Text>

            <View style={styles.guestBtnRow}>
              <TouchableOpacity
                activeOpacity={0.88}
                style={styles.guestPrimaryBtn}
                onPress={() => router.push({ pathname: '/auth', params: { mode: 'login' } } as any)}
              >
                <Text style={styles.guestPrimaryBtnText}>Masuk Akun</Text>
              </TouchableOpacity>

              <TouchableOpacity
                activeOpacity={0.85}
                style={styles.guestOutlineBtn}
                onPress={() => router.push({ pathname: '/auth', params: { mode: 'register' } } as any)}
              >
                <Text style={styles.guestOutlineBtnText}>Daftar</Text>
              </TouchableOpacity>
            </View>
          </GlassView>
        ) : loading ? (
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
              Foto tanaman herbal menggunakan kamera untuk menyimpan catatan identifikasi di akun Anda.
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
          confirmModal.mode === 'all' ? 'Hapus Semua Riwayat?' : 'Hapus Catatan Pindai?'
        }
        message={
          confirmModal.mode === 'all'
            ? 'Seluruh arsip pemindaian tanaman akan dihapus permanen dari akun Anda.'
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

  guestCard: { marginTop: 6 },
  guestCardInner: {
    padding: 26,
    alignItems: 'center',
    gap: 8,
  },
  guestBtnRow: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 14,
    width: '100%',
  },
  guestPrimaryBtn: {
    flex: 1.4,
    backgroundColor: C.white,
    paddingVertical: 13,
    borderRadius: R.pill,
    alignItems: 'center',
  },
  guestPrimaryBtnText: {
    color: C.ink,
    fontSize: 13.5,
    fontWeight: '800',
  },
  guestOutlineBtn: {
    flex: 1,
    paddingVertical: 13,
    borderRadius: R.pill,
    borderWidth: 1,
    borderColor: C.glassBorderHi,
    backgroundColor: 'rgba(255, 255, 255, 0.08)',
    alignItems: 'center',
  },
  guestOutlineBtnText: {
    color: C.white,
    fontSize: 13.5,
    fontWeight: '700',
  },

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
  emptyTitle: { color: C.white, fontSize: 16.5, fontWeight: '800', textAlign: 'center' },
  emptySub: {
    color: C.textSoft,
    fontSize: 12.5,
    textAlign: 'center',
    lineHeight: 19,
    maxWidth: 300,
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