import type { ImageSourcePropType } from 'react-native';

/**
 * GAMBAR BOT (PNG tanpa background). Ganti `null` dengan require(...) setelah file siap.
 * Masing-masing boleh PNG berbeda.
 */

/** 1) BERANDA — banner HerbBOT di Beranda + tombol melayang (FAB) di halaman detail.
 *    Contoh: require('../../assets/herbbot.png') */
export const BOT_AVATAR_SOURCE: ImageSourcePropType | null = require('../../assets/herbbot.png');

/** 2) CHAT — avatar kecil di bubble chat, indikator mengetik, & sapaan di tengah layar chat.
 *    Contoh: require('../../assets/herbbot-2.png') */
export const BOT_CHAT_AVATAR_SOURCE: ImageSourcePropType | null = require('../../assets/herbbot-3.png');

/** 3) HEADING CHAT — logo bot di kiri heading modal (seperti logo di header Beranda).
 *    Kalau dibiarkan null, otomatis memakai gambar CHAT di atas.
 *    Contoh: require('../../assets/herbbot-header.png') */
export const BOT_HEADER_AVATAR_SOURCE: ImageSourcePropType | null = require('../../assets/herbbot-2.png');
