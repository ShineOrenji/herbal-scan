import React, { useEffect, useRef } from 'react';
import { Animated, StyleSheet, View } from 'react-native';
import BotAvatar from './BotAvatar';
import { C, glass } from './theme';

const STEP = 300;

function Dot({ offset }: { offset: number }) {
  const v = useRef(new Animated.Value(0.3)).current;

  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.delay(offset),
        Animated.timing(v, { toValue: 1, duration: STEP, useNativeDriver: true }),
        Animated.timing(v, { toValue: 0.3, duration: STEP, useNativeDriver: true }),
        Animated.delay(STEP - offset),
      ])
    );
    loop.start();
    return () => loop.stop();
  }, [offset, v]);

  return <Animated.View style={[styles.dot, { opacity: v }]} />;
}

export default function TypingIndicator() {
  return (
    <View style={styles.row}>
      <BotAvatar size={30} />
      <View style={styles.bubble}>
        <Dot offset={0} />
        <Dot offset={STEP / 2} />
        <Dot offset={STEP} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'flex-end', gap: 8 },
  bubble: {
    ...glass,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    borderRadius: 22,
    borderBottomLeftRadius: 7,
    paddingHorizontal: 16,
    paddingVertical: 15,
  },
  dot: { width: 7, height: 7, borderRadius: 3.5, backgroundColor: C.mint },
});
