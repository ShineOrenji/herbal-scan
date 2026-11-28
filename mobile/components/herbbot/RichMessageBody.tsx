import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { C } from './theme';
import { sanitizeDisplayText } from './utils';

// Merender **tebal**, *miring*, judul ###, poin daftar & paragraf tanpa simbol mentah
export default function RichMessageBody({ text, isUser }: { text: string; isUser: boolean }) {
  const cleanText = sanitizeDisplayText(text)
    .replace(/`([^`\n]+)`/g, '$1')
    .replace(/^---+$/gm, '');
  const lines = cleanText.split(/\r?\n/);

  const baseText = [styles.text, isUser && styles.userText];
  const boldStyle = isUser ? styles.userBold : styles.botBold;

  const renderInline = (lineText: string, keyPrefix: string) => {
    const tokens = lineText.split(/(\*\*\*[^*\n]+\*\*\*|\*\*[^*\n]+\*\*|\*[^*\n]+\*)/g);
    return tokens.map((tok, idx) => {
      if (tok.startsWith('***') && tok.endsWith('***') && tok.length > 6) {
        return (
          <Text key={`${keyPrefix}_bi_${idx}`} style={[boldStyle, { fontStyle: 'italic' }]}>
            {tok.slice(3, -3)}
          </Text>
        );
      }
      if (tok.startsWith('**') && tok.endsWith('**') && tok.length > 4) {
        return (
          <Text key={`${keyPrefix}_b_${idx}`} style={boldStyle}>
            {tok.slice(2, -2)}
          </Text>
        );
      }
      if (tok.startsWith('*') && tok.endsWith('*') && tok.length > 2) {
        return (
          <Text key={`${keyPrefix}_i_${idx}`} style={{ fontStyle: 'italic' }}>
            {tok.slice(1, -1)}
          </Text>
        );
      }
      return <Text key={`${keyPrefix}_t_${idx}`}>{tok.replace(/\*/g, '')}</Text>;
    });
  };

  return (
    <View style={styles.wrap}>
      {lines.map((line, index) => {
        const trimmed = line.trim();
        if (trimmed === '') return <View key={`sp_${index}`} style={{ height: 4 }} />;

        const heading = trimmed.match(/^#{1,6}\s+(.*)$/);
        if (heading) {
          return (
            <Text key={`h_${index}`} style={[...baseText, boldStyle, { marginTop: 3 }]}>
              {renderInline(heading[1], `h_${index}`)}
            </Text>
          );
        }

        const bullet = trimmed.match(/^[\-\*\•]\s+(.*)$/);
        if (bullet) {
          return (
            <View key={`li_${index}`} style={styles.row}>
              <View style={[styles.dot, isUser && { backgroundColor: C.white }]} />
              <Text style={[...baseText, { flex: 1 }]}>{renderInline(bullet[1], `li_${index}`)}</Text>
            </View>
          );
        }

        const numbered = trimmed.match(/^(\d+\.)\s+(.*)$/);
        if (numbered) {
          return (
            <View key={`num_${index}`} style={styles.row}>
              <Text style={[styles.num, isUser && { color: C.white }]}>{numbered[1]}</Text>
              <Text style={[...baseText, { flex: 1 }]}>
                {renderInline(numbered[2], `num_${index}`)}
              </Text>
            </View>
          );
        }

        return (
          <Text key={`p_${index}`} style={baseText}>
            {renderInline(trimmed, `p_${index}`)}
          </Text>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: 3 },
  row: { flexDirection: 'row', alignItems: 'flex-start', gap: 8, paddingLeft: 2 },
  dot: {
    width: 5,
    height: 5,
    borderRadius: 2.5,
    backgroundColor: C.mint,
    marginTop: 9,
  },
  num: { color: C.mint, fontSize: 14.5, fontWeight: '800', lineHeight: 22, minWidth: 18 },
  text: { color: '#ecfdf5', fontSize: 14.5, lineHeight: 22 },
  userText: { color: C.white, fontWeight: '600' },
  botBold: { color: C.white, fontWeight: '800' },
  userBold: { color: C.white, fontWeight: '900' },
});
