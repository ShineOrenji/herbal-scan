import React, { createContext, useCallback, useContext, useEffect, useState } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  UserProfile,
  getMeApi,
  googleLoginApi,
  loginApi,
  logoutApi,
  sendRegisterOtpApi,
  setApiAuthToken,
  updatePasswordApi,
  updateProfileApi,
  uploadAvatarApi,
  verifyRegisterOtpApi,
} from '../services/api';

const TOKEN_STORAGE_KEY = '@herbalscan_auth_token';
const USER_STORAGE_KEY = '@herbalscan_auth_user';

interface AuthContextValue {
  user: UserProfile | null;
  token: string | null;
  isReady: boolean;
  loginWithCredentials: (identifier: string, password: string) => Promise<void>;
  sendRegisterOtp: (payload: {
    name: string;
    email: string;
    phone?: string;
    password: string;
  }) => Promise<{ message: string; dev_otp?: string | null }>;
  verifyRegisterOtp: (email: string, otp: string) => Promise<void>;
  loginWithGoogleToken: (tokens: { access_token?: string; id_token?: string }) => Promise<void>;
  updateProfileData: (name: string, phone?: string) => Promise<string>;
  uploadAvatarImage: (uri: string) => Promise<string>;
  changeUserPassword: (payload: {
    current_password?: string;
    password: string;
    password_confirmation: string;
  }) => Promise<string>;
  refreshUser: () => Promise<void>;
  logoutUser: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<UserProfile | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [isReady, setIsReady] = useState(false);

  const persistSession = useCallback(async (newToken: string, newUser: UserProfile) => {
    setApiAuthToken(newToken);
    setToken(newToken);
    setUser(newUser);
    await AsyncStorage.multiSet([
      [TOKEN_STORAGE_KEY, newToken],
      [USER_STORAGE_KEY, JSON.stringify(newUser)],
    ]);
  }, []);

  const clearSession = useCallback(async () => {
    setApiAuthToken(null);
    setToken(null);
    setUser(null);
    await AsyncStorage.multiRemove([TOKEN_STORAGE_KEY, USER_STORAGE_KEY]);
  }, []);

  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        const entries = await AsyncStorage.multiGet([TOKEN_STORAGE_KEY, USER_STORAGE_KEY]);
        const savedToken = entries[0]?.[1] || null;
        const savedUserRaw = entries[1]?.[1] || null;

        if (savedToken) {
          setApiAuthToken(savedToken);
          if (mounted) setToken(savedToken);
          if (savedUserRaw && mounted) {
            try {
              setUser(JSON.parse(savedUserRaw));
            } catch {
              // Abaikan JSON rusak
            }
          }
          try {
            const freshUser = await getMeApi();
            if (mounted) {
              setUser(freshUser);
              await AsyncStorage.setItem(USER_STORAGE_KEY, JSON.stringify(freshUser));
            }
          } catch (err: any) {
            if (err?.response?.status === 401 && mounted) {
              await clearSession();
            }
          }
        }
      } finally {
        if (mounted) setIsReady(true);
      }
    })();

    return () => {
      mounted = false;
    };
  }, [clearSession]);

  const loginWithCredentials = async (identifier: string, password: string) => {
    const res = await loginApi({ identifier, password });
    await persistSession(res.token, res.user);
  };

  const sendRegisterOtp = async (payload: {
    name: string;
    email: string;
    phone?: string;
    password: string;
  }) => {
    const res = await sendRegisterOtpApi(payload);
    return { message: res.message, dev_otp: res.dev_otp ?? null };
  };

  const verifyRegisterOtp = async (email: string, otp: string) => {
    const res = await verifyRegisterOtpApi({ email, otp });
    await persistSession(res.token, res.user);
  };

  const loginWithGoogleToken = async (tokens: { access_token?: string; id_token?: string }) => {
    const res = await googleLoginApi(tokens);
    await persistSession(res.token, res.user);
  };

  const updateProfileData = async (name: string, phone?: string) => {
    const res = await updateProfileApi({ name, phone });
    setUser(res.user);
    await AsyncStorage.setItem(USER_STORAGE_KEY, JSON.stringify(res.user));
    return res.message;
  };

  const uploadAvatarImage = async (uri: string) => {
    const res = await uploadAvatarApi(uri);
    setUser(res.user);
    await AsyncStorage.setItem(USER_STORAGE_KEY, JSON.stringify(res.user));
    return res.message;
  };

  const changeUserPassword = async (payload: {
    current_password?: string;
    password: string;
    password_confirmation: string;
  }) => {
    const res = await updatePasswordApi(payload);
    if (user && !user.has_password) {
      const updated = { ...user, has_password: true };
      setUser(updated);
      await AsyncStorage.setItem(USER_STORAGE_KEY, JSON.stringify(updated));
    }
    return res.message;
  };

  const refreshUser = useCallback(async () => {
    if (!token) return;
    try {
      const fresh = await getMeApi();
      setUser(fresh);
      await AsyncStorage.setItem(USER_STORAGE_KEY, JSON.stringify(fresh));
    } catch {
      // Abaikan jika offline sementara
    }
  }, [token]);

  const logoutUser = async () => {
    try {
      await logoutApi();
    } catch {
      // Tetap hapus sesi lokal meski offline
    }
    await clearSession();
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        token,
        isReady,
        loginWithCredentials,
        sendRegisterOtp,
        verifyRegisterOtp,
        loginWithGoogleToken,
        updateProfileData,
        uploadAvatarImage,
        changeUserPassword,
        refreshUser,
        logoutUser,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) {
    throw new Error('useAuth must be used inside AuthProvider');
  }
  return ctx;
}