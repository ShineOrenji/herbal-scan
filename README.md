# 🌿 HerbalScan

Aplikasi mobile identifikasi tanaman herbal berbasis **Hybrid AI** (*Local TensorFlow Lite + Cloud Multimodal Vision AI*) yang terintegrasi langsung dengan database literatur ilmiah **Europe PMC** dan **CrossRef** untuk menyajikan khasiat serta sitasi jurnal ber-DOI resmi secara otomatis.

---

## ✨ Fitur Utama

- **Identifikasi Hybrid 3-Tier:** Menggabungkan kecepatan model CNN lokal (`MobileNetV2` TFLite) untuk daun tunggal dengan kecerdasan visual *Gemini Vision API* untuk tanaman liar di alam/kebun.
- **Visual Chain-of-Thought:** Analisis ciri morfologi daun, tepi, tekstur permukaan, dan tangkai sebelum menentukan spesies untuk mencegah salah tebak pada tanaman kembar (*Singkong vs Pepaya*, *Keji Beling vs Sambung Nyawa*).
- **Deteksi Keamanan & Toksisitas:** Peringatan otomatis untuk tanaman beracun berbahaya serta informasi kontraindikasi medis.
- **Referensi Jurnal Asli (2020–2026):** Penarikan otomatis hingga 3 jurnal ilmiah *peer-reviewed* terbaru lengkap dengan tautan `[https://doi.org/](https://doi.org/)...` yang valid (bebas halusinasi AI).
- **Auto-Caching MySQL:** Spesies baru beserta jurnalnya otomatis disimpan ke database sehingga pemindaian berikutnya berjalan instan dan hemat kuota API ($0).

---

## 🧠 Arsitektur Sistem & Alur Kerja

1. **Input Kamera (`Expo React Native`):** Pengguna memotret tanaman dalam rasio `1:1` atau memilih gambar dari galeri (`quality: 0.5`), lalu mengirimkannya ke `POST /api/v1/predict`.
2. **Tier 1 — Inferensi Lokal (`MobileNetV2` TFLite):** Backend Laravel menjalankan `predict.py`. Jika objek dikenali dengan skor keyakinan **$\ge 95\%$**, data langsung diambil dari MySQL dalam waktu **< 0,5 detik**.
3. **Tier 2 — Analisis Lapangan (`Gemini Vision API`):** Jika skor lokal **$< 95\%$** (foto di alam terbuka atau spesies baru di luar 11 kelas latih), foto dikompres ke `960px` dan dianalisis menggunakan `gemini-2.5-flash` (dengan cadangan otomatis ke `gemini-3.1-flash-lite`).
4. **Tier 3 — Penarikan Jurnal & Auto-Save (`Europe PMC + CrossRef`):** Jika tanaman valid belum tersimpan di database, sistem menarik jurnal ilmiah tahun 2020–2026 yang memiliki DOI resmi, menyimpannya ke MySQL, lalu membuka layar **Detail Botani** di HP.

---

## 🛠️ Tech Stack

| Komponen       | Teknologi                                    | Keterangan                                                                       |
| :---           | :---                                         | :---                                                                             |
| **Mobile App** | React Native, Expo Router, TypeScript, Axios | UI kamera pemindai, galeri, dan layar Detail Botani.                             |
| **Backend API** | PHP 8.x, Laravel 13, MySQL | Manajemen REST API, kompresi citra, dan caching katalog.                                          |
| **Model AI Lokal** | TensorFlow Lite (`MobileNetV2`), Python | Dilatih di Google Colab (*Indonesian Herb Leaf Dataset 3500* + kelas non-herbal). |
| **Cloud Vision AI** | Google AI Studio (`gemini-2.5-flash`) | Klasifikasi taksonomi visual dan ekstraksi informasi etnofarmakologi.              |
| **Literatur Ilmiah** | Europe PMC REST API & CrossRef API | Penyedia metadata jurnal ilmiah dan DOI resmi gratis.                                |

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
│   │   │   └── ScientificReference.php
│   │   └── Services/
│   │       ├── HerbalVisionService.php
│   │       └── EuropePmcService.php
│   ├── config/services.php
│   ├── database/migrations/
│   └── routes/api.php
└── mobile/
    ├── assets/model/
    │   ├── herbal_model.tflite
    │   └── labels.txt
    ├── app/
    │   ├── (tabs)/scan.tsx
    │   └── detail/[slug].tsx
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
| `name` | `VARCHAR` | Nama umum tanaman (Bahasa Indonesia) |
| `scientific_name` | `VARCHAR` | Nama ilmiah binomial (*Latin*) |
| `local_name` | `VARCHAR` | Nama daerah di Indonesia |
| `description` | `TEXT` | Deskripsi morfologi tanaman |
| `plant_parts_used` | `VARCHAR` | Bagian tanaman yang dimanfaatkan |
| `traditional_usage` | `TEXT` | Khasiat dan cara pengolahan tradisional |
| `lab_evidence` | `TEXT` (Nullable) | Ringkasan senyawa aktif & bukti uji laboratorium |
| `clinical_evidence` | `TEXT` (Nullable) | Ringkasan bukti uji klinis pada manusia |
| `safety_warning` | `TEXT` | Peringatan keamanan & kontraindikasi |
| `image_url` | `VARCHAR` (Nullable) | Path/URL gambar ilustrasi tanaman |

### 2. Tabel `scientific_references`
| Kolom | Tipe | Keterangan |
| :--- | :--- | :--- |
| `id` | `BIGINT` (PK) | ID unik referensi |
| `herbal_id` | `BIGINT` (FK) | Relasi `ON DELETE CASCADE` ke `herbals.id` |
| `title` | `VARCHAR` | Judul artikel jurnal ilmiah |
| `author_year` | `VARCHAR` | Penulis dan tahun publikasi |
| `evidence_level` | `ENUM` | `'Tradisional'`, `'Laboratorium'`, atau `'Uji Klinis'` |
| `doi_or_url` | `VARCHAR` (Nullable) | Tautan DOI resmi (`[https://doi.org/](https://doi.org/)...`) |

---

## 🚀 Cara Menjalankan Proyek (Linux Mint)

### 1. Konfigurasi `backend/.env`
```env
GEMINI_API_KEY=isi_dengan_api_key_google_ai_studio
GEMINI_MODEL=gemini-2.5-flash
TFLITE_CONFIDENCE_THRESHOLD=95
```

### 2. Jalankan Server Laravel & Sinkronkan IP Wi-Fi Otomatis
```bash
cd ~/Projects/herbal-scan/backend
CURRENT_IP=$(hostname -I | awk '{print $1}')
sed -i "s|http://[0-9.]*:8000|http://${CURRENT_IP}:8000|g" ../mobile/services/api.ts ../mobile/services/classifier.ts
php -d upload_max_filesize=20M -d post_max_size=25M artisan serve --host=0.0.0.0 --port=8000
```

### 3. Jalankan Aplikasi Mobile Expo
```bash
cd ~/Projects/herbal-scan/mobile
npx expo start -c
```

---

## 📝 Catatan Pengembangan (Engineering Log)

- **Mengatasi Domain Shift Dataset:** Dataset studio berlatar polos memiliki akurasi rendah pada foto daun liar di alam. Solusinya adalah menetapkan ambang batas TFLite di angka `95%` dan mendelegasikan kondisi lapangan ke Vision AI multimodal.
- **Pencegahan Salah Tebak Spesies Kembar:** Mewajibkan AI mengisi analisis ciri fisik daun, tepi, dan tangkai sebelum menyimpulkan nama spesies berhasil memisahkan *Daun Singkong vs Pepaya* serta *Keji Beling vs Sambung Nyawa*.
- **Sitasi Jurnal Bebas Halusinasi:** Seluruh referensi ditarik langsung melalui REST API publik *Europe PMC* dan *CrossRef* berdasarkan `scientific_name` dengan filter publikasi `2020–2026` ber-DOI aktif.
