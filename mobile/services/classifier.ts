import { Platform } from 'react-native';
import * as ApiModule from './api';

let ExpoConstants: any = null;
try {
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const mod = require('expo-constants');
  ExpoConstants = mod?.default ?? mod;
} catch {
  ExpoConstants = null;
}

export interface DetectedPlantItem {
  slug: string;
  name: string;
  scientific_name: string;
  confidence: number;
  is_toxic?: boolean;
  box_2d?: number[] | null;
  scan_image_url?: string | null;
}

export interface ClassificationResponse {
  is_herbal: boolean;
  mode: 'single' | 'multi' | 'rejected';
  message?: string;
  scan_image_url?: string | null;
  plants: DetectedPlantItem[];
}

function resolveBaseUrl(): string {
  const apiAny = ApiModule as any;
  for (const exp of Object.values(apiAny)) {
    if (exp && (typeof exp === 'object' || typeof exp === 'function')) {
      const base = (exp as any)?.defaults?.baseURL || (exp as any)?.baseURL;
      if (typeof base === 'string' && base.startsWith('http')) {
        return base.replace(/\/+$/, '');
      }
    }
    if (typeof exp === 'string' && exp.startsWith('http')) {
      return exp.replace(/\/+$/, '');
    }
  }

  const envUrl =
    process.env.EXPO_PUBLIC_API_URL ||
    process.env.EXPO_PUBLIC_BASE_URL ||
    process.env.EXPO_PUBLIC_BACKEND_URL;
  if (typeof envUrl === 'string' && envUrl.startsWith('http')) {
    return envUrl.replace(/\/+$/, '');
  }

  const hostUri: string | undefined =
    ExpoConstants?.expoConfig?.hostUri ||
    ExpoConstants?.manifest2?.extra?.expoGo?.debuggerHost ||
    ExpoConstants?.manifest?.debuggerHost;

  if (typeof hostUri === 'string' && hostUri.length > 0) {
    const host = hostUri.split(':')[0];
    if (host) {
      return `http://${host}:8000/api/v1`;
    }
  }

  const linkingUri: string | undefined = ExpoConstants?.linkingUri;
  if (typeof linkingUri === 'string') {
    const match = linkingUri.match(/^(?:exp|https?):\/\/([^:/]+)/i);
    if (match?.[1]) {
      return `http://${match[1]}:8000/api/v1`;
    }
  }

  const defaultHost = Platform.OS === 'android' ? '10.0.2.2' : '127.0.0.1';
  return `http://${defaultHost}:8000/api/v1`;
}

function buildTargetUrls(baseUrl: string): string[] {
  const clean = baseUrl.replace(/\/+$/, '');
  const urls: string[] = [];

  if (clean.endsWith('/api/v1')) {
    const apiRoot = clean.replace(/\/v1$/, '');
    urls.push(`${clean}/predict`, `${apiRoot}/identify`);
  } else if (clean.endsWith('/api')) {
    urls.push(`${clean}/v1/predict`, `${clean}/identify`);
  } else {
    urls.push(`${clean}/api/v1/predict`, `${clean}/api/identify`, `${clean}/predict`, `${clean}/identify`);
  }

  return Array.from(new Set(urls));
}

function sanitizeServerMessage(raw?: string): string {
  if (!raw) {
    return 'Gagal memproses gambar pada server. Periksa koneksi internet Anda lalu coba lagi.';
  }
  const lower = raw.toLowerCase();
  if (
    lower.includes('curl error') ||
    lower.includes('googleapis') ||
    lower.includes('recv failure') ||
    lower.includes('ssl')
  ) {
    return 'Koneksi server ke layanan analisis terputus sementara. Silakan tekan Identifikasi ulang.';
  }
  if (lower.includes('network request failed') || lower.includes('network error')) {
    return 'Tidak dapat menjangkau server Laravel. Pastikan HP & laptop satu Wi-Fi dan server berjalan dengan --host=0.0.0.0.';
  }
  return raw;
}

function buildFormData(
  fieldName: string,
  uri: string,
  name: string,
  type: string
): FormData {
  const formData = new FormData();
  formData.append(fieldName, { uri, name, type } as any);
  return formData;
}

function uploadFormData(
  url: string,
  formData: FormData,
  timeoutMs = 60000
): Promise<{ status: number; text: string }> {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open('POST', url);
    xhr.timeout = timeoutMs;
    xhr.setRequestHeader('Accept', 'application/json');

    xhr.onload = () => {
      resolve({
        status: xhr.status,
        text: typeof xhr.responseText === 'string' ? xhr.responseText : '',
      });
    };

    xhr.onerror = () => {
      reject(new Error('Network request failed'));
    };

    xhr.ontimeout = () => {
      reject(new Error('TIMEOUT'));
    };

    xhr.send(formData);
  });
}

export async function classifyImage(imageUri: string): Promise<ClassificationResponse> {
  const baseUrl = resolveBaseUrl();
  const targetUrls = buildTargetUrls(baseUrl);

  const normalizedUri =
    Platform.OS === 'android' &&
    !imageUri.startsWith('file://') &&
    !imageUri.startsWith('content://')
      ? `file://${imageUri}`
      : imageUri;

  const filename = normalizedUri.split('/').pop() || `specimen-${Date.now()}.jpg`;
  const match = /\.(\w+)$/.exec(filename);
  const ext = match ? match[1].toLowerCase() : 'jpg';
  const mimeType = ext === 'png' ? 'image/png' : 'image/jpeg';

  let allNotFound = true;
  let lastMessage = '';

  for (const url of targetUrls) {
    try {
      let { status, text } = await uploadFormData(
        url,
        buildFormData('image', normalizedUri, filename, mimeType),
        60000
      );

      if (status === 404 || status === 405) {
        continue;
      }

      allNotFound = false;

      // Sesuaikan otomatis jika backend memvalidasi field 'photo' atau 'file'
      if (status === 422) {
        const lowerText = text.toLowerCase();
        const altField = lowerText.includes('photo')
          ? 'photo'
          : lowerText.includes('file')
          ? 'file'
          : null;

        if (altField) {
          const retry = await uploadFormData(
            url,
            buildFormData(altField, normalizedUri, filename, mimeType),
            60000
          );
          status = retry.status;
          text = retry.text;
        }
      }

      let json: any = {};
      try {
        json = text ? JSON.parse(text) : {};
      } catch {
        throw new Error(`Respons server tidak valid (${status}).`);
      }

      if (status < 200 || status >= 300) {
        const firstValidationErr =
          json?.errors && typeof json.errors === 'object'
            ? (Object.values(json.errors).flat()[0] as string)
            : undefined;
        throw new Error(
          firstValidationErr || json?.message || `Server mengembalikan status ${status}.`
        );
      }

      const payload = json?.data ?? json ?? {};
      const plants: DetectedPlantItem[] = Array.isArray(payload.plants)
        ? payload.plants
        : payload.slug
        ? [payload]
        : [];

      return {
        is_herbal: Boolean(payload.is_herbal ?? plants.length > 0),
        mode:
          payload.mode ||
          (plants.length > 1 ? 'multi' : plants.length === 1 ? 'single' : 'rejected'),
        message: payload.message ? sanitizeServerMessage(payload.message) : undefined,
        scan_image_url: payload.scan_image_url || null,
        plants,
      };
    } catch (err: any) {
      if (err?.message === 'TIMEOUT') {
        throw new Error('Waktu analisis habis (timeout). Silakan coba pindai ulang.');
      }
      lastMessage = err?.message || 'Network request failed';
      if (!allNotFound) {
        break;
      }
    }
  }

  if (allNotFound) {
    throw new Error(
      `Endpoint /v1/predict & /identify tidak merespons pada ${baseUrl}.`
    );
  }

  throw new Error(sanitizeServerMessage(lastMessage));
}
