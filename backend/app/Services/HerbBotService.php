<?php

namespace App\Services;

use App\Models\Herbal;
use Illuminate\Http\Client\ConnectionException;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Log;
use RuntimeException;

class HerbBotService
{
    public function chat(string $message, ?Herbal $plant = null, array $history = []): array
    {
        $geminiKeys = $this->resolveGeminiKeys();
        if (empty($geminiKeys)) {
            throw new RuntimeException('GEMINI_API_KEYS belum dikonfigurasi pada server.');
        }

        $systemInstruction = $this->buildSystemInstruction($plant);
        $contents = $this->buildConversationContents($message, $history);

        $rotatedKeys = $geminiKeys;
        shuffle($rotatedKeys);

        $models = ['gemini-3.5-flash-lite', 'gemini-3.1-flash-lite', 'gemini-3.6-flash'];
        $lastDiagnostic = 'Layanan HerbBOT sedang sibuk sesaat.';

        foreach (array_slice($rotatedKeys, 0, 3) as $currentKey) {
            foreach ($models as $model) {
                $genConfig = [
                    'temperature' => 0.4,
                    'topP' => 0.9,
                    'maxOutputTokens' => 450,
                ];

                $genConfig['thinkingConfig'] = ['thinkingLevel' => str_starts_with($model, 'gemini-3.') ? 'MINIMAL' : 'LOW'];

                $payload = [
                    'systemInstruction' => [
                        'parts' => [
                            ['text' => $systemInstruction],
                        ],
                    ],
                    'contents' => $contents,
                    'generationConfig' => $genConfig,
                ];

                $url = "https://generativelanguage.googleapis.com/v1beta/models/{$model}:generateContent?key={$currentKey}";

                try {
                    $response = Http::withOptions([
                        'force_ip_resolve' => 'v4',
                        'version' => 1.1,
                    ])
                        ->connectTimeout(4)
                        ->timeout(14)
                        ->withHeaders([
                            'Content-Type' => 'application/json',
                            'Expect' => '',
                        ])
                        ->post($url, $payload);

                    if ($response->successful()) {
                        $parts = data_get($response->json(), 'candidates.0.content.parts', []);
                        $rawText = '';
                        if (is_array($parts)) {
                            foreach ($parts as $part) {
                                if (!empty($part['text']) && empty($part['thought'])) {
                                    $rawText .= $part['text'];
                                }
                            }
                        }

                        $cleaned = trim($rawText);
                        if ($cleaned !== '') {
                            return $this->parseNaturalOutput($cleaned);
                        }
                    }

                    $status = $response->status();
                    $apiMsg = (string) data_get($response->json(), 'error.message', '');
                    $lastDiagnostic = "Gagal memproses ({$status}): " . ($apiMsg !== '' ? $apiMsg : 'Respon kosong');

                    Log::warning('HerbBOT attempt failed', [
                        'model' => $model,
                        'status' => $status,
                        'error' => $apiMsg,
                    ]);

                    if (in_array($status, [401, 403, 429], true)) {
                        break;
                    }
                } catch (ConnectionException $e) {
                    $lastDiagnostic = 'Koneksi ke layanan AI terputus sesaat.';
                    continue;
                } catch (\Throwable $e) {
                    $lastDiagnostic = 'Kendala teknis: ' . $e->getMessage();
                }
            }
        }

        throw new RuntimeException($lastDiagnostic);
    }

    private function parseNaturalOutput(string $rawText): array
    {
        $trimmedRaw = trim($rawText);
        if (str_starts_with($trimmedRaw, '{') && str_contains($trimmedRaw, '"reply"')) {
            $decoded = json_decode($trimmedRaw, true);
            if (is_array($decoded) && !empty($decoded['reply'])) {
                return [
                    'reply' => trim((string) $decoded['reply']),
                    'suggestions' => array_slice(
                        array_values(array_filter((array) ($decoded['suggestions'] ?? []), 'is_string')),
                        0,
                        3
                    ),
                ];
            }
        }

        $suggestions = [];
        $replyText = $rawText;

        if (str_contains($rawText, '<<<SUGGESTIONS>>>')) {
            [$mainPart, $sugPart] = explode('<<<SUGGESTIONS>>>', $rawText, 2);
            $replyText = trim($mainPart);

            $lines = preg_split('/\r\n|\r|\n/', trim($sugPart)) ?: [];
            foreach ($lines as $line) {
                $cleanLine = preg_replace('/^[\-\*\•\d\.\)\s]+/', '', trim($line));
                $cleanLine = trim((string) $cleanLine, "\"'*` ");
                if ($cleanLine !== '' && mb_strlen($cleanLine) <= 95) {
                    $suggestions[] = $cleanLine;
                }
            }
            $suggestions = array_slice($suggestions, 0, 3);
        }

        $replyText = str_replace('<<<SUGGESTIONS>>>', '', $replyText);
        $replyText = preg_replace('/^#{1,6}\s+/m', '', $replyText);
        $replyText = preg_replace('/`([^`\n]+)`/', '$1', (string) $replyText);
        $replyText = preg_replace('/(?<!\*)\*(?!\*)([^*\n]+?)(?<!\*)\*(?!\*)/', '$1', (string) $replyText);
        $replyText = preg_replace("/\n{3,}/", "\n\n", (string) $replyText);
        $replyText = trim((string) $replyText);

        return [
            'reply' => $replyText,
            'suggestions' => $suggestions,
        ];
    }

    private function buildSystemInstruction(?Herbal $plant): string
    {
        $basePrompt = <<<PROMPT
IDENTITAS PEMBUAT APLIKASI:
Aplikasi HerbalScan dan asisten AI HerbBOT ini dibuat dan dikembangkan oleh Fahmi, Mahasiswa Program Studi Sistem Informasi, Universitas Kartamulia. Jika pengguna bertanya siapa pembuat, pencipta, developer, atau pemilik aplikasi ini, jawab dengan jelas: Fahmi, Mahasiswa Sistem Informasi Universitas Kartamulia.

Anda adalah HerbBOT, asisten botani dan herbal pada aplikasi HerbalScan.
Gaya bicara: ramah, cerdas, langsung ke inti, ringkas, dan natural dalam Bahasa Indonesia.

ATURAN FORMAT & KEAMANAN:
1. Jawab padat, jelas, dan cepat dibaca di HP (maksimal 2 paragraf singkat atau 3–4 poin pendek).
2. Gunakan HANYA **teks tebal** untuk istilah penting, dan `- ` atau `1. ` untuk daftar. DILARANG memakai `*miring*`, `###`, `---`, backtick, atau JSON.
3. Bedakan manfaat empiris/tradisional dengan bukti ilmiah, serta ingatkan konsultasi dokter bila punya penyakit kronis atau minum obat rutin.
4. Bila tanaman beracun, tegaskan di kalimat pertama bahwa tanaman tersebut **tidak boleh dikonsumsi**.
5. Di baris paling akhir setelah jawaban, tulis persis `<<<SUGGESTIONS>>>` lalu 3 pertanyaan lanjutan singkat (1 baris polos per pertanyaan).
PROMPT;

        if (!$plant) {
            return $basePrompt;
        }

        $toxicStatus = $plant->is_toxic ? 'BERACUN (DILARANG DIKONSUMSI)' : 'Aman dalam takaran wajar';
        $prep = mb_substr((string) ($plant->preparation_method ?: $plant->traditional_usage ?: ''), 0, 280);
        $dose = mb_substr((string) ($plant->dosage_notes ?? ''), 0, 180);
        $contra = mb_substr((string) ($plant->contraindications ?? ''), 0, 180);

        return $basePrompt . "\n\n" . <<<CONTEXT
KONTEKS TANAMAN: {$plant->name} ({$plant->scientific_name}) | Status: {$toxicStatus} | Bagian: {$plant->plant_parts_used}
Cara Olah: {$prep}
Takaran: {$dose}
Kontraindikasi: {$contra}
CONTEXT;
    }

    private function buildConversationContents(string $message, array $history): array
    {
        $contents = [];
        $recentHistory = array_slice($history, -4);

        foreach ($recentHistory as $turn) {
            if (!is_array($turn)) {
                continue;
            }
            $role = ($turn['role'] ?? '') === 'assistant' ? 'model' : 'user';
            $text = trim((string) ($turn['text'] ?? ''));
            if ($text === '') {
                continue;
            }
            $contents[] = [
                'role' => $role,
                'parts' => [
                    ['text' => mb_substr($text, 0, 320)],
                ],
            ];
        }

        $contents[] = [
            'role' => 'user',
            'parts' => [
                ['text' => trim($message)],
            ],
        ];

        return $contents;
    }

    private function resolveGeminiKeys(): array
    {
        $rawSources = [
            config('services.gemini.keys'),
            config('services.gemini.key'),
            env('GEMINI_API_KEYS'),
            env('GEMINI_API_KEY'),
            $_ENV['GEMINI_API_KEYS'] ?? null,
            $_ENV['GEMINI_API_KEY'] ?? null,
            getenv('GEMINI_API_KEYS') ?: null,
            getenv('GEMINI_API_KEY') ?: null,
        ];

        $keys = [];
        foreach ($rawSources as $source) {
            if (!is_string($source) || trim($source) === '') {
                continue;
            }
            foreach (explode(',', $source) as $part) {
                $clean = trim($part);
                if ($clean !== '' && !in_array($clean, $keys, true)) {
                    $keys[] = $clean;
                }
            }
        }

        return $keys;
    }
}
