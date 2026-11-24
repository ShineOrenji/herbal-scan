import { HerbBotMessageItem } from '../../services/api';

export interface ChatBubble extends HerbBotMessageItem {
  isError?: boolean;
  /** Teks pertanyaan yang gagal terkirim, dipakai tombol "Coba lagi" */
  retryText?: string;
  /** id pesan sementara milik pertanyaan yang gagal */
  retryTempId?: string;
}

/** Isi dialog konfirmasi — dirender oleh HerbalConfirmModal (komponen yang sama dengan Riwayat/Profil) */
export interface ConfirmState {
  variant: 'single' | 'danger-all';
  title: string;
  description: string;
  itemLabel?: string;
  confirmLabel: string;
  successMessage: string;
  onConfirm: () => Promise<void>;
}
