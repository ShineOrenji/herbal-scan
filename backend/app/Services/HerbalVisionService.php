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

        $optimized = $this->prepareOptimizedImage($imagePath);
        $base64Image = $optimized['data'];
        $mimeType = $optimized['mime_type'];

        // Cache v4 untuk mereset hasil keliru sebelumnya
        $normalizedHash = hash('sha256', $base64Image);
        $cacheKey = "herbal_vision_pool_v4_{$normalizedHash}";
        $cached = Cache::get($cacheKey);
        if (is_array($cached) && !empty($cached['detected_plants'])) {
            return $cached;
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
Anda adalah ahli taksonomi botani global, agronomi, dan etnofarmakologi. Tugas Anda mengidentifikasi spesies tumbuhan apa pun di dunia (tanaman herbal, tanaman buah, sayuran, tanaman hias, maupun tumbuhan liar) secara presisi tinggi dalam kondisi dan sudut kamera apa pun. Kembalikan HANYA JSON valid.

{$knownHint}ATURAN UTAMA ANTI-BIAS & PEMBACAAN SEGALA POSISI KAMERA:
1. **Jangan Pernah Menolak Foto Tumbuhan yang Terlihat**:
   - Pengguna memotret di lapangan dengan berbagai sudut (dari atas, samping, bawah daun, miring, terbalik, close-up sebagian helai daun, atau jarak sedang).
   - Selama bagian tumbuhan (daun, batang, ranting, bunga, buah, atau rimpang) terlihat pada foto, **WAJIB** identifikasi spesies yang paling akurat secara botani (`"is_plant": true`, `"is_confident_species": true`).
   - **JANGAN** menolak foto tumbuhan dengan alasan "foto buram", "kurang fokus", atau "terlalu jauh" selama siluet, bentuk tepi, atau susunan daun masih dapat dikenali.
   - Tolak (`"is_plant": false`) HANYA jika foto sama sekali bukan tumbuhan (manusia, hewan, lantai, dinding, layar kosong) atau merupakan makanan/masakan matang (`"is_cooked_or_processed_food": true`).
2. **Kunci Determinasi Botani Wajib (Isi `botanical_key_check` Sebelum Menentukan Nama)**:
   - **Bentuk & Lekukan Tepi Daun (`leaf_lobes_and_margin`)**: Periksa dengan teliti apakah helai daun **berlekuk menjari / bercuping** (*palmately lobed* seperti Daun Anggur, Pepaya, Singkong, Jarak Pagar, Jarak Kepyar, Pare) atau **utuh tanpa lekukan** (*unlobed* seperti Binahong, Sirih, Salam, Alpukat, Mangga). Periksa tepi daun: **bergerigi kasar/tajam** (*coarsely serrate/dentate*), **bergerigi halus**, **beringgit** (*crenate*), atau **rata mulus** (*entire*).
   - **Pola Pertulangan & Tekstur (`venation_and_surface`)**: Tulang daun **menjari dari pangkal** (*palmate* seperti Anggur/Jarak), **melengkung tegas dari pangkal ke ujung** (*campylodromous* seperti Sirih), **menyirip** (*pinnate*), atau **sejajar** (*parallel*). Tekstur: tipis seperti kertas, kaku mengilap, berbulu halus/kasar, atau tebal berdaging/sukulen.
   - **Pembeda Spesies Mirip di Dunia (`lookalike_differentiation`)**: Bandingkan dengan spesies yang sekilas mirip agar tidak tertukar:
     * **Daun Anggur (*Vitis vinifera*) vs Binahong (*Anredera cordifolia*) vs Daun Sirih (*Piper betle*)**:
       - *Daun Anggur*: Berbentuk jantung-membulat dengan **3–5 lekukan cuping menjari yang jelas**, **tepi bergerigi kasar tidak beraturan**, pertulangan menjari menonjol, helai tipis-kasar tidak sukulen.
       - *Binahong*: Tepi daun **rata mulus 100% tanpa gerigi dan tanpa lekukan cuping**, helai **tebal berdaging/sukulen**, permukaan licin mengilap, tulang daun samar.
       - *Daun Sirih Hijau*: Tepi **rata mulus tanpa lekukan/gerigi**, helai **tipis-kaku (tidak sukulen)** dengan **5–7 tulang daun melengkung tajam beralur dalam**.
     * **Daun Mint (*Mentha spicata* / *Mentha piperita*) vs Kemangi (*Ocimum × africanum*) vs Daun Jinten (*Plectranthus amboinicus*)**:
       - *Mint*: Permukaan berkerut tegas (*rugose*), tepi bergerigi tajam teratur, tangkai sangat pendek.
       - *Kemangi*: Helai tipis rata/halus, tepi rata hingga bergelombang halus, ujung meruncing, tangkai ramping panjang.
       - *Daun Jinten*: Helai tebal berdaging, berbulu beludru rapat, tepi beringgit tumpul.
     * **Daun Pepaya (*Carica papaya*) vs Daun Singkong (*Manihot esculenta*) vs Jarak Kepyar (*Ricinus communis*)**:
       - *Pepaya*: Daun tunggal sangat besar berlekuk menjari dalam dengan cuping-cuping bercabang tidak beraturan, tangkai berongga panjang.
       - *Singkong*: Daun menjari dengan 5–9 anak daun ramping memanjang bertepi rata.
       - *Jarak Kepyar*: Daun menjari berbentuk bintang (7–11 cuping) dengan tepi bergerigi tajam teratur dan tangkai menempel agak ke tengah helai (*peltate*).
     * **Kunyit (*Curcuma longa*) vs Temulawak (*Curcuma zanthorrhiza*) vs Jahe (*Zingiber officinale*) vs Lengkuas (*Alpinia galanga*) vs Kencur (*Kaempferia galanga*)**:
       - Bedakan dari warna & serat rimpang atau susunan serta bentuk daunnya.
3. **Tanaman Beracun (WAJIB `is_toxic`: true & akhiran `" (Beracun)"` pada `common_name_id`)**:
   - Meskipun memiliki khasiat tradisional, jika tanaman mengandung racun berbahaya bagi manusia/hewan (seperti *Pokeweed* / *Phytolacca americana*, *Saga Rambat* / *Abrus precatorius*, *Kecubung* / *Datura metel*, *Bunga Terompet* / *Brugmansia*, *Jarak Pagar* / *Jatropha curcas*, *Jarak Kepyar* / *Ricinus communis*, *Bintaro* / *Cerbera manghas*, *Gadung* / *Dioscorea hispida*, *Patah Tulang* / *Euphorbia tirucalli*, *Tapak Dara* / *Catharanthus roseus*, *Tembelekan* / *Lantana camara*, *Dieffenbachia*, *Oleander* / *Nerium oleander*), wajib tetapkan `"is_toxic": true` dan tambahkan `" (Beracun)"` di akhir `common_name_id`.

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
      "lab_evidence": "string",
      "clinical_evidence": "string",
      "safety_warning": "string",
      "is_toxic": false,
      "is_confident_species": true,
      "confidence": 94,
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
                        ->timeout(22)
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

        $listCacheKey = 'gemini_pool_models_v4_' . substr(md5($sampleKey), 0, 10);
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
                imagejpeg($src, null, 90);
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
                'common_name_id' => $this->sanitizeCommonName((string) ($item['common_name_id'] ?? ''), (bool) ($item['is_toxic'] ?? false)),
                'scientific_name' => trim((string) ($item['scientific_name'] ?? '')),
                'local_name' => trim((string) ($item['local_name'] ?? '')),
                'description' => trim((string) ($item['description'] ?? '')),
                'plant_parts_used' => trim((string) ($item['plant_parts_used'] ?? 'Daun')),
                'traditional_usage' => trim((string) ($item['traditional_usage'] ?? '')),
                'lab_evidence' => isset($item['lab_evidence']) ? trim((string) $item['lab_evidence']) : null,
                'clinical_evidence' => isset($item['clinical_evidence']) ? trim((string) $item['clinical_evidence']) : null,
                'safety_warning' => trim((string) ($item['safety_warning'] ?? 'Gunakan sesuai takaran wajar dan konsultasikan dengan tenaga kesehatan bila memiliki kondisi medis tertentu.')),
                'is_toxic' => (bool) ($item['is_toxic'] ?? false),
                'is_confident_species' => (bool) ($item['is_confident_species'] ?? true),
                'confidence' => (int) ($item['confidence'] ?? 85),
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
