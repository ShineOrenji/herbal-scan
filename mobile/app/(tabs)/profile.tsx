import React, { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Image,
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
import * as ImagePicker from 'expo-image-picker';
import { useFocusEffect, useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import BotanicalBackdrop from '../../components/BotanicalBackdrop';
import GlassView from '../../components/GlassView';
import HerbalConfirmModal from '../../components/HerbalConfirmModal';
import { useAuth } from '../../contexts/AuthContext';
import {
  C,
  R,
  SCREEN_BOTTOM_PAD,
  SCREEN_TOP_PAD,
  TAB_BAR,
} from '../../constants/herbalTheme';

export default function ProfileScreen() {
  const router = useRouter();
  const {
    user,
    updateProfileData,
    uploadAvatarImage,
    changeUserPassword,
    refreshUser,
    logoutUser,
  } = useAuth();

  const [name, setName] = useState(user?.name || '');
  const [phone, setPhone] = useState(user?.phone || '');
  const [savingProfile, setSavingProfile] = useState(false);
  const [uploadingAvatar, setUploadingAvatar] = useState(false);

  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showCurrentPw, setShowCurrentPw] = useState(false);
  const [showNewPw, setShowNewPw] = useState(false);
  const [savingPassword, setSavingPassword] = useState(false);

  const [logoutModal, setLogoutModal] = useState(false);
  const [loggingOut, setLoggingOut] = useState(false);

  const [toastMsg, setToastMsg] = useState<string | null>(null);
  const [errorBanner, setErrorBanner] = useState<string | null>(null);

  useFocusEffect(
    useCallback(() => {
      if (user) {
        refreshUser();
      }
    }, [user, refreshUser])
  );

  useEffect(() => {
    if (user) {
      setName(user.name || '');
      setPhone(user.phone || '');
    }
  }, [user]);

  const showToast = (msg: string) => {
    setErrorBanner(null);
    setToastMsg(msg);
    setTimeout(() => {
      setToastMsg((prev) => (prev === msg ? null : prev));
    }, 2600);
  };

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

  const handlePickAvatar = async () => {
    if (uploadingAvatar) return;
    setErrorBanner(null);

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.82,
    });

    if (!result.canceled && result.assets?.[0]?.uri) {
      setUploadingAvatar(true);
      try {
        const msg = await uploadAvatarImage(result.assets[0].uri);
        showToast(msg);
      } catch (err: any) {
        setErrorBanner(extractApiError(err, 'Gagal mengunggah foto profil.'));
      } finally {
        setUploadingAvatar(false);
      }
    }
  };

  const handleSaveProfile = async () => {
    setErrorBanner(null);
    if (name.trim().length < 2) {
      setErrorBanner('Nama minimal 2 karakter.');
      return;
    }

    setSavingProfile(true);
    try {
      const msg = await updateProfileData(name.trim(), phone.trim() || undefined);
      showToast(msg);
    } catch (err: any) {
      setErrorBanner(extractApiError(err, 'Gagal memperbarui profil.'));
    } finally {
      setSavingProfile(false);
    }
  };

  const handleSavePassword = async () => {
    setErrorBanner(null);
    if (user?.has_password && !currentPassword) {
      setErrorBanner('Masukkan kata sandi Anda saat ini.');
      return;
    }
    if (newPassword.length < 8) {
      setErrorBanner('Kata sandi baru minimal 8 karakter.');
      return;
    }
    if (newPassword !== confirmPassword) {
      setErrorBanner('Konfirmasi kata sandi baru tidak cocok.');
      return;
    }

    setSavingPassword(true);
    try {
      const msg = await changeUserPassword({
        current_password: user?.has_password ? currentPassword : undefined,
        password: newPassword,
        password_confirmation: confirmPassword,
      });
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
      showToast(msg);
    } catch (err: any) {
      setErrorBanner(extractApiError(err, 'Gagal memperbarui kata sandi.'));
    } finally {
      setSavingPassword(false);
    }
  };

  const handleLogoutConfirm = async () => {
    setLoggingOut(true);
    try {
      await logoutUser();
      setLogoutModal(false);
      showToast('Anda telah keluar dari akun');
    } finally {
      setLoggingOut(false);
    }
  };

  return (
    <View style={styles.screen}>
      <StatusBar barStyle="light-content" translucent backgroundColor="transparent" />
      <BotanicalBackdrop tone="soft" />

      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <ScrollView
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
          contentContainerStyle={styles.scrollContent}
        >
          <View style={styles.headerBlock}>
            <Text style={styles.pageTitle}>
              Profil{'\n'}
              <Text style={styles.pageTitleBold}>Pengguna</Text>
            </Text>
            <Text style={styles.pageSubtitle}>
              {user
                ? 'Kelola identitas akun, foto profil, dan keamanan kata sandi'
                : 'Mode Tamu aktif — masuk untuk membuka arsip riwayat pribadi'}
            </Text>
          </View>

          {!user ? (
            /* TAMPILAN TAMU */
            <GlassView
              radius={30}
              intensity={50}
              style={styles.cardSpacing}
              contentStyle={styles.guestInner}
            >
              <View style={styles.guestAvatarCircle}>
                <Ionicons name="person-outline" size={38} color={C.leaf} />
              </View>
              <Text style={styles.guestTitle}>Anda Belum Masuk</Text>
              <Text style={styles.guestDesc}>
                Tanpa login, Anda tetap bisa mencari dan memindai tanaman baru untuk katalog global, tetapi riwayat pindaian tidak tersimpan.
              </Text>

              <View style={styles.perkList}>
                <View style={styles.perkRow}>
                  <Ionicons name="checkmark-circle" size={18} color={C.leaf} />
                  <Text style={styles.perkText}>Simpan seluruh riwayat pemindaian daun & bunga</Text>
                </View>
                <View style={styles.perkRow}>
                  <Ionicons name="checkmark-circle" size={18} color={C.leaf} />
                  <Text style={styles.perkText}>Masuk cepat dengan Gmail, No. HP, atau Google</Text>
                </View>
                <View style={styles.perkRow}>
                  <Ionicons name="checkmark-circle" size={18} color={C.leaf} />
                  <Text style={styles.perkText}>Atur foto profil & keamanan akun pribadi</Text>
                </View>
              </View>

              <TouchableOpacity
                activeOpacity={0.88}
                style={styles.primaryBtn}
                onPress={() => router.push({ pathname: '/auth', params: { mode: 'login' } } as any)}
              >
                <Ionicons name="log-in-outline" size={20} color={C.ink} />
                <Text style={styles.primaryBtnText}>Masuk ke Akun</Text>
              </TouchableOpacity>

              <TouchableOpacity
                activeOpacity={0.85}
                style={styles.secondaryBtn}
                onPress={() => router.push({ pathname: '/auth', params: { mode: 'register' } } as any)}
              >
                <Text style={styles.secondaryBtnText}>Daftar Akun Baru (OTP Gmail)</Text>
              </TouchableOpacity>
            </GlassView>
          ) : (
            /* TAMPILAN PROFIL PENGGUNA LOGIN */
            <>
              {errorBanner ? (
                <GlassView
                  radius={20}
                  intensity={45}
                  fill="rgba(239, 68, 68, 0.22)"
                  style={styles.cardSpacing}
                  contentStyle={styles.errorInner}
                >
                  <Ionicons name="alert-circle" size={19} color="#fca5a5" />
                  <Text style={styles.errorText}>{errorBanner}</Text>
                </GlassView>
              ) : null}

              {/* Kartu Avatar & Ringkasan Akun */}
              <GlassView
                radius={30}
                intensity={52}
                style={styles.cardSpacing}
                contentStyle={styles.avatarCardInner}
              >
                <TouchableOpacity
                  activeOpacity={0.85}
                  style={styles.avatarTouchable}
                  onPress={handlePickAvatar}
                >
                  {user.avatar_url ? (
                    <Image source={{ uri: user.avatar_url }} style={styles.avatarImg} />
                  ) : (
                    <View style={styles.avatarPlaceholder}>
                      <Text style={styles.avatarInitial}>
                        {(user.name || 'H').charAt(0).toUpperCase()}
                      </Text>
                    </View>
                  )}

                  <View style={styles.cameraBadge}>
                    {uploadingAvatar ? (
                      <ActivityIndicator size="small" color={C.ink} />
                    ) : (
                      <Ionicons name="camera" size={15} color={C.ink} />
                    )}
                  </View>
                </TouchableOpacity>

                <Text style={styles.userName}>{user.name}</Text>
                <Text style={styles.userEmail}>{user.email}</Text>

                <View style={styles.statPillRow}>
                  <View style={styles.statPill}>
                    <Ionicons name="checkmark-done" size={14} color={C.leaf} />
                    <Text style={styles.statPillText}>Gmail Terverifikasi</Text>
                  </View>
                  <View style={styles.statPill}>
                    <Ionicons name="scan" size={14} color={C.leaf} />
                    <Text style={styles.statPillText}>{user.scan_count ?? 0} Pindaian</Text>
                  </View>
                </View>
              </GlassView>

              {/* Kartu Edit Nama & Nomor HP */}
              <GlassView
                radius={30}
                intensity={48}
                style={styles.cardSpacing}
                contentStyle={styles.sectionInner}
              >
                <View style={styles.sectionHead}>
                  <View style={styles.sectionIcon}>
                    <Ionicons name="person-circle-outline" size={20} color={C.leaf} />
                  </View>
                  <Text style={styles.sectionTitle}>Informasi Profil</Text>
                </View>

                <Text style={styles.inputLabel}>Nama Lengkap</Text>
                <View style={styles.inputBox}>
                  <Ionicons name="person-outline" size={18} color={C.leafSoft} />
                  <TextInput
                    value={name}
                    onChangeText={setName}
                    placeholder="Nama lengkap Anda"
                    placeholderTextColor={C.textFaint}
                    style={styles.textInput}
                  />
                </View>

                <Text style={styles.inputLabel}>Nomor HP</Text>
                <View style={styles.inputBox}>
                  <Ionicons name="call-outline" size={18} color={C.leafSoft} />
                  <TextInput
                    value={phone}
                    onChangeText={setPhone}
                    placeholder="0812xxxxxxxx"
                    placeholderTextColor={C.textFaint}
                    keyboardType="phone-pad"
                    style={styles.textInput}
                  />
                </View>

                <TouchableOpacity
                  activeOpacity={0.88}
                  disabled={savingProfile}
                  style={[styles.primaryBtn, { marginTop: 18 }]}
                  onPress={handleSaveProfile}
                >
                  {savingProfile ? (
                    <ActivityIndicator size="small" color={C.ink} />
                  ) : (
                    <>
                      <Ionicons name="save-outline" size={18} color={C.ink} />
                      <Text style={styles.primaryBtnText}>Simpan Profil</Text>
                    </>
                  )}
                </TouchableOpacity>
              </GlassView>

              {/* Kartu Ganti Kata Sandi */}
              <GlassView
                radius={30}
                intensity={48}
                style={styles.cardSpacing}
                contentStyle={styles.sectionInner}
              >
                <View style={styles.sectionHead}>
                  <View style={styles.sectionIcon}>
                    <Ionicons name="key-outline" size={19} color={C.leaf} />
                  </View>
                  <Text style={styles.sectionTitle}>
                    {user.has_password ? 'Ganti Kata Sandi' : 'Buat Kata Sandi Akun'}
                  </Text>
                </View>

                {user.has_password ? (
                  <>
                    <Text style={styles.inputLabel}>Kata Sandi Saat Ini</Text>
                    <View style={styles.inputBox}>
                      <Ionicons name="lock-closed-outline" size={18} color={C.leafSoft} />
                      <TextInput
                        value={currentPassword}
                        onChangeText={setCurrentPassword}
                        placeholder="Masukkan kata sandi lama"
                        placeholderTextColor={C.textFaint}
                        secureTextEntry={!showCurrentPw}
                        autoCapitalize="none"
                        style={styles.textInput}
                      />
                      <TouchableOpacity onPress={() => setShowCurrentPw((p) => !p)}>
                        <Ionicons
                          name={showCurrentPw ? 'eye-off-outline' : 'eye-outline'}
                          size={20}
                          color={C.textSoft}
                        />
                      </TouchableOpacity>
                    </View>
                  </>
                ) : null}

                <Text style={styles.inputLabel}>Kata Sandi Baru</Text>
                <View style={styles.inputBox}>
                  <Ionicons name="lock-open-outline" size={18} color={C.leafSoft} />
                  <TextInput
                    value={newPassword}
                    onChangeText={setNewPassword}
                    placeholder="Minimal 8 karakter"
                    placeholderTextColor={C.textFaint}
                    secureTextEntry={!showNewPw}
                    autoCapitalize="none"
                    style={styles.textInput}
                  />
                  <TouchableOpacity onPress={() => setShowNewPw((p) => !p)}>
                    <Ionicons
                      name={showNewPw ? 'eye-off-outline' : 'eye-outline'}
                      size={20}
                      color={C.textSoft}
                    />
                  </TouchableOpacity>
                </View>

                <Text style={styles.inputLabel}>Konfirmasi Kata Sandi Baru</Text>
                <View style={styles.inputBox}>
                  <Ionicons name="checkmark-circle-outline" size={18} color={C.leafSoft} />
                  <TextInput
                    value={confirmPassword}
                    onChangeText={setConfirmPassword}
                    placeholder="Ulangi kata sandi baru"
                    placeholderTextColor={C.textFaint}
                    secureTextEntry={!showNewPw}
                    autoCapitalize="none"
                    style={styles.textInput}
                  />
                </View>

                <TouchableOpacity
                  activeOpacity={0.88}
                  disabled={savingPassword}
                  style={[styles.secondaryBtn, { marginTop: 18 }]}
                  onPress={handleSavePassword}
                >
                  {savingPassword ? (
                    <ActivityIndicator size="small" color={C.white} />
                  ) : (
                    <Text style={styles.secondaryBtnText}>Perbarui Kata Sandi</Text>
                  )}
                </TouchableOpacity>
              </GlassView>

              {/* Tombol Keluar */}
              <TouchableOpacity
                activeOpacity={0.85}
                style={styles.logoutBtn}
                onPress={() => setLogoutModal(true)}
              >
                <Ionicons name="log-out-outline" size={20} color="#fca5a5" />
                <Text style={styles.logoutBtnText}>Keluar dari Akun</Text>
              </TouchableOpacity>
            </>
          )}
        </ScrollView>
      </KeyboardAvoidingView>

      {toastMsg ? (
        <View pointerEvents="none" style={styles.toastPill}>
          <Ionicons name="checkmark-circle" size={16} color={C.leaf} />
          <Text style={styles.toastText}>{toastMsg}</Text>
        </View>
      ) : null}

      <HerbalConfirmModal
        visible={logoutModal}
        variant="single"
        title="Keluar dari Akun?"
        message="Anda dapat masuk kembali kapan saja menggunakan Gmail, Nomor HP, atau akun Google Anda."
        itemLabel={user?.email}
        confirmText="Ya, Keluar"
        cancelText="Batal"
        loading={loggingOut}
        onConfirm={handleLogoutConfirm}
        onCancel={() => {
          if (!loggingOut) setLogoutModal(false);
        }}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: C.bgSoft },
  scrollContent: {
    paddingTop: SCREEN_TOP_PAD,
    paddingHorizontal: 20,
    paddingBottom: SCREEN_BOTTOM_PAD,
  },
  headerBlock: { marginBottom: 20 },
  pageTitle: {
    fontSize: 31,
    fontWeight: '300',
    color: C.white,
    lineHeight: 38,
    letterSpacing: -0.5,
  },
  pageTitleBold: { fontWeight: '800' },
  pageSubtitle: {
    marginTop: 8,
    fontSize: 13,
    color: C.textSoft,
    lineHeight: 19,
  },

  cardSpacing: { marginBottom: 14 },

  guestInner: {
    padding: 24,
    alignItems: 'center',
  },
  guestAvatarCircle: {
    width: 82,
    height: 82,
    borderRadius: 41,
    backgroundColor: 'rgba(74, 222, 128, 0.16)',
    borderWidth: 1,
    borderColor: 'rgba(134, 239, 172, 0.36)',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 14,
  },
  guestTitle: {
    fontSize: 19,
    fontWeight: '800',
    color: C.white,
    marginBottom: 6,
  },
  guestDesc: {
    fontSize: 12.5,
    color: C.textSoft,
    textAlign: 'center',
    lineHeight: 19,
    marginBottom: 16,
  },
  perkList: {
    width: '100%',
    gap: 10,
    marginBottom: 20,
    backgroundColor: 'rgba(255, 255, 255, 0.06)',
    padding: 14,
    borderRadius: 20,
  },
  perkRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 9,
  },
  perkText: {
    flex: 1,
    fontSize: 12.5,
    color: C.mint,
    fontWeight: '600',
  },

  errorInner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    padding: 14,
  },
  errorText: { flex: 1, color: '#fee2e2', fontSize: 12.5, fontWeight: '600' },

  avatarCardInner: {
    padding: 22,
    alignItems: 'center',
  },
  avatarTouchable: {
    position: 'relative',
    marginBottom: 12,
  },
  avatarImg: {
    width: 92,
    height: 92,
    borderRadius: 46,
    borderWidth: 2,
    borderColor: C.leaf,
  },
  avatarPlaceholder: {
    width: 92,
    height: 92,
    borderRadius: 46,
    backgroundColor: 'rgba(74, 222, 128, 0.22)',
    borderWidth: 2,
    borderColor: C.leaf,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarInitial: {
    fontSize: 34,
    fontWeight: '800',
    color: C.white,
  },
  cameraBadge: {
    position: 'absolute',
    right: 0,
    bottom: 0,
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: C.leaf,
    borderWidth: 2,
    borderColor: '#081C11',
    alignItems: 'center',
    justifyContent: 'center',
  },
  userName: {
    fontSize: 20,
    fontWeight: '800',
    color: C.white,
  },
  userEmail: {
    fontSize: 13,
    color: C.leafSoft,
    marginTop: 2,
    fontWeight: '600',
  },
  statPillRow: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 14,
  },
  statPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: R.pill,
    backgroundColor: 'rgba(255, 255, 255, 0.09)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.16)',
  },
  statPillText: {
    color: C.mint,
    fontSize: 11.5,
    fontWeight: '700',
  },

  sectionInner: { padding: 20 },
  sectionHead: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginBottom: 10,
  },
  sectionIcon: {
    width: 34,
    height: 34,
    borderRadius: 12,
    backgroundColor: 'rgba(74, 222, 128, 0.18)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '800',
    color: C.white,
  },
  inputLabel: {
    fontSize: 12,
    fontWeight: '700',
    color: C.mint,
    marginBottom: 6,
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
    height: 50,
  },
  textInput: {
    flex: 1,
    color: C.white,
    fontSize: 14,
    fontWeight: '600',
  },

  primaryBtn: {
    width: '100%',
    height: 50,
    borderRadius: R.pill,
    backgroundColor: C.white,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  primaryBtnText: {
    color: C.ink,
    fontSize: 14,
    fontWeight: '800',
  },
  secondaryBtn: {
    width: '100%',
    height: 48,
    marginTop: 10,
    borderRadius: R.pill,
    backgroundColor: 'rgba(255, 255, 255, 0.10)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.24)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  secondaryBtnText: {
    color: C.white,
    fontSize: 13.5,
    fontWeight: '800',
  },

  logoutBtn: {
    marginTop: 4,
    height: 50,
    borderRadius: R.pill,
    backgroundColor: 'rgba(239, 68, 68, 0.16)',
    borderWidth: 1,
    borderColor: 'rgba(252, 165, 165, 0.36)',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  logoutBtnText: {
    color: '#fecaca',
    fontSize: 14,
    fontWeight: '800',
  },

  toastPill: {
    position: 'absolute',
    alignSelf: 'center',
    bottom: TAB_BAR.bottom + TAB_BAR.height + 40,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: 'rgba(10, 34, 22, 0.96)',
    borderWidth: 1,
    borderColor: 'rgba(134, 239, 172, 0.4)',
    paddingHorizontal: 16,
    paddingVertical: 11,
    borderRadius: R.pill,
    elevation: 10,
  },
  toastText: { color: C.white, fontSize: 13, fontWeight: '700' },
});