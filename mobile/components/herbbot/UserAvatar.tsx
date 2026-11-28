import React from 'react';
import { Image, StyleSheet, Text, View } from 'react-native';
import { useAuth } from '../../contexts/AuthContext';
import { C } from './theme';

/** Foto profil user (avatar_url dari akun); bila belum ada, huruf pertama nama. */
export default function UserAvatar({ size = 30 }: { size?: number }) {
  const { user } = useAuth();
  const box = { width: size, height: size, borderRadius: size / 2 };

  if (user?.avatar_url) {
    return <Image source={{ uri: user.avatar_url }} style={[box, styles.photo]} />;
  }

  return (
    <View style={[box, styles.initialWrap]}>
      <Text style={[styles.initial, { fontSize: size * 0.44 }]}>
        {(user?.name || 'U').charAt(0).toUpperCase()}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  photo: {
    borderWidth: 1.5,
    borderColor: 'rgba(187, 247, 208, 0.7)',
    backgroundColor: 'rgba(255,255,255,0.1)',
  },
  initialWrap: {
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(74, 222, 128, 0.22)',
    borderWidth: 1.5,
    borderColor: 'rgba(187, 247, 208, 0.7)',
  },
  initial: { color: C.white, fontWeight: '800' },
});
