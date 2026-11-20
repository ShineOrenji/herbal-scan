import React, { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
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

export default function AuthScreen() {
  const router = useRouter();
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
      router.back();
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
            router.replace("/(tabs)");
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
      router.back();
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

  const isPhoneInput = identifier.trim().length > 0 && !identifier.includes('@');

  return (
    <View style={styles.screen}>
      <StatusBar barStyle="light-content" translucent backgroundColor="transparent" />
      <BotanicalBackdrop />

      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <ScrollView
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
          contentContainerStyle={styles.scrollContent}
        >
          {/* Tombol Tutup */}
          <View style={styles.topRow}>
            <TouchableOpacity activeOpacity={0.85} onPress={() => router.back()}>
              <GlassView
                radius={22}
                intensity={55}
                style={styles.closeBtn}
                contentStyle={styles.closeBtnInner}
              >
                <Ionicons name="close" size={21} color={C.white} />
              </GlassView>
            </TouchableOpacity>
          </View>

          {/* Header Hero */}
          <View style={styles.headerBlock}>
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
          </View>

          {/* Switcher Masuk / Daftar */}
          <GlassView
            radius={R.pill}
            intensity={45}
            style={styles.switchWrap}
            contentStyle={styles.switchInner}
          >
            <TouchableOpacity
              activeOpacity={0.85}
              style={[styles.switchTab, mode === 'login' && styles.switchTabActive]}
              onPress={() => {
                setMode('login');
                setErrorMsg(null);
                setInfoMsg(null);
              }}
            >
              <Text style={[styles.switchText, mode === 'login' && styles.switchTextActive]}>
                Masuk
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              activeOpacity={0.85}
              style={[styles.switchTab, mode === 'register' && styles.switchTabActive]}
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
          </GlassView>

          {/* Notifikasi Error / Info */}
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
                {devOtpHint ? (
                  <Text style={styles.devOtpText}>Kode OTP Uji Lokal: {devOtpHint}</Text>
                ) : null}
              </View>
            </GlassView>
          ) : null}

          {/* FORM LOGIN */}
          {mode === 'login' ? (
            <GlassView
              radius={30}
              intensity={50}
              style={styles.formCard}
              contentStyle={styles.formInner}
            >
              <Text style={styles.inputLabel}>Gmail atau Nomor HP</Text>
              <View style={styles.inputBox}>
                <Ionicons
                  name={isPhoneInput ? 'call-outline' : 'mail-outline'}
                  size={18}
                  color={C.leafSoft}
                />
                <TextInput
                  value={identifier}
                  onChangeText={setIdentifier}
                  placeholder="nama@gmail.com atau 0812xxxx"
                  placeholderTextColor={C.textFaint}
                  autoCapitalize="none"
                  keyboardType="email-address"
                  style={styles.textInput}
                />
              </View>

              <Text style={styles.inputLabel}>Kata Sandi</Text>
              <View style={styles.inputBox}>
                <Ionicons name="lock-closed-outline" size={18} color={C.leafSoft} />
                <TextInput
                  value={loginPassword}
                  onChangeText={setLoginPassword}
                  placeholder="Minimal 8 karakter"
                  placeholderTextColor={C.textFaint}
                  secureTextEntry={!showLoginPw}
                  autoCapitalize="none"
                  style={styles.textInput}
                />
                <TouchableOpacity
                  onPress={() => setShowLoginPw((p) => !p)}
                  hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                >
                  <Ionicons
                    name={showLoginPw ? 'eye-off-outline' : 'eye-outline'}
                    size={20}
                    color={C.textSoft}
                  />
                </TouchableOpacity>
              </View>

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
            <GlassView
              radius={30}
              intensity={50}
              style={styles.formCard}
              contentStyle={styles.formInner}
            >
              <Text style={styles.inputLabel}>Nama Lengkap</Text>
              <View style={styles.inputBox}>
                <Ionicons name="person-outline" size={18} color={C.leafSoft} />
                <TextInput
                  value={regName}
                  onChangeText={setRegName}
                  placeholder="Contoh: Fahmi Pratama"
                  placeholderTextColor={C.textFaint}
                  style={styles.textInput}
                />
              </View>

              <Text style={styles.inputLabel}>Alamat Gmail (Wajib untuk OTP)</Text>
              <View style={styles.inputBox}>
                <Ionicons name="mail-outline" size={18} color={C.leafSoft} />
                <TextInput
                  value={regEmail}
                  onChangeText={setRegEmail}
                  placeholder="akunanda@gmail.com"
                  placeholderTextColor={C.textFaint}
                  autoCapitalize="none"
                  keyboardType="email-address"
                  style={styles.textInput}
                />
              </View>

              <Text style={styles.inputLabel}>Nomor HP (Untuk Login Alternatif)</Text>
              <View style={styles.inputBox}>
                <Ionicons name="call-outline" size={18} color={C.leafSoft} />
                <TextInput
                  value={regPhone}
                  onChangeText={setRegPhone}
                  placeholder="0812xxxxxxxx"
                  placeholderTextColor={C.textFaint}
                  keyboardType="phone-pad"
                  style={styles.textInput}
                />
              </View>

              <Text style={styles.inputLabel}>Kata Sandi</Text>
              <View style={styles.inputBox}>
                <Ionicons name="lock-closed-outline" size={18} color={C.leafSoft} />
                <TextInput
                  value={regPassword}
                  onChangeText={setRegPassword}
                  placeholder="Minimal 8 karakter"
                  placeholderTextColor={C.textFaint}
                  secureTextEntry={!showRegPw}
                  autoCapitalize="none"
                  style={styles.textInput}
                />
                <TouchableOpacity
                  onPress={() => setShowRegPw((p) => !p)}
                  hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                >
                  <Ionicons
                    name={showRegPw ? 'eye-off-outline' : 'eye-outline'}
                    size={20}
                    color={C.textSoft}
                  />
                </TouchableOpacity>
              </View>

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
            /* FORM REGISTER LANGKAH 2: VERIFIKASI OTP GMAIL */
            <GlassView
              radius={30}
              intensity={50}
              style={styles.formCard}
              contentStyle={styles.formInner}
            >
              <View style={styles.otpHeaderBox}>
                <View style={styles.otpIconBadge}>
                  <Ionicons name="mail-unread-outline" size={26} color={C.leaf} />
                </View>
                <Text style={styles.otpTitle}>Verifikasi Kode OTP Gmail</Text>
                <Text style={styles.otpSub}>
                  Masukkan 6 digit kode verifikasi yang dikirim ke{' '}
                  <Text style={{ color: C.white, fontWeight: '800' }}>
                    {regEmail.trim().toLowerCase()}
                  </Text>
                </Text>
              </View>

              <View style={styles.otpInputBox}>
                <TextInput
                  value={otpCode}
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

                <TouchableOpacity
                  disabled={resendCooldown > 0 || submitting}
                  onPress={handleSendOtp}
                >
                  <Text
                    style={[
                      styles.linkHighlight,
                      resendCooldown > 0 && { color: C.textFaint },
                    ]}
                  >
                    {resendCooldown > 0
                      ? `Kirim Ulang (${resendCooldown}d)`
                      : 'Kirim Ulang OTP'}
                  </Text>
                </TouchableOpacity>
              </View>
            </GlassView>
          )}
        </ScrollView>
      </KeyboardAvoidingView>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: C.bgSoft },
  scrollContent: {
    paddingTop: SCREEN_TOP_PAD - 4,
    paddingHorizontal: 20,
    paddingBottom: 42,
  },
  topRow: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    marginBottom: 10,
  },
  closeBtn: { width: 44, height: 44 },
  closeBtnInner: { flex: 1, alignItems: 'center', justifyContent: 'center' },

  headerBlock: { marginBottom: 20 },
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
  badgeText: {
    color: C.leafSoft,
    fontSize: 10.5,
    fontWeight: '800',
    letterSpacing: 0.7,
  },
  title: {
    fontSize: 32,
    fontWeight: '300',
    color: C.white,
    lineHeight: 39,
    letterSpacing: -0.5,
  },
  titleBold: { fontWeight: '800' },
  subtitle: {
    marginTop: 8,
    fontSize: 13,
    color: C.textSoft,
    lineHeight: 19,
  },

  switchWrap: { marginBottom: 16 },
  switchInner: {
    flexDirection: 'row',
    padding: 5,
    gap: 6,
  },
  switchTab: {
    flex: 1,
    paddingVertical: 11,
    borderRadius: R.pill,
    alignItems: 'center',
    justifyContent: 'center',
  },
  switchTabActive: {
    backgroundColor: C.white,
  },
  switchText: {
    fontSize: 13.5,
    fontWeight: '700',
    color: C.textSoft,
  },
  switchTextActive: {
    color: C.ink,
    fontWeight: '800',
  },

  noticeCard: { marginBottom: 14 },
  noticeInner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    padding: 14,
  },
  errorText: { flex: 1, color: '#fee2e2', fontSize: 12.5, fontWeight: '600', lineHeight: 18 },
  infoText: { color: C.mint, fontSize: 12.5, fontWeight: '600', lineHeight: 18 },
  devOtpText: { color: '#fde047', fontSize: 12.5, fontWeight: '800', marginTop: 4 },

  formCard: { marginBottom: 20 },
  formInner: { padding: 20 },
  inputLabel: {
    fontSize: 12,
    fontWeight: '700',
    color: C.mint,
    marginBottom: 7,
    marginTop: 10,
  },
  inputBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    backgroundColor: 'rgba(255, 255, 255, 0.08)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.2)',
    borderRadius: 18,
    paddingHorizontal: 14,
    height: 52,
  },
  textInput: {
    flex: 1,
    color: C.white,
    fontSize: 14,
    fontWeight: '600',
  },
  primaryBtn: {
    marginTop: 22,
    backgroundColor: C.white,
    borderRadius: R.pill,
    height: 52,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.26,
    shadowRadius: 14,
    elevation: 6,
  },
  primaryBtnText: {
    color: C.ink,
    fontSize: 14.5,
    fontWeight: '800',
  },

  dividerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginVertical: 18,
  },
  dividerLine: {
    flex: 1,
    height: 1,
    backgroundColor: 'rgba(255, 255, 255, 0.14)',
  },
  dividerLabel: {
    fontSize: 11.5,
    color: C.textFaint,
    fontWeight: '600',
  },
  googleBtn: {
    height: 50,
    borderRadius: R.pill,
    backgroundColor: 'rgba(255, 255, 255, 0.10)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.25)',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
  },
  googleBtnText: {
    color: C.white,
    fontSize: 13.5,
    fontWeight: '800',
  },

  otpHeaderBox: {
    alignItems: 'center',
    marginBottom: 18,
    gap: 6,
  },
  otpIconBadge: {
    width: 58,
    height: 58,
    borderRadius: 29,
    backgroundColor: 'rgba(74, 222, 128, 0.18)',
    borderWidth: 1,
    borderColor: 'rgba(134, 239, 172, 0.35)',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 4,
  },
  otpTitle: {
    fontSize: 18,
    fontWeight: '800',
    color: C.white,
  },
  otpSub: {
    fontSize: 12.5,
    color: C.textSoft,
    textAlign: 'center',
    lineHeight: 19,
  },
  otpInputBox: {
    backgroundColor: 'rgba(255, 255, 255, 0.09)',
    borderWidth: 1.5,
    borderColor: 'rgba(134, 239, 172, 0.45)',
    borderRadius: 20,
    height: 62,
    justifyContent: 'center',
    paddingHorizontal: 16,
  },
  otpTextInput: {
    color: C.white,
    fontSize: 26,
    fontWeight: '800',
    textAlign: 'center',
    letterSpacing: 10,
  },
  otpFooterActions: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 18,
  },
  linkMuted: {
    color: C.textSoft,
    fontSize: 12.5,
    fontWeight: '700',
  },
  linkHighlight: {
    color: C.leaf,
    fontSize: 12.5,
    fontWeight: '800',
  },
});