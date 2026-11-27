<?php

namespace App\Services;

use Illuminate\Http\Client\ConnectionException;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Log;
use RuntimeException;

class HerbalVisionService
{
    public function identifyPlant(string $imagePath, array $knownSpecies = [], array $extraImagePaths = []): array
    {
        if (!file_exists($imagePath)) {
            throw new RuntimeException('File gambar tidak ditemukan di server.');
        }

        $geminiKeys = $this->resolveGeminiKeys();
        if (empty($geminiKeys)) {
            throw new RuntimeException('GEMINI_API_KEYS atau GEMINI_API_KEY belum diisi pada environment.');
        }

        $optimized = $this->prepareOptimizedImage($imagePath);
        $base64Image = $optimized['data'];
        $mimeType = $optimized['mime_type'];
        $rawBytes = $optimized['bytes'];

        $extraOptimized = [];
        foreach (array_slice($extraImagePaths, 0, 2) as $extraPath) {
            if (is_string($extraPath) && file_exists($extraPath)) {
                try {
                    $extraOptimized[] = $this->prepareOptimizedImage($extraPath);
                } catch (\Throwable) {
                    // Lewati foto tambahan jika gagal dibaca
                }
            }
        }

        $plantNetKeys = $this->resolvePlantNetKeys();
        $engineTag = empty($plantNetKeys) ? 'gemini_only' : 'hybrid_pn_gemini';

        $hashSeed = $base64Image . '_' . $engineTag;
        if (!empty($extraOptimized)) {
            $extraHashPart = implode('_', array_map(fn ($e) => substr(hash('sha256', $e['data']), 0, 16), $extraOptimized));
            $hashSeed = $base64Image . '_' . $extraHashPart . '_' . $engineTag;
        }
        $normalizedHash = hash('sha256', $hashSeed);
        $cacheKey = "herbal_vision_pool_v30_{$normalizedHash}";
        $cached = Cache::get($cacheKey);
        if (is_array($cached) && !empty($cached['detected_plants'])) {
            return $cached;
        }

        $plantNetCandidates = [];
        if (!empty($plantNetKeys)) {
            $plantNetCandidates = $this->queryPlantNetCandidates($rawBytes, $mimeType, $plantNetKeys, $extraOptimized);
        }

        $plantNetHint = '';
        if (!empty($plantNetCandidates)) {
            $lines = [];
            foreach ($plantNetCandidates as $idx => $cand) {
                $rank = $idx + 1;
                $commonStr = !empty($cand['common_names']) ? ' | Nama umum: ' . implode(', ', array_slice($cand['common_names'], 0, 3)) : '';
                $familyStr = $cand['family'] !== '' ? " | Famili: {$cand['family']}" : '';
                $lines[] = "{$rank}. {$cand['scientific_name']} (Skor PlantNet: {$cand['score_percent']}%{$familyStr}{$commonStr})";
            }

            $plantNetHint = "HASIL ANALISIS MORFOLOGI BOTANI PLANTNET (5 KANDIDAT UNTUK TANAMAN PALING DOMINAN):\n"
                . implode("\n", $lines) . "\n\n"
                . "INSTRUKSI HIBRIDA PL@NTNET & MORFOLOGI VISUAL: Jika skor kandidat teratas Pl@ntNet >= 35% dan bentuk daunnya cocok dengan foto, gunakan spesies Pl@ntNet tersebut sebagai acuan utama. Namun jika skor Pl@ntNet rendah (< 35%)—misalnya pada tanaman tropis/bonsai Indonesia seperti Loa (Ficus racemosa), Sancang, atau foto kamera ponsel yang agak buram/tanpa bunga—gunakan analisis morfologi visual botani Anda sendiri untuk menentukan spesies paling akurat. ABAIKAN kandidat Pl@ntNet jika skornya < 30% dan tentukan spesies dari analisis morfologi visual Anda dengan is_confident_species: true dan confidence 65-85. Gunakan nama Indonesia umum (jangan istilah asing seperti Puero). Tolak (is_plant: false) HANYA jika foto bukan tumbuhan atau makanan matang.\n\n";
        }

        $knownHint = '';
        if (!empty($knownSpecies)) {
            $pairs = array_map(
                fn ($item) => $item['name'],
                array_slice($knownSpecies, 0, 60)
            );
            $knownHint = "CATATAN PENAMAAN KATALOG: Identifikasi spesies tumbuhan yang SEBENARNYA di dunia berdasarkan botani murni terlebih dahulu (JANGAN memaksakan cocok ke daftar ini jika spesiesnya berbeda). HANYA jika spesiesnya memang sama persis, gunakan format nama Indonesia & ilmiah berikut: " . implode(', ', $pairs) . ".\n\n";
        }

        $prompt = <<<PROMPT
Anda adalah ahli taksonomi botani global, agronomi, dan etnofarmakologi. Tugas Anda mengidentifikasi spesies tumbuhan apa pun di dunia (tanaman herbal, tanaman buah, sayuran, tanaman hias, bonsai, maupun tumbuhan liar) secara presisi tinggi dalam kondisi dan sudut kamera apa pun. Kembalikan HANYA JSON valid.

{$plantNetHint}{$knownHint}ANALISIS MULTI-SUDUT (JIKA ADA >1 FOTO): Jika pengguna mengirimkan 2–3 foto dari spesimen yang sama (Foto 1: Daun/Utama, Foto 2: Batang/Ranting, Foto 3: Bunga/Buah), gabungkan seluruh ciri morfologi dari semua sudut tersebut (bulu halus batang, getah, susunan tangkai, bunga/buah) untuk mengunci satu spesies paling akurat.

ATURAN PENAMAAN INDONESIA: Kolom common_name_id WAJIB memakai nama populer Bahasa Indonesia yang dikenal luas (contoh: Loa, Anggur, Sirih, Sambiloto). DILARANG memakai nama Inggris/asing (seperti Crattock, Cluster fig, Puero) atau nama Latin di common_name_id.

ATURAN UTAMA ANTI-BIAS & PEMBACAAN SEGALA JARAK KAMERA:
1. **Deteksi Single & Multi-Spesimen (1 hingga 5 Tanaman dalam 1 Bingkai)**:
  - Pengguna dapat memotret **1 tanaman** (jarak dekat ranting/daun maupun jarak jauh pohon/bonsai utuh) ATAU **beberapa tanaman sekaligus (multi-spesimen)** dalam satu foto (misalnya 2–5 pot tanaman berdampingan atau beberapa ranting/daun berbeda dalam satu frame).
  - Pindai seluruh area gambar: jika terdapat lebih dari 1 spesies tumbuhan yang jelas terlihat, **WAJIB** kembalikan SEMUA spesies berbeda tersebut sebagai objek terpisah di dalam array `"detected_plants"` (maksimal 5 spesimen), diurutkan dari yang paling besar/jelas di bingkai.
  - Setiap objek dalam `"detected_plants"` WAJIB memiliki koordinat `"box_2d": [ymin, xmin, ymax, xmax]` (skala 0–1000) yang membungkus tepat masing-masing tanaman secara terpisah (bukan satu kotak besar untuk semua).
  - Abaikan benda mati (pot, lantai, tembok, meja) dan jangan menduplikasi spesies yang sama dua kali kecuali benar-benar spesies berbeda.
  - Selama bagian tumbuhan terlihat pada foto, **WAJIB** identifikasi spesiesnya (`"is_plant": true`, `"is_confident_species": true`). Tolak (`"is_plant": false`) HANYA jika foto sama sekali bukan tumbuhan atau merupakan makanan matang (`"is_cooked_or_processed_food": true`).
2. **Kunci Determinasi Botani Wajib (`botanical_key_check`)**:
  - **Bentuk & Lekukan Tepi Daun (`leaf_lobes_and_margin`)**: Periksa apakah berlekuk menjari (*palmately lobed* seperti Daun Tin *Ficus carica*, Anggur, Pepaya, Singkong) atau utuh tanpa lekukan (*unlobed* seperti Loa *Ficus racemosa*, Sancang *Premna*, Saeng Simbar *Serissa*, Hokianti *Ehretia*).
  - **Pola Pertulangan & Tekstur (`venation_and_surface`)**: Periksa tulang daun (menyirip, menjari, melengkung, sejajar) dan tekstur permukaan (mengilap, berbulu halus, berbintik putih mikro, atau tebal berdaging).
  - **Pembeda Spesies Mirip & Bonsai Populer (`lookalike_differentiation`)**:
    - **Anting Putri (*Wrightia religiosa*) vs Melati Putih (*Jasminum sambac*)**:
      - *Anting Putri (Wrightia religiosa / Water Jasmine)*: Perdu/bonsai berkayu dengan ranting cokelat-keabuan ramping, pasangan daun berhadapan kecil-lonjong berujung meruncing (sering berwarna hijau kekuningan/kuning emas pada kultivar varigata), tulang daun menyirip halus melengkung, serta bunga putih menggantung ke bawah. Jika cocok dengan ciri ini, identifikasi sebagai **Anting Putri (*Wrightia religiosa*)**, JANGAN diterjemahkan sebagai Melati Putih hanya karena nama Inggrisnya *Water Jasmine*.
      - *Melati Putih (Jasminum sambac)*: Perdu merambat/setengah memanjat berbatang hijau berbulu halus, daun bulat telur lebar mengilap berujung tumpul/agak runcing dengan tulang daun melengkung menonjol, serta bunga putih bertumpuk tegak beraroma sangat wangi.
    - **Daun Dewa (*Gynura divaricata*) vs Jonghe / Sintrong (*Crassocephalum crepidioides*)**:
      - *Daun Dewa (Gynura divaricata)*: Bunga bonggol **tegak menghadap ke atas** berwarna kuning cerah hingga kuning-jingga; helai daun **tebal berdaging (semi-sukulen)** dengan permukaan berbulu halus beludru, batang berdaging sering bersemu ungu dan berumbi. Jika foto bunga tegak kuning-jingga atau batang/daun berdaging terlihat, pilih **Daun Dewa (*Gynura divaricata*)** (`is_toxic: false`), JANGAN terkecoh kandidat gulma *Crassocephalum crepidioides* dari Pl@ntNet.
      - *Jonghe / Sintrong (Crassocephalum crepidioides)*: Bunga bonggol berbentuk tabung silindris yang **merunduk/menunduk ke bawah** dengan ujung merah bata/jingga kecokelatan; daun **tipis seperti kertas (tidak berdaging)** dengan tepi bergerigi tajam tidak beraturan dan batang lunak berongga tanpa umbi.
    - **Pepaya Muda (*Carica papaya*) vs Ginseng Jawa/Penyu (*Talinum paniculatum*)**:
      - *Pepaya (Carica papaya)*: Walau masih bibit/kecil, daun pepaya sudah berlekuk menjari (3–7 cuping menjari dengan tulang daun utama memancar pucat dari pangkal tangkai panjang berongga). JANGAN pernah mengidentifikasi daun pepaya muda sebagai Ginseng Penyu/Ginseng Jawa (yang daunnya kecil utuh tanpa lekukan, tebal berdaging seperti sendok).
    - **Kumis Kucing (*Orthosiphon aristatus*) vs Sembung/Jaka Tua (*Blumea balsamifera*)**:
      - *Kumis Kucing*: Daun berhadapan bentuk belah ketupat/bulat telur dengan tepi bergerigi kasar pada separuh atas dan batang segi empat keunguan. JANGAN keliru dengan Jaka Tua/Sembung.
    - **Harendong / Senggani (*Melastoma malabathricum* / *Clidemia hirta*) vs Buntut Tikus**:
      - *Harendong/Senggani*: Daun tunggal berhadapan dengan 3–5 tulang daun melengkung sejajar dari pangkal hingga ujung (*acrodromous*) dan ranting kemerahan berbulu halus.
    - **Saeng Simbar / Seng Simbur (*Serissa japonica*) vs Hokianti (*Ehretia microphylla*) vs Sidaguri (*Sida rhombifolia*)**:
      - *Saeng Simbar (Serissa japonica)*: Daun sangat kecil (1–2 cm), tersusun rapat berhadapan pada ranting berkayu halus, helai lonjong-runcing bertepi rata mulus, bau khas menyengat bila diremas.
      - *Hokianti (Ehretia microphylla)*: Daun bulat telur sungsang mengilap, bagian ujung sering berlekuk/bergerigi tumpul, dan permukaan atas daun memiliki bintik-bintik putih kasar (*scabrous*).
      - *Sidaguri (Sida rhombifolia)*: Terna tegak berdaun belah ketupat/lonjong dengan tepi bergerigi jelas sepanjang separuh atas helai dan tulang daun menyirip menonjol.
    - **Sancang / Buas-buas (*Premna microphylla* / *Premna serratifolia*) vs Jati Emas (*Gmelina arborea* / *Tectona grandis*) vs Loa (*Ficus racemosa*)**:
      - *Sancang / Buas-buas*: Perdu/bonsai berkayu dengan daun bulat telur-lonjong berhadapan, tepi rata atau bergerigi dangkal di ujung, aroma khas menyengat saat diremas, batang tanpa getah putih (JANGAN keliru mengidentifikasi Sancang sebagai Jati Emas/Jati).
      - *Sancang / Buas-buas*: Daun berhadapan, aroma khas menyengat saat diremas, batang tanpa getah putih.
      - *Loa (Ficus racemosa)*: Ciri kunci pucuk memiliki kuncup seludang ujung meruncing (terminal stipule) khas marga Ficus, daun berseling bulat telur-lonjong bertepi rata, bergetah putih susu (JANGAN pernah identifikasi sebagai Coussapoa microcarpa atau Ocotea foetens). Detail: Daun tunggal berseling bulat telur-lonjong bertepi rata (tidak berlekuk), tulang daun menyirip jelas, batang/tangkai bergetah putih susu (JANGAN pernah identifikasi Loa sebagai Ocotea foetens).
3. **Skor Keyakinan Visual & Peringatan Lapangan (Ramah Kamera HP Standar)**:
  - Evaluasi kejelasan struktur daun/ranting/batang secara visual. Selama bentuk helai daun, tepi, atau susunan ranting masih dapat dikenali (termasuk foto dari kamera HP standar/agak buram ringan), WAJIB set `"is_confident_species": true` dan beri `confidence` realistis (`65–90` jika ciri spesies jelas, `55–68` jika hanya daun tanpa bunga/buah).
  - JANGAN pernah menurunkan `confidence` ke bawah `55` hanya karena skor mentah Pl@ntNet kecil (< 35%) pada tanaman tropis/bonsai Indonesia seperti Loa (*Ficus racemosa*), Sancang, atau daun tanpa bunga. Set `is_confident_species: false` dan `confidence < 45` HANYA jika foto benar-benar gelap total, blur parah hingga bentuk daun tidak terlihat sama sekali, atau bukan tanaman.
  - Jika hanya daun tanpa bunga/buah sehingga mirip beberapa spesies lain, tuliskan pada `description` 2 kandidat spesies pembanding beserta ciri pembeda di lapangan (getah putih, aroma daun saat diremas, bentuk batang).
  - Pada `safety_warning`, ingatkan agar tidak mengonsumsi tumbuhan liar di alam terbuka hanya berdasarkan foto daun tanpa verifikasi bunga, buah, atau ahli botani.
4. **Standar Nama Populer Indonesia**:
  - *Cycas revoluta* -> `common_name_id`: `"Pakis Haji (Beracun)"`, `local_name`: `"Pakis Haji, Sikas"`
  - *Premna microphylla* / *Premna serratifolia* -> `common_name_id`: `"Sancang (Buas-buas)"`, `local_name`: `"Sancang, Buas-buas, Singkil"`
  - *Serissa japonica* / *Serissa foetida* -> `common_name_id`: `"Saeng Simbar (Seng Simbur)"`, `local_name`: `"Saeng Simbar, Seng Simbur, Serissa"`
  - *Ficus racemosa* -> `common_name_id`: `"Loa"`, `local_name`: `"Loa, Elo"`
5. **Tanaman Beracun (WAJIB `is_toxic`: true & akhiran `" (Beracun)"` pada `common_name_id`)**:
  - Berlaku untuk *Pakis Haji* (*Cycas revoluta*), *Kamboja Jepang* (*Adenium obesum*), *Pokeweed*, *Saga Rambat*, *Kecubung*, *Bunga Terompet*, *Jarak Pagar*, *Jarak Kepyar*, *Bintaro*, *Gadung*, *Patah Tulang*, *Tapak Dara*, *Tembelekan*, *Dieffenbachia*, *Oleander*.

Kembalikan persis struktur JSON berikut:
{
  "is_plant": true,
  "is_cooked_or_processed_food": false,
  "rejection_reason": null,
  "detected_plants": [
    {
      "botanical_key_check": {
        "leaf_lobes_and_margin": "Deskripsi lekukan cuping & bentuk tepi daun",
        "venation_and_surface": "Pola tulang daun & ketebalan/tekstur permukaan",
        "lookalike_differentiation": "Alasan botani mengapa spesies ini berbeda dari tanaman mirip lainnya"
      },
      "common_name_id": "string",
      "scientific_name": "string",
      "local_name": "string",
      "description": "string",
      "plant_parts_used": "string",
      "traditional_usage": "string",
      "preparation_method": "Langkah pengolahan terukur (gram/lembar, volume air ml, durasi rebus/seduh) atau tulis TIDAK UNTUK DIKONSUMSI bila beracun",
      "dosage_notes": "Takaran dan frekuensi pakai wajar dewasa",
      "contraindications": "Kelompok yang dilarang menggunakan (ibu hamil, menyusui, gangguan ginjal/hati, interaksi obat)",
      "scientific_reference": "Rujukan standar etnofarmakologi / BPOM / Kemenkes / literatur botani",
      "lab_evidence": "string",
      "clinical_evidence": "string",
      "safety_warning": "string",
      "is_toxic": false,
      "is_confident_species": true,
      "confidence": 72,
      "box_2d": [100, 100, 900, 900]
    }
  ]
}
PROMPT;

        $rotatedKeys = $geminiKeys;
        shuffle($rotatedKeys);

        $discovered = $this->resolveActiveModels($rotatedKeys[0]);
        $models = array_values(array_unique(array_merge(
            ['gemini-2.5-flash', 'gemini-2.5-flash-lite'],
            $discovered
        )));
        $models = array_slice($models, 0, 4);
        $lastStatus = 0;
        $lastApiMessage = 'Layanan analisis sedang sibuk.';

        foreach (array_slice($rotatedKeys, 0, 4) as $keyIdx => $currentKey) {
            foreach ($models as $model) {
                $genConfig = [
                    'temperature' => 0.0,
                    'responseMimeType' => 'application/json',
                ];
                if (str_starts_with($model, 'gemini-3.')) {
                    $genConfig['thinkingConfig'] = ['thinkingLevel' => 'MINIMAL'];
                } elseif (str_starts_with($model, 'gemini-2.5-')) {
                    $genConfig['thinkingConfig'] = ['thinkingBudget' => 0];
                }

                $payload = [
                    'contents' => [
                        [
                            'parts' => array_merge(
                                [
                                    ['text' => $prompt],
                                    [
                                        'inline_data' => [
                                            'mime_type' => $mimeType,
                                            'data' => $base64Image,
                                        ],
                                    ],
                                ],
                                array_map(
                                    fn ($item) => [
                                        'inline_data' => [
                                            'mime_type' => $item['mime_type'],
                                            'data' => $item['data'],
                                        ],
                                    ],
                                    $extraOptimized
                                )
                            ),
                        ],
                    ],
                    'generationConfig' => $genConfig,
                ];

                try {
                    $endpoint = "https://generativelanguage.googleapis.com/v1beta/models/{$model}:generateContent?key={$currentKey}";

                    $response = Http::withOptions([
                        'force_ip_resolve' => 'v4',
                        'version' => 1.1,
                    ])
                        ->connectTimeout(3)
                        ->timeout(11)
                        ->withHeaders([
                            'Content-Type' => 'application/json',
                            'Expect' => '',
                        ])
                        ->post($endpoint, $payload);

                    if ($response->successful()) {
                        $parts = data_get($response->json(), 'candidates.0.content.parts', []);
                        $rawText = '';
                        if (is_array($parts)) {
                            foreach ($parts as $part) {
                                if (!empty($part['thought'])) {
                                    continue;
                                }
                                if (isset($part['text']) && is_string($part['text'])) {
                                    $rawText .= $part['text'];
                                }
                            }
                        }

                        $parsed = $this->decodeVisionJson($rawText);
                        if ($parsed !== null) {
                            $parsed = $this->applyBotanicalGuardrails($parsed, $plantNetCandidates);
                            if ($parsed['is_plant'] && !empty($parsed['detected_plants'])) {
                                Cache::put($cacheKey, $parsed, now()->addDays(14));
                            }
                            return $parsed;
                        }

                        $lastApiMessage = 'Format respons analisis tidak valid.';
                        continue;
                    }

                    $lastStatus = $response->status();
                    $lastApiMessage = (string) data_get($response->json(), 'error.message', "HTTP {$lastStatus}");
                    Log::warning("Gemini Pool [Key#" . ($keyIdx + 1) . "][{$model}] gagal ({$lastStatus}): {$lastApiMessage}");

                    if (in_array($lastStatus, [401, 403, 429], true)) {
                        break;
                    }
                } catch (ConnectionException $e) {
                    $lastStatus = 0;
                    $lastApiMessage = 'Koneksi internet server ke layanan analisis terputus sesaat.';
                    Log::warning("Koneksi Key#" . ($keyIdx + 1) . " [{$model}] terputus: " . $e->getMessage());
                    continue;
                } catch (\Throwable $e) {
                    $lastApiMessage = $e->getMessage();
                    Log::warning("Error Key#" . ($keyIdx + 1) . " [{$model}]: " . $e->getMessage());
                }
            }
        }

        if (!empty($plantNetCandidates)) {
            $pnFallback = $this->buildPlantNetFallbackResponse($plantNetCandidates);
            if ($pnFallback !== null) {
                $pnFallback = $this->applyBotanicalGuardrails($pnFallback, $plantNetCandidates);
                Cache::put($cacheKey, $pnFallback, now()->addHours(6));
                return $pnFallback;
            }
        }

        if (in_array($lastStatus, [429, 503], true)) {
            throw new RuntimeException('Seluruh jalur analisis sedang padat sesaat. Silakan tekan Identifikasi Spesimen kembali.');
        }

        throw new RuntimeException("Gagal menganalisis spesimen ({$lastStatus}): {$lastApiMessage}");
    }

    private function buildPlantNetFallbackResponse(array $pnCandidates): ?array
    {
        $top = $pnCandidates[0] ?? null;
        if (!is_array($top) || empty($top['scientific_name'])) {
            return null;
        }

        $sci = trim((string) $top['scientific_name']);
        $score = (int) round((float) ($top['score_percent'] ?? 0));
        $commonList = is_array($top['common_names'] ?? null) ? $top['common_names'] : [];
        $commonName = !empty($commonList) ? trim((string) $commonList[0]) : $sci;
        $family = trim((string) ($top['family'] ?? 'Tidak tercatat'));
        $localNames = !empty($commonList) ? implode(', ', array_slice($commonList, 0, 4)) : $commonName;

        return [
            'is_plant' => true,
            'is_cooked_or_processed_food' => false,
            'rejection_reason' => null,
            'detected_plants' => [
                [
                    'botanical_key_check' => [
                        'leaf_lobes_and_margin' => 'Terverifikasi melalui pencocokan morfologi Pl@ntNet.',
                        'venation_and_surface' => "Famili botani: {$family}.",
                        'lookalike_differentiation' => 'Dicocokkan langsung dengan basis data taksonomi Pl@ntNet.',
                    ],
                    'common_name_id' => $commonName,
                    'scientific_name' => $sci,
                    'local_name' => $localNames,
                    'description' => "Spesimen teridentifikasi sebagai {$commonName} ({$sci}) dari famili {$family} melalui pencocokan taksonomi Pl@ntNet dengan tingkat kemiripan {$score}%.",
                    'plant_parts_used' => 'Daun atau bagian tumbuhan sesuai literatur etnobotani',
                    'traditional_usage' => 'Gunakan hanya setelah memastikan kesesuaian spesies dan referensi pemanfaatan tradisional yang terverifikasi.',
                    'preparation_method' => 'Pastikan identitas spesies terkonfirmasi sebelum pengolahan; konsultasikan rujukan herbal resmi (BPOM/Kemenkes).',
                    'dosage_notes' => 'Gunakan dalam batas wajar sesuai pedoman sediaan herbal.',
                    'contraindications' => 'Hindari penggunaan pada ibu hamil, menyusui, anak-anak, atau riwayat alergi tanpa arahan tenaga kesehatan.',
                    'scientific_reference' => 'Pl@ntNet Global Botanical Database & Monograf Etnobotani',
                    'lab_evidence' => "Klasifikasi taksonomi terverifikasi pada famili {$family} ({$sci}).",
                    'clinical_evidence' => 'Perlu verifikasi monograf klinis spesifik untuk sediaan ekstrak terstandar.',
                    'safety_warning' => 'Jangan mengonsumsi tumbuhan liar hanya berdasarkan foto daun tanpa verifikasi organ bunga, buah, atau ahli botani.',
                    'is_toxic' => false,
                    'is_confident_species' => true,
                    'confidence' => max(58, $score),
                    'box_2d' => [120, 120, 880, 880],
                ],
            ],
        ];
    }

    private function queryPlantNetCandidates(string $rawBytes, string $mimeType, array $plantNetKeys, array $extraOptimized = []): array
    {
        $totalKeys = count($plantNetKeys);
        $startIndex = ((int) Cache::increment('herbal_plantnet_key_rr')) % $totalKeys;
        $rotatedKeys = array_merge(
            array_slice($plantNetKeys, $startIndex),
            array_slice($plantNetKeys, 0, $startIndex)
        );

        $ext = str_contains($mimeType, 'png') ? 'png' : 'jpg';

        foreach ($rotatedKeys as $keyIdx => $pnKey) {
            try {
                $url = 'https://my-api.plantnet.org/v2/identify/all?api-key=' . urlencode($pnKey)
                    . '&no-reject=true&lang=id';

                $pending = Http::withOptions([
                    'force_ip_resolve' => 'v4',
                ])
                    ->connectTimeout(3)
                    ->timeout(6)
                    ->attach('images', $rawBytes, "specimen_1.{$ext}");

                foreach ($extraOptimized as $eIdx => $extraItem) {
                    $eExt = str_contains($extraItem['mime_type'], 'png') ? 'png' : 'jpg';
                    $pending = $pending->attach('images', $extraItem['bytes'], 'specimen_' . ($eIdx + 2) . ".{$eExt}");
                }

                $response = $pending->post(
                    $url,
                    empty($extraOptimized) ? ['organs' => 'auto'] : []
                );

                if ($response->successful()) {
                    $results = $response->json('results');
                    if (!is_array($results) || empty($results)) {
                        return [];
                    }

                    $candidates = [];
                    foreach (array_slice($results, 0, 5) as $row) {
                        $sci = trim((string) data_get($row, 'species.scientificNameWithoutAuthor', ''));
                        if ($sci === '') {
                            $sci = trim((string) data_get($row, 'species.scientificName', ''));
                        }
                        if ($sci === '') {
                            continue;
                        }

                        $score = (float) ($row['score'] ?? 0);
                        $commonNames = data_get($row, 'species.commonNames', []);
                        $family = trim((string) data_get($row, 'species.family.scientificNameWithoutAuthor', ''));

                        $candidates[] = [
                            'scientific_name' => $sci,
                            'score_percent' => round($score * 100, 1),
                            'common_names' => is_array($commonNames) ? $commonNames : [],
                            'family' => $family,
                        ];
                    }

                    $candidates = array_values(array_filter($candidates, function ($c) {
    $s = strtolower((string) ($c['scientific_name'] ?? ''));
    $sc = (float) ($c['score_percent'] ?? 0);
    if ((str_contains($s, 'ocotea foetens') || str_contains($s, 'coussapoa')) && $sc < 65) {
        return false;
    }
    return true;
}));
return $candidates;
                }

                $status = $response->status();
                Log::warning("PlantNet Pool [Key#" . ($keyIdx + 1) . "] gagal ({$status}): " . $response->body());

                if (!in_array($status, [401, 403, 429, 500, 502, 503], true)) {
                    break;
                }
            } catch (\Throwable $e) {
                Log::warning("PlantNet Pool [Key#" . ($keyIdx + 1) . "] exception: " . $e->getMessage());
            }
        }

        return [];
    }

    private function resolvePlantNetKeys(): array
    {
        $sources = [
            config('services.plantnet.keys'),
            config('services.plantnet.key'),
            env('PLANTNET_API_KEYS'),
            env('PLANTNET_API_KEY'),
            $_ENV['PLANTNET_API_KEYS'] ?? null,
            $_ENV['PLANTNET_API_KEY'] ?? null,
            getenv('PLANTNET_API_KEYS') ?: null,
            getenv('PLANTNET_API_KEY') ?: null,
        ];
        $keys = [];
        foreach ($sources as $src) {
            if (!is_string($src) || trim($src) === '') {
                continue;
            }
            foreach (explode(',', $src) as $part) {
                $clean = trim($part);
                if ($clean !== '' && !in_array($clean, $keys, true)) {
                    $keys[] = $clean;
                }
            }
        }
        return $keys;
    }

    private function resolveGeminiKeys(): array
    {
        $sources = [
            config('services.gemini.keys'),
            config('services.gemini.key'),
            env('GEMINI_API_KEYS'),
            env('GEMINI_API_KEY'),
            env('GOOGLE_API_KEY'),
            $_ENV['GEMINI_API_KEYS'] ?? null,
            $_ENV['GEMINI_API_KEY'] ?? null,
            $_ENV['GOOGLE_API_KEY'] ?? null,
            getenv('GEMINI_API_KEYS') ?: null,
            getenv('GEMINI_API_KEY') ?: null,
            getenv('GOOGLE_API_KEY') ?: null,
        ];
        $keys = [];
        foreach ($sources as $src) {
            if (!is_string($src) || trim($src) === '') {
                continue;
            }
            foreach (explode(',', $src) as $part) {
                $clean = trim($part);
                if ($clean !== '' && !in_array($clean, $keys, true)) {
                    $keys[] = $clean;
                }
            }
        }
        return $keys;
    }

    private function resolveActiveModels(string $sampleKey): array
    {
        $configuredModel = trim((string) (env('GEMINI_MODEL') ?: config('services.gemini.model', '')));

        $listCacheKey = 'gemini_pool_models_v5_' . substr(md5($sampleKey), 0, 10);
        $discovered = Cache::remember($listCacheKey, now()->addHours(12), function () use ($sampleKey) {
            try {
                $res = Http::withOptions(['force_ip_resolve' => 'v4', 'version' => 1.1])
                    ->connectTimeout(3)
                    ->timeout(6)
                    ->get("https://generativelanguage.googleapis.com/v1beta/models?key={$sampleKey}");

                if (!$res->successful()) {
                    return [];
                }

                $fullFlash = [];
                $liteFlash = [];
                foreach (($res->json('models') ?? []) as $m) {
                    $methods = $m['supportedGenerationMethods'] ?? [];
                    $rawName = (string) ($m['name'] ?? '');
                    if (!in_array('generateContent', $methods, true) || !str_starts_with($rawName, 'models/')) {
                        continue;
                    }

                    $short = substr($rawName, 7);
                    $lower = strtolower($short);
                    if (
                        str_contains($lower, 'gemini') &&
                        str_contains($lower, 'flash') &&
                        !str_contains($lower, '2.0') &&
                        !str_contains($lower, 'tts') &&
                        !str_contains($lower, 'image') &&
                        !str_contains($lower, 'preview') &&
                        !str_contains($lower, 'exp')
                    ) {
                        if (str_contains($lower, 'lite')) {
                            $liteFlash[] = $short;
                        } else {
                            $fullFlash[] = $short;
                        }
                    }
                }

                rsort($fullFlash, SORT_NATURAL);
                rsort($liteFlash, SORT_NATURAL);
                return [...$fullFlash, ...$liteFlash];
            } catch (\Throwable) {
                return [];
            }
        });

        $validConfigured = ($configuredModel !== '' && !str_contains($configuredModel, '2.0'))
            ? $configuredModel
            : null;

        $merged = array_values(array_unique(array_filter([
            $validConfigured,
            'gemini-2.5-flash',
            'gemini-2.5-flash',
            ...$discovered,
            'gemini-2.5-flash-lite',
        ])));

        return array_slice($merged, 0, 2);
    }

    private function prepareOptimizedImage(string $imagePath): array
    {
        $rawBinary = file_get_contents($imagePath);
        if ($rawBinary === false) {
            throw new RuntimeException('Gagal membaca file gambar untuk analisis.');
        }

        if (function_exists('imagecreatefromstring')) {
            $src = @imagecreatefromstring($rawBinary);
            if ($src !== false) {
                $w = imagesx($src);
                $h = imagesy($src);
                $maxDim = 800;

                if ($w > $maxDim || $h > $maxDim) {
                    $ratio = $maxDim / max($w, $h);
                    $newW = max(1, (int) round($w * $ratio));
                    $newH = max(1, (int) round($h * $ratio));
                    $scaled = imagescale($src, $newW, $newH, IMG_BICUBIC);
                    if ($scaled !== false) {
                        $src = $scaled;
                    }
                }

                ob_start();
                imagejpeg($src, null, 82);
                $jpegBytes = ob_get_clean();
                $src = null;

                if (is_string($jpegBytes) && strlen($jpegBytes) > 0) {
                    return [
                        'data' => base64_encode($jpegBytes),
                        'mime_type' => 'image/jpeg',
                        'bytes' => $jpegBytes,
                    ];
                }
            }
        }

        return [
            'data' => base64_encode($rawBinary),
            'mime_type' => mime_content_type($imagePath) ?: 'image/jpeg',
            'bytes' => $rawBinary,
        ];
    }

    public function canonicalScientificName(string $rawName): string
    {
        $clean = str_replace(['×', '✕'], ' ', trim($rawName));
        $clean = preg_replace('/\s*\([^)]*\)/', '', $clean);
        $clean = preg_replace('/\s+/', ' ', trim((string) $clean));

        if ($clean === '') {
            return '';
        }

        $parts = explode(' ', $clean);
        $parts[0] = ucfirst(strtolower($parts[0]));

        for ($i = 1; $i < count($parts); $i++) {
            $parts[$i] = strtolower($parts[$i]);
        }

        return implode(' ', $parts);
    }

    private function applyBotanicalGuardrails(array $parsed, array $pnCandidates): array
    {
        if (empty($parsed['detected_plants']) || !is_array($parsed['detected_plants'])) {
            return $parsed;
        }

        $topPnScore = !empty($pnCandidates) ? (int) round((float) ($pnCandidates[0]['score_percent'] ?? 0)) : null;
        $runnerUps = [];
        foreach (array_slice($pnCandidates, 1, 2) as $cand) {
            $name = trim((string) ($cand['scientific_name'] ?? ''));
            $sc = round((float) ($cand['score_percent'] ?? 0), 1);
            if ($name !== '') {
                $runnerUps[] = "{$name} ({$sc}%)";
            }
        }

        foreach ($parsed['detected_plants'] as $idx => &$plant) {
            $sci = strtolower(trim((string) ($plant['scientific_name'] ?? '')));
            $common = strtolower(trim((string) ($plant['common_name_id'] ?? '')));

            $geminiConf = (int) ($plant['confidence'] ?? 0);
            $isConf = (bool) ($plant['is_confident_species'] ?? true);
            if ($idx === 0 && $topPnScore !== null && $topPnScore >= 35) {
                $blended = (int) round(($topPnScore * 0.6) + ($geminiConf * 0.4));
                $plant['confidence'] = max(62, $topPnScore, min(95, $blended));
                $plant['is_confident_species'] = true;
            } elseif ($idx === 0 && ($topPnScore === null || $topPnScore < 35)) {
                if ($isConf && trim((string) ($plant['scientific_name'] ?? '')) !== '') {
                    $plant['confidence'] = max(60, min(85, $geminiConf));
                } else {
                    $plant['confidence'] = min(85, $geminiConf);
                }
            }

            if (
                str_starts_with($sci, 'ficus racemosa')
                || str_contains($common, 'crattock')
                || str_contains($common, 'cluster fig')
                || $common === 'loa'
                || $common === 'pohon loa'
            ) {
                $plant['common_name_id'] = 'Loa';
                $plant['scientific_name'] = 'Ficus racemosa';
                $plant['local_name'] = 'Loa, Pohon Loa, Ara, Elo';
            }

            if (
                (str_starts_with($sci, 'vitis ') || str_contains($common, 'anggur') || str_contains($common, 'grape'))
                && !str_contains($sci, 'ampelopsis')
                && !str_contains($sci, 'parthenocissus')
                && !str_contains($sci, 'menispermum')
            ) {
                $plant['is_toxic'] = false;
                $plant['common_name_id'] = 'Anggur';
                if (trim((string) ($plant['local_name'] ?? '')) === '') {
                    $plant['local_name'] = 'Anggur, Daun Anggur';
                }
                $plant['safety_warning'] = 'Daun anggur budidaya aman diolah dalam takaran wajar. Namun bentuk daunnya menyerupai tanaman rambat liar yang tidak aman dikonsumsi (seperti Menispermum/moonseed), pastikan daun berasal dari tanaman anggur budidaya yang jelas.';
            }

            $conf = (int) ($plant['confidence'] ?? 0);
            if ($topPnScore !== null && $topPnScore >= 20 && $conf < 65 && !empty($runnerUps)) {
                $altText = ' Kandidat botani pembanding Pl@ntNet: ' . implode(', ', $runnerUps) . '.';
                $desc = trim((string) ($plant['description'] ?? ''));
                if (!str_contains($desc, 'Kandidat botani pembanding')) {
                    $plant['description'] = $desc . $altText;
                }
            }
        }
        unset($plant);

        return $parsed;
    }
    private function decodeVisionJson(string $rawText): ?array
    {
        $trimmed = trim($rawText);
        if ($trimmed === '') {
            return null;
        }

        $trimmed = preg_replace('/^```(?:json)?\s*/i', '', $trimmed);$trimmed = preg_replace('/\s*```$/', '', (string) $trimmed);

        $decoded = json_decode(trim((string) $trimmed), true);
        if (!is_array($decoded)) {
            return null;
        }

        $plants = [];
        foreach (($decoded['detected_plants'] ?? []) as $item) {
            if (!is_array($item)) {
                continue;
            }

            $box = null;
            if (is_array($item['box_2d'] ?? null) && count($item['box_2d']) >= 4) {
                $box = array_map(
                    fn ($v) => max(0, min(1000, (int) $v)),
                    array_slice($item['box_2d'], 0, 4)
                );
            }

            $plant = [
                'common_name_id' => $this->sanitizeCommonName((string) ($item['common_name_id'] ?? ''), (bool) ($item['is_toxic'] ?? false)),
                'scientific_name' => trim((string) ($item['scientific_name'] ?? '')),
                'local_name' => trim((string) ($item['local_name'] ?? '')),
                'description' => trim((string) ($item['description'] ?? '')),
                'plant_parts_used' => trim((string) ($item['plant_parts_used'] ?? 'Daun')),
                'traditional_usage' => trim((string) ($item['traditional_usage'] ?? '')),
                'preparation_method' => trim((string) ($item['preparation_method'] ?? '')),
                'dosage_notes' => trim((string) ($item['dosage_notes'] ?? '')),
                'contraindications' => trim((string) ($item['contraindications'] ?? '')),
                'scientific_reference' => trim((string) ($item['scientific_reference'] ?? 'Rujukan Botani & Etnofarmakologi')),
                'lab_evidence' => isset($item['lab_evidence']) ? trim((string) $item['lab_evidence']) : null,
                'clinical_evidence' => isset($item['clinical_evidence']) ? trim((string) $item['clinical_evidence']) : null,
                'safety_warning' => trim((string) ($item['safety_warning'] ?? 'Gunakan sesuai takaran wajar dan konsultasikan dengan tenaga kesehatan bila memiliki kondisi medis tertentu.')),
                'is_toxic' => (bool) ($item['is_toxic'] ?? false),
                'is_confident_species' => (bool) ($item['is_confident_species'] ?? true),
                'confidence' => (int) ($item['confidence'] ?? 72),
                'box_2d' => $box,
            ];

            $this->normalizeSpeciesIdentity($plant);
            $plants[] = $plant;
        }

        return [
            'is_plant' => (bool) ($decoded['is_plant'] ?? false),
            'is_cooked_or_processed_food' => (bool) ($decoded['is_cooked_or_processed_food'] ?? false),
            'rejection_reason' => isset($decoded['rejection_reason']) ? trim((string) $decoded['rejection_reason']) : null,
            'detected_plants' => $plants,
        ];
    }

    private function normalizeSpeciesIdentity(array &$plant): void
    {
        $sciLower = strtolower($plant['scientific_name']);

        if (str_contains($sciLower, 'cycas revoluta')) {
            $plant['is_toxic'] = true;
            $plant['common_name_id'] = 'Pakis Haji (Beracun)';
            if ($plant['local_name'] === '' || stripos($plant['local_name'], 'pakis haji') === false) {
                $plant['local_name'] = 'Pakis Haji, Sikas';
            }
            return;
        }

        if (
            str_contains($sciLower, 'premna microphylla') ||
            str_contains($sciLower, 'premna serratifolia') ||
            str_contains($sciLower, 'premna obtusifolia')
        ) {
            $plant['common_name_id'] = 'Sancang (Buas-buas)';
            $plant['local_name'] = 'Sancang, Buas-buas, Singkil';
            return;
        }

        if (
            str_contains($sciLower, 'serissa japonica') ||
            str_contains($sciLower, 'serissa foetida')
        ) {
            $plant['common_name_id'] = 'Saeng Simbar (Seng Simbur)';
            $plant['local_name'] = 'Saeng Simbar, Seng Simbur, Serissa';
            return;
        }

        if (str_contains($sciLower, 'ficus racemosa')) {
            $plant['common_name_id'] = 'Loa';
            if ($plant['local_name'] === '' || stripos($plant['local_name'], 'loa') === false) {
                $plant['local_name'] = 'Loa, Elo';
            }
            return;
        }

        if (str_contains($sciLower, 'vitis vinifera') || str_contains($sciLower, 'vitis labrusca') || str_starts_with($sciLower, 'vitis ')) {
            $plant['is_toxic'] = false;
            $plant['common_name_id'] = 'Anggur';
            if ($plant['local_name'] === '' || stripos($plant['local_name'], 'anggur') === false) {
                $plant['local_name'] = 'Anggur, Daun Anggur';
            }
            $plant['safety_warning'] = 'Daun anggur budidaya aman diolah dalam takaran wajar, namun bentuk daunnya mirip dengan tanaman rambat liar yang tidak aman dikonsumsi (seperti Menispermum/moonseed). Pastikan daun berasal dari pohon anggur budidaya yang jelas sebelum dikonsumsi.';
        }
    }

    private function sanitizeCommonName(string $rawName, bool $isToxic): string
    {
        $hasToxicTag = $isToxic || (bool) preg_match('/\(\s*beracun\s*\)/i', $rawName);
        $clean = preg_replace('/\s*\([^)]*\)/', '', $rawName);
        $clean = preg_replace('/\s+/', ' ', trim((string) $clean));
        if ($clean === '') {
            return '';
        }
        return $hasToxicTag ? "{$clean} (Beracun)" : $clean;
    }
}
