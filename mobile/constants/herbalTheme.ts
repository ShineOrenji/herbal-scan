import { Platform } from 'react-native';


/**
 * Design token HerbalScan (UI saja, tidak ada logika aplikasi di sini).
 * Semua layar memakai token ini supaya tampilan konsisten.
 */
export const C = {
  bg: '#06140D',
  bgSoft: '#0A2216',
  canopy: '#10331F',

  leaf: '#4ADE80',
  leafSoft: '#86EFAC',
  leafDeep: '#15803D',
  emerald: '#259c51',

  mint: '#ECFDF5',
  ink: '#0F2D1C',
  white: '#FFFFFF',

  glass: 'rgba(255, 255, 255, 0.09)',
  glassHi: 'rgba(255, 255, 255, 0.15)',
  glassBorder: 'rgba(255, 255, 255, 0.17)',
  glassBorderHi: 'rgba(255, 255, 255, 0.30)',

  textSoft: 'rgba(236, 253, 245, 0.74)',
  textFaint: 'rgba(236, 253, 245, 0.50)',

  danger: '#EF4444',
  dangerDeep: '#DC2626',
  dangerSoft: '#FCA5A5',
  dangerBg: 'rgba(239, 68, 68, 0.22)',

  amber: '#FCD34D',
  sky: '#7DD3FC',
};

export const R = {
  card: 28,
  tile: 22,
  thumb: 18,
  pill: 999,
};

/** Dimensi tab bar melengkung (dipakai juga untuk jarak aman di layar). */
export const TAB_BAR = {
  height: 68,
  sideInset: 22,
  bottom: Platform.OS === 'ios' ? 22 : 14,
  bubble: 58,
};

/** Padding bawah konten scroll agar tidak tertutup tab bar. */
export const SCREEN_BOTTOM_PAD = 168;

/** Padding atas aman untuk header layar. */
export const SCREEN_TOP_PAD = Platform.OS === 'android' ? 44 : 58;

/**
 * GANTI DENGAN GAMBAR PRIBADI ANDA (opsional).
 * - WELCOME_PLANT_IMAGE: PNG transparan tanaman dalam pot (rasio ~1:1).
 *   Jika kosong / gagal dimuat, layar sambutan memakai ilustrasi bawaan.
 * - BACKDROP_IMAGE: foto daun hijau untuk latar (akan diburamkan otomatis).
 *   Jika kosong, latar memakai cahaya hijau berlapis bawaan.
 */
import type { ImageSourcePropType } from 'react-native';

// Pake image sendiri aja ler
export const WELCOME_PLANT_IMAGE: ImageSourcePropType | string | null = require('../assets/herbal_icon.png');
export const BACKDROP_IMAGE: ImageSourcePropType | string | null = null;
export const PLANT_OVERLAY_IMAGE: ImageSourcePropType | string | null = require('../assets/backdrop.png');

/** Permukaan kaca (glass) yang dipakai ulang di banyak kartu. */
export const glass = {
  backgroundColor: 'rgba(255, 255, 255, 0.08)',
  borderWidth: 1,
  borderColor: 'rgba(255, 255, 255, 0.18)',
  borderTopColor: 'rgba(255, 255, 255, 0.40)',
  borderBottomColor: 'rgba(255, 255, 255, 0.08)',
} as const;
