import React, { useEffect, useRef, useState } from 'react';
import { Animated, Modal, Pressable, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { C, HB } from './theme';

interface Props {
  visible: boolean;
  preview: string;
  onShare: () => void;
  onDelete: () => void;
  onCancel: () => void;
}

/**
 * Dialog opsi pesan berupa <Modal> sungguhan (jendela sendiri) tepat di tengah layar.
 * Karena bukan bagian dari layout sheet, kolom chat TIDAK ikut bergeser / terdorong.
 */
export default function MessageActionsDialog({ visible, preview, onShare, onDelete, onCancel }: Props) {
  const [rendered, setRendered] = useState(visible);
  const backdrop = useRef(new Animated.Value(0)).current;
  const scale = useRef(new Animated.Value(0.92)).current;
  const lastPreview = useRef(preview);
  if (preview) lastPreview.current = preview;

  useEffect(() => {
    if (visible) {
      setRendered(true);
      backdrop.setValue(0);
      scale.setValue(0.92);
      Animated.parallel([
        Animated.timing(backdrop, { toValue: 1, duration: 170, useNativeDriver: true }),
        Animated.spring(scale, { toValue: 1, friction: 9, tension: 90, useNativeDriver: true }),
      ]).start();
    } else {
      Animated.timing(backdrop, { toValue: 0, duration: 140, useNativeDriver: true }).start(
        ({ finished }) => {
          if (finished) setRendered(false);
        }
      );
    }
  }, [visible, backdrop, scale]);

  if (!rendered) return null;

  return (
    <Modal
      transparent
      visible={rendered}
      animationType="none"
      statusBarTranslucent
      onRequestClose={onCancel}
    >
    <Animated.View style={[styles.backdrop, { opacity: backdrop }]}>
      <Pressable style={StyleSheet.absoluteFill} onPress={onCancel} />

      <Animated.View style={[styles.card, { transform: [{ scale }] }]}>
        <View style={styles.iconCircle}>
          <Ionicons name="chatbubble-ellipses" size={22} color={C.leafSoft} />
        </View>
        <Text style={styles.title}>Opsi Pesan</Text>
        <Text style={styles.preview} numberOfLines={3}>
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
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: HB.dim,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 28,
  },
  card: {
    width: '100%',
    maxWidth: 340,
    backgroundColor: HB.cardBg,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.24)',
    borderRadius: 30,
    padding: 20,
    alignItems: 'center',
    gap: 10,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 14 },
    shadowOpacity: 0.4,
    shadowRadius: 24,
    elevation: 16,
  },
  iconCircle: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: HB.emeraldTint,
    borderWidth: 1,
    borderColor: HB.emeraldBorder,
    alignItems: 'center',
    justifyContent: 'center',
  },
  title: { color: C.white, fontSize: 18, fontWeight: '800', textAlign: 'center' },
  preview: {
    color: C.textSoft,
    fontSize: 12.5,
    lineHeight: 18,
    fontStyle: 'italic',
    textAlign: 'center',
    marginBottom: 4,
  },
  row: {
    width: '100%',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderRadius: 20,
    backgroundColor: 'rgba(255, 255, 255, 0.08)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.14)',
  },
  rowDanger: { backgroundColor: HB.dangerTint, borderColor: HB.dangerBorder },
  rowText: { color: C.white, fontSize: 14.5, fontWeight: '700' },
  cancelBtn: {
    width: '100%',
    marginTop: 2,
    paddingVertical: 14,
    borderRadius: 999,
    backgroundColor: 'rgba(255, 255, 255, 0.14)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.18)',
    alignItems: 'center',
  },
  cancelText: { color: C.white, fontSize: 14.5, fontWeight: '700' },
});
