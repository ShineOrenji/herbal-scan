import React, { useEffect, useRef, useState } from 'react';
import { Animated, Pressable, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { C, HB } from './theme';

interface Props {
  visible: boolean;
  preview: string;
  onShare: () => void;
  onDelete: () => void;
  onCancel: () => void;
}

/**
 * Bottom sheet opsi pesan. Dirender sebagai sibling sheet chat (full layar),
 * gayanya disamakan dengan HerbalConfirmModal agar alert di seluruh app seragam.
 */
export default function MessageActionsSheet({ visible, preview, onShare, onDelete, onCancel }: Props) {
  const insets = useSafeAreaInsets();
  const [rendered, setRendered] = useState(visible);
  const backdrop = useRef(new Animated.Value(0)).current;
  const slide = useRef(new Animated.Value(48)).current;
  const lastPreview = useRef(preview);
  if (preview) lastPreview.current = preview;

  useEffect(() => {
    if (visible) {
      setRendered(true);
      backdrop.setValue(0);
      slide.setValue(48);
      Animated.parallel([
        Animated.timing(backdrop, { toValue: 1, duration: 220, useNativeDriver: true }),
        Animated.spring(slide, { toValue: 0, damping: 18, stiffness: 190, mass: 0.85, useNativeDriver: true }),
      ]).start();
    } else {
      Animated.parallel([
        Animated.timing(backdrop, { toValue: 0, duration: 170, useNativeDriver: true }),
        Animated.timing(slide, { toValue: 32, duration: 170, useNativeDriver: true }),
      ]).start(({ finished }) => {
        if (finished) setRendered(false);
      });
    }
  }, [visible, backdrop, slide]);

  if (!rendered) return null;

  return (
    <Animated.View style={[styles.backdrop, { opacity: backdrop, paddingBottom: Math.max(insets.bottom, 12) + 10 }]}>
      <Pressable style={StyleSheet.absoluteFill} onPress={onCancel} />

      <Animated.View style={[styles.card, { transform: [{ translateY: slide }] }]}>
        <View style={styles.handle} />
        <Text style={styles.title}>Opsi Pesan</Text>
        <Text style={styles.preview} numberOfLines={2}>
          {lastPreview.current}
        </Text>

        <TouchableOpacity style={styles.row} activeOpacity={0.8} onPress={onShare}>
          <Ionicons name="share-outline" size={19} color={C.leafSoft} />
          <Text style={styles.rowText}>Salin / Bagikan Teks</Text>
        </TouchableOpacity>

        <TouchableOpacity style={[styles.row, styles.rowDanger]} activeOpacity={0.8} onPress={onDelete}>
          <Ionicons name="trash-outline" size={19} color={HB.danger} />
          <Text style={[styles.rowText, { color: HB.danger }]}>Hapus Pesan</Text>
        </TouchableOpacity>

        <TouchableOpacity style={styles.cancelBtn} activeOpacity={0.8} onPress={onCancel}>
          <Text style={styles.cancelText}>Batal</Text>
        </TouchableOpacity>
      </Animated.View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: HB.dim,
    justifyContent: 'flex-end',
    paddingHorizontal: 14,
    zIndex: 100,
    elevation: 100,
  },
  card: {
    width: '100%',
    backgroundColor: HB.cardBg,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.24)',
    borderRadius: 34,
    paddingHorizontal: 20,
    paddingTop: 12,
    paddingBottom: 20,
    gap: 10,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 14 },
    shadowOpacity: 0.4,
    shadowRadius: 24,
    elevation: 16,
  },
  handle: {
    alignSelf: 'center',
    width: 42,
    height: 4.5,
    borderRadius: 99,
    backgroundColor: 'rgba(255, 255, 255, 0.28)',
    marginBottom: 6,
  },
  title: { color: C.white, fontSize: 18, fontWeight: '800', textAlign: 'center' },
  preview: {
    color: C.textSoft,
    fontSize: 12.5,
    lineHeight: 18,
    fontStyle: 'italic',
    textAlign: 'center',
    marginBottom: 6,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingHorizontal: 16,
    paddingVertical: 15,
    borderRadius: 20,
    backgroundColor: 'rgba(255, 255, 255, 0.08)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.14)',
  },
  rowDanger: { backgroundColor: HB.dangerTint, borderColor: HB.dangerBorder },
  rowText: { color: C.white, fontSize: 14.5, fontWeight: '700' },
  cancelBtn: {
    marginTop: 2,
    paddingVertical: 15,
    borderRadius: 999,
    backgroundColor: 'rgba(255, 255, 255, 0.14)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.18)',
    alignItems: 'center',
  },
  cancelText: { color: C.white, fontSize: 14.5, fontWeight: '700' },
});
