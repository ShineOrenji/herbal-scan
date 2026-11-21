<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\User;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Facades\Mail;
use Illuminate\Support\Facades\Storage;

class AuthController extends Controller
{
    public function sendRegisterOtp(Request $request): JsonResponse
    {
        $isResendOnly = !$request->filled('password') && !$request->filled('name');

        if ($isResendOnly) {
            $validated = $request->validate([
                'email' => [
                    'required',
                    'string',
                    'email:rfc',
                    'max:150',
                    'regex:/^[a-zA-Z0-9._%+-]+@gmail\.com$/i',
                ],
            ], [
                'email.regex' => 'Registrasi wajib menggunakan alamat Gmail aktif (@gmail.com).',
            ]);

            $email = strtolower(trim($validated['email']));

            if (User::where('email', $email)->exists()) {
                return response()->json([
                    'status' => 'error',
                    'message' => 'Alamat Gmail ini sudah aktif terdaftar. Silakan langsung masuk.',
                ], 422);
            }

            $existingPending = DB::table('email_otps')
                ->where('email', $email)
                ->orderByDesc('id')
                ->first();

            if (!$existingPending || empty($existingPending->payload)) {
                return response()->json([
                    'status' => 'error',
                    'message' => 'Sesi pendaftaran tidak ditemukan atau sudah habis. Silakan isi formulir daftar kembali.',
                ], 422);
            }

            $storedPayload = json_decode((string) $existingPending->payload, true) ?: [];
            $userName = $storedPayload['name'] ?? 'Pengguna HerbalScan';
            $payloadJson = (string) $existingPending->payload;
        } else {
            $validated = $request->validate([
                'name' => ['required', 'string', 'min:2', 'max:100'],
                'email' => [
                    'required',
                    'string',
                    'email:rfc',
                    'max:150',
                    'regex:/^[a-zA-Z0-9._%+-]+@gmail\.com$/i',
                    'unique:users,email',
                ],
                'phone' => ['nullable', 'string', 'min:9', 'max:20'],
                'password' => ['required', 'string', 'min:8', 'max:100'],
            ], [
                'email.regex' => 'Registrasi wajib menggunakan alamat Gmail aktif (@gmail.com) untuk menerima kode OTP.',
                'email.unique' => 'Alamat Gmail ini sudah terdaftar. Silakan langsung masuk.',
                'password.min' => 'Kata sandi minimal harus 8 karakter.',
            ]);

            $email = strtolower(trim($validated['email']));
            $normalizedPhone = $this->normalizePhone($validated['phone'] ?? null);

            if ($normalizedPhone !== null && User::where('phone', $normalizedPhone)->exists()) {
                return response()->json([
                    'status' => 'error',
                    'message' => 'Nomor HP ini sudah digunakan oleh akun lain.',
                ], 422);
            }

            $userName = trim($validated['name']);
            $payloadJson = json_encode([
                'name' => $userName,
                'email' => $email,
                'phone' => $normalizedPhone,
                'password' => Hash::make($validated['password']),
            ]);
        }

        $otpCode = str_pad((string) random_int(0, 999999), 6, '0', STR_PAD_LEFT);

        DB::table('email_otps')->where('email', $email)->delete();
        DB::table('email_otps')->insert([
            'email' => $email,
            'otp_code' => $otpCode,
            'payload' => $payloadJson,
            'expires_at' => now()->addMinutes(5),
            'created_at' => now(),
            'updated_at' => now(),
        ]);

        $mailerDriver = (string) config('mail.default', 'log');

        if ($mailerDriver !== 'log') {
            try {
                $body = "Halo {$userName},\n\n"
                    . "Kode OTP pendaftaran HerbalScan Anda adalah: {$otpCode}\n\n"
                    . "Kode ini berlaku selama 5 menit. Jangan bagikan kode ini kepada siapa pun.\n\n"
                    . "Salam Botani,\nTim HerbalScan";

                Mail::raw($body, function ($message) use ($email) {
                    $message->to($email)
                        ->subject('Kode OTP Verifikasi Akun HerbalScan');
                });
            } catch (\Throwable $e) {
                Log::error("Gagal mengirim email OTP SMTP ke {$email}: " . $e->getMessage());
                return response()->json([
                    'status' => 'error',
                    'message' => 'Gagal mengirim kode OTP ke Gmail. Periksa konfigurasi SMTP server atau coba beberapa saat lagi.',
                ], 500);
            }
        } else {
            Log::info("[HerbalScan OTP LOG] Email: {$email} | Kode OTP: {$otpCode}");
        }

        return response()->json([
            'status' => 'success',
            'message' => "Kode OTP 6 digit telah dikirim ke {$email}. Periksa kotak masuk atau folder Spam Gmail Anda.",
            'dev_otp' => $mailerDriver === 'log' ? $otpCode : null,
        ]);
    }

    public function verifyRegisterOtp(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'email' => ['required', 'string', 'email'],
            'otp' => ['required', 'string', 'size:6'],
        ]);

        $email = strtolower(trim($validated['email']));
        $record = DB::table('email_otps')
            ->where('email', $email)
            ->orderByDesc('id')
            ->first();

        if (!$record) {
            return response()->json([
                'status' => 'error',
                'message' => 'Permintaan OTP tidak ditemukan. Silakan kirim ulang kode OTP.',
            ], 422);
        }

        if (now()->greaterThan($record->expires_at)) {
            DB::table('email_otps')->where('email', $email)->delete();
            return response()->json([
                'status' => 'error',
                'message' => 'Kode OTP sudah kedaluwarsa. Silakan minta kode baru.',
            ], 422);
        }

        if (!hash_equals((string) $record->otp_code, trim($validated['otp']))) {
            return response()->json([
                'status' => 'error',
                'message' => 'Kode OTP salah. Periksa kembali kotak masuk Gmail Anda.',
            ], 422);
        }

        $payload = json_decode((string) $record->payload, true) ?: [];

        if (User::where('email', $email)->exists()) {
            DB::table('email_otps')->where('email', $email)->delete();
            return response()->json([
                'status' => 'error',
                'message' => 'Akun dengan Gmail ini sudah terdaftar. Silakan langsung masuk.',
            ], 422);
        }

        $user = new User();
        $user->name = $payload['name'] ?? 'Pengguna HerbalScan';
        $user->email = $email;
        $user->phone = $payload['phone'] ?? null;
        $user->password = $payload['password'];
        $user->has_password = true;
        $user->email_verified_at = now();
        $user->save();

        DB::table('email_otps')->where('email', $email)->delete();

        $token = $user->createToken('herbalscan-mobile')->plainTextToken;
        $hostUrl = rtrim($request->getSchemeAndHttpHost(), '/');

        return response()->json([
            'status' => 'success',
            'message' => 'Akun berhasil diverifikasi dan aktif!',
            'token' => $token,
            'user' => $this->formatUser($user, $hostUrl),
        ]);
    }

    public function login(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'identifier' => ['required', 'string', 'max:150'],
            'password' => ['required', 'string', 'min:8', 'max:100'],
        ], [
            'password.min' => 'Kata sandi minimal 8 karakter.',
        ]);

        $rawIdentifier = trim($validated['identifier']);
        $user = null;

        if (str_contains($rawIdentifier, '@')) {
            $user = User::where('email', strtolower($rawIdentifier))->first();
        } else {
            $normalizedPhone = $this->normalizePhone($rawIdentifier);
            if ($normalizedPhone !== null) {
                $user = User::where('phone', $normalizedPhone)
                    ->orWhere('phone', $rawIdentifier)
                    ->first();
            }
        }

        if (!$user || empty($user->password) || !Hash::check($validated['password'], $user->password)) {
            return response()->json([
                'status' => 'error',
                'message' => 'Gmail / Nomor HP atau kata sandi tidak cocok.',
            ], 401);
        }

        $token = $user->createToken('herbalscan-mobile')->plainTextToken;
        $hostUrl = rtrim($request->getSchemeAndHttpHost(), '/');

        return response()->json([
            'status' => 'success',
            'message' => 'Berhasil masuk ke HerbalScan.',
            'token' => $token,
            'user' => $this->formatUser($user, $hostUrl),
        ]);
    }

    public function googleLogin(Request $request): JsonResponse
    {
        $request->validate([
            'access_token' => ['nullable', 'string'],
            'id_token' => ['nullable', 'string'],
        ]);

        $googleProfile = null;

        try {
            if ($request->filled('access_token')) {
                $resp = Http::withOptions(['force_ip_resolve' => 'v4', 'version' => 1.1])
                    ->timeout(12)
                    ->withToken($request->input('access_token'))
                    ->get('https://www.googleapis.com/oauth2/v3/userinfo');

                if ($resp->successful()) {
                    $googleProfile = $resp->json();
                }
            } elseif ($request->filled('id_token')) {
                $resp = Http::withOptions(['force_ip_resolve' => 'v4', 'version' => 1.1])
                    ->timeout(12)
                    ->get('https://oauth2.googleapis.com/tokeninfo', [
                        'id_token' => $request->input('id_token'),
                    ]);

                if ($resp->successful()) {
                    $googleProfile = $resp->json();
                }
            }
        } catch (\Throwable $e) {
            Log::warning('Verifikasi Google OAuth gagal: ' . $e->getMessage());
        }

        if (empty($googleProfile['email'])) {
            return response()->json([
                'status' => 'error',
                'message' => 'Token akun Google tidak valid atau sudah kedaluwarsa.',
            ], 401);
        }

        $email = strtolower(trim((string) $googleProfile['email']));
        $googleId = (string) ($googleProfile['sub'] ?? '');
        $name = trim((string) ($googleProfile['name'] ?? explode('@', $email)[0]));

        $user = User::where('email', $email)
            ->when($googleId !== '', fn ($q) => $q->orWhere('google_id', $googleId))
            ->first();

        if (!$user) {
            $user = User::create([
                'name' => $name,
                'email' => $email,
                'google_id' => $googleId !== '' ? $googleId : null,
                'has_password' => false,
                'email_verified_at' => now(),
            ]);
        } else {
            if ($googleId !== '' && empty($user->google_id)) {
                $user->google_id = $googleId;
            }
            if (empty($user->email_verified_at)) {
                $user->email_verified_at = now();
            }
            $user->save();
        }

        $token = $user->createToken('herbalscan-google')->plainTextToken;
        $hostUrl = rtrim($request->getSchemeAndHttpHost(), '/');

        return response()->json([
            'status' => 'success',
            'message' => 'Berhasil masuk dengan akun Google.',
            'token' => $token,
            'user' => $this->formatUser($user, $hostUrl),
        ]);
    }

    public function me(Request $request): JsonResponse
    {
        $user = $request->user();
        $hostUrl = rtrim($request->getSchemeAndHttpHost(), '/');

        return response()->json([
            'status' => 'success',
            'user' => $this->formatUser($user, $hostUrl),
        ]);
    }

    public function updateProfile(Request $request): JsonResponse
    {
        $user = $request->user();

        $validated = $request->validate([
            'name' => ['required', 'string', 'min:2', 'max:100'],
            'phone' => ['nullable', 'string', 'min:9', 'max:20'],
        ]);

        $normalizedPhone = $this->normalizePhone($validated['phone'] ?? null);

        if (
            $normalizedPhone !== null &&
            User::where('phone', $normalizedPhone)->where('id', '!=', $user->id)->exists()
        ) {
            return response()->json([
                'status' => 'error',
                'message' => 'Nomor HP tersebut sudah dipakai oleh akun lain.',
            ], 422);
        }

        $user->name = trim($validated['name']);
        $user->phone = $normalizedPhone;
        $user->save();

        $hostUrl = rtrim($request->getSchemeAndHttpHost(), '/');

        return response()->json([
            'status' => 'success',
            'message' => 'Profil berhasil diperbarui.',
            'user' => $this->formatUser($user, $hostUrl),
        ]);
    }

    public function updateAvatar(Request $request): JsonResponse
    {
        $request->validate([
            'avatar' => ['required', 'file', 'max:5120'],
        ], [
            'avatar.required' => 'Pilih file foto profil terlebih dahulu.',
            'avatar.max' => 'Ukuran foto profil maksimal 5 MB.',
        ]);

        $uploadedFile = $request->file('avatar');
        $realPath = $uploadedFile?->getRealPath();

        if (!$realPath || @getimagesize($realPath) === false) {
            return response()->json([
                'status' => 'error',
                'message' => 'File yang dipilih bukan gambar yang valid (JPG/PNG/WEBP).',
            ], 422);
        }

        try {
            $user = $request->user();
            $oldPath = $user->avatar_path;

            $newPath = app(\App\Services\CloudinaryService::class)->upload($realPath, 'herbal-scan/avatars');
            $user->avatar_path = $newPath;
            $user->save();

            if (!empty($oldPath) && $oldPath !== $newPath) {
                try {
                    if (str_starts_with($oldPath, 'http')) {
                        app(\App\Services\CloudinaryService::class)->deleteByUrl($oldPath);
                    } else {
                        Storage::disk('public')->delete($oldPath);
                    }
                } catch (\Throwable) {
                    // Abaikan kegagalan hapus file lama pada filesystem read-only
                }
            }

            $hostUrl = rtrim($request->getSchemeAndHttpHost(), '/');

            return response()->json([
                'status' => 'success',
                'message' => 'Foto profil berhasil diperbarui.',
                'user' => $this->formatUser($user, $hostUrl),
            ]);
        } catch (\Throwable $e) {
            Log::error('Gagal memperbarui foto profil: ' . $e->getMessage());
            return response()->json([
                'status' => 'error',
                'message' => 'Gagal mengunggah foto profil: ' . $e->getMessage(),
            ], 500);
        }
    }

    public function updatePassword(Request $request): JsonResponse
    {
        $user = $request->user();

        $rules = [
            'password' => ['required', 'string', 'min:8', 'max:100', 'confirmed'],
        ];

        if ($user->has_password) {
            $rules['current_password'] = ['required', 'string'];
        }

        $validated = $request->validate($rules, [
            'password.min' => 'Kata sandi baru minimal 8 karakter.',
            'password.confirmed' => 'Konfirmasi kata sandi baru tidak cocok.',
        ]);

        if ($user->has_password && !Hash::check($validated['current_password'], (string) $user->password)) {
            return response()->json([
                'status' => 'error',
                'message' => 'Kata sandi saat ini tidak sesuai.',
            ], 422);
        }

        $user->password = $validated['password'];
        $user->has_password = true;
        $user->save();

        return response()->json([
            'status' => 'success',
            'message' => 'Kata sandi berhasil diperbarui.',
        ]);
    }

    public function logout(Request $request): JsonResponse
    {
        $request->user()?->currentAccessToken()?->delete();

        return response()->json([
            'status' => 'success',
            'message' => 'Berhasil keluar dari akun.',
        ]);
    }

    private function normalizePhone(?string $raw): ?string
    {
        if ($raw === null) {
            return null;
        }
        $digits = preg_replace('/\D+/', '', $raw);
        if ($digits === '') {
            return null;
        }
        if (str_starts_with($digits, '62')) {
            $digits = '0' . substr($digits, 2);
        } elseif (!str_starts_with($digits, '0') && str_starts_with($digits, '8')) {
            $digits = '0' . $digits;
        }
        return $digits;
    }

    private function formatUser(User $user, string $hostUrl): array
    {
        return [
            'id' => $user->id,
            'name' => $user->name,
            'email' => $user->email,
            'phone' => $user->phone,
            'avatar_url' => !empty($user->avatar_path)
                ? (str_starts_with($user->avatar_path, 'http') ? $user->avatar_path : $hostUrl . '/storage/' . ltrim($user->avatar_path, '/'))
                : null,
            'has_password' => (bool) $user->has_password,
            'scan_count' => $user->scanHistories()->count(),
        ];
    }
}