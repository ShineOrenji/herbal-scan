# 🌿 HerbalScan — Sistem Identifikasi & Asisten Botani Berbasis Hybrid AI

**HerbalScan** adalah aplikasi mobile lintas platform (*Android & iOS*) untuk mengidentifikasi spesies tumbuhan herbal, tanaman buah/hias/bonsai, serta tumbuhan liar beracun secara instan melalui kamera smartphone. Aplikasi ini memadukan **Hybrid Cloud Vision (PlantNet API + Google Gemini 2.5 Flash)** dengan dukungan deteksi tunggal maupun **multi-spesimen (1–5 tanaman sekaligus)**, validasi literatur jurnal ilmiah terindeks DOI, serta **HerbBOT AI** sebagai asisten konsultasi botani dan etnofarmakologi kontekstual.

---

## 🎯 Ringkasan Eksekutif (Bahan Pitching & Presentasi)

- **Latar Belakang Masalah:** Masyarakat sering kesulitan membedakan tanaman herbal maupun tanaman budidaya yang aman dengan tumbuhan liar beracun yang bentuk daunnya mirip, termasuk saat mengamati beberapa tanaman sekaligus di pekarangan maupun kebun, serta minimnya akses cepat ke bukti ilmiah dan panduan pengolahan yang aman.
- **Solusi:** Aplikasi pemindai tanaman cerdas yang mampu mendeteksi 1 hingga 5 spesimen tumbuhan berbeda dalam satu foto (baik foto kamera HD maupun foto galeri non-HD), menampilkan identitas spesies berbahasa Indonesia, kotak deteksi berwarna (*color-coded bounding box*), status keamanan (*Aman vs Beracun*), cara pengolahan tradisional, referensi jurnal ilmiah terbaru (≥ 2020), serta asisten AI **HerbBOT** untuk tanya-jawab interaktif.
- **Nilai Jual Utama (*Unique Value Proposition*):**
  1. **Arsitektur Multi-Layer Hybrid AI:** Menggabungkan akurasi taksonomi **PlantNet** dengan penalaran botani spasial **Google Gemini 2.5 Flash** di server serta aset model **MobileNetV2 (TensorFlow Lite)** di paket aplikasi.
  2. **Deteksi Multi-Spesimen & Color-Coded Bounding Box (1–5 Tanaman):** Mampu mengidentifikasi hingga 5 spesies berbeda dalam satu tangkapan kamera dan memetakannya dengan kotak deteksi berwarna berbeda (`#1`–`#5`) beserta kartu detail geser.
  3. **Botanical Guardrails & Anti-Ngasal (*Low-Confidence Rejection*):** Menormalisasi nama asing ke nama populer Indonesia (misalnya *Ficus racemosa* sebagai **Loa**), mencegah label beracun palsu pada tanaman budidaya seperti **Anggur** (*Vitis*), serta menolak foto buram/non-tanaman agar AI tidak menebak sembarangan.
  4. **Deteksi Dini Tanaman Beracun (*Toxic Alert*):** Menandai otomatis spesies berbahaya dengan label peringatan khusus serta kotak deteksi berwarna **merah** di layar pemindai.
  5. **Asisten AI Botani Kontekstual (*HerbBOT*):** Asisten tanya-jawab cerdas yang otomatis memahami profil lengkap tanaman yang sedang dibuka (cara pengolahan, takaran pakai, kontraindikasi, peringatan toksisitas) maupun konsultasi herbal umum dengan riwayat tersinkronisasi per akun.
  6. **Validasi Literatur Ilmiah & Katalog Dinamis:** Katalog monograf dimulai dari **11 spesies herbal kurasi default** dan otomatis bertambah dari hasil pemindaian pengguna (diurutkan dari pemindaian terbaru di posisi paling atas), lengkap dengan foto referensi **iNaturalist** dan jurnal ilmiah ber-DOI (≥ 2020) dari **Europe PMC**, **Crossref**, dan **OpenAlex**.

---

## 🧠 Arsitektur AI & Alur Kerja Sistem (*End-to-End Pipeline*)

```text
[Kamera / Galeri Smartphone (HD maupun Non-HD)]
             │
             ▼
1. Adaptive Image Normalization & Transport (mobile/services/classifier.ts)
   └─ Penyesuaian rotasi EXIF, resize optimal (1024px), & kompresi JPEG hemat bandwidth
             │
             ▼
2. Cloud Taxonomic Matching (PlantNet API — HerbalVisionService.php)
   └─ Pencocokan morfologi daun/ranting/bunga tanaman dominan ke database botani global (Top-5)
             │
             ▼
3. Multimodal Spatial & Botanical Guardrails (Google Gemini 2.5 Flash)
   └─ Deteksi 1–5 spesimen (`box_2d`), kunci determinasi daun, normalisasi nama Indonesia,
      filter anti-bias/toksisitas, & penolakan foto tidak fokus (`low_confidence_rejected`)
             │
             ▼
4. Conversational Botanical Assistant (HerbBOT AI — HerbBotService.php)
   └─ Konsultasi interaktif berbasis konteks monograf tanaman & riwayat percakapan pengguna
             │
             ▼
5. Visual, Academic & Persistence Layer (iNaturalist + Europe PMC/Crossref/OpenAlex + TiDB Cloud)
   └─ Pengambilan foto referensi otomatis, jurnal ilmiah ber-DOI (≥ 2020), & sinkronisasi cloud
```

### Pembagian Peran Engine AI

- **Taxonomic Vision — PlantNet API**
  - **Lokasi Kode:** `backend/app/Services/HerbalVisionService.php`
  - **Fungsi Utama:** Menghasilkan 5 kandidat spesies botani teratas berdasarkan kemiripan morfologi organ tumbuhan paling dominan di bingkai.
- **Multimodal Vision LLM — Google Gemini 2.5 Flash**
  - **Lokasi Kode:** `backend/app/Services/HerbalVisionService.php`
  - **Fungsi Utama:** Mengidentifikasi seluruh spesimen berbeda (1–5 tanaman), menghasilkan koordinat `box_2d`, menjalankan kunci determinasi daun, menormalisasi nama populer Indonesia, mendeteksi status beracun, dan menyusun informasi etnofarmakologi.
- **Conversational AI — Google Gemini 2.5 Flash (`HerbBOT`)**
  - **Lokasi Kode:** `backend/app/Services/HerbBotService.php` & `mobile/components/herbbot/`
  - **Fungsi Utama:** Menjawab pertanyaan pengguna seputar khasiat, cara pengolahan, takaran, dan keamanan tanaman secara kontekstual berlatensi rendah (< 1,5 detik) dengan chip saran pertanyaan lanjutan otomatis.
- **Bundled Edge Model — MobileNetV2 (TensorFlow Lite)**
  - **Lokasi Kode:** `mobile/assets/model/herbal_model.tflite`
  - **Fungsi Utama:** Aset model klasifikasi ringan 11 kelas herbal yang dibundel di dalam repositori mobile.

---

## ✨ Fitur Lengkap Aplikasi

1. **Pemindaian Kamera & Galeri Cerdas (Single, Multi-Spesimen, & Non-HD Resilient)**
   - Mendukung pemotretan jarak dekat (detail ranting & helai daun), jarak menengah/jauh (pohon atau bonsai dalam pot), foto galeri resolusi standar/non-HD, maupun pemindaian **beberapa tanaman sekaligus (1–5 spesies)** dalam satu bingkai.
   - **Mode Tunggal (`1 Tanaman`):** Langsung membuka halaman detail spesies dengan foto hasil kamera/galeri pengguna tampil sebagai gambar utama dan perbandingan visual spesimen.
   - **Mode Multi-Spesimen (`2–5 Tanaman`):** Menampilkan *color-coded bounding box* interaktif pada foto (**#1 Hijau, #2 Biru, #3 Kuning, #4 Ungu, #5 Merah Muda**) lengkap dengan kartu geser (*horizontal drawer*) dan skor keyakinan masing-masing.
2. **HerbBOT — Asisten AI Botani & Herbal Kontekstual**
   - **Mode Kontekstual Tanaman:** Saat dibuka dari halaman Detail tanaman (lewat tombol melayang *Draggable FAB*), HerbBOT otomatis membaca profil lengkap tanaman tersebut—termasuk status toksisitas, cara pengolahan, takaran pakai, dan kontraindikasi.
   - **Mode Konsultasi Umum:** Dapat diakses langsung dari Beranda untuk berdiskusi seputar perbandingan spesies herbal, racikan aman, maupun perawatan tanaman.
   - **Pengalaman Chat Modern:** Dilengkapi saran pertanyaan lanjutan interaktif (*suggestion chips*), format teks terstruktur, penyimpanan riwayat percakapan di cloud (TiDB) dan lokal (`AsyncStorage`), gestur *swipe-to-delete* pada panel riwayat, serta dialog konfirmasi hapus/reset terpusat.
3. **Sistem Peringatan Tanaman Beracun (*Toxic Alert*)**
   - Spesies beracun (seperti *Pakis Haji*, *Kamboja Jepang*, *Kecubung*, *Bintaro*, *Tapak Dara*, *Patah Tulang*, *Awar-awar*, *Janda Bolong*, *Ki Tolod*) otomatis diberi penanda **`(Beracun)`**, kotak deteksi berwarna **merah**, dan peringatan keamanan tegas, sementara tanaman pangan/budidaya aman (seperti *Anggur*) dilindungi dari salah deteksi racun.
4. **Katalog Monograf Dinamis & Filter Kategori**
   - Dimulai dari **11 monograf herbal kurasi default** dan otomatis bertambah setiap kali spesies baru dipindai, dengan urutan **tanaman terbaru di posisi paling atas** pada Beranda maupun Katalog Pencarian.
   - Pencarian instan berdasarkan nama populer Indonesia, nama daerah (Sunda, Jawa, Melayu, dll.), maupun nama ilmiah, dilengkapi filter pintar: `Semua`, `Herbal Aman`, `Beracun`, `Daun`, `Rimpang`, `Buah & Bunga`, serta kategori manfaat kesehatan.
5. **Referensi Jurnal Ilmiah Terindeks DOI (≥ 2020)**
   - Menarik publikasi penelitian terbaru ber-DOI dari **Europe PMC**, **Crossref**, dan **OpenAlex**, serta mengklasifikasikan tingkat bukti ke dalam **`Tradisional`**, **`Laboratorium`**, dan **`Uji Klinis`**.
6. **Autentikasi & Riwayat Pemindaian (*Cloud Sync*)**
   - Registrasi akun dengan verifikasi **OTP Email (Gmail SMTP)**, Login standar, **Google Sign-In (OAuth)**, manajemen profil/avatar, dan riwayat pemindaian tersinkronisasi per akun.

---

## 🛠️ Tech Stack Lengkap

### Frontend Mobile (`/mobile`)
- **Core Framework:** React Native, Expo SDK 58, Expo Router (*File-based Routing*), TypeScript
- **Penyimpanan Lokal & Offline Cache:** `@react-native-async-storage/async-storage`, `expo-file-system`, `expo-image-manipulator`
- **UI & Navigasi:** `@expo/vector-icons` (`Ionicons` & `MaterialCommunityIcons`), `CurvedTabBar`, `GlassView`, `HerbalConfirmModal`, *Draggable FAB*, dan modul komponen `components/herbbot/`

### Backend API (`/backend`)
- **Framework:** Laravel (PHP 8.2+) REST API
- **Autentikasi:** Laravel Sanctum (*Bearer Token*)
- **Hosting:** Vercel Serverless Functions (`vercel-php@0.9.0`, region `sin1`)
- **Database:** TiDB Cloud (*MySQL-compatible Distributed Serverless SQL*)
- **Resiliensi API:** *Multi-key pool rotation* untuk `GEMINI_API_KEYS` dan `PLANTNET_API_KEYS` guna mencegah *rate-limit* (HTTP 429) dan menjaga latensi tetap rendah.

---

## 📁 Peta Struktur Direktori & Audit Kode

```text
herbal-scan/
├── backend/                                    # Laravel REST API (Vercel Serverless)
│   ├── app/
│   │   ├── Http/Controllers/Api/
│   │   │   ├── AuthController.php              # OTP Gmail, Login, Google OAuth, Profil & Avatar
│   │   │   ├── HerbalController.php            # Katalog Dinamis, Filter, Detail Slug, Multi-Scan & Riwayat
│   │   │   └── HerbBotController.php           # Sesi chat, thread per tanaman/umum, & manajemen pesan
│   │   ├── Models/
│   │   │   ├── Herbal.php                      # Model spesies tanaman, atribut toksisitas, & monograf
│   │   │   ├── ScientificReference.php         # Model referensi jurnal DOI
│   │   │   ├── ScanHistory.php                 # Model riwayat pemindaian user
│   │   │   ├── HerbBotSession.php              # Model sesi percakapan HerbBOT
│   │   │   ├── HerbBotMessage.php              # Model pesan percakapan HerbBOT
│   │   │   └── User.php                        # Model pengguna & token Sanctum
│   │   └── Services/
│   │       ├── HerbalVisionService.php         # Pipeline Hybrid PlantNet + Gemini (1–5 Spesimen & Guardrails)
│   │       ├── HerbBotService.php              # Layanan AI percakapan botani berlatensi rendah
│   │       ├── EuropePmcService.php            # Pencarian jurnal Europe PMC, Crossref, OpenAlex
│   │       └── BotanicalImageService.php       # Pengambilan foto referensi botani (iNaturalist)
│   ├── database/
│   │   ├── migrations/                         # Definisi skema tabel & constraint ENUM
│   │   └── seeders/                            # Data 11 tanaman herbal kurasi default & panduan pengolahan
│   └── routes/api.php                          # Definisi seluruh endpoint /api/v1/*
│
└── mobile/                                     # Aplikasi Mobile Expo (React Native)
    ├── app/
    │   ├── (tabs)/
    │   │   ├── index.tsx                       # Beranda, Filter Chips, Pintasan HerbBOT & Katalog Terbaru
    │   │   ├── scan.tsx                        # Kamera/Galeri, Color-Coded Bounding Box & Multi-Drawer
    │   │   ├── search.tsx                      # Pencarian katalog herbal & filter kategori
    │   │   ├── history.tsx                     # Riwayat pemindaian pengguna & foto lokal
    │   │   └── profile.tsx                     # Pengaturan akun & profil pengguna
    │   ├── detail/[slug].tsx                   # Detail tanaman, perbandingan foto user, klinis & jurnal DOI
    │   ├── auth.tsx                            # Layar Login, Register OTP, & Google Sign-In
    │   └── index.tsx                           # Entry point & navigasi awal
    ├── components/
    │   ├── herbbot/                            # Arsitektur modular UI & state HerbBOT AI
    │   │   ├── HerbBotHeader.tsx               # Header kontekstual tanaman/umum & tombol aksi
    │   │   ├── HistoryPanel.tsx                # Panel riwayat percakapan & swipe-to-delete
    │   │   ├── MessageBubble.tsx               # Gelembung pesan user & asisten
    │   │   ├── RichMessageBody.tsx             # Parser teks tebal, miring, & daftar terstruktur
    │   │   ├── ChatInputBar.tsx                # Kolom input responsif keyboard
    │   │   ├── Suggestions.tsx                 # Chip & daftar pertanyaan lanjutan cerdas
    │   │   ├── MessageActionsSheet.tsx         # Lembar aksi salin/bagikan & hapus pesan
    │   │   └── useHerbBotChat.ts               # State management, sinkronisasi API, & cache lokal
    │   ├── HerbBotModal.tsx                    # Modal utama chat HerbBOT dengan gestur tarik
    │   ├── DraggableBotFab.tsx                 # Tombol melayang HerbBOT yang dapat digeser bebas
    │   ├── CurvedTabBar.tsx                    # Navigasi bawah kustom melengkung
    │   ├── GlassView.tsx                       # Komponen efek kaca (*glassmorphism*)
    │   └── HerbalConfirmModal.tsx              # Dialog konfirmasi terpusat untuk aksi hapus/reset
    └── services/
        ├── api.ts                              # Klien HTTP Axios, cache katalog, & endpoint HerbBOT
        └── classifier.ts                       # Optimasi foto & komunikasi payload identifikasi
```

---

## 🗄️ Skema Database Utama (TiDB Cloud)

1. **`users`**: Kredensial pengguna (`name`, `email`, `password`, `google_id`, `avatar_url`, `email_verified_at`).
2. **`herbals`**: Katalog spesies global (`slug`, `name`, `scientific_name`, `local_name`, `description`, `plant_parts_used`, `traditional_usage`, `preparation_method`, `dosage_notes`, `contraindications`, `lab_evidence`, `clinical_evidence`, `safety_warning`, `image_url`, `is_curated`, disertai atribut komputasi `is_toxic`).
3. **`scientific_references`**: Daftar publikasi ilmiah yang terhubung ke `herbal_id` (`title`, `author_year`, `evidence_level` ENUM `['Tradisional', 'Laboratorium', 'Uji Klinis']`, `doi_or_url`).
4. **`scan_histories`**: Rekam jejak pemindaian pengguna (`user_id`, `detected_slug`, `image_path`, `confidence_score`, `created_at`).
5. **`herbbot_sessions` & `herbbot_messages`**: Penyimpanan sesi percakapan per pengguna (baik sesi umum maupun sesi khusus per `plant_slug`) beserta riwayat pesan `user` dan `assistant`.

---

## 🚀 Panduan Instalasi & Menjalankan Secara Lokal

### 1. Clone Repositori

```bash
git clone [https://github.com/ShineOrenji/herbal-scan.git](https://github.com/ShineOrenji/herbal-scan.git)
cd herbal-scan
```

### 2. Instalasi Backend (Laravel)

```bash
cd backend
composer install
cp .env.example .env
php artisan key:generate
```

Lengkapi konfigurasi berikut pada file `backend/.env`:

```env
DB_CONNECTION=mysql
DB_HOST=your-tidb-cloud-host
DB_PORT=4000
DB_DATABASE=test
DB_USERNAME=your-tidb-username
DB_PASSWORD=your-tidb-password

GEMINI_API_KEYS=key_gemini_1,key_gemini_2
GEMINI_MODEL=gemini-2.5-flash
PLANTNET_API_KEYS=key_plantnet_1,key_plantnet_2

MAIL_MAILER=smtp
MAIL_HOST=smtp.gmail.com
MAIL_PORT=587
MAIL_USERNAME=your-email@gmail.com
MAIL_PASSWORD=your-gmail-app-password
```

Jalankan migrasi database beserta seeder 11 tanaman kurasi default, lalu nyalakan server lokal:

```bash
php artisan migrate --seed
php artisan serve
```

### 3. Instalasi Mobile App (Expo / React Native)

Buka terminal baru pada direktori utama proyek:

```bash
cd mobile
npm install
npx expo start
```

Pindai QR Code menggunakan aplikasi **Expo Go** di perangkat Android/iOS, atau buat paket aplikasi Android (`.apk`) mandiri menggunakan EAS:

```bash
eas build --platform android --profile preview
```

---

## 🎤 Poin Kunci Tanya-Jawab (Persiapan Audit & Presentasi)

- **Q: Bagaimana sistem mampu mendeteksi hingga 5 tanaman berbeda sekaligus dalam satu foto meskipun PlantNet dirancang untuk satu spesies?**
  > *Jawab:* Pada arsitektur Hybrid AI HerbalScan, PlantNet berperan memberikan 5 kandidat taksonomi untuk tanaman paling dominan di bingkai, sementara **Google Gemini 2.5 Flash** diinstruksikan memindai seluruh area foto untuk mengidentifikasi spesimen ke-2 hingga ke-5 secara mandiri serta mengembalikan koordinat spasial `box_2d` masing-masing. Aplikasi mobile kemudian merender kotak deteksi berwarna berbeda (`#1`–`#5`) agar pengguna dapat mengetuk tiap tanaman secara terpisah.
- **Q: Bagaimana sistem menjaga akurasi pada foto non-HD serta mencegah AI menebak asal-asalan?**
  > *Jawab:* Foto dari kamera maupun galeri dinormalisasi ke resolusi optimal (`1024px` di aplikasi, `800px` bicubic di server) sebelum dianalisis. Jika citra terlalu buram, gelap, atau bukan tumbuhan sehingga skor keyakinan di bawah ambang aman, sistem menolak pemindaian secara otomatis (`rejected`) alih-alih menghasilkan tebakan acak. Selain itu, lapisan *Botanical Guardrails* memastikan nama asing dinormalisasi ke nama populer Indonesia (seperti *Ficus racemosa* menjadi **Loa**).
- **Q: Bagaimana HerbBOT menjaga akurasi informasi medis/keamanan dan tetap merespons cepat (< 1,5 detik)?**
  > *Jawab:* HerbBOT menyuntikkan data terkurasi dari database `herbals` (status toksisitas, cara pengolahan, takaran pakai, dan kontraindikasi) ke dalam *system instruction*, menonaktifkan *thinking budget* agar generasi teks dimulai seketika, merotasi *pool* API key secara acak, serta membedakan khasiat empiris dengan bukti ilmiah klinis.
- **Q: Dari mana sumber referensi ilmiah pada filter "Berjurnal Ilmiah" berasal?**
  > *Jawab:* Backend menarik metadata publikasi ilmiah asli ber-DOI yang terbit mulai tahun **2020 ke atas** secara otomatis dari **EMBL-EBI Europe PMC**, **Crossref**, dan **OpenAlex** berdasarkan nama binomial spesies yang teridentifikasi.

---

## ⚠️ Disclaimer Botani & Medis

Seluruh informasi yang disajikan oleh **HerbalScan** dan **HerbBOT** disusun untuk tujuan edukasi, riset botani, dan referensi awal. Identifikasi berbasis citra kamera dan jawaban AI tidak menggantikan verifikasi langsung oleh ahli taksonomi botani maupun konsultasi dengan dokter/apoteker sebelum mengonsumsi tumbuhan liar atau ramuan herbal untuk pengobatan.

---

## 📄 Kredit & Atribusi

- **Machine Learning & Vision:** PlantNet API, Google Gemini 2.5 Flash API, MobileNetV2 (TensorFlow Lite)
- **Data Botani & Literatur Akademik:** iNaturalist, EMBL-EBI Europe PMC, Crossref, OpenAlex
- **Antarmuka & Ikon:** Expo / React Native, Ionicons & MaterialCommunityIcons (`@expo/vector-icons`)