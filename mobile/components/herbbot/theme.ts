import { C, R, glass } from '../../constants/herbalTheme';

// Re-export supaya semua komponen HerbBOT mengambil token dari satu pintu
export { C, R, glass };

// Token tambahan khusus HerbBOT (di atas token beranda)
export const HB = {
  // isian di atas GlassView untuk sheet utama
  sheetFill: 'rgba(10, 34, 21, 0.95)',
  sheetFillToxic: 'rgba(26, 12, 16, 0.5)',
  // sama dengan backdrop HerbalConfirmModal
  dim: 'rgba(2, 24, 16, 0.66)',
  cardBg: '#0E2B1B',
  hairline: 'rgba(255, 255, 255, 0.12)',
  specular: 'rgba(255, 255, 255, 0.18)',
  emeraldTint: 'rgba(74, 222, 128, 0.16)',
  emeraldBorder: 'rgba(134, 239, 172, 0.38)',
  danger: '#ff6b6b',
  dangerSolid: '#ef4444',
  dangerTint: 'rgba(239, 68, 68, 0.16)',
  dangerBorder: 'rgba(248, 113, 113, 0.38)',
} as const;
