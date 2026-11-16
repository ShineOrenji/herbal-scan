import React, { useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Animated,
  Easing,
  Modal,
  Pressable,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';

interface HerbalConfirmModalProps {
  visible: boolean;
  variant?: 'single' | 'danger-all';
  title: string;
  message: string;
  itemLabel?: string;
  confirmText?: string;
  cancelText?: string;
  loading?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}

export default function HerbalConfirmModal({
  visible,
  variant = 'single',
  title,
  message,
  itemLabel,
  confirmText = 'Hapus',
  cancelText = 'Batal',
  loading = false,
  onConfirm,
  onCancel,
}: HerbalConfirmModalProps) {
  const [rendered, setRendered] = useState(visible);

  const backdropOpacity = useRef(new Animated.Value(0)).current;
  const sheetTranslateY = useRef(new Animated.Value(60)).current;
  const sheetScale = useRef(new Animated.Value(0.94)).current;
  const waveScale = useRef(new Animated.Value(0.85)).current;
  const waveOpacity = useRef(new Animated.Value(0.55)).current;
  const iconTilt = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    let rippleLoop: Animated.CompositeAnimation | null = null;

    if (visible) {
      setRendered(true);
      backdropOpacity.setValue(0);
      sheetTranslateY.setValue(48);
      sheetScale.setValue(0.93);
      iconTilt.setValue(0);

      Animated.parallel([
        Animated.timing(backdropOpacity, {
          toValue: 1,
          duration: 240,
          easing: Easing.out(Easing.cubic),
          useNativeDriver: true,
        }),
        Animated.spring(sheetTranslateY, {
          toValue: 0,
          damping: 18,
          stiffness: 190,
          mass: 0.85,
          useNativeDriver: true,
        }),
        Animated.spring(sheetScale, {
          toValue: 1,
          damping: 18,
          stiffness: 190,
          useNativeDriver: true,
        }),
        Animated.sequence([
          Animated.delay(140),
          Animated.timing(iconTilt, { toValue: -1, duration: 90, useNativeDriver: true }),
          Animated.timing(iconTilt, { toValue: 1, duration: 110, useNativeDriver: true }),
          Animated.timing(iconTilt, { toValue: 0, duration: 90, useNativeDriver: true }),
        ]),
      ]).start();

      rippleLoop = Animated.loop(
        Animated.parallel([
          Animated.timing(waveScale, {
            toValue: 1.55,
            duration: 1500,
            easing: Easing.out(Easing.quad),
            useNativeDriver: true,
          }),
          Animated.timing(waveOpacity, {
            toValue: 0,
            duration: 1500,
            easing: Easing.out(Easing.quad),
            useNativeDriver: true,
          }),
        ])
      );
      rippleLoop.start();
    } else if (rendered) {
      Animated.parallel([
        Animated.timing(backdropOpacity, {
          toValue: 0,
          duration: 180,
          easing: Easing.in(Easing.cubic),
          useNativeDriver: true,
        }),
        Animated.timing(sheetTranslateY, {
          toValue: 32,
          duration: 180,
          easing: Easing.in(Easing.cubic),
          useNativeDriver: true,
        }),
        Animated.timing(sheetScale, {
          toValue: 0.94,
          duration: 180,
          useNativeDriver: true,
        }),
      ]).start(() => setRendered(false));
    }

    return () => {
      if (rippleLoop) rippleLoop.stop();
    };
  }, [visible, rendered, backdropOpacity, sheetTranslateY, sheetScale, waveScale, waveOpacity, iconTilt]);

  if (!rendered) return null;

  const isBulk = variant === 'danger-all';
  const rotateInterpolate = iconTilt.interpolate({
    inputRange: [-1, 0, 1],
    outputRange: ['-10deg', '0deg', '10deg'],
  });

  return (
    <Modal
      transparent
      visible={rendered}
      animationType="none"
      statusBarTranslucent
      onRequestClose={loading ? undefined : onCancel}
    >
      <Animated.View style={[styles.backdrop, { opacity: backdropOpacity }]}>
        <Pressable
          style={StyleSheet.absoluteFill}
          onPress={loading ? undefined : onCancel}
        />

        <Animated.View
          style={[
            styles.card,
            {
              transform: [{ translateY: sheetTranslateY }, { scale: sheetScale }],
            },
          ]}
        >
          <View style={styles.handlePill} />

          <View style={styles.radarContainer}>
            <Animated.View
              style={[
                styles.radarWave,
                isBulk ? styles.radarWaveBulk : styles.radarWaveSingle,
                {
                  opacity: waveOpacity,
                  transform: [{ scale: waveScale }],
                },
              ]}
            />
            <View
              style={[
                styles.iconCore,
                isBulk ? styles.iconCoreBulk : styles.iconCoreSingle,
              ]}
            >
              <Animated.View style={{ transform: [{ rotate: rotateInterpolate }] }}>
                <Ionicons
                  name={isBulk ? 'trash-bin' : 'leaf'}
                  size={28}
                  color="#ffffff"
                />
              </Animated.View>
            </View>
          </View>

          <Text style={styles.title}>{title}</Text>
          <Text style={styles.message}>{message}</Text>

          {itemLabel ? (
            <View style={styles.specimenChip}>
              <Ionicons name="sparkles" size={14} color="#86efac" />
              <Text style={styles.specimenChipText} numberOfLines={1}>
                {itemLabel}
              </Text>
            </View>
          ) : null}

          <View style={styles.actionsRow}>
            <TouchableOpacity
              style={styles.cancelBtn}
              activeOpacity={0.78}
              onPress={onCancel}
              disabled={loading}
            >
              <Text style={styles.cancelBtnText}>{cancelText}</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[
                styles.confirmBtn,
                isBulk ? styles.confirmBtnBulk : styles.confirmBtnSingle,
              ]}
              activeOpacity={0.85}
              onPress={onConfirm}
              disabled={loading}
            >
              {loading ? (
                <ActivityIndicator size="small" color="#ffffff" />
              ) : (
                <>
                  <Ionicons name="trash-outline" size={17} color="#ffffff" />
                  <Text style={styles.confirmBtnText}>{confirmText}</Text>
                </>
              )}
            </TouchableOpacity>
          </View>
        </Animated.View>
      </Animated.View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(2, 24, 16, 0.66)',
    justifyContent: 'flex-end',
    paddingHorizontal: 14,
    paddingBottom: 22,
  },
  card: {
    width: '100%',
    backgroundColor: '#0E2B1B',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.24)',
    borderRadius: 34,
    paddingHorizontal: 22,
    paddingTop: 12,
    paddingBottom: 22,
    alignItems: 'center',
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 14 },
    shadowOpacity: 0.4,
    shadowRadius: 24,
    elevation: 16,
  },
  handlePill: {
    width: 42,
    height: 4.5,
    borderRadius: 99,
    backgroundColor: 'rgba(255, 255, 255, 0.28)',
    marginBottom: 18,
  },
  radarContainer: {
    width: 78,
    height: 78,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 14,
  },
  radarWave: {
    position: 'absolute',
    width: 66,
    height: 66,
    borderRadius: 33,
  },
  radarWaveSingle: {
    backgroundColor: '#f59e0b',
  },
  radarWaveBulk: {
    backgroundColor: '#ef4444',
  },
  iconCore: {
    width: 60,
    height: 60,
    borderRadius: 30,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#0f172a',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.18,
    shadowRadius: 10,
    elevation: 5,
  },
  iconCoreSingle: {
    backgroundColor: '#d97706',
  },
  iconCoreBulk: {
    backgroundColor: '#dc2626',
  },
  title: {
    fontSize: 19,
    fontWeight: '800',
    color: '#ffffff',
    textAlign: 'center',
    marginBottom: 6,
  },
  message: {
    fontSize: 13.5,
    color: 'rgba(236, 253, 245, 0.74)',
    textAlign: 'center',
    lineHeight: 20,
    marginBottom: 14,
  },
  specimenChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: 'rgba(74, 222, 128, 0.16)',
    borderWidth: 1,
    borderColor: 'rgba(134, 239, 172, 0.38)',
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 999,
    marginBottom: 18,
    maxWidth: '100%',
  },
  specimenChipText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#86efac',
  },
  actionsRow: {
    flexDirection: 'row',
    gap: 10,
    width: '100%',
    marginTop: 4,
  },
  cancelBtn: {
    flex: 1,
    paddingVertical: 15,
    borderRadius: 999,
    backgroundColor: 'rgba(255, 255, 255, 0.14)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.18)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  cancelBtnText: {
    fontSize: 14.5,
    fontWeight: '700',
    color: '#ffffff',
  },
  confirmBtn: {
    flex: 1.3,
    flexDirection: 'row',
    gap: 7,
    paddingVertical: 15,
    borderRadius: 999,
    alignItems: 'center',
    justifyContent: 'center',
  },
  confirmBtnSingle: {
    backgroundColor: '#d97706',
  },
  confirmBtnBulk: {
    backgroundColor: '#dc2626',
  },
  confirmBtnText: {
    fontSize: 14.5,
    fontWeight: '700',
    color: '#ffffff',
  },
});
