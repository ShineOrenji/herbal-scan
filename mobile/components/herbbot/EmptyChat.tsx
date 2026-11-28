import React from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { BotMascot } from './BotAvatar';
import { SuggestionList } from './Suggestions';
import { C } from './theme';

interface EmptyChatProps {
  greeting: string;
  subtitle: string;
  suggestions: string[];
  onPick: (q: string) => void;
}

/**
 * Tampilan awal chat: sapaan di TENGAH layar (bukan bubble chat),
 * saran pertanyaan turun ke BAWAH tepat di atas kolom input.
 */
export default function EmptyChat({ greeting, subtitle, suggestions, onPick }: EmptyChatProps) {
  return (
    <ScrollView
      style={{ flex: 1 }}
      contentContainerStyle={styles.content}
      showsVerticalScrollIndicator={false}
      keyboardShouldPersistTaps="handled"
    >
      <View style={styles.hero}>
        <BotMascot size={124} />
        <Text style={styles.greeting}>{greeting}</Text>
        <Text style={styles.subtitle}>{subtitle}</Text>
      </View>

      {suggestions.length > 0 && (
        <View style={styles.suggestions}>
          <SuggestionList items={suggestions} onPick={onPick} />
        </View>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  content: { flexGrow: 1, paddingHorizontal: 16, paddingBottom: 8 },
  hero: {
    flex: 1,
    minHeight: 190,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 12,
    paddingBottom: 12,
    gap: 6,
  },
  greeting: {
    color: C.white,
    fontSize: 26,
    fontWeight: '300',
    letterSpacing: -0.5,
    textAlign: 'center',
    marginTop: 6,
  },
  subtitle: {
    color: C.textSoft,
    fontSize: 13.5,
    lineHeight: 20,
    textAlign: 'center',
    maxWidth: 320,
  },
  suggestions: { paddingTop: 8 },
});
