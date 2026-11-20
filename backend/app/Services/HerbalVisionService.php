<?php

namespace App\Services;

use Illuminate\Http\Client\ConnectionException;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Log;
use RuntimeException;

class HerbalVisionService
{
    public function identifyPlant(string $imagePath, array $knownSpecies = []): array
    {
        if (!file_exists($imagePath)) {
            throw new RuntimeException('File gambar tidak ditemukan di server.');
        }

        $apiKeys = $this->resolveApiKeys();
        if (empty($apiKeys)) {
            throw new RuntimeException('GEMINI_API_KEYS atau GEMINI_API_KEY belum diisi pada environment.');
        }

        // Resolusi 1024px kualitas 88 menjaga ketajaman urat daun, ketebalan sukulen, dan trikoma
        $optimized = $this->prepareOptimizedImage($imagePath);
        $base64Image = $optimized['data'];
        $mimeType = $optimized['mime_type'];

        // Cache v2 agar hasil lama yang keliru tidak terpakai ulang
        $normalizedHash = hash('sha256', $base64Image);
        $cacheKey = "herbal_vision_pool_v2_{$normalizedHash}";
        $cached = Cache::get($cacheKey);
        if (is_array($cached) && !empty($cached['detected_plants'])) {
            return $cached;
        }

        $knownHint = '';
        if (!empty($knownSpecies)) {
            $pairs = array_map(
                fn ($item) => "{$item['name']} ({$item['scientific_name']})",
                array_slice($knownSpecies, 0, 60)
            );
            $knownHint = "Daftar spesies referensi di database HerbalScan (gunakan nama Indonesia & ilmiah yang sama JIKA ciri morfologi fisik pada foto benar-benar cocok): " . implode(', ', $pairs) . ".\n\n";
        }

        $prompt = <<<PROMPT
Anda adalah ahli taksonomi botani lapangan, agronomi, dan etnofarmakologi Indonesia. Tugas Anda mengidentifikasi spesimen tumbuhan pada foto secara presisi tinggi dalam kondisi kamera apa pun (close-up satu helai daun, ranting, tanaman utuh di pot/kebun, sudut miring, pencahayaan redup/silau, atau daun basah). Kembalikan HANYA JSON valid.

{$knownHint}LANGKAH WAJIB SEBELUM MENENTUKAN NAMA SPESIES:
Isi kolom `morphological_analysis` terlebih dahulu dengan mengamati bukti visual nyata pada foto:
1. **Ketebalan & Tekstur Helai Daun**: Apakah tebal berdaging/berair/sukulen (*succulent*), tipis lunak (*herbaceous*), kaku seperti kertas/kulit (*coriaceous*), mengilap (*glossy*), berbulu halus/kasar (*pubescent/hispid*), atau berkerut (*rugose*)?
2. **Pola Pertulangan Daun (Venation)**: Apakah tulang daun melengkung tegas dari pangkal ke ujung (*campylodromous*), menyirip jelas (*pinnate*), menjari (*palmate*), sejajar (*parallel*), atau tulang daun samar tenggelam dalam daging daun?
3. **Bentuk, Tepi, Pangkal & Tangkai**: Bentuk helai (jantung/cordate, bulat telur/ovate, lanset, menjari, majemuk menyirip), tepi daun (rata/entire, bergerigi/serrate, beringgit/crenate, berlekuk), serta warna/bentuk batang, ruas, sulur, umbi udara, bunga, atau rimpang jika terlihat.
4. **Kompensasi Sudut & Pencahayaan Kamera**: Jangan tertipu kilau cahaya matahari atau bayangan. Jika hanya tampak satu daun dari dekat atau dari samping, fokus pada rasio panjang-lebar helai, lekukan pangkal daun, pola urat, dan ketebalan tepi daun.

ATURAN PEMBEDA SPESIES MIRIP DI INDONESIA (WAJIB DIPATUHI):
- **Binahong (*Anredera cordifolia*) vs Daun Sirih Hijau (*Piper betle*) vs Sirih Cina/Ketumpang Air (*Peperomia pellucida*)**:
  - *Binahong*: Daun berbentuk jantung (*cordate*) dengan helai **TEBAL BERDAGING (sukulen/empuk)**, permukaan licin mengilap, tulang daun melengkung **samar/tidak menonjol tajam**, tangkai daun pendek-sedang agak berdaging/kemerahan, batang merambat lunak/berdaging (sering ada umbi udara/bulbil di ketiak).
  - *Daun Sirih Hijau*: Daun berbentuk jantung/bulat telur meruncing dengan helai **TIPIS-KAKU (tidak sukulen)**, memiliki **5–7 tulang daun utama melengkung tajam dan beralur jelas** dari pangkal hingga ujung daun, batang berkayu dengan buku/ruas membengkak.
  - *Sirih Cina / Ketumpang Air*: Ukuran daun jauh lebih kecil (1–3 cm), sangat tipis transparan/berair, batang tegak lunak bening kehijauan, tumbuh berkelompok di tempat lembap.
- **Daun Mint (*Mentha spicata* / *Mentha piperita*) vs Kemangi (*Ocimum × africanum*) vs Daun Jinten/Bangun-bangun (*Plectranthus amboinicus*)**:
  - *Mint*: Permukaan berkerut tegas (*rugose*) mengikuti alur urat, tepi bergerigi tajam teratur, tangkai sangat pendek.
  - *Kemangi*: Helai tipis rata/halus, tepi rata hingga bergelombang halus, ujung meruncing, tangkai ramping panjang.
  - *Daun Jinten*: Helai sangat tebal berdaging, berbulu beludru rapat, tepi beringgit tumpul.
- **Pegagan (*Centella asiatica*) vs Semanggi (*Marsilea crenata*)**:
  - *Pegagan*: Daun tunggal berbentuk ginjal/kipas membulat dengan tepi beringgit tumpul dan tulang daun menjari dari pangkal tangkai.
  - *Semanggi*: Daun majemuk beranak daun 4 helai menyerupai semanggi simetris.
- **Sambiloto (*Andrographis paniculata*) vs Meniran (*Phyllanthus niruri*) vs Daun Katuk (*Sauropus androgynus*)**:
  - *Sambiloto*: Daun tunggal berhadapan berbentuk lanset meruncing, batang segi empat, rasa sangat pahit.
  - *Meniran*: Daun majemuk menyirip kecil-kecil oval berderet rapi dengan deretan buah/bunga bulat kecil menggantung di bawah tangkai daun.
  - *Katuk*: Daun majemuk berseling, helai bulat telur dengan bercak keperakan samar di tengah daun, tangkai kemerahan.
- **Rimpang & Tanaman Temu-temuan**:
  - Bedakan *Kunyit* (*Curcuma longa*, daging jingga pekat), *Temulawak* (*Curcuma zanthorrhiza*, rimpang besar kuning pucat-jingga lembut), *Jahe* (*Zingiber officinale*, rimpang bercabang krem-kuning berserat), *Lengkuas* (*Alpinia galanga*, rimpang putih-kemerahan berserat keras beruas jelas), dan *Kencur* (*Kaempferia galanga*, rimpang kecil aromatik dengan 2–4 helai daun bulat lebar tumbuh mendatar di atas tanah).
- **Herbal Populer & Liar Nusantara Lainnya**:
  - Kenali secara akurat *Daun Kelor* (*Moringa oleifera*), *Daun Salam* (*Syzygium polyanthum*), *Kumis Kucing* (*Orthosiphon aristatus*), *Keji Beling* (*Strobilanthes crispus*), *Tempuyung* (*Sonchus arvensis*), *Alang-alang* (*Imperata cylindrica*), *Kirinyuh* (*Chromolaena odorata*), *Bandotan* (*Ageratum conyzoides*), *Patikan Kebo* (*Euphorbia hirta*), *Ciplukan* (*Physalis angulata*), *Sembung* (*Blumea balsamifera*), *Pecut Kuda* (*Stachytarpheta jamaicensis*), *Brotowali* (*Tinospora crispa*), *Lidah Buaya* (*Aloe vera*), dan *Mahkota Dewa* (*Phaleria macrocarpa*).
- **Tanaman Beracun (WAJIB `is_toxic`: true & akhiran `" (Beracun)"` pada `common_name_id`)**:
  - Meskipun suatu tanaman memiliki pemanfaatan tradisional, JIKA tanaman tersebut mengandung senyawa toksik berbahaya bagi manusia/hewan (seperti *Pokeweed* / *Phytolacca americana*, *Saga Rambat* / *Abrus precatorius*, *Kecubung* / *Datura metel*, *Bunga Terompet* / *Brugmansia*, *Jarak Pagar* / *Jatropha curcas*, *Jarak Kepyar* / *Ricinus communis*, *Bintaro* / *Cerbera manghas*, *Gadung* / *Dioscorea hispida*, *Patah Tulang* / *Euphorbia tirucalli*, *Tapak Dara* / *Catharanthus roseus*, *Tembelekan* / *Lantana camara*, *Dieffenbachia*, dan *Oleander* / *Nerium oleander*), Anda WAJIB menetapkan `"is_toxic": true` dan menambahkan `" (Beracun)"` pada `common_name_id`.

ATURAN TOLERANSI FOTO:
- Jangan menolak foto tumbuhan hanya karena diambil dari jarak dekat (macro), sudut miring, atau sebagian daun terpotong bingkai. Selama bagian tumbuhan terlihat, identifikasi spesies paling akurat (`is_plant`: true, `is_confident_species`: true).
- Tolak (`is_plant`: false) HANYA jika foto bukan tumbuhan (manusia, hewan, benda mati) atau makanan/masakan matang (`is_cooked_or_processed_food`: true).

Kembalikan persis struktur JSON berikut:
{
  "is_plant": true,
  "is_cooked_or_processed_food": false,
  "rejection_reason": null,
  "detected_plants": [
    {
      "morphological_analysis": "Ringkasan ciri visual: bentuk helai, ketebalan/sukulensi, pola urat daun, tepi, dan alasan pembeda dari spesies yang mirip.",
      "common_name_id": "string",
      "scientific_name": "string",
      "local_name": "string",
      "description": "string",
      "plant_parts_used": "string",
      "traditional_usage": "string",
      "lab_evidence": "string",
      "clinical_evidence": "string",
      "safety_warning": "string",
      "is_toxic": false,
      "is_confident_species": true,
      "confidence": 95,
      "box_2d": [100, 100, 900, 900]
    }
  ]
}
PROMPT;

        $totalKeys = count($apiKeys);
        $startIndex = ((int) Cache::increment('herbal_gemini_key_rr')) % $totalKeys;
        $rotatedKeys = array_merge(
            array_slice($apiKeys, $startIndex),
            array_slice($apiKeys, 0, $startIndex)
        );

        $models = $this->resolveActiveModels($rotatedKeys[0]);
        $lastStatus = 0;
        $lastApiMessage = 'Layanan analisis sedang sibuk.';

        $payload = [
            'contents' => [
                [
                    'parts' => [
                        ['text' => $prompt],
                        [
                            'inline_data' => [
                                'mime_type' => $mimeType,
                                'data' => $base64Image,
                            ],
                        ],
                    ],
                ],
            ],
            'generationConfig' => [
                'temperature' => 0.0,
                'topK' => 1,
                'topP' => 0.1,
                'responseMimeType' => 'application/json',
            ],
        ];

        foreach ($rotatedKeys as $keyIdx => $currentKey) {
            foreach ($models as $model) {
                try {
                    $endpoint = "https://generativelanguage.googleapis.com/v1beta/models/{$model}:generateContent?key={$currentKey}";

                    $response = Http::withOptions([
                        'force_ip_resolve' => 'v4',
                        'version' => 1.1,
                    ])
                        ->connectTimeout(6)
                        ->timeout(20)
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

                    if (in_array($lastStatus, [400, 401, 403, 429], true)) {
                        break;
                    }
                } catch (ConnectionException $e) {
                    $lastStatus = 0;
                    $lastApiMessage = 'Koneksi internet server ke layanan analisis terputus sesaat.';
                    Log::warning("Koneksi Key#" . ($keyIdx + 1) . " [{$model}] terputus: " . $e->getMessage());
                    break;
                } catch (\Throwable $e) {
                    $lastApiMessage = $e->getMessage();
                    Log::warning("Error Key#" . ($keyIdx + 1) . " [{$model}]: " . $e->getMessage());
                }
            }
        }

        if (in_array($lastStatus, [429, 503], true)) {
            throw new RuntimeException('Seluruh jalur analisis sedang padat sesaat. Silakan tekan Identifikasi Spesimen kembali.');
        }

        throw new RuntimeException("Gagal menganalisis spesimen ({$lastStatus}): {$lastApiMessage}");
    }

    private function resolveApiKeys(): array
    {
        $multiRaw = (string) env('GEMINI_API_KEYS', '');
        $singleRaw = (string) (env('GEMINI_API_KEY') ?: config('services.gemini.key') ?: env('GOOGLE_API_KEY', ''));

        $combined = $multiRaw !== '' ? ($multiRaw . ',' . $singleRaw) : $singleRaw;
        $keys = array_map('trim', explode(',', $combined));

        return array_values(array_unique(array_filter($keys, fn ($k) => $k !== '')));
    }

    private function resolveActiveModels(string $sampleKey): array
    {
        $configuredModel = trim((string) (env('GEMINI_MODEL') ?: config('services.gemini.model', '')));

        $listCacheKey = 'gemini_pool_models_v2_' . substr(md5($sampleKey), 0, 10);
        $discovered = Cache::remember($listCacheKey, now()->addHours(12), function () use ($sampleKey) {
            try {
                $res = Http::withOptions(['force_ip_resolve' => 'v4', 'version' => 1.1])
                    ->connectTimeout(5)
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
                        !str_contains($lower, 'image')
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

        // Prioritaskan model Flash penuh (lebih tajam membaca tekstur & urat daun) sebelum Flash-Lite
        $merged = array_values(array_unique(array_filter([
            $validConfigured,
            'gemini-3.5-flash',
            'gemini-2.5-flash',
            ...$discovered,
            'gemini-3.5-flash-lite',
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
                $maxDim = 1024;

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
                imagejpeg($src, null, 88);
                $jpegBytes = ob_get_clean();
                $src = null;

                if (is_string($jpegBytes) && strlen($jpegBytes) > 0) {
                    return [
                        'data' => base64_encode($jpegBytes),
                        'mime_type' => 'image/jpeg',
                    ];
                }
            }
        }

        return [
            'data' => base64_encode($rawBinary),
            'mime_type' => mime_content_type($imagePath) ?: 'image/jpeg',
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

            $plants[] = [
                'common_name_id' => trim((string) ($item['common_name_id'] ?? '')),
                'scientific_name' => trim((string) ($item['scientific_name'] ?? '')),
                'local_name' => trim((string) ($item['local_name'] ?? '')),
                'description' => trim((string) ($item['description'] ?? '')),
                'plant_parts_used' => trim((string) ($item['plant_parts_used'] ?? 'Daun')),
                'traditional_usage' => trim((string) ($item['traditional_usage'] ?? '')),
                'lab_evidence' => isset($item['lab_evidence']) ? trim((string) $item['lab_evidence']) : null,
                'clinical_evidence' => isset($item['clinical_evidence']) ? trim((string) $item['clinical_evidence']) : null,
                'safety_warning' => trim((string) ($item['safety_warning'] ?? 'Gunakan sesuai takaran wajar dan konsultasikan dengan tenaga kesehatan bila memiliki kondisi medis tertentu.')),
                'is_toxic' => (bool) ($item['is_toxic'] ?? false),
                'is_confident_species' => (bool) ($item['is_confident_species'] ?? false),
                'confidence' => (int) ($item['confidence'] ?? 0),
                'box_2d' => $box,
            ];
        }

        return [
            'is_plant' => (bool) ($decoded['is_plant'] ?? false),
            'is_cooked_or_processed_food' => (bool) ($decoded['is_cooked_or_processed_food'] ?? false),
            'rejection_reason' => isset($decoded['rejection_reason']) ? trim((string) $decoded['rejection_reason']) : null,
            'detected_plants' => $plants,
        ];
    }
}
