import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import GlassIconButton from './GlassIconButton';
import BotAvatar from './BotAvatar';
import { C, HB } from './theme';

interface HerbBotHeaderProps {
  plantName?: string;
  isToxic: boolean;
  isAuthenticated: boolean;
  isPlantMode: boolean;
  canReset: boolean;
  historyOpen: boolean;
  onNewChat: () => void;
  onToggleHistory: () => void;
  onReset: () => void;
  onClose: () => void;
}

const BTN = 38;

/** Heading disamakan dengan header Beranda: logo + teks brand mint di kiri, tombol lingkaran glass di kanan. */
export default function HerbBotHeader({
  plantName,
  isToxic,
  isAuthenticated,
  isPlantMode,
  canReset,
  historyOpen,
  onNewChat,
  onToggleHistory,
  onReset,
  onClose,
}: HerbBotHeaderProps) {
  const warn = isToxic && Boolean(plantName);

  return (
    <View style={styles.header}>
      <BotAvatar size={46} variant="header" />

      <View style={styles.titleCol}>
        <Text style={styles.brand}>{historyOpen ? 'Riwayat Konsultasi' : 'HerbBOT'}</Text>
        <View style={styles.subRow}>
          {warn && <Ionicons name="warning" size={11} color={HB.danger} />}
          <Text style={[styles.sub, warn && { color: HB.danger }]} numberOfLines={1}>
            {plantName ? `Konteks · ${plantName}` : 'Asisten botani & herbal'}
          </Text>
        </View>
      </View>

      {isAuthenticated && !isPlantMode && (
        <>
          <GlassIconButton icon="create-outline" label="Chat baru" size={BTN} onPress={onNewChat} />
          <GlassIconButton
            icon="time-outline"
            label="Riwayat percakapan"
            size={BTN}
            active={historyOpen}
            onPress={onToggleHistory}
          />
        </>
      )}

      {isAuthenticated && isPlantMode && canReset && (
        <GlassIconButton icon="refresh" label="Reset percakapan" size={BTN} danger onPress={onReset} />
      )}

      <GlassIconButton icon="close" label="Tutup" size={BTN} onPress={onClose} />
    </View>
  );
}

const styles = StyleSheet.create({
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 16,
    paddingBottom: 12,
  },
  titleCol: { flex: 1, marginLeft: 2 },
  brand: { color: C.mint, fontSize: 15, fontWeight: '700' },
  subRow: { flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 1 },
  sub: { flexShrink: 1, color: C.textSoft, fontSize: 12, fontWeight: '600' },
});
