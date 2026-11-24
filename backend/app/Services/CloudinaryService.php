<?php

namespace App\Services;

use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Log;
use RuntimeException;

class CloudinaryService
{
    private function parseCredentials(): array
    {
        $raw = config('services.cloudinary.url')
            ?: env('CLOUDINARY_URL')
            ?: ($_SERVER['CLOUDINARY_URL'] ?? $_ENV['CLOUDINARY_URL'] ?? getenv('CLOUDINARY_URL') ?: '');

        $url = trim((string) $raw, " \t\n\r\0\x0B\"'");
        $url = preg_replace('/^CLOUDINARY_URL\s*=\s*/i', '', $url);
        $url = trim((string) $url, " \t\n\r\0\x0B\"'");

        if ($url === '') {
            $cloudName = trim((string) env('CLOUDINARY_CLOUD_NAME', ''));
            $apiKey = trim((string) env('CLOUDINARY_API_KEY', ''));
            $apiSecret = trim((string) env('CLOUDINARY_API_SECRET', ''));
            if ($cloudName !== '' && $apiKey !== '' && $apiSecret !== '') {
                return [
                    'cloud_name' => $cloudName,
                    'api_key' => $apiKey,
                    'api_secret' => $apiSecret,
                ];
            }
            throw new RuntimeException('CLOUDINARY_URL belum dikonfigurasi pada environment.');
        }

        if (preg_match('#cloudinary://([^:@\s]+):([^@\s]+)@([a-zA-Z0-9_-]+)#i', $url, $matches)) {
            return [
                'cloud_name' => trim($matches[3]),
                'api_key' => urldecode(trim($matches[1])),
                'api_secret' => urldecode(trim($matches[2])),
            ];
        }

        $parsed = parse_url($url);
        if (!empty($parsed['host']) && !empty($parsed['user']) && !empty($parsed['pass'])) {
            return [
                'cloud_name' => trim($parsed['host']),
                'api_key' => urldecode($parsed['user']),
                'api_secret' => urldecode($parsed['pass']),
            ];
        }

        throw new RuntimeException('Format CLOUDINARY_URL tidak valid. Pastikan nilainya berformat cloudinary://api_key:api_secret@cloud_name.');
    }

    public function upload(string $filePath, string $folder = 'herbal-scan'): string
    {
        $creds = $this->parseCredentials();
        $timestamp = time();
        $signature = sha1("folder={$folder}&timestamp={$timestamp}{$creds['api_secret']}");

        $response = Http::withOptions([
            'force_ip_resolve' => 'v4',
            'version' => 1.1,
        ])
            ->connectTimeout(8)
            ->timeout(25)
            ->attach('file', file_get_contents($filePath), basename($filePath) . '.jpg')
            ->post("https://api.cloudinary.com/v1_1/{$creds['cloud_name']}/image/upload", [
                'api_key' => $creds['api_key'],
                'timestamp' => $timestamp,
                'folder' => $folder,
                'signature' => $signature,
            ]);

        if (!$response->successful() || empty($response->json('secure_url'))) {
            $cloudErr = (string) ($response->json('error.message') ?? '');
            Log::error('Cloudinary upload gagal', [
                'status' => $response->status(),
                'body' => $response->body(),
            ]);
            throw new RuntimeException(
                $cloudErr !== ''
                    ? "Cloudinary menolak unggahan: {$cloudErr}"
                    : 'Gagal mengunggah gambar ke Cloudinary.'
            );
        }

        return (string) $response->json('secure_url');
    }

    public function deleteByUrl(?string $imageUrl): void
    {
        if (empty($imageUrl) || !str_contains($imageUrl, 'res.cloudinary.com')) {
            return;
        }

        if (!preg_match('#/upload/(?:v\d+/)?(.+)\.[a-zA-Z0-9]+$#', $imageUrl, $matches)) {
            return;
        }

        try {
            $creds = $this->parseCredentials();
            $publicId = $matches[1];
            $timestamp = time();
            $signature = sha1("public_id={$publicId}&timestamp={$timestamp}{$creds['api_secret']}");

            Http::withOptions([
                'force_ip_resolve' => 'v4',
                'version' => 1.1,
            ])
                ->timeout(15)
                ->asForm()
                ->post(
                    "https://api.cloudinary.com/v1_1/{$creds['cloud_name']}/image/destroy",
                    [
                        'public_id' => $publicId,
                        'api_key' => $creds['api_key'],
                        'timestamp' => $timestamp,
                        'signature' => $signature,
                    ]
                );
        } catch (\Throwable $e) {
            Log::warning('Gagal menghapus gambar lama di Cloudinary: ' . $e->getMessage());
        }
    }
}
