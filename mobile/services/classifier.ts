import * as ImageManipulator from "expo-image-manipulator";
import { Platform } from 'react-native';
import * as ApiModule from './api';

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

export interface LatestScanSession {
  slug: string;
  primaryPhoto: string;
  anglePhotos: string[];
  timestamp: number;
}

let latestScanSession: LatestScanSession | null = null;

export function setLatestScanSession(session: LatestScanSession | null): void {
  latestScanSession = session;
}

export function getLatestScanSession(slug?: string): LatestScanSession | null {
  if (!latestScanSession) return null;
  if (slug && latestScanSession.slug !== slug) return null;
  return latestScanSession;
}

function resolveBaseUrl(): string {
  if (typeof ApiModule.BASE_URL === 'string' && ApiModule.BASE_URL.startsWith('http')) {
    return ApiModule.BASE_URL.replace(/\/+$/, '');
  }
  return 'http://10.58.220.63:8000/api/v1';
}

function buildTargetUrls(baseUrl: string): string[] {
  const clean = baseUrl.replace(/\/+$/, '');
  if (clean.endsWith('/api/v1')) {
    const apiRoot = clean.replace(/\/v1$/, '');
    return [`${clean}/predict`, `${apiRoot}/identify`];
  }
  if (clean.endsWith('/api')) {
    return [`${clean}/v1/predict`, `${clean}/identify`];
  }
  return [`${clean}/api/v1/predict`, `${clean}/api/identify`];
}

function sanitizeServerMessage(raw?: string, targetBaseUrl?: string): string {
  if (!raw) {
    return 'Gagal memproses gambar pada server. Periksa koneksi internet Anda lalu coba lagi.';
  }
  const lower = raw.toLowerCase();
  if (
    lower.includes('network request failed') ||
    lower.includes('network error') ||
    lower.includes('failed to fetch')
  ) {
    const hostInfo = targetBaseUrl ? ` (${targetBaseUrl})` : '';
    return `Tidak dapat menjangkau server Laravel${hostInfo}. Pastikan server berjalan dengan --host=0.0.0.0 dan HP berada di Wi-Fi yang sama.`;
  }
  return raw;
}

function buildFormData(
  fieldName: string,
  uri: string,
  name: string,
  type: string,
  extraFiles: { uri: string; name: string; type: string }[] = []
): FormData {
  const formData = new FormData();
  formData.append(fieldName, { uri, name, type } as any);
  for (const extra of extraFiles) {
    formData.append('images[]', extra as any);
  }
  return formData;
}

function uploadFormData(
  url: string,
  formData: FormData,
  timeoutMs = 90000
): Promise<{ status: number; text: string }> {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open('POST', url);
    xhr.timeout = timeoutMs;
    xhr.setRequestHeader('Accept', 'application/json');

    const token = ApiModule.getApiAuthToken?.();
    if (token) {
      xhr.setRequestHeader('Authorization', `Bearer ${token}`);
    }

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

export async function classifyImage(
  rawImageUri: string,
  extraImageUris: string[] = []
): Promise<ClassificationResponse> {
  let imageUri = rawImageUri;
  try {
    const manipulated = await ImageManipulator.manipulateAsync(
      rawImageUri,
      [{ resize: { width: 1024 } }],
      { compress: 0.88, format: ImageManipulator.SaveFormat.JPEG }
    );
    if (manipulated?.uri) {
      imageUri = manipulated.uri;
    }
  } catch {
    // Gunakan foto asli jika kompresi dilewati
  }
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

  const extraFiles: { uri: string; name: string; type: string }[] = [];
  for (let i = 0; i < Math.min(2, extraImageUris.length); i += 1) {
    let extraUri = extraImageUris[i];
    if (!extraUri) continue;
    try {
      const mExtra = await ImageManipulator.manipulateAsync(
        extraUri,
        [{ resize: { width: 960 } }],
        { compress: 0.85, format: ImageManipulator.SaveFormat.JPEG }
      );
      if (mExtra?.uri) extraUri = mExtra.uri;
    } catch {}
    const normExtra =
      Platform.OS === 'android' &&
      !extraUri.startsWith('file://') &&
      !extraUri.startsWith('content://')
        ? `file://${extraUri}`
        : extraUri;
    extraFiles.push({
      uri: normExtra,
      name: `specimen-angle-${i + 2}-${Date.now()}.jpg`,
      type: 'image/jpeg',
    });
  }

  let notFoundCount = 0;

  for (const url of targetUrls) {
    try {
      let { status, text } = await uploadFormData(
        url,
        buildFormData('image', normalizedUri, filename, mimeType, extraFiles),
        90000
      );

      if (status === 404 || status === 405) {
        notFoundCount += 1;
        continue;
      }

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
            90000
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
        message: payload.message ? sanitizeServerMessage(payload.message, baseUrl) : undefined,
        scan_image_url: payload.scan_image_url || null,
        plants,
      };
    } catch (err: any) {
      if (err?.message === 'TIMEOUT') {
        throw new Error('Waktu analisis habis (timeout). Silakan coba pindai ulang.');
      }
      throw new Error(sanitizeServerMessage(err?.message, baseUrl));
    }
  }

  if (notFoundCount === targetUrls.length) {
    throw new Error(`Endpoint /v1/predict & /identify tidak ditemukan pada ${baseUrl}.`);
  }

  throw new Error('Gagal memproses pemindaian spesimen.');
}