import React from 'react';
import {
  ActivityIndicator,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { HerbBotSessionSummary } from '../../services/api';
import SwipeableHistoryRow from './SwipeableHistoryRow';
import { C, R } from './theme';

interface HistoryPanelProps {
  sessions: HerbBotSessionSummary[];
  loading: boolean;
  currentId?: number;
  onSelect: (s: HerbBotSessionSummary) => void;
  onDelete: (s: HerbBotSessionSummary) => void;
  onNewChat: () => void;
  bottomPad: number;
}

export default function HistoryPanel({
  sessions,
  loading,
  currentId,
  onSelect,
  onDelete,
  onNewChat,
  bottomPad,
}: HistoryPanelProps) {
  return (
    <View style={styles.wrap}>
      <View style={styles.topBar}>
        <View>
          <Text style={styles.heading}>Riwayat Konsultasi</Text>
          {!loading && sessions.length > 0 && (
            <Text style={styles.sub}>{sessions.length} percakapan</Text>
          )}
        </View>
        <TouchableOpacity style={styles.newPill} activeOpacity={0.85} onPress={onNewChat}>
          <Ionicons name="add" size={15} color={C.ink} />
          <Text style={styles.newPillText}>Chat Baru</Text>
        </TouchableOpacity>
      </View>

      {loading ? (
        <View style={styles.center}>
          <ActivityIndicator size="small" color={C.mint} />
        </View>
      ) : sessions.length === 0 ? (
        <View style={styles.center}>
          <Ionicons name="chatbubbles-outline" size={36} color={C.textFaint} />
          <Text style={styles.emptyText}>Belum ada riwayat konsultasi tersimpan.</Text>
        </View>
      ) : (
        <ScrollView
          showsVerticalScrollIndicator={false}
          contentContainerStyle={{ gap: 10, paddingBottom: bottomPad }}
        >
          {sessions.map((item) => (
            <SwipeableHistoryRow
              key={`sess_${item.id}`}
              item={item}
              isCurrent={item.id === currentId}
              onSelect={() => onSelect(item)}
              onRequestDelete={() => onDelete(item)}
            />
          ))}
          <Text style={styles.hint}>Geser ke kiri untuk menghapus percakapan</Text>
        </ScrollView>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { flex: 1, paddingHorizontal: 16, paddingTop: 16 },
  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 14,
  },
  heading: { color: C.white, fontSize: 17, fontWeight: '800' },
  sub: { color: C.textSoft, fontSize: 12, marginTop: 2 },
  newPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: C.white,
    paddingHorizontal: 13,
    paddingVertical: 8,
    borderRadius: R.pill,
  },
  newPillText: { color: C.ink, fontSize: 12.5, fontWeight: '800' },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 10 },
  emptyText: { color: C.textSoft, fontSize: 13, textAlign: 'center' },
  hint: { color: C.textFaint, fontSize: 11.5, textAlign: 'center', marginTop: 4 },
});
