import React, { useRef } from 'react';
import { Animated, PanResponder, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { HerbBotSessionSummary } from '../../services/api';
import { C, HB, glass } from './theme';

const ACTION_W = 84;

interface Props {
  item: HerbBotSessionSummary;
  isCurrent: boolean;
  onSelect: () => void;
  onRequestDelete: () => void;
}

export default function SwipeableHistoryRow({ item, isCurrent, onSelect, onRequestDelete }: Props) {
  const translateX = useRef(new Animated.Value(0)).current;
  const isOpen = useRef(false);

  const snapTo = (target: number) => {
    isOpen.current = target < 0;
    Animated.spring(translateX, {
      toValue: target,
      useNativeDriver: true,
      friction: 9,
      tension: 80,
    }).start();
  };

  const pan = useRef(
    PanResponder.create({
      onMoveShouldSetPanResponder: (_, g) =>
        Math.abs(g.dx) > 10 && Math.abs(g.dx) > Math.abs(g.dy) * 1.4,
      onPanResponderMove: (_, g) => {
        const base = isOpen.current ? -ACTION_W : 0;
        translateX.setValue(Math.max(-ACTION_W - 12, Math.min(0, base + g.dx)));
      },
      onPanResponderRelease: (_, g) => {
        if (g.dx < -32 || (isOpen.current && g.dx < 24)) snapTo(-ACTION_W);
        else snapTo(0);
      },
      onPanResponderTerminate: () => snapTo(isOpen.current ? -ACTION_W : 0),
    })
  ).current;

  // Aksi hapus hanya terlihat saat kartu digeser (kartu bersifat translusen)
  const actionOpacity = translateX.interpolate({
    inputRange: [-ACTION_W, -12, 0],
    outputRange: [1, 0.6, 0],
    extrapolate: 'clamp',
  });

  const count = item.messages_count ?? 0;

  return (
    <View style={styles.container}>
      <Animated.View style={[styles.action, { opacity: actionOpacity }]}>
        <TouchableOpacity
          style={styles.actionTouch}
          activeOpacity={0.85}
          onPress={() => {
            snapTo(0);
            onRequestDelete();
          }}
        >
          <Ionicons name="trash-outline" size={19} color={C.white} />
          <Text style={styles.actionText}>Hapus</Text>
        </TouchableOpacity>
      </Animated.View>

      <Animated.View
        style={[styles.card, isCurrent && styles.cardActive, { transform: [{ translateX }] }]}
        {...pan.panHandlers}
      >
        <TouchableOpacity
          style={styles.touch}
          activeOpacity={0.8}
          onPress={() => (isOpen.current ? snapTo(0) : onSelect())}
        >
          <View style={styles.iconBadge}>
            <Ionicons name="chatbubble-ellipses" size={16} color={C.mint} />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={styles.title} numberOfLines={1}>
              {item.title}
            </Text>
            <Text style={styles.meta}>{count} pesan</Text>
          </View>
          {isCurrent ? (
            <Ionicons name="checkmark-circle" size={18} color={C.emerald} />
          ) : (
            <Ionicons name="chevron-forward" size={16} color={C.textFaint} />
          )}
        </TouchableOpacity>
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { borderRadius: 20, overflow: 'hidden', justifyContent: 'center' },
  action: {
    position: 'absolute',
    right: 0,
    top: 0,
    bottom: 0,
    width: ACTION_W,
    backgroundColor: HB.dangerSolid,
    borderRadius: 20,
  },
  actionTouch: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 2 },
  actionText: { color: C.white, fontSize: 11, fontWeight: '800' },
  card: { ...glass, borderRadius: 20 },
  cardActive: { borderColor: C.emerald },
  touch: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingHorizontal: 14,
    paddingVertical: 13,
  },
  iconBadge: {
    width: 36,
    height: 36,
    borderRadius: 12,
    backgroundColor: HB.emeraldTint,
    borderWidth: 1,
    borderColor: HB.emeraldBorder,
    alignItems: 'center',
    justifyContent: 'center',
  },
  title: { color: C.white, fontSize: 14, fontWeight: '700' },
  meta: { color: C.textSoft, fontSize: 11.5, marginTop: 2 },
});
