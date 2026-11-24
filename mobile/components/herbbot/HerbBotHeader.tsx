import React from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import GlassIconButton from './GlassIconButton';
import { C, HB, glass } from './theme';
import {Image,
  ImageSourcePropType,} from 'react-native';

const BOT_AVATAR_SOURCE: ImageSourcePropType | null = require('../../assets/herbbot.png');

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
      {BOT_AVATAR_SOURCE ? (
                <Image source={BOT_AVATAR_SOURCE} style={styles.avatarImg} resizeMode="cover" />
              ) : (
                <Ionicons name="sparkles" size={26} color={C.white} />
              )}

      <View style={styles.titleCol}>
        <Text style={styles.title}>{historyOpen ? 'Riwayat' : 'HerbBOT'}</Text>
        <View style={styles.subRow}>
          {warn && <Ionicons name="warning" size={11} color={HB.danger} />}
          <Text style={[styles.sub, warn && { color: HB.danger }]} numberOfLines={1}>
            {plantName ? `Konteks · ${plantName}` : 'Asisten botani & herbal'}
          </Text>
        </View>
      </View>

      {/* Beranda: Chat baru + Riwayat dalam satu kapsul kaca */}
      {isAuthenticated && !isPlantMode && (
        <View style={styles.capsule}>
          <TouchableOpacity
            accessibilityRole="button"
            accessibilityLabel="Chat baru"
            style={styles.capsuleBtn}
            onPress={onNewChat}
            activeOpacity={0.7}
          >
            <Ionicons name="create-outline" size={18} color={C.mint} />
          </TouchableOpacity>
          <View style={styles.capsuleDivider} />
          <TouchableOpacity
            accessibilityRole="button"
            accessibilityLabel="Riwayat percakapan"
            style={[styles.capsuleBtn, historyOpen && styles.capsuleBtnActive]}
            onPress={onToggleHistory}
            activeOpacity={0.7}
          >
            <Ionicons name="time-outline" size={18} color={historyOpen ? C.white : C.mint} />
          </TouchableOpacity>
        </View>
      )}

      {/* Detail tanaman: hanya tombol reset */}
      {isAuthenticated && isPlantMode && canReset && (
        <GlassIconButton icon="refresh" label="Reset percakapan" danger onPress={onReset} />
      )}

      <GlassIconButton icon="close" label="Tutup" onPress={onClose} />
    </View>
  );
}

const styles = StyleSheet.create({
  avatarImg: {
    width: 60,
    height: 60,
  },

  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingHorizontal: 16,
    paddingBottom: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: HB.hairline,
  },
  badge: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: C.emerald,
    borderWidth: 1,
    borderColor: 'rgba(187, 247, 208, 0.6)',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: C.emerald,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.4,
    shadowRadius: 8,
    elevation: 5,
  },
  titleCol: { flex: 1 },
  title: { color: C.white, fontSize: 18, fontWeight: '800', letterSpacing: -0.3 },
  subRow: { flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 1 },
  sub: { flexShrink: 1, color: C.textSoft, fontSize: 12, fontWeight: '600' },
  capsule: {
    ...glass,
    flexDirection: 'row',
    alignItems: 'center',
    height: 36,
    borderRadius: 18,
    overflow: 'hidden',
  },
  capsuleBtn: {
    width: 40,
    height: 36,
    alignItems: 'center',
    justifyContent: 'center',
  },
  capsuleBtnActive: { backgroundColor: C.emerald },
  capsuleDivider: { width: StyleSheet.hairlineWidth, height: 16, backgroundColor: HB.hairline },
});
