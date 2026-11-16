# 🌿 HerbalScan

Aplikasi mobile identifikasi tanaman herbal berbasis **Hybrid AI** (*Cloud Multimodal Vision AI + Local TensorFlow Lite Offline Fallback*) yang terintegrasi dengan database literatur ilmiah **Europe PMC** dan **CrossRef** untuk menyajikan profil morfologi, bukti klinis, peringatan toksisitas, serta sitasi jurnal ber-DOI resmi secara otomatis.

---

## ✨ Fitur Utama

- **Identifikasi Multi-Spesimen (`box_2d`):** Mendeteksi 1 hingga 5 spesies tumbuhan segar sekaligus dalam satu bidikan kamera `1:1`, lengkap dengan kotak anotasi interaktif berkode warna (termasuk penanda merah untuk tanaman beracun).
- **Arsitektur Hybrid Resilien (Cloud Vision + Offline TFLite):** Menggunakan *Gemini Vision API* sebagai mesin analisis utama untuk akurasi taksonomi di lapangan terbuka, serta otomatis beralih ke model lokal `MobileNetV2` (`predict.py` / TFLite) apabila koneksi internet ke layanan cloud terputus.
- **Validasi Objek Cerdas:** Menolak otomatis foto non-tanaman, benda mati, gambar buram (`confidence < 75%`), maupun makanan/masakan matang (`is_cooked_or_processed_food`).
- **Deteksi Keamanan & Toksisitas:** Peringatan otomatis untuk spesies beracun berbahaya (*Kecubung*, *Jarak Pagar*, *Oleander*, dll.) beserta informasi bagian tanaman yang dimanfaatkan dan kontraindikasinya.
- **Referensi Jurnal Asli (2020–Terbaru):** Penarikan otomatis jurnal ilmiah *peer-reviewed* ber-DOI aktif (`https://doi.org/...`) langsung dari REST API **Europe PMC** tanpa halusinasi AI.
- **Auto-Caching MySQL & Riwayat Pindai:** Spesies baru, foto referensi taksonomi, jurnal ilmiah, hingga riwayat pemindaian pengguna tersimpan otomatis di MySQL untuk akses instan pada pemindaian berikutnya.
- **Antarmuka Dark Botanical Glassmorphism:** Desain *liquid glass* bertema hijau botani gelap dengan *reticle* kamera presisi `1:1`, animasi radar pemindaian 3 tahap, tab bar kapsul melayang, serta halaman detail monograf dengan efek *parallax*.

---

## 🧠 Arsitektur Sistem & Alur Kerja

1. **Input Kamera & Galeri (`Expo React Native`):** Pengguna memotret spesimen di dalam bingkai bidik `1:1` (atau memilih dari galeri), lalu aplikasi memotong area presisi bingkai dan mengubah ukurannya ke `896px` (`JPEG`) sebelum mengunggahnya via `XMLHttpRequest` ke `POST /api/v1/predict`.
2. **Tier 1 — Analisis Multimodal Lapangan (`HerbalVisionService`):** Backend Laravel mengirim citra ke `gemini-2.5-flash` (dengan cadangan berantai ke `gemini-flash-latest`, `gemini-flash-lite-latest`, dan `gemini-2.5-flash-lite`) menggunakan koneksi paksa `IPv4` + `HTTP/1.1` untuk memetakan spesies, tingkat keyakinan, peringatan keamanan, serta koordinat `box_2d`.
3. **Tier 2 — Offline Fallback (`MobileNetV2` TFLite):** Jika layanan cloud tidak terjangkau, backend otomatis menjalankan `predict.py` secara lokal dan menerima hasil apabila skor keyakinan **$\ge 85\%$**.
4. **Tier 3 — Auto-Save & Sinkronisasi Literatur (`EuropePmcService` & `BotanicalImageService`):** Spesies valid disimpan ke tabel `herbals` dan `scan_histories`. Saat pengguna membuka katalog atau halaman **Detail Monograf**, backend melengkapi foto referensi botani serta jurnal ilmiah (tahun `2020`–terbaru) ber-DOI resmi.

---

## 🛠️ Tech Stack

| Komponen | Teknologi | Keterangan |
| :--- | :--- | :--- |
| **Mobile App** | React Native, Expo Router, TypeScript | Kamera `1:1`, `ImageManipulator`, `XMLHttpRequest`, dan UI *Glassmorphism*. |
| **Backend API** | PHP 8.x, Laravel, MySQL | REST API `/api/v1`, Guzzle HTTP (`IPv4` + `HTTP/1.1` retry), dan *caching* katalog. |
| **Cloud Vision AI** | Google Gemini API (`gemini-2.5-flash`) | Deteksi multi-spesimen (`box_2d`), ekstraksi fitokimia, dan validasi toksisitas. |
| **Model AI Lokal** | TensorFlow Lite (`MobileNetV2`), Python | *Offline fallback* klasifikasi daun (*Indonesian Herb Leaf Dataset*). |
| **Literatur & Foto** | Europe PMC API & Botanical Image Service | Penyedia metadata jurnal ilmiah ber-DOI resmi dan foto referensi taksonomi. |

---

## 📁 Struktur Direktori

```text
herbal-scan/
├── README.md
├── backend/
│   ├── predict.py
│   ├── app/
│   │   ├── Http/Controllers/Api/
│   │   │   └── HerbalController.php
│   │   ├── Models/
│   │   │   ├── Herbal.php
│   │   │   ├── ScanHistory.php
│   │   │   └── ScientificReference.php
│   │   └── Services/
│   │       ├── BotanicalImageService.php
│   │       ├── EuropePmcService.php
│   │       └── HerbalVisionService.php
│   ├── config/services.php
│   ├── database/migrations/
│   └── routes/api.php
└── mobile/
    ├── assets/model/
    │   ├── herbal_model.tflite
    │   └── labels.txt
    ├── app/
    │   ├── _layout.tsx
    │   ├── index.tsx
    │   ├── (tabs)/
    │   │   ├── _layout.tsx
    │   │   ├── index.tsx
    │   │   ├── search.tsx
    │   │   ├── scan.tsx
    │   │   └── history.tsx
    │   └── detail/
    │       └── [slug].tsx
    ├── components/
    │   ├── BotanicalBackdrop.tsx
    │   ├── CurvedTabBar.tsx
    │   ├── GlassView.tsx
    │   ├── HerbalConfirmModal.tsx
    │   └── tabBarMetrics.ts
    ├── constants/
    │   └── herbalTheme.ts
    └── services/
        ├── api.ts
        └── classifier.ts
```

---

## 🗄️ Skema Database MySQL

### 1. Tabel `herbals`
| Kolom | Tipe | Keterangan |
| :--- | :--- | :--- |
| `id` | `BIGINT` (PK) | ID unik tanaman |
| `slug` | `VARCHAR` (Unique) | Kunci URL (contoh: `sirih`, `daun_singkong`, `lidah_buaya`) |
| `name` | `VARCHAR` | Nama umum tanaman (Bahasa Indonesia, dengan akhiran `(Beracun)` jika toksik) |
| `scientific_name` | `VARCHAR` | Nama ilmiah binomial/trinomial (*Latin*) |
| `local_name` | `VARCHAR` | Sinonim nama daerah di Indonesia |
| `description` | `TEXT` | Deskripsi morfologi botani tanaman |
| `plant_parts_used` | `VARCHAR` | Bagian tanaman yang dimanfaatkan |
| `traditional_usage` | `TEXT` | Khasiat dan pemanfaatan tradisional |
| `lab_evidence` | `TEXT` (Nullable) | Ringkasan senyawa aktif & bukti uji laboratorium (*in vitro/in vivo*) |
| `clinical_evidence` | `TEXT` (Nullable) | Ringkasan bukti uji klinis pada manusia |
| `safety_warning` | `TEXT` | Peringatan keamanan, efek samping, & kontraindikasi |
| `image_url` | `VARCHAR` (Nullable) | URL foto referensi taksonomi tanaman |
| `is_curated` | `BOOLEAN` | Penanda spesies terkurasi di katalog utama |

### 2. Tabel `scientific_references`
| Kolom | Tipe | Keterangan |
| :--- | :--- | :--- |
| `id` | `BIGINT` (PK) | ID unik referensi |
| `herbal_id` | `BIGINT` (FK) | Relasi `ON DELETE CASCADE` ke `herbals.id` |
| `title` | `VARCHAR` | Judul artikel jurnal ilmiah |
| `author_year` | `VARCHAR` | Penulis dan tahun publikasi |
| `authors` | `VARCHAR` (Nullable) | Daftar penulis publikasi |
| `year` | `INT` (Nullable) | Tahun terbit publikasi (`>= 2020`) |
| `journal` | `VARCHAR` (Nullable) | Nama jurnal penerbit |
| `evidence_level` | `VARCHAR` | Tingkat bukti ilmiah (`Tradisional`, `Laboratorium`, `Uji Klinis`) |
| `doi` | `VARCHAR` (Nullable) | Kode pengenal DOI |
| `doi_or_url` | `VARCHAR` (Nullable) | Tautan DOI resmi (`https://doi.org/...`) |

### 3. Tabel `scan_histories`
| Kolom | Tipe | Keterangan |
| :--- | :--- | :--- |
| `id` | `BIGINT` (PK) | ID unik riwayat pemindaian |
| `user_id` | `BIGINT` (Nullable) | ID pengguna terautentikasi (`null` untuk mode tamu) |
| `detected_slug` | `VARCHAR` | Referensi `slug` spesies yang terdeteksi |
| `confidence_score` | `FLOAT` | Skor tingkat kecocokan identifikasi (`0–100`) |
| `image_path` | `VARCHAR` (Nullable) | Path foto hasil pindai pada `storage/app/public/history_scans` |

---

## 🚀 Cara Menjalankan Proyek (Linux Mint)

### 1. Konfigurasi `backend/.env`
```env
GEMINI_API_KEY=isi_dengan_api_key_google_ai_studio
GEMINI_VISION_MODEL=gemini-2.5-flash
```

### 2. Jalankan Server Laravel & Storage Link
```bash
cd ~/Projects/herbal-scan/backend
php artisan storage:link
php artisan optimize:clear
php -d upload_max_filesize=20M -d post_max_size=25M artisan serve --host=0.0.0.0 --port=8000
```

### 3. Jalankan Aplikasi Mobile Expo
Pastikan HP dan laptop berada pada jaringan Wi-Fi yang sama (`classifier.ts` mendeteksi IP LAN sesi Metro/Expo secara otomatis):
```bash
cd ~/Projects/herbal-scan/mobile
npx expo start -c
```

---

## 📝 Catatan Pengembangan (Engineering Log)

- **Stabilitas Koneksi Cloud Vision (`cURL error 35`):** Memaksa resolusi jaringan ke `IPv4` (`force_ip_resolve => 'v4'`), protokol `HTTP/1.1`, header `'Expect' => ''`, serta mekanisme *auto-retry* pada `HerbalVisionService` menghilangkan *socket reset* saat mengunggah payload foto ke server Google.
- **Kompatibilitas Multipart Android:** Mengganti unggahan `FormData` dari `fetch` ke `XMLHttpRequest` native menghindari error `Unsupported FormDataPart implementation` pada Expo SDK terbaru, sekaligus menjaga ukuran foto di `896px` agar tulang daun tetap tajam dan ringan diunggah.
- **Lazy Reference Fetching:** Pengambilan foto referensi botani dan jurnal Europe PMC dipindahkan ke pemuatan katalog/detail (`index` & `showBySlug`) sehingga proses pemindaian kamera selesai jauh lebih cepat.
- **Sitasi Jurnal Bebas Halusinasi:** Seluruh referensi ditarik langsung melalui REST API publik *Europe PMC* berdasarkan `scientific_name` dengan penyaringan tahun terbit `2020–terbaru` dan tautan DOI aktif.