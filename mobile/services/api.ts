import axios from 'axios';
import { HerbalDetail, ScanHistoryItem } from '../types/herbal';

// Ganti IP sesuai alamat IP Wi-Fi laptop Linux Mint Anda
const BASE_URL = 'http://10.34.248.63:8000/api/v1';

const apiClient = axios.create({
  baseURL: BASE_URL,
  timeout: 25000,
  headers: {
    'Content-Type': 'application/json',
    'Accept': 'application/json',
  },
});

let FileSystem: any = null;
try {
  FileSystem = require('expo-file-system/legacy');
} catch {
  try {
    FileSystem = require('expo-file-system');
  } catch {
    FileSystem = null;
  }
}

const CATALOG_CACHE_FILE = FileSystem?.documentDirectory
  ? `${FileSystem.documentDirectory}herbal_global_catalog_cache.json`
  : null;

let memoryCatalogCache: HerbalDetail[] = [];
const memoryDetailCache: Record<string, HerbalDetail> = {};

const saveCatalogToLocalCache = async (plants: HerbalDetail[]): Promise<void> => {
  memoryCatalogCache = plants;
  for (const p of plants) {
    if (p.slug) {
      memoryDetailCache[p.slug] = { ...memoryDetailCache[p.slug], ...p };
    }
  }
  if (!CATALOG_CACHE_FILE || !FileSystem?.writeAsStringAsync) return;
  try {
    await FileSystem.writeAsStringAsync(CATALOG_CACHE_FILE, JSON.stringify(plants));
  } catch {
    // Abaikan jika gagal menulis cache disk
  }
};

const readCatalogFromLocalCache = async (): Promise<HerbalDetail[]> => {
  if (memoryCatalogCache.length > 0) {
    return memoryCatalogCache;
  }
  if (!CATALOG_CACHE_FILE || !FileSystem?.readAsStringAsync) {
    return [];
  }
  try {
    const raw = await FileSystem.readAsStringAsync(CATALOG_CACHE_FILE);
    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed)) {
      memoryCatalogCache = parsed;
      for (const p of parsed) {
        if (p.slug) {
          memoryDetailCache[p.slug] = p;
        }
      }
      return parsed;
    }
  } catch {
    // Belum ada cache tersimpan
  }
  return [];
};

export interface CatalogSyncResult {
  plants: HerbalDetail[];
  isOffline: boolean;
}

export const getHerbalCatalogSynced = async (searchQuery?: string): Promise<CatalogSyncResult> => {
  const trimmed = searchQuery?.trim() ?? '';

  try {
    const response = await apiClient.get('/herbals', {
      params: trimmed !== '' ? { q: trimmed } : {},
    });
    const list: HerbalDetail[] = Array.isArray(response.data?.data) ? response.data.data : [];

    if (trimmed === '' && list.length > 0) {
      await saveCatalogToLocalCache(list);
    }

    return { plants: list, isOffline: false };
  } catch {
    const cached = await readCatalogFromLocalCache();
    if (trimmed === '') {
      return { plants: cached, isOffline: true };
    }

    const q = trimmed.toLowerCase();
    const filtered = cached.filter(
      (item) =>
        item.name.toLowerCase().includes(q) ||
        item.scientific_name.toLowerCase().includes(q) ||
        (item.local_name || '').toLowerCase().includes(q)
    );
    return { plants: filtered, isOffline: true };
  }
};

export const getHerbalCatalog = async (searchQuery?: string): Promise<HerbalDetail[]> => {
  const res = await getHerbalCatalogSynced(searchQuery);
  return res.plants;
};

export const getHerbalBySlug = async (slug: string): Promise<HerbalDetail> => {
  try {
    const response = await apiClient.get(`/herbals/slug/${slug}`);
    const detail: HerbalDetail = response.data.data;
    if (detail?.slug) {
      memoryDetailCache[detail.slug] = detail;
    }
    return detail;
  } catch (err) {
    if (memoryDetailCache[slug]) {
      return memoryDetailCache[slug];
    }
    const cachedList = await readCatalogFromLocalCache();
    const found = cachedList.find((item) => item.slug === slug);
    if (found) {
      return found;
    }
    throw err;
  }
};

export const getScanHistories = async (): Promise<ScanHistoryItem[]> => {
  const response = await apiClient.get('/scan-histories');
  return response.data.data;
};

export const deleteScanHistory = async (id: number): Promise<void> => {
  await apiClient.delete(`/scan-histories/${id}`);
};

export const clearAllScanHistories = async (): Promise<void> => {
  await apiClient.delete('/scan-histories');
};
