import React from 'react';
import { Pressable, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import BotAvatar from './BotAvatar';
import UserAvatar from './UserAvatar';
import RichMessageBody from './RichMessageBody';
import { ChatBubble } from './types';
import { C, HB, glass } from './theme';

interface MessageBubbleProps {
  msg: ChatBubble;
  onLongPress?: () => void;
  onRetry?: () => void;
}

const AVATAR = 30;

export default function MessageBubble({ msg, onLongPress, onRetry }: MessageBubbleProps) {
  const isUser = msg.role === 'user';

  return (
    <View style={[styles.row, isUser ? styles.rowUser : styles.rowBot]}>

      {!isUser && <BotAvatar size={AVATAR} error={msg.isError} />}

      <Pressable
        onLongPress={onLongPress}
        delayLongPress={280}
        disabled={!onLongPress}
        style={({ pressed }) => [
          styles.bubble,
          isUser ? styles.userBubble : styles.botBubble,
          msg.isError && styles.errorBubble,
          pressed && { opacity: 0.85 },
        ]}
      >
        {msg.isError && <Text style={styles.errorLabel}>Gangguan koneksi</Text>}
        <RichMessageBody text={msg.text} isUser={isUser} />

        {msg.isError && onRetry && (
          <TouchableOpacity style={styles.retryBtn} onPress={onRetry} activeOpacity={0.8}>
            <Ionicons name="refresh" size={13} color={C.white} />
            <Text style={styles.retryText}>Coba lagi</Text>
          </TouchableOpacity>
        )}
      </Pressable>
      
      {/* Nyalakan agar ada avatarnya profilenya di samping bubble chat */}
      {/* {isUser && <UserAvatar size={AVATAR} />} */}
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'flex-end', gap: 8 },
  rowUser: { justifyContent: 'flex-end' },
  rowBot: { justifyContent: 'flex-start' },
  bubble: {
    maxWidth: '78%',
    paddingHorizontal: 15,
    paddingVertical: 11,
  },
  userBubble: {
    backgroundColor: C.emerald,
    borderRadius: 22,
    borderBottomRightRadius: 7,
    shadowColor: C.emerald,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 3,
  },
  botBubble: {
    ...glass,
    borderRadius: 22,
    borderBottomLeftRadius: 7,
  },
  errorBubble: {
    backgroundColor: HB.dangerTint,
    borderColor: HB.dangerBorder,
  },
  errorLabel: {
    color: HB.danger,
    fontSize: 11.5,
    fontWeight: '800',
    marginBottom: 4,
  },
  retryBtn: {
    alignSelf: 'flex-start',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: 10,
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 999,
    backgroundColor: 'rgba(255,255,255,0.14)',
  },
  retryText: { color: C.white, fontSize: 12.5, fontWeight: '700' },
});
