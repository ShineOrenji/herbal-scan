import AsyncStorage from "@react-native-async-storage/async-storage";
import axios from 'axios';
import { HerbalDetail, ScanHistoryItem } from '../types/herbal';

let ExpoConstants: any = null;
try {
  const mod = require('expo-constants');
  ExpoConstants = mod?.default ?? mod;
} catch {
  ExpoConstants = null;
}

const DEFAULT_SERVER_IP = '10.34.248.63';

function detectBaseUrl(): string {
  const envUrl = process.env.EXPO_PUBLIC_API_URL;
  if (typeof envUrl === 'string' && envUrl.startsWith('http')) {
    return envUrl.replace(/\/+$/, '');
  }

  const hostUri: string | undefined =
    ExpoConstants?.expoConfig?.hostUri ||
    ExpoConstants?.manifest2?.extra?.expoGo?.debuggerHost ||
    ExpoConstants?.manifest?.debuggerHost;

  if (typeof hostUri === 'string' && hostUri.length > 0) {
    const host = hostUri.split(':')[0];
    if (/^\d{1,3}(\.\d{1,3}){3}$/.test(host)) {
      return `http://${host}:8000/api/v1`;
    }
  }

  return `http://${DEFAULT_SERVER_IP}:8000/api/v1`;
}

export const BASE_URL = detectBaseUrl();

let currentAuthToken: string | null = null;

export const setApiAuthToken = (token: string | null) => {
  currentAuthToken = token;
};

export const getApiAuthToken = () => currentAuthToken;

export const apiClient = axios.create({
  baseURL: BASE_URL,
  timeout: 25000,
  headers: {
    'Content-Type': 'application/json',
    Accept: 'application/json',
  },
});

apiClient.interceptors.request.use((config) => {
  if (currentAuthToken) {
    config.headers = config.headers ?? {};
    config.headers.Authorization = `Bearer ${currentAuthToken}`;
  }
  return config;
});

export interface UserProfile {
  id: number;
  name: string;
  email: string;
  phone: string | null;
  avatar_url: string | null;
  has_password: boolean;
  scan_count?: number;
}

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
const DETAIL_DISK_CACHE_KEY = "herbal_detail_disk_cache_v1";
const memoryDetailCache: Record<string, HerbalDetail> = {};
let detailDiskHydrated = false;

const hydrateDetailDiskCache = async (): Promise<void> => {
  if (detailDiskHydrated) return;
  detailDiskHydrated = true;
  try {
    const raw = await AsyncStorage.getItem(DETAIL_DISK_CACHE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (parsed && typeof parsed === "object") {
        Object.assign(memoryDetailCache, parsed);
      }
    }
  } catch {}
};

const persistDetailDiskCache = async (): Promise<void> => {
  try {
    await AsyncStorage.setItem(DETAIL_DISK_CACHE_KEY, JSON.stringify(memoryDetailCache));
  } catch {}
};

hydrateDetailDiskCache();

export const getPersistedHerbalBySlug = async (slug: string): Promise<HerbalDetail | null> => {
  if (!slug) return null;
  if (memoryDetailCache[slug]) return memoryDetailCache[slug];
  await hydrateDetailDiskCache();
  if (memoryDetailCache[slug]) return memoryDetailCache[slug];
  const cat = await readCatalogFromLocalCache();
  return cat.find((item) => item.slug === slug) || null;
};

const saveCatalogToLocalCache = async (plants: HerbalDetail[]): Promise<void> => {
  memoryCatalogCache = plants;
  for (const p of plants) {
    if (p.slug) {
      memoryDetailCache[p.slug] = { ...memoryDetailCache[p.slug], ...p };
    }
  }
  persistDetailDiskCache();
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

export const getCachedHerbalBySlug = (slug: string): HerbalDetail | null => {
  if (!slug) return null;
  return memoryDetailCache[slug] || memoryCatalogCache.find((item) => item.slug === slug) || null;
};

export const getHerbalBySlug = async (slug: string): Promise<HerbalDetail> => {
  try {
    const response = await apiClient.get(`/herbals/slug/${slug}`);
    const detail: HerbalDetail = response.data.data;
    if (detail?.slug) {
      memoryDetailCache[detail.slug] = detail;
      persistDetailDiskCache();
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

// === AUTH & PROFILE API ===

export const sendRegisterOtpApi = async (payload: {
  name: string;
  email: string;
  phone?: string;
  password: string;
}) => {
  const res = await apiClient.post('/auth/register/send-otp', payload);
  return res.data;
};

export const verifyRegisterOtpApi = async (payload: { email: string; otp: string }) => {
  const res = await apiClient.post('/auth/register/verify-otp', payload);
  return res.data as { token: string; user: UserProfile; message: string };
};

export const loginApi = async (payload: { identifier: string; password: string }) => {
  const res = await apiClient.post('/auth/login', payload);
  return res.data as { token: string; user: UserProfile; message: string };
};

export const googleLoginApi = async (payload: { access_token?: string; id_token?: string }) => {
  const res = await apiClient.post('/auth/google', payload);
  return res.data as { token: string; user: UserProfile; message: string };
};

export const getMeApi = async (): Promise<UserProfile> => {
  const res = await apiClient.get('/auth/me');
  return res.data.user;
};

export const updateProfileApi = async (payload: { name: string; phone?: string }) => {
  const res = await apiClient.put('/auth/profile', payload);
  return res.data as { user: UserProfile; message: string };
};

export const uploadAvatarApi = async (imageUri: string) => {
  const Manipulator = require('expo-image-manipulator');
  const resized = await Manipulator.manipulateAsync(
    imageUri,
    [{ resize: { width: 480 } }],
    {
      compress: 0.78,
      format: Manipulator.SaveFormat?.JPEG ?? 'jpeg',
      base64: true,
    }
  );

  if (!resized?.base64) {
    throw new Error('Gagal memproses foto profil yang dipilih.');
  }

  const res = await apiClient.post('/auth/profile/avatar', {
    avatar_base64: `data:image/jpeg;base64,${resized.base64}`,
  });
  return res.data as { user: UserProfile; message: string };
};

export const updatePasswordApi = async (payload: {
  current_password?: string;
  password: string;
  password_confirmation: string;
}) => {
  const res = await apiClient.put('/auth/password', payload);
  return res.data as { message: string };
};

export const logoutApi = async () => {
  await apiClient.post('/auth/logout');
};