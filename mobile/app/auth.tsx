import React, { useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Animated,
  Easing,
  Image,
  Keyboard,
  Platform,
  Pressable,
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import BotanicalBackdrop from '../components/BotanicalBackdrop';
import GlassView from '../components/GlassView';
import { useKeyboardAwareScroll } from '../components/useKeyboardAwareScroll';
import { useAuth } from '../contexts/AuthContext';
import { C, R, SCREEN_TOP_PAD } from '../constants/herbalTheme';
import {
  useAutoFillOtpFromGmail,
  openGmailApp,
  savePendingOtpEmail,
  getPendingOtpEmail,
  clearPendingOtpEmail,
} from '../services/otpHelper';

let WebBrowser: any = null;
let GoogleAuth: any = null;
try {
  WebBrowser = require('expo-web-browser');
  WebBrowser?.maybeCompleteAuthSession?.();
  GoogleAuth = require('expo-auth-session/providers/google');
} catch {
  WebBrowser = null;
  GoogleAuth = null;
}

type AuthMode = 'login' | 'register';
type IonName = keyof typeof Ionicons.glyphMap;

const HERBAL_LOGO = require('../assets/herbal_icon.png');

/** Muncul dengan fade + naik halus (animasi masuk). */
function FadeSlide({
  delay = 0,
  style,
  children,
}: {
  delay?: number;
  style?: any;
  children: React.ReactNode;
}) {
  const v = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    Animated.timing(v, {
      toValue: 1,
      duration: 520,
      delay,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: true,
    }).start();
  }, [v, delay]);
  return (
    <Animated.View
      style={[
        style,
        { opacity: v, transform: [{ translateY: v.interpolate({ inputRange: [0, 1], outputRange: [24, 0] }) }] },
      ]}
    >
      {children}
    </Animated.View>
  );
}

interface AuthFieldProps {
  label: string;
  icon: IonName;
  value: string;
  onChangeText: (t: string) => void;
  placeholder: string;
  secure?: boolean;
  show?: boolean;
  onToggleShow?: () => void;
  onFocusExtra?: () => void;
  keyboardType?: any;
  autoCapitalize?: 'none' | 'sentences' | 'words' | 'characters';
}

/**
 * Input dengan ring fokus. Untuk kata sandi: ikon mata langsung bekerja walau keyboard
 * tertutup (input dibuat ulang via `key` agar Android langsung menampilkan / menyembunyikan teks).
 */
function AuthField({
  label,
  icon,
  value,
  onChangeText,
  placeholder,
  secure,
  show,
  onToggleShow,
  onFocusExtra,
  keyboardType,
  autoCapitalize,
}: AuthFieldProps) {
  const ref = useRef<TextInput>(null);
  const [focused, setFocused] = useState(false);
  const [bump, setBump] = useState(0);

  // Tidak pernah memfokuskan input / membuka keyboard.
  // Keyboard tertutup -> input dibuat ulang (Android langsung menampilkan teks).
  // Keyboard terbuka   -> cukup ganti properti (input sedang fokus, jadi langsung berlaku).
  const toggle = () => {
    if (!Keyboard.isVisible()) setBump((b) => b + 1);
    onToggleShow?.();
  };

  return (
    <View>
      <Text style={styles.inputLabel}>{label}</Text>
      <View style={[styles.inputBox, focused && styles.inputBoxFocused]}>
        <Ionicons name={icon} size={18} color={focused ? C.leaf : C.leafSoft} />
        <TextInput
          key={secure ? `pw-${bump}` : 'plain'}
          ref={ref}
          value={value}
          onChangeText={onChangeText}
          placeholder={placeholder}
          placeholderTextColor={C.textFaint}
          secureTextEntry={Boolean(secure) && !show}
          autoCapitalize={autoCapitalize ?? 'none'}
          autoCorrect={false}
          keyboardType={keyboardType}
          onFocus={() => {
            setFocused(true);
            onFocusExtra?.();
          }}
          onBlur={() => setFocused(false)}
          style={styles.textInput}
        />
        {secure ? (
          <Pressable
            onPress={toggle}
            hitSlop={16}
            style={styles.eyeBtn}
            accessibilityRole="button"
            accessibilityLabel={show ? 'Sembunyikan kata sandi' : 'Tampilkan kata sandi'}
          >
            <Ionicons name={show ? 'eye-off-outline' : 'eye-outline'} size={21} color={show ? C.leaf : C.textSoft} />
          </Pressable>
        ) : null}
      </View>
    </View>
  );
}

export default function AuthScreen() {
  const router = useRouter();
  const didRedirectHome = useRef(false);
  const goToTabsOnce = () => {
    if (didRedirectHome.current) return;
    didRedirectHome.current = true;
    if (typeof (router as any).dismissAll === "function" && router.canGoBack()) {
      (router as any).dismissAll();
    }
    goToTabsOnce();
  };
  const params = useLocalSearchParams<{ mode?: string }>();
  const {
    loginWithCredentials,
    sendRegisterOtp,
    verifyRegisterOtp,
    loginWithGoogleToken,
  } = useAuth();

  const [mode, setMode] = useState<AuthMode>(
    params.mode === 'register' ? 'register' : 'login'
  );

  // State Login
  const [identifier, setIdentifier] = useState('');
  const [loginPassword, setLoginPassword] = useState('');
  const [showLoginPw, setShowLoginPw] = useState(false);

  // State Register + OTP Gmail
  const [regStep, setRegStep] = useState<'form' | 'otp'>('form');
  const [regName, setRegName] = useState('');
  const [regEmail, setRegEmail] = useState('');
  const [regPhone, setRegPhone] = useState('');
  const [regPassword, setRegPassword] = useState('');
  const [showRegPw, setShowRegPw] = useState(false);
  const [otpCode, setOtpCode] = useState('');
  const [resendCooldown, setResendCooldown] = useState(0);
  const [devOtpHint, setDevOtpHint] = useState<string | null>(null);

  const [submitting, setSubmitting] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);
  const kb = useKeyboardAwareScroll();
  useEffect(() => {
    getPendingOtpEmail().then((savedEmail) => {
      if (savedEmail) {
        setMode('register');
        setRegEmail(savedEmail);
        setRegStep('otp');
      }
    });
  }, []);

  const submitOtpCode = async (rawOtp: string) => {
    const cleanOtp = rawOtp.trim();
    if (cleanOtp.length !== 6 || submitting) return;

    setErrorMsg(null);
    setSubmitting(true);
    try {
      await verifyRegisterOtp(regEmail.trim().toLowerCase(), cleanOtp);
      await clearPendingOtpEmail();
      goToTabsOnce();
    } catch (err: any) {
      setErrorMsg(extractApiError(err, 'Kode OTP tidak valid atau sudah kedaluwarsa.'));
    } finally {
      setSubmitting(false);
    }
  };

  useAutoFillOtpFromGmail((detectedCode) => {
    if (regStep === 'otp') {
      setOtpCode(detectedCode);
      submitOtpCode(detectedCode);
    }
  });
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [infoMsg, setInfoMsg] = useState<string | null>(null);

  const googleClientId =
    process.env.EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID ||
    process.env.EXPO_PUBLIC_GOOGLE_EXPO_CLIENT_ID ||
    "";
  const googleAndroidClientId =
    process.env.EXPO_PUBLIC_GOOGLE_ANDROID_CLIENT_ID || "";

  const androidRedirectUri = googleAndroidClientId
    ? `com.googleusercontent.apps.${googleAndroidClientId.replace(".apps.googleusercontent.com", "")}:/oauth2redirect/google`
    : undefined;

  const expoUsername = process.env.EXPO_PUBLIC_EXPO_USERNAME || "";
  const webRedirectUri = expoUsername
    ? `https://auth.expo.io/@${expoUsername}/mobile`
    : undefined;

  const activeRedirectUri =
    Platform.OS === "android" ? androidRedirectUri : webRedirectUri;

  const [googleRequest, googleResponse, promptGoogleAsync] = GoogleAuth?.useAuthRequest
    ? GoogleAuth.useAuthRequest({
        androidClientId: googleAndroidClientId || undefined,
        webClientId: googleClientId || undefined,
        ...(Platform.OS === "web" && googleClientId ? { clientId: googleClientId } : {}),
        ...(activeRedirectUri ? { redirectUri: activeRedirectUri } : {}),
      })
    : [null, null, null];

  useEffect(() => {
    if (resendCooldown <= 0) return;
    const t = setInterval(() => {
      setResendCooldown((prev) => (prev > 0 ? prev - 1 : 0));
    }, 1000);
    return () => clearInterval(t);
  }, [resendCooldown]);

  useEffect(() => {
    if (googleResponse?.type === 'success') {
      const accessToken = googleResponse.authentication?.accessToken;
      const idToken = googleResponse.authentication?.idToken || googleResponse.params?.id_token;
      if (accessToken || idToken) {
        (async () => {
          setGoogleLoading(true);
          setErrorMsg(null);
          try {
            await loginWithGoogleToken({
              access_token: accessToken,
              id_token: idToken,
            });
            goToTabsOnce();
          } catch (err: any) {
            setErrorMsg(
              err?.response?.data?.message || 'Gagal memverifikasi akun Google ke server.'
            );
          } finally {
            setGoogleLoading(false);
          }
        })();
      }
    }
  }, [googleResponse, loginWithGoogleToken, router]);

  const extractApiError = (err: any, fallback: string) => {
    const errors = err?.response?.data?.errors;
    if (errors && typeof errors === 'object') {
      const firstKey = Object.keys(errors)[0];
      if (firstKey && Array.isArray(errors[firstKey]) && errors[firstKey][0]) {
        return errors[firstKey][0];
      }
    }
    return err?.response?.data?.message || fallback;
  };

  const handleLoginSubmit = async () => {
    setErrorMsg(null);
    setInfoMsg(null);

    if (!identifier.trim()) {
      setErrorMsg('Masukkan alamat Gmail atau nomor HP Anda.');
      return;
    }
    if (loginPassword.length < 8) {
      setErrorMsg('Kata sandi minimal 8 karakter.');
      return;
    }

    setSubmitting(true);
    try {
      await loginWithCredentials(identifier.trim(), loginPassword);
      goToTabsOnce();
    } catch (err: any) {
      setErrorMsg(extractApiError(err, 'Gagal masuk. Periksa Gmail / No. HP dan kata sandi.'));
    } finally {
      setSubmitting(false);
    }
  };

  const handleGooglePress = async () => {
    setErrorMsg(null);
    setInfoMsg(null);

    if (!googleClientId || !promptGoogleAsync) {
      setErrorMsg(
        'Client ID Google OAuth belum diatur di file mobile/.env (EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID).'
      );
      return;
    }

    try {
      await promptGoogleAsync();
    } catch {
      setErrorMsg('Gagal membuka jendela login Google.');
    }
  };

  const handleSendOtp = async () => {
    setErrorMsg(null);
    setInfoMsg(null);
    setDevOtpHint(null);

    const cleanEmail = regEmail.trim().toLowerCase();
    if (regName.trim().length < 2) {
      setErrorMsg('Nama lengkap minimal 2 karakter.');
      return;
    }
    if (!/^[a-zA-Z0-9._%+-]+@gmail\.com$/i.test(cleanEmail)) {
      setErrorMsg('Wajib memasukkan alamat Gmail aktif (@gmail.com) untuk menerima kode OTP.');
      return;
    }
    if (regPassword.length < 8) {
      setErrorMsg('Kata sandi minimal 8 karakter.');
      return;
    }

    setSubmitting(true);
    try {
      const res = await sendRegisterOtp({
        name: regName.trim(),
        email: cleanEmail,
        phone: regPhone.trim() || undefined,
        password: regPassword,
      });
      setRegStep('otp');
      await savePendingOtpEmail(cleanEmail);
      setResendCooldown(60);
      setInfoMsg(res.message);
      if (res.dev_otp) {
        setDevOtpHint(res.dev_otp);
      }
    } catch (err: any) {
      setErrorMsg(extractApiError(err, 'Gagal mengirim kode OTP ke Gmail.'));
    } finally {
      setSubmitting(false);
    }
  };

  const handleVerifyOtp = async () => {
    if (otpCode.trim().length !== 6) {
      setErrorMsg('Masukkan 6 digit kode OTP dari Gmail Anda.');
      return;
    }
    await submitOtpCode(otpCode);
  };

  // Indikator kaca Masuk / Daftar yang meluncur
  const [switchW, setSwitchW] = useState(0);
  const switchAnim = useRef(new Animated.Value(mode === 'login' ? 0 : 1)).current;
  useEffect(() => {
    Animated.spring(switchAnim, {
      toValue: mode === 'login' ? 0 : 1,
      damping: 16,
      stiffness: 190,
      useNativeDriver: true,
    }).start();
  }, [mode, switchAnim]);

  // Kartu bergetar halus saat ada error
  const shakeX = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    if (!errorMsg) return;
    Animated.sequence([
      Animated.timing(shakeX, { toValue: 9, duration: 60, useNativeDriver: true }),
      Animated.timing(shakeX, { toValue: -9, duration: 80, useNativeDriver: true }),
      Animated.timing(shakeX, { toValue: 6, duration: 70, useNativeDriver: true }),
      Animated.timing(shakeX, { toValue: 0, duration: 60, useNativeDriver: true }),
    ]).start();
  }, [errorMsg, shakeX]);

  const isPhoneInput = identifier.trim().length > 0 && !identifier.includes('@');

  return (
    <View style={styles.screen}>
      <StatusBar barStyle="light-content" translucent backgroundColor="transparent" />
      <BotanicalBackdrop />

      <ScrollView
        {...kb.scrollProps}
        contentContainerStyle={[styles.scrollContent, { paddingBottom: kb.keyboardHeight + 40 }]}
      >
        {/* Logo + tombol tutup */}
        <View style={styles.topRow}>
          <Image source={HERBAL_LOGO} resizeMode="contain" style={styles.logoImg} />

          <TouchableOpacity activeOpacity={0.85} onPress={() => router.back()}>
            <GlassView radius={22} intensity={55} style={styles.closeBtn} contentStyle={styles.closeBtnInner}>
              <Ionicons name="close" size={21} color={C.white} />
            </GlassView>
          </TouchableOpacity>
        </View>

        {/* Judul */}
        <FadeSlide style={styles.headerBlock}>
          <View style={styles.badgePill}>
            <Ionicons name="shield-checkmark" size={13} color={C.leaf} />
            <Text style={styles.badgeText}>AKUN HERBALSCAN</Text>
          </View>
          <Text style={styles.title}>
            {mode === 'login' ? (
              <>
                Selamat{'\n'}
                <Text style={styles.titleBold}>Datang Kembali</Text>
              </>
            ) : (
              <>
                Buat Akun{'\n'}
                <Text style={styles.titleBold}>Botani Baru</Text>
              </>
            )}
          </Text>
          <Text style={styles.subtitle}>
            {mode === 'login'
              ? 'Masuk untuk menyimpan riwayat pemindaian tanaman dan menyinkronkan profil Anda.'
              : 'Daftar menggunakan Gmail aktif untuk verifikasi OTP dan penyimpanan arsip pindai.'}
          </Text>
        </FadeSlide>

        {/* Switcher Masuk / Daftar */}
        <FadeSlide delay={90}>
          <GlassView radius={R.pill} intensity={45} style={styles.switchWrap} contentStyle={styles.switchInner}>
            <View style={styles.switchRow} onLayout={(e) => setSwitchW(e.nativeEvent.layout.width)}>
              {switchW > 0 && (
                <Animated.View
                  style={[
                    styles.switchIndicator,
                    {
                      width: switchW / 2,
                      transform: [
                        {
                          translateX: switchAnim.interpolate({
                            inputRange: [0, 1],
                            outputRange: [0, switchW / 2],
                          }),
                        },
                      ],
                    },
                  ]}
                />
              )}

              <TouchableOpacity
                activeOpacity={0.85}
                style={styles.switchTab}
                onPress={() => {
                  setMode('login');
                  setErrorMsg(null);
                  setInfoMsg(null);
                }}
              >
                <Text style={[styles.switchText, mode === 'login' && styles.switchTextActive]}>Masuk</Text>
              </TouchableOpacity>

              <TouchableOpacity
                activeOpacity={0.85}
                style={styles.switchTab}
                onPress={() => {
                  setMode('register');
                  setRegStep('form');
                  setErrorMsg(null);
                  setInfoMsg(null);
                }}
              >
                <Text style={[styles.switchText, mode === 'register' && styles.switchTextActive]}>
                  Daftar Akun
                </Text>
              </TouchableOpacity>
            </View>
          </GlassView>
        </FadeSlide>

        {/* Notifikasi */}
        {errorMsg ? (
          <GlassView
            radius={20}
            intensity={45}
            fill="rgba(239, 68, 68, 0.22)"
            style={styles.noticeCard}
            contentStyle={styles.noticeInner}
          >
            <Ionicons name="alert-circle" size={19} color="#fca5a5" />
            <Text style={styles.errorText}>{errorMsg}</Text>
          </GlassView>
        ) : null}

        {infoMsg ? (
          <GlassView
            radius={20}
            intensity={45}
            fill="rgba(74, 222, 128, 0.18)"
            style={styles.noticeCard}
            contentStyle={styles.noticeInner}
          >
            <Ionicons name="mail-open-outline" size={19} color={C.leaf} />
            <View style={{ flex: 1 }}>
              <Text style={styles.infoText}>{infoMsg}</Text>
              {devOtpHint ? <Text style={styles.devOtpText}>Kode OTP Uji Lokal: {devOtpHint}</Text> : null}
            </View>
          </GlassView>
        ) : null}

        {/* Kartu form (animasi masuk ulang tiap ganti mode / langkah) */}
        <FadeSlide key={`${mode}-${regStep}`} delay={160}>
          <Animated.View style={{ transform: [{ translateX: shakeX }] }}>
            {mode === 'login' ? (
              /* FORM LOGIN */
              <GlassView radius={30} intensity={50} style={styles.formCard} contentStyle={styles.formInner}>
                <AuthField
                  label="Gmail atau Nomor HP"
                  icon={isPhoneInput ? 'call-outline' : 'mail-outline'}
                  value={identifier}
                  onChangeText={setIdentifier}
                  placeholder="nama@gmail.com atau 0812xxxx"
                  keyboardType="email-address"
                  onFocusExtra={kb.onInputFocus}
                />

                <AuthField
                  label="Kata Sandi"
                  icon="lock-closed-outline"
                  value={loginPassword}
                  onChangeText={setLoginPassword}
                  placeholder="Minimal 8 karakter"
                  secure
                  show={showLoginPw}
                  onToggleShow={() => setShowLoginPw((p) => !p)}
                  onFocusExtra={kb.onInputFocus}
                />

                <TouchableOpacity
                  activeOpacity={0.88}
                  disabled={submitting}
                  style={[styles.primaryBtn, submitting && { opacity: 0.7 }]}
                  onPress={handleLoginSubmit}
                >
                  {submitting ? (
                    <ActivityIndicator size="small" color={C.ink} />
                  ) : (
                    <>
                      <Ionicons name="log-in-outline" size={20} color={C.ink} />
                      <Text style={styles.primaryBtnText}>Masuk Sekarang</Text>
                    </>
                  )}
                </TouchableOpacity>

                <View style={styles.dividerRow}>
                  <View style={styles.dividerLine} />
                  <Text style={styles.dividerLabel}>atau lanjutkan dengan</Text>
                  <View style={styles.dividerLine} />
                </View>

                <TouchableOpacity
                  activeOpacity={0.86}
                  disabled={googleLoading || (Boolean(googleClientId) && !googleRequest)}
                  style={styles.googleBtn}
                  onPress={handleGooglePress}
                >
                  {googleLoading ? (
                    <ActivityIndicator size="small" color={C.white} />
                  ) : (
                    <>
                      <Ionicons name="logo-google" size={18} color="#fde047" />
                      <Text style={styles.googleBtnText}>Masuk dengan Gmail (Google)</Text>
                    </>
                  )}
                </TouchableOpacity>
              </GlassView>
            ) : regStep === 'form' ? (
              /* FORM REGISTER LANGKAH 1 */
              <GlassView radius={30} intensity={50} style={styles.formCard} contentStyle={styles.formInner}>
                <AuthField
                  label="Nama Lengkap"
                  icon="person-outline"
                  value={regName}
                  onChangeText={setRegName}
                  placeholder="Contoh: Fahmi Pratama"
                  autoCapitalize="words"
                  onFocusExtra={kb.onInputFocus}
                />
                <AuthField
                  label="Alamat Gmail (Wajib untuk OTP)"
                  icon="mail-outline"
                  value={regEmail}
                  onChangeText={setRegEmail}
                  placeholder="akunanda@gmail.com"
                  keyboardType="email-address"
                  onFocusExtra={kb.onInputFocus}
                />
                <AuthField
                  label="Nomor HP (Untuk Login Alternatif)"
                  icon="call-outline"
                  value={regPhone}
                  onChangeText={setRegPhone}
                  placeholder="0812xxxxxxxx"
                  keyboardType="phone-pad"
                  onFocusExtra={kb.onInputFocus}
                />
                <AuthField
                  label="Kata Sandi"
                  icon="lock-closed-outline"
                  value={regPassword}
                  onChangeText={setRegPassword}
                  placeholder="Minimal 8 karakter"
                  secure
                  show={showRegPw}
                  onToggleShow={() => setShowRegPw((p) => !p)}
                  onFocusExtra={kb.onInputFocus}
                />

                <TouchableOpacity
                  activeOpacity={0.88}
                  disabled={submitting}
                  style={[styles.primaryBtn, submitting && { opacity: 0.7 }]}
                  onPress={handleSendOtp}
                >
                  {submitting ? (
                    <ActivityIndicator size="small" color={C.ink} />
                  ) : (
                    <>
                      <Ionicons name="paper-plane-outline" size={19} color={C.ink} />
                      <Text style={styles.primaryBtnText}>Kirim Kode OTP ke Gmail</Text>
                    </>
                  )}
                </TouchableOpacity>
              </GlassView>
            ) : (
              /* FORM REGISTER LANGKAH 2: VERIFIKASI OTP */
              <GlassView radius={30} intensity={50} style={styles.formCard} contentStyle={styles.formInner}>
                <View style={styles.otpHeaderBox}>
                  <View style={styles.otpIconBadge}>
                    <Ionicons name="mail-unread-outline" size={26} color={C.leaf} />
                  </View>
                  <Text style={styles.otpTitle}>Verifikasi Kode OTP Gmail</Text>
                  <Text style={styles.otpSub}>
                    Masukkan 6 digit kode verifikasi yang dikirim ke{' '}
                    <Text style={{ color: C.white, fontWeight: '800' }}>{regEmail.trim().toLowerCase()}</Text>
                  </Text>
                </View>

                <View style={styles.otpInputBox}>
                  <TextInput
                    value={otpCode}
                    onFocus={kb.onInputFocus}
                    onChangeText={(txt) => {
                      const clean = txt.replace(/\D+/g, '').slice(0, 6);
                      setOtpCode(clean);
                      if (clean.length === 6) {
                        submitOtpCode(clean);
                      }
                    }}
                    placeholder="000000"
                    placeholderTextColor={C.textFaint}
                    keyboardType="number-pad"
                    maxLength={6}
                    autoComplete="one-time-code"
                    textContentType="oneTimeCode"
                    style={styles.otpTextInput}
                  />
                </View>

                <TouchableOpacity
                  activeOpacity={0.88}
                  disabled={submitting}
                  style={[styles.primaryBtn, submitting && { opacity: 0.7 }]}
                  onPress={handleVerifyOtp}
                >
                  {submitting ? (
                    <ActivityIndicator size="small" color={C.ink} />
                  ) : (
                    <>
                      <Ionicons name="checkmark-circle-outline" size={20} color={C.ink} />
                      <Text style={styles.primaryBtnText}>Verifikasi & Aktifkan Akun</Text>
                    </>
                  )}
                </TouchableOpacity>

                <View style={styles.otpFooterActions}>
                  <TouchableOpacity
                    onPress={() => {
                      setRegStep('form');
                      setErrorMsg(null);
                      setInfoMsg(null);
                    }}
                  >
                    <Text style={styles.linkMuted}>Ubah Data / Gmail</Text>
                  </TouchableOpacity>

                  <TouchableOpacity disabled={resendCooldown > 0 || submitting} onPress={handleSendOtp}>
                    <Text style={[styles.linkHighlight, resendCooldown > 0 && { color: C.textFaint }]}>
                      {resendCooldown > 0 ? `Kirim Ulang (${resendCooldown}d)` : 'Kirim Ulang OTP'}
                    </Text>
                  </TouchableOpacity>
                </View>
              </GlassView>
            )}
          </Animated.View>
        </FadeSlide>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: C.bgSoft },
  scrollContent: { paddingTop: SCREEN_TOP_PAD - 4, paddingHorizontal: 20 },

  topRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 14,
  },
  logoImg: { width: 80, height: 80 },
  closeBtn: { width: 44, height: 44 },
  closeBtnInner: { flex: 1, alignItems: 'center', justifyContent: 'center' },

  headerBlock: { marginBottom: 18 },
  badgePill: {
    alignSelf: 'flex-start',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: 'rgba(74, 222, 128, 0.16)',
    borderWidth: 1,
    borderColor: 'rgba(134, 239, 172, 0.34)',
    paddingHorizontal: 12,
    paddingVertical: 5,
    borderRadius: R.pill,
    marginBottom: 12,
  },
  badgeText: { color: C.leafSoft, fontSize: 10.5, fontWeight: '800', letterSpacing: 0.7 },
  title: { fontSize: 32, fontWeight: '300', color: C.white, lineHeight: 39, letterSpacing: -0.5 },
  titleBold: { fontWeight: '800' },
  subtitle: { marginTop: 8, fontSize: 13, color: C.textSoft, lineHeight: 19 },

  switchWrap: { marginBottom: 16 },
  switchInner: { padding: 5 },
  switchRow: { flexDirection: 'row', alignItems: 'center' },
  switchIndicator: {
    position: 'absolute',
    left: 0,
    top: 0,
    bottom: 0,
    borderRadius: R.pill,
    backgroundColor: C.white,
  },
  switchTab: { flex: 1, paddingVertical: 12, alignItems: 'center', justifyContent: 'center' },
  switchText: { color: C.mint, fontSize: 13.5, fontWeight: '700' },
  switchTextActive: { color: C.ink, fontWeight: '800' },

  noticeCard: { marginBottom: 12 },
  noticeInner: { flexDirection: 'row', alignItems: 'center', gap: 10, padding: 14 },
  errorText: { flex: 1, color: '#fee2e2', fontSize: 12.5, fontWeight: '600', lineHeight: 18 },
  infoText: { color: '#dcfce7', fontSize: 12.5, fontWeight: '600', lineHeight: 18 },
  devOtpText: { color: C.amber, fontSize: 12, fontWeight: '800', marginTop: 4 },

  formCard: {},
  formInner: { padding: 20 },
  inputLabel: { color: C.mint, fontSize: 12.5, fontWeight: '700', marginBottom: 8, marginTop: 4 },
  inputBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    height: 54,
    paddingHorizontal: 16,
    borderRadius: 18,
    backgroundColor: 'rgba(255, 255, 255, 0.08)',
    borderWidth: 1.5,
    borderColor: 'rgba(255, 255, 255, 0.14)',
    marginBottom: 12,
  },
  inputBoxFocused: {
    borderColor: C.leaf,
    backgroundColor: 'rgba(74, 222, 128, 0.1)',
  },
  textInput: { flex: 1, color: C.white, fontSize: 14.5, paddingVertical: 0 },
  eyeBtn: { width: 34, height: 34, alignItems: 'center', justifyContent: 'center', marginRight: -6 },

  primaryBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: C.white,
    paddingVertical: 16,
    borderRadius: R.pill,
    marginTop: 10,
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.28,
    shadowRadius: 14,
    elevation: 8,
  },
  primaryBtnText: { color: C.ink, fontSize: 15, fontWeight: '800' },

  dividerRow: { flexDirection: 'row', alignItems: 'center', gap: 10, marginVertical: 18 },
  dividerLine: { flex: 1, height: 1, backgroundColor: 'rgba(255, 255, 255, 0.16)' },
  dividerLabel: { color: C.textFaint, fontSize: 11.5, fontWeight: '600' },
  googleBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    paddingVertical: 15,
    borderRadius: R.pill,
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.24)',
  },
  googleBtnText: { color: C.white, fontSize: 14, fontWeight: '700' },

  otpHeaderBox: { alignItems: 'center', marginBottom: 18 },
  otpIconBadge: {
    width: 62,
    height: 62,
    borderRadius: 31,
    backgroundColor: 'rgba(74, 222, 128, 0.16)',
    borderWidth: 1,
    borderColor: 'rgba(134, 239, 172, 0.36)',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 12,
  },
  otpTitle: { color: C.white, fontSize: 17, fontWeight: '800' },
  otpSub: { color: C.textSoft, fontSize: 12.5, textAlign: 'center', lineHeight: 19, marginTop: 6 },
  otpInputBox: {
    borderRadius: 20,
    backgroundColor: 'rgba(255, 255, 255, 0.08)',
    borderWidth: 1.5,
    borderColor: 'rgba(74, 222, 128, 0.45)',
    paddingVertical: 6,
    marginBottom: 6,
  },
  otpTextInput: {
    textAlign: 'center',
    color: C.white,
    fontSize: 30,
    fontWeight: '800',
    letterSpacing: 10,
    paddingVertical: 10,
  },
  otpFooterActions: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 18,
  },
  linkMuted: { color: C.textSoft, fontSize: 12.5, fontWeight: '600' },
  linkHighlight: { color: C.leaf, fontSize: 12.5, fontWeight: '800' },
});
