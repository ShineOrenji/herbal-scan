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
            throw new RuntimeException('GEMINI_API_KEYS atau GEMINI_API_KEY belum diisi pada file backend/.env.');
        }

        // Optimasi gambar ke 768px agar upload cepat (~90KB) namun detail urat & tepi daun tetap tajam
        $optimized = $this->prepareOptimizedImage($imagePath);
        $base64Image = $optimized['data'];
        $mimeType = $optimized['mime_type'];

        // Cache deterministik berbasis konten gambar terkompresi (instan <0.05 dtk & hemat kuota)
        $normalizedHash = hash('sha256', $base64Image);
        $cacheKey = "herbal_vision_pool_v1_{$normalizedHash}";
        $cached = Cache::get($cacheKey);
        if (is_array($cached) && !empty($cached['detected_plants'])) {
            return $cached;
        }

        $knownHint = '';
        if (!empty($knownSpecies)) {
            $pairs = array_map(
                fn ($item) => "{$item['name']} ({$item['scientific_name']})",
                array_slice($knownSpecies, 0, 50)
            );
            $knownHint = "Daftar spesies referensi di database HerbalScan (gunakan nama Indonesia & ilmiah yang sama jika spesimen cocok): " . implode(', ', $pairs) . ".\n\n";
        }

        $prompt = <<<PROMPT
Anda adalah ahli taksonomi botani, agronomi, dan etnofarmakologi Indonesia. Analisis foto spesimen tumbuhan ini secara teliti, objektif, dan deterministik. Kembalikan HANYA JSON valid.

{$knownHint}ATURAN AKURASI MORFOLOGI & TOLERANSI KAMERA LAPANGAN:
1. **Toleransi Kondisi Lapangan**:
   - Pengguna memotret di kebun, pekarangan, atau pasar menggunakan kamera ponsel standar.
   - Jangan menolak foto tumbuhan hanya karena tangkai tidak terlihat penuh atau sudut foto miring. Selama bentuk daun, rimpang, bunga, atau batang masih terlihat, identifikasi spesies yang paling tepat secara botani (`is_plant`: true, `is_confident_species`: true).
   - Tolak (`is_plant`: false) HANYA jika objek bukan tumbuhan (manusia, hewan, benda mati) atau merupakan makanan/masakan matang (`is_cooked_or_processed_food`: true).
2. **Wajib Bedakan Spesies Indonesia yang Bentuknya Mirip**:
   - **Daun Mint (*Mentha spicata* / *Mentha piperita*) vs Daun Kemangi (*Ocimum × africanum*) vs Daun Jinten (*Plectranthus amboinicus*)**:
     * *Mint*: Permukaan helai daun berkerut tegas (*rugose*) mengikuti alur tulang daun, tepi bergerigi tajam teratur (*serrate*), tangkai sangat pendek.
     * *Kemangi*: Helai daun tipis, permukaan relatif rata/halus (tidak berkerut dalam), tepi rata hingga bergelombang halus, ujung meruncing, tangkai panjang ramping.
     * *Daun Jinten / Bangun-bangun*: Helai daun tebal berdaging (*succulent*), berbulu beludru rapat, tepi beringgit tumpul.
   - **Kunyit (*Curcuma longa*) vs Temulawak (*Curcuma zanthorrhiza*) vs Jahe (*Zingiber officinale*) vs Lengkuas (*Alpinia galanga*)**:
     * Periksa warna daging/kulit rimpang (jingga pekat pada kunyit, kuning pucat beraroma tajam dengan ukuran rimpang besar pada temulawak, krem-kuning pucat berserat pada jahe, putih-kemerahan berserat keras pada lengkuas) atau lebar serta tulang tengah helai daun.
   - **Daun Sirih (*Piper betle*) vs Binahong (*Anredera cordifolia*)**:
     * *Sirih*: Daun berbentuk jantung dengan pertulangan melengkung tegas dari pangkal ke ujung (*campylodromous*), helai agak kaku/berurat jelas.
     * *Binahong*: Daun berbentuk jantung dengan helai tebal berdaging (*succulent*), permukaan licin mengilap, tulang daun melengkung samar.
   - **Seledri (*Apium graveolens*) vs Daun Ketumbar (*Coriandrum sativum*)**:
     * *Seledri*: Anak daun lebih kaku, mengilap, berlekuk tajam, tangkai beralur tegas.
     * *Ketumbar*: Anak daun bagian atas lebih halus/berbagi menyirip sempit, tekstur lebih lembut.
   - **Tanaman Beracun yang Mirip Herbal/Sayur**:
     * Identifikasi secara ketat tanaman toksik seperti Kecubung (*Datura metel*), Jarak Pagar (*Jatropha curcas*), Jarak Kepyar (*Ricinus communis*), Bunga Terompet (*Brugmansia*), atau Gadung (*Dioscorea hispida*) dan wajib tandai `is_toxic`: true.
3. **Tumbuhan Obat Liar & Etnobotani Nusantara**:
   - Kenali herbal liar Indonesia seperti Alang-alang (*Imperata cylindrica*), Kirinyuh (*Chromolaena odorata*), Meniran (*Phyllanthus niruri*), Bandotan (*Ageratum conyzoides*), Patikan Kebo (*Euphorbia hirta*), Pegagan (*Centella asiatica*), Tempuyung (*Sonchus arvensis*), Sembung (*Blumea balsamifera*), Pecut Kuda (*Stachytarpheta jamaicensis*), Ciplukan (*Physalis angulata*), Sambiloto (*Andrographis paniculata*), Kumis Kucing (*Orthosiphon aristatus*), sambil memprioritaskan bukti morfologi aktual pada gambar.

Aturan Output JSON:
- `common_name_id`: Nama umum populer Bahasa Indonesia (contoh: "Daun Mint", "Daun Kemangi", "Temulawak", "Daun Sirih"). Tambahkan " (Beracun)" di akhir jika beracun (contoh: "Kecubung (Beracun)").
- `scientific_name`: Nama ilmiah binomial/trinomial standar.
- `local_name`: Sinonim nama daerah di Indonesia dipisahkan koma (Sunda, Jawa, Melayu, dll.).
- `description`: Deskripsi morfologi botani ringkas & akurat dalam Bahasa Indonesia (2-3 kalimat).
- `plant_parts_used`: Bagian yang dimanfaatkan (contoh: "Daun", "Rimpang", atau "Tidak untuk dikonsumsi (Beracun)").
- `traditional_usage`: Pemanfaatan tradisional/empiris di Indonesia dalam Bahasa Indonesia.
- `lab_evidence`: Ringkasan kandungan senyawa aktif/fitokimia & uji laboratorium (in vitro/in vivo).
- `clinical_evidence`: Ringkasan bukti klinis pada manusia jika ada (atau null jika belum memadai).
- `safety_warning`: Peringatan keamanan, efek samping, dan kontraindikasi.
- `is_toxic`: boolean.
- `is_confident_species`: boolean.
- `confidence`: integer 0-100 tingkat keyakinan identifikasi.
- `box_2d`: koordinat bounding box `[ymin, xmin, ymax, xmax]` integer 0-1000.

Kembalikan persis struktur JSON berikut:
{
  "is_plant": true,
  "is_cooked_or_processed_food": false,
  "rejection_reason": null,
  "detected_plants": [
    {
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

        // Rotasi otomatis Round-Robin antar 5 API key
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

        // Failover instan antar key tanpa jeda sleep jika salah satu key limit (429) atau sibuk (503)
        foreach ($rotatedKeys as $keyIdx => $currentKey) {
            foreach ($models as $model) {
                try {
                    $endpoint = "https://generativelanguage.googleapis.com/v1beta/models/{$model}:generateContent?key={$currentKey}";

                    $response = Http::withOptions([
                        'force_ip_resolve' => 'v4',
                        'version' => 1.1,
                    ])
                        ->connectTimeout(6)
                        ->timeout(16)
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

                    // Key mati/invalid atau limit 429 -> langsung pindah ke Key berikutnya!
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

        $listCacheKey = 'gemini_pool_models_' . substr(md5($sampleKey), 0, 10);
        $discovered = Cache::remember($listCacheKey, now()->addHours(12), function () use ($sampleKey) {
            try {
                $res = Http::withOptions(['force_ip_resolve' => 'v4', 'version' => 1.1])
                    ->connectTimeout(5)
                    ->timeout(6)
                    ->get("https://generativelanguage.googleapis.com/v1beta/models?key={$sampleKey}");

                if (!$res->successful()) {
                    return [];
                }

                $models = [];
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
                        !str_contains($lower, '2.5') &&
                        !str_contains($lower, '2.0') &&
                        !str_contains($lower, 'tts') &&
                        !str_contains($lower, 'image')
                    ) {
                        $models[] = $short;
                    }
                }

                rsort($models, SORT_NATURAL);
                return $models;
            } catch (\Throwable) {
                return [];
            }
        });

        $validConfigured = ($configuredModel !== '' && !str_contains($configuredModel, '2.5') && !str_contains($configuredModel, '2.0'))
            ? $configuredModel
            : null;

        $merged = array_values(array_unique(array_filter([
            $validConfigured,
            'gemini-3.5-flash-lite',
            'gemini-3.5-flash',
            'gemini-3.1-flash-lite',
            ...$discovered,
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
                $maxDim = 768;

                if ($w > $maxDim || $h > $maxDim) {
                    $ratio = $maxDim / max($w, $h);
                    $newW = max(1, (int) round($w * $ratio));
                    $newH = max(1, (int) round($h * $ratio));
                    $scaled = imagescale($src, $newW, $newH, IMG_BILINEAR_FIXED);
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