import React from 'react';
import { StyleSheet, TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { C, HB, glass } from './theme';

interface GlassIconButtonProps {
  icon: React.ComponentProps<typeof Ionicons>['name'];
  label: string;
  onPress: () => void;
  active?: boolean;
  danger?: boolean;
  size?: number;
}

export default function GlassIconButton({
  icon,
  label,
  onPress,
  active,
  danger,
  size = 36,
}: GlassIconButtonProps) {
  return (
    <TouchableOpacity
      accessibilityRole="button"
      accessibilityLabel={label}
      activeOpacity={0.75}
      onPress={onPress}
      style={[
        styles.btn,
        { width: size, height: size, borderRadius: size / 2 },
        active && styles.active,
        danger && styles.danger,
      ]}
    >
      <Ionicons name={icon} size={Math.round(size * 0.5)} color={danger ? HB.danger : active ? C.white : C.mint} />
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  btn: {
    alignItems: 'center',
    justifyContent: 'center',
    ...glass,
  },
  active: {
    backgroundColor: C.emerald,
    borderColor: 'rgba(187, 247, 208, 0.7)',
  },
  danger: {
    backgroundColor: HB.dangerTint,
    borderColor: HB.dangerBorder,
  },
});
