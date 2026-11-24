import React from 'react';
import { StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { C, glass } from './theme';

interface ChatInputBarProps {
  value: string;
  onChange: (v: string) => void;
  onSend: () => void;
  sending: boolean;
  placeholder: string;
  bottomPad: number;
  compact: boolean; // true saat keyboard tampil → sembunyikan disclaimer
}

export default function ChatInputBar({
  value,
  onChange,
  onSend,
  sending,
  placeholder,
  bottomPad,
  compact,
}: ChatInputBarProps) {
  const canSend = value.trim().length > 0 && !sending;

  return (
    <View style={[styles.wrap, { paddingBottom: bottomPad }]}>
      <View style={styles.capsule}>
        <TextInput
          style={styles.input}
          value={value}
          onChangeText={onChange}
          placeholder={placeholder}
          placeholderTextColor={C.textFaint}
          multiline
          maxLength={500}
          selectionColor={C.mint}
        />
        <TouchableOpacity
          accessibilityRole="button"
          accessibilityLabel="Kirim pertanyaan"
          style={[styles.sendBtn, !canSend && styles.sendBtnOff]}
          onPress={onSend}
          disabled={!canSend}
          activeOpacity={0.85}
        >
          <Ionicons name="arrow-up" size={19} color={canSend ? C.white : C.textFaint} />
        </TouchableOpacity>
      </View>
      {!compact && (
        <Text style={styles.disclaimer}>Edukasi herbal, bukan pengganti diagnosis dokter</Text>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { paddingHorizontal: 14, paddingTop: 4 },
  capsule: {
    ...glass,
    flexDirection: 'row',
    alignItems: 'flex-end',
    borderRadius: 26,
    paddingLeft: 16,
    paddingRight: 6,
    paddingVertical: 6,
    gap: 8,
  },
  input: {
    flex: 1,
    minHeight: 34,
    maxHeight: 110,
    paddingTop: 7,
    paddingBottom: 7,
    color: C.white,
    fontSize: 14.5,
  },
  sendBtn: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: C.emerald,
    alignItems: 'center',
    justifyContent: 'center',
  },
  sendBtnOff: { backgroundColor: 'rgba(255,255,255,0.12)' },
  disclaimer: {
    textAlign: 'center',
    color: C.textFaint,
    fontSize: 10.5,
    marginTop: 7,
  },
});
