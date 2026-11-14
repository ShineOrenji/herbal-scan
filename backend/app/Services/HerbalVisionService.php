<?php

namespace App\Services;

use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Log;
use RuntimeException;

class HerbalVisionService
{
    public function identifyPlant(string $imagePath): array
    {
        $apiKey = trim((string) (config('services.gemini.api_key') ?: env('GEMINI_API_KEY')));

        if ($apiKey === '') {
            throw new RuntimeException('GEMINI_API_KEY belum diisi di file backend/.env.');
        }

        [$mimeType, $base64Image] = $this->prepareCompressedImage($imagePath);
        $prompt = $this->buildBotanicalPrompt();

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
                'temperature' => 0.1,
                'responseMimeType' => 'application/json',
                'responseSchema' => [
                    'type' => 'OBJECT',
                    'properties' => [
                        'morphological_analysis' => ['type' => 'STRING'],
                        'is_plant' => ['type' => 'BOOLEAN'],
                        'is_medicinal_herb' => ['type' => 'BOOLEAN'],
                        'is_toxic' => ['type' => 'BOOLEAN'],
                        'confidence' => ['type' => 'INTEGER'],
                        'common_name_id' => ['type' => 'STRING'],
                        'scientific_name' => ['type' => 'STRING'],
                        'local_name' => ['type' => 'STRING'],
                        'description' => ['type' => 'STRING'],
                        'plant_parts_used' => ['type' => 'STRING'],
                        'traditional_usage' => ['type' => 'STRING'],
                        'lab_evidence' => ['type' => 'STRING'],
                        'clinical_evidence' => ['type' => 'STRING'],
                        'safety_warning' => ['type' => 'STRING'],
                    ],
                    'required' => [
                        'morphological_analysis',
                        'is_plant',
                        'is_medicinal_herb',
                        'is_toxic',
                        'confidence',
                        'common_name_id',
                        'scientific_name',
                        'local_name',
                        'description',
                        'plant_parts_used',
                        'traditional_usage',
                        'lab_evidence',
                        'clinical_evidence',
                        'safety_warning',
                    ],
                ],
            ],
        ];

        $models = [
            'gemini-2.5-flash',
            'gemini-3-flash-preview',
            'gemini-flash-latest',
            'gemini-3.1-flash-lite-preview',
            'gemini-flash-lite-latest',
        ];

        $lastError = 'Layanan Vision AI belum merespons.';

        foreach ($models as $model) {
            $endpoint = "https://generativelanguage.googleapis.com/v1beta/models/{$model}:generateContent";

            try {
                $response = Http::timeout(25)
                    ->withHeaders([
                        'x-goog-api-key' => $apiKey,
                        'Content-Type' => 'application/json',
                    ])
                    ->post($endpoint, $payload);

                if ($response->successful()) {
                    $rawText = (string) $response->json('candidates.0.content.parts.0.text', '');
                    $parsed = $this->decodeJsonSafely($rawText);

                    if (!is_array($parsed)) {
                        $lastError = "Format JSON dari {$model} tidak valid.";
                        continue;
                    }

                    return $this->normalizeResult($parsed);
                }

                $status = $response->status();
                $msg = (string) ($response->json('error.message') ?? $response->body());
                $lastError = "HTTP {$status} ({$model}): " . mb_substr($msg, 0, 120);

                Log::warning("Gemini Vision {$model} dilewati", ['status' => $status, 'error' => $lastError]);
            } catch (\Throwable $e) {
                $lastError = "Koneksi {$model} timeout: " . $e->getMessage();
                Log::warning($lastError);
            }
        }

        throw new RuntimeException($lastError);
    }

    private function decodeJsonSafely(string $raw): ?array
    {
        $clean = trim($raw);
        $decoded = json_decode($clean, true);
        if (is_array($decoded)) {
            return $decoded;
        }

        if (preg_match('/\{[\s\S]*\}/', $clean, $matches)) {
            $decoded = json_decode($matches[0], true);
            if (is_array($decoded)) {
                return $decoded;
            }
        }

        return null;
    }

    private function buildBotanicalPrompt(): string
    {
        return <<<PROMPT
Anda adalah pakar taksonomi botani, etnofarmakologi, dan toksikologi tumbuhan berbasis bukti ilmiah (evidence-based).
Identifikasi spesies tumbuhan pada foto secara objektif meskipun spesies tersebut berada di luar daftar tanaman umum.

LANGKAH 1 — ANALISIS MORFOLOGI VISUAL (`morphological_analysis`):
Amati ciri fisik nyata pada gambar sebelum menentukan nama spesies:
(a) Tipe daun (daun tunggal utuh, daun menjari dengan cuping sempit, daun menjari berlekuk dalam menyirip, atau daun majemuk menyirip/menyirip ganda).
(b) Tepi daun & pertulangan (tepi rata/entire, bergerigi halus, bergerigi tajam/serrate, atau berlekuk dalam/pinnatifid).
(c) Warna, tekstur, & tangkai (warna hijau segar, hijau tua, atau merah keunguan/perunggu; permukaan licin mengilap, tebal sukulen, atau berbulu kasar; letak tangkai di pangkal tepi daun atau menempel ke tengah helai/peltate; warna tangkai kemerahan atau hijau berongga).

LANGKAH 2 — KUNCI PEMBEDA SPESIES MIRIP & TANAMAN BERACUN:
- Daun Singkong / Ketela Pohon (Manihot esculenta): Daun menjari dalam dengan 5–9 cuping SEMPIT memanjang berbentuk lanset (lanceolate). TEPI TIAP CUPING RATA (tidak bergerigi dan tidak berlekuk-lekuk lagi). Tangkai daun panjang sering berwarna kemerahan/keunguan atau hijau kemerahan. Wajib set `is_plant` = true, `is_medicinal_herb` = true, `is_toxic` = false (cantumkan pada `safety_warning` bahwa daun singkong mentah mengandung glikosida sianogenik linamarin sehingga wajib direbus matang sebelum dikonsumsi). JANGAN PERNAH tertukar dengan Pepaya!
- Daun Pepaya (Carica papaya): Daun tunggal sangat besar, menjari lebar dengan 7–11 cuping besar yang BERLEKUK-LEKUK DALAM menyirip (pinnatifid — tiap cuping bercabang/berlekuk lagi), warna hijau segar (tidak pernah merah keunguan), bertangkai panjang tebal berongga hijau pucat yang menempel di pangkal tepi helai.
- Jarak Kepyar / Castor Bean (Ricinus communis): Daun menjari 5–11 cuping lebar dengan TEPI BERGERIGI TAJAM (serrate) teratur, tangkai menempel agak ke tengah helai daun (peltate), warna hijau tua atau MERAH KEUNGUAN / PERUNGGU, sering disertai buah bulat berduri lunak. SANGAT BERACUN (mengandung protein toksin risin mematikan, terutama pada biji dan daun mentah). Wajib set `is_plant` = true, `is_toxic` = true, `is_medicinal_herb` = true.
- Jarak Pagar (Jatropha curcas): Daun berlekuk 3–5 dangkal berbentuk hati lebar, tepi rata, bergetah. BERACUN jika tertelan (mengandung kurkin dan ester forbol). Wajib set `is_plant` = true, `is_toxic` = true, `is_medicinal_herb` = true.
- Kecubung (Datura metel / Brugmansia): Daun tunggal bulat telur dengan bunga terompet besar. SANGAT BERACUN (alkaloid tropana: skopolamin, hiosiamin, atropin). Wajib set `is_plant` = true, `is_toxic` = true, `is_medicinal_herb` = true.
- Tanaman Beracun Lain di Alam Liar (mis. Nerium oleander, Abrus precatorius, Dieffenbachia, Euphorbia tirucalli): Wajib set `is_plant` = true, `is_toxic` = true, `is_medicinal_herb` = true.
- Keji Beling (Strobilanthes crispus): Daun tunggal hijau tua, permukaan SANGAT KASAR berbulu pendek seperti amplas, tepi bergerigi.
- Sambung Nyawa (Gynura procumbens): Daun tunggal hijau cerah agak TEBAL BERDAGING (sukulen), permukaan HALUS LICIN tidak kasar, sering bersemu keunguan.

LANGKAH 3 — ATURAN PENULISAN DATA ILMIAH (PLUS-MINUS & AKURAT):
1. Jika `is_toxic` = true, tambahkan akhiran ` (Beracun)` pada `common_name_id` (contoh: `Jarak Kepyar (Beracun)`).
2. Pada `traditional_usage`, `lab_evidence`, dan `clinical_evidence`, sajikan fakta ilmiah secara berimbang (plus-minus):
   - Untuk tanaman herbal: jelaskan senyawa aktif utama (mis. flavonoid, kuersetin, kurkuminoid, andrografolid), mekanisme kerja berdasarkan studi laboratorium/klinis, serta batas dosis wajar.
   - Untuk tanaman beracun: jelaskan potensi farmakologis/etnobotani yang pernah diteliti ilmuwan (mis. penggunaan luar terkontrol atau isolat senyawa tertentu) SEKALIGUS menjelaskan senyawa toksik spesifik, mekanisme keracunan organ, dan alasan mengapa konsumsi langsung sangat berbahaya.
3. Pada `safety_warning`, tuliskan peringatan keamanan yang spesifik dan faktual (bukan kalimat generik).
4. Jika gambar BUKAN tumbuhan (mis. wajah, benda mati, kendaraan, layar, makanan jadi), isi `is_plant` = false, `is_medicinal_herb` = false, `is_toxic` = false, dan `confidence` di bawah 40.
PROMPT;
    }

    private function normalizeResult(array $data): array
    {
        $isToxic = (bool) ($data['is_toxic'] ?? false);
        $commonName = trim((string) ($data['common_name_id'] ?? 'Tanaman'));

        if ($isToxic && $commonName !== '' && !str_contains(strtolower($commonName), 'beracun')) {
            $commonName .= ' (Beracun)';
        }

        return [
            'is_plant' => (bool) ($data['is_plant'] ?? false),
            'is_medicinal_herb' => (bool) ($data['is_medicinal_herb'] ?? false),
            'is_toxic' => $isToxic,
            'confidence' => (int) ($data['confidence'] ?? 0),
            'common_name_id' => $commonName,
            'scientific_name' => trim((string) ($data['scientific_name'] ?? '')),
            'local_name' => trim((string) ($data['local_name'] ?? '')),
            'description' => trim((string) ($data['description'] ?? 'Deskripsi botani belum tersedia.')),
            'plant_parts_used' => trim((string) ($data['plant_parts_used'] ?? 'Daun')),
            'traditional_usage' => trim((string) ($data['traditional_usage'] ?? 'Memiliki catatan pemanfaatan etnobotani dan kajian fitokimia.')),
            'lab_evidence' => !empty($data['lab_evidence']) ? trim((string) $data['lab_evidence']) : null,
            'clinical_evidence' => !empty($data['clinical_evidence']) ? trim((string) $data['clinical_evidence']) : null,
            'safety_warning' => trim((string) ($data['safety_warning'] ?? 'Perhatikan dosis dan konsultasikan dengan tenaga medis sebelum penggunaan.')),
        ];
    }

    private function prepareCompressedImage(string $imagePath): array
    {
        if (function_exists('imagecreatefromstring')) {
            $raw = @file_get_contents($imagePath);
            $src = $raw !== false ? @imagecreatefromstring($raw) : false;

            if ($src !== false) {
                $origW = imagesx($src);
                $origH = imagesy($src);
                $maxDim = 1024;

                if ($origW > $maxDim || $origH > $maxDim) {
                    $ratio = min($maxDim / $origW, $maxDim / $origH);
                    $newW = max(1, (int) round($origW * $ratio));
                    $newH = max(1, (int) round($origH * $ratio));

                    $dst = imagecreatetruecolor($newW, $newH);
                    imagecopyresampled($dst, $src, 0, 0, 0, 0, $newW, $newH, $origW, $origH);
                    imagedestroy($src);
                    $src = $dst;
                }

                ob_start();
                imagejpeg($src, null, 85);
                $jpegData = ob_get_clean();
                imagedestroy($src);

                if (!empty($jpegData)) {
                    return ['image/jpeg', base64_encode($jpegData)];
                }
            }
        }

        $mimeType = mime_content_type($imagePath) ?: 'image/jpeg';
        return [$mimeType, base64_encode((string) file_get_contents($imagePath))];
    }
}
