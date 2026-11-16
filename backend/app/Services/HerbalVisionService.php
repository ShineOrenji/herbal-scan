<?php

namespace App\Services;

use Illuminate\Http\Client\ConnectionException;
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

        $apiKey = config('services.gemini.key') ?: env('GEMINI_API_KEY') ?: env('GOOGLE_API_KEY');
        if (empty($apiKey)) {
            throw new RuntimeException('GEMINI_API_KEY belum dikonfigurasi pada file .env backend.');
        }

        $imageBinary = file_get_contents($imagePath);
        if ($imageBinary === false) {
            throw new RuntimeException('Gagal membaca file gambar untuk analisis.');
        }

        $base64Image = base64_encode($imageBinary);
        $mimeType = mime_content_type($imagePath) ?: 'image/jpeg';

        $knownHint = '';
        if (!empty($knownSpecies)) {
            $pairs = array_map(
                fn ($item) => "{$item['name']} ({$item['scientific_name']})",
                array_slice($knownSpecies, 0, 40)
            );
            $knownHint = "Daftar spesies referensi yang sudah ada di database (gunakan nama & penulisan ilmiah yang konsisten jika cocok): " . implode(', ', $pairs) . ".\n\n";
        }

        $prompt = <<<PROMPT
Anda adalah ahli taksonomi botani dan etnofarmakologi Indonesia. Analisis foto spesimen tumbuhan ini secara teliti dan kembalikan HANYA JSON valid.

{$knownHint}Aturan Identifikasi Wajib:
1. Tentukan apakah foto menampilkan tumbuhan segar/mentah (`is_plant`: true/false).
2. PENTING — Tumbuhan Obat Liar & Rerumputan Etnobotani Indonesia:
   - JANGAN menolak tanaman liar, gulma kebun, atau famili Poaceae/rumput-rumputan yang dikenal dalam pengobatan tradisional Indonesia/daerah (Sunda, Jawa, Melayu, dll.), seperti:
     * Alang-alang / Eurih (*Imperata cylindrica* — helai daun pipih panjang, tepi tajam/kasar, tulang tengah pucat, akar/rimpang obat penurun panas & diuretik)
     * Kirinyuh / Tekelan (*Chromolaena odorata* — daun segitiga/oval bergerigi kasar, aroma khas saat diremas, obat luka & antiseptik)
     * Meniran (*Phyllanthus niruri*), Bandotan / Babadotan (*Ageratum conyzoides*), Patikan Kebo (*Euphorbia hirta*), Pegagan / Antanan (*Centella asiatica*), Tempuyung (*Sonchus arvensis*), Rumput Mutiara (*Oldenlandia corymbosa*), Sembung (*Blumea balsamifera*), Pecut Kuda (*Stachytarpheta jamaicensis*), Ciplukan (*Physalis angulata*).
   - Hanya tolak (`is_plant`: false) jika foto benar-benar bukan tumbuhan (manusia, hewan, benda mati), makanan/masakan matang (`is_cooked_or_processed_food`: true), atau rumput lapangan/halaman terpotong acak yang tidak memiliki ciri morfologi spesies yang dapat diidentifikasi.
3. Jika foto menampilkan 1 hingga maksimal 5 spesies tumbuhan segar yang berbeda, identifikasi masing-masing spesies secara akurat dalam array `detected_plants`.
4. Untuk setiap spesies yang terdeteksi:
   - `common_name_id`: Nama umum populer dalam Bahasa Indonesia (contoh: "Alang-alang", "Kirinyuh", "Daun Sirih", "Kunyit"). WAJIB tambahkan akhiran " (Beracun)" jika tanaman tersebut beracun (contoh: "Kecubung (Beracun)", "Jarak Pagar (Beracun)", "Oleander (Beracun)").
   - `scientific_name`: Nama ilmiah binomial/trinomial standar (contoh: "Imperata cylindrica", "Chromolaena odorata", "Piper betle").
   - `local_name`: Sinonim nama daerah di Indonesia dipisahkan koma (sertakan nama Sunda/Jawa/lokal yang relevan, misalnya "Eurih, Ilalang, Lalang" untuk Alang-alang atau "Babadotan" untuk Bandotan).
   - `description`: Deskripsi morfologi botani ringkas & akurat dalam Bahasa Indonesia (2-3 kalimat mencakup bentuk helai daun, tepi, pertulangan, atau batang).
   - `plant_parts_used`: Bagian yang dimanfaatkan (contoh: "Akar dan Rimpang", "Daun", "Seluruh Bagian Tanaman", atau "Tidak untuk dikonsumsi (Beracun)").
   - `traditional_usage`: Pemanfaatan tradisional/empiris di Indonesia dalam Bahasa Indonesia. Jika beracun, jelaskan bahayanya dan tegaskan larangan konsumsi.
   - `lab_evidence`: Ringkasan kandungan senyawa aktif/fitokimia & temuan uji laboratorium (in vitro/in vivo).
   - `clinical_evidence`: Ringkasan bukti klinis pada manusia jika ada (atau null jika belum ada uji klinis memadai).
   - `safety_warning`: Peringatan keamanan, efek samping, dan kontraindikasi dalam Bahasa Indonesia.
   - `is_toxic`: boolean (true jika beracun/toksik, false jika aman sebagai herbal/sayur).
   - `is_confident_species`: boolean (true jika ciri daun/batang/bunga cukup jelas untuk mengenali spesiesnya).
   - `confidence`: integer 0-100 tingkat keyakinan identifikasi.
   - `box_2d`: koordinat bounding box `[ymin, xmin, ymax, xmax]` skala integer 0 sampai 1000 yang melingkupi tanaman tersebut pada foto.

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
      "confidence": 92,
      "box_2d": [100, 100, 900, 900]
    }
  ]
}
PROMPT;

        $configuredModel = trim((string) (config('services.gemini.model') ?: env('GEMINI_VISION_MODEL', '')));
        $rawCandidates = [
            ($configuredModel !== '' && !str_contains($configuredModel, '2.0-flash')) ? $configuredModel : null,
            'gemini-2.5-flash',
            'gemini-flash-latest',
            'gemini-flash-lite-latest',
            'gemini-2.5-flash-lite',
        ];
        $candidateModels = array_values(array_unique(array_filter($rawCandidates)));

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
                'temperature' => 0.15,
                'responseMimeType' => 'application/json',
            ],
        ];

        $lastError = 'Layanan analisis sedang sibuk.';
        $hadTransientBusy = false;
        $hadConnectionReset = false;

        foreach ($candidateModels as $index => $model) {
            try {
                $endpoint = "https://generativelanguage.googleapis.com/v1beta/models/{$model}:generateContent?key={$apiKey}";

                $response = Http::withOptions([
                    'force_ip_resolve' => 'v4',
                    'version' => 1.1,
                ])
                    ->connectTimeout(15)
                    ->timeout(45)
                    ->retry(2, 600, function ($exception) {
                        return $exception instanceof ConnectionException;
                    }, false)
                    ->withHeaders([
                        'Content-Type' => 'application/json',
                        'Expect' => '',
                    ])
                    ->post($endpoint, $payload);

                if ($response->successful()) {
                    $rawText = (string) data_get($response->json(), 'candidates.0.content.parts.0.text', '');
                    $parsed = $this->decodeVisionJson($rawText);
                    if ($parsed !== null) {
                        return $parsed;
                    }
                    $lastError = 'Format respons analisis tidak valid.';
                    continue;
                }

                $status = $response->status();
                $apiMsg = (string) data_get($response->json(), 'error.message', "HTTP {$status}");
                Log::warning("Model {$model} gagal ({$status}): {$apiMsg}");

                if (in_array($status, [429, 500, 502, 503, 504], true)) {
                    $hadTransientBusy = true;
                    $lastError = $apiMsg;
                } elseif (!$hadTransientBusy) {
                    $lastError = $apiMsg;
                }

                if ($index < count($candidateModels) - 1) {
                    usleep(350000);
                }
            } catch (\Throwable $e) {
                $msg = $e->getMessage();
                Log::warning("Koneksi ke {$model} error: {$msg}");

                if (
                    $e instanceof ConnectionException ||
                    str_contains(strtolower($msg), 'curl error') ||
                    str_contains(strtolower($msg), 'recv failure')
                ) {
                    $hadConnectionReset = true;
                }

                if (!$hadTransientBusy) {
                    $lastError = $msg;
                }

                if ($index < count($candidateModels) - 1) {
                    usleep(350000);
                }
            }
        }

        if ($hadTransientBusy || str_contains(strtolower($lastError), 'high demand') || str_contains(strtolower($lastError), 'overloaded')) {
            throw new RuntimeException('Server analisis sedang mengalami lonjakan permintaan sementara. Tunggu beberapa detik lalu tekan Identifikasi Spesimen kembali.');
        }

        if ($hadConnectionReset) {
            Log::error('Koneksi cURL ke Google API terputus setelah retry: ' . $lastError);
            throw new RuntimeException('Koneksi internet server ke layanan analisis terputus sesaat. Silakan tekan Identifikasi Spesimen ulang.');
        }

        throw new RuntimeException('Gagal memproses gambar pada layanan analisis: ' . $lastError);
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