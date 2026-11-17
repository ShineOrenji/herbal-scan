import { useEffect, useRef } from 'react';
import { AppState, Linking, Platform } from 'react-native';
import * as Clipboard from 'expo-clipboard';
import AsyncStorage from '@react-native-async-storage/async-storage';

const PENDING_OTP_KEY = 'herbalscan_pending_otp_email';

export async function savePendingOtpEmail(email: string) {
  await AsyncStorage.setItem(PENDING_OTP_KEY, email.trim().toLowerCase());
}

export async function getPendingOtpEmail(): Promise<string | null> {
  return AsyncStorage.getItem(PENDING_OTP_KEY);
}

export async function clearPendingOtpEmail() {
  await AsyncStorage.removeItem(PENDING_OTP_KEY);
}

export function useAutoFillOtpFromGmail(onOtpDetected: (code: string) => void) {
  const appState = useRef(AppState.currentState);
  const lastDetected = useRef<string>('');

  useEffect(() => {
    const checkClipboard = async () => {
      try {
        const text = await Clipboard.getStringAsync();
        const match = text.trim().match(/\b(\d{6})\b/);
        if (match && match[1] && match[1] !== lastDetected.current) {
          lastDetected.current = match[1];
          onOtpDetected(match[1]);
        }
      } catch {
        // Abaikan jika izin clipboard tidak tersedia
      }
    };

    const sub = AppState.addEventListener('change', (nextState) => {
      if (appState.current.match(/inactive|background/) && nextState === 'active') {
        checkClipboard();
      }
      appState.current = nextState;
    });

    return () => sub.remove();
  }, [onOtpDetected]);
}

export async function openGmailApp() {
  if (Platform.OS === 'android') {
    await Linking.openURL('intent://#Intent;package=com.google.android.gm;scheme=googlegmail;end').catch(
      () => Linking.openURL('mailto:')
    );
    return;
  }
  const canOpen = await Linking.canOpenURL('googlegmail://').catch(() => false);
  await Linking.openURL(canOpen ? 'googlegmail://' : 'mailto:');
}