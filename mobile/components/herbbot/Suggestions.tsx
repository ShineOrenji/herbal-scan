import React from 'react';
import { ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { C, HB, R, glass } from './theme';

interface SuggestionProps {
  items: string[];
  onPick: (q: string) => void;
}

/** Kartu vertikal — dipakai saat percakapan masih kosong */
export function SuggestionList({ items, onPick }: SuggestionProps) {
  return (
    <View style={styles.listWrap}>
      <Text style={styles.listTitle}>Coba tanyakan</Text>
      {items.map((q, idx) => (
        <TouchableOpacity
          key={`sug_${idx}`}
          style={styles.card}
          activeOpacity={0.8}
          onPress={() => onPick(q)}
        >
          <View style={styles.cardIcon}>
            <Ionicons name="sparkles" size={16} color={C.mint} />
          </View>
          <Text style={styles.cardText} numberOfLines={2}>
            {q}
          </Text>
          <Ionicons name="chevron-forward" size={16} color={C.textFaint} />
        </TouchableOpacity>
      ))}
      <Text style={styles.hint}>Tahan pesan untuk menyalin atau menghapus.</Text>
    </View>
  );
}

/** Chip horizontal — dipakai di atas kolom input saat percakapan berjalan */
export function SuggestionChips({ items, onPick }: SuggestionProps) {
  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      keyboardShouldPersistTaps="handled"
      style={styles.chipsScroll}
      contentContainerStyle={styles.chipsContent}
    >
      {items.map((q, idx) => (
        <TouchableOpacity
          key={`chip_${idx}`}
          style={styles.chip}
          activeOpacity={0.8}
          onPress={() => onPick(q)}
        >
          <Ionicons name="sparkles-outline" size={13} color={C.mint} />
          <Text style={styles.chipText} numberOfLines={1}>
            {q}
          </Text>
        </TouchableOpacity>
      ))}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  listWrap: { gap: 8, marginTop: 8 },
  listTitle: {
    color: C.textSoft,
    fontSize: 12,
    fontWeight: '800',
    letterSpacing: 0.6,
    textTransform: 'uppercase',
    marginBottom: 2,
    paddingHorizontal: 4,
  },
  card: {
    ...glass,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    borderRadius: 20,
    paddingVertical: 12,
    paddingHorizontal: 12,
  },
  cardIcon: {
    width: 34,
    height: 34,
    borderRadius: 12,
    backgroundColor: HB.emeraldTint,
    borderWidth: 1,
    borderColor: HB.emeraldBorder,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cardText: { flex: 1, color: C.white, fontSize: 13.5, fontWeight: '600', lineHeight: 19 },
  hint: {
    color: C.textFaint,
    fontSize: 11.5,
    textAlign: 'center',
    marginTop: 6,
  },
  chipsScroll: { flexGrow: 0, marginBottom: 8 },
  chipsContent: { paddingHorizontal: 16, gap: 8, alignItems: 'center' },
  chip: {
    ...glass,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    borderRadius: R.pill,
    paddingHorizontal: 13,
    paddingVertical: 8,
    maxWidth: 280,
  },
  chipText: { color: C.mint, fontSize: 12.5, fontWeight: '700' },
});
