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
        if ($url === '') {
            throw new RuntimeException('CLOUDINARY_URL belum dikonfigurasi pada environment.');
        }

        $parsed = parse_url($url);
        if (empty($parsed['host']) || empty($parsed['user']) || empty($parsed['pass'])) {
            throw new RuntimeException('Format CLOUDINARY_URL tidak valid.');
        }

        return [
            'cloud_name' => trim($parsed['host']),
            'api_key' => urldecode($parsed['user']),
            'api_secret' => urldecode($parsed['pass']),
        ];
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
            Log::error('Cloudinary upload gagal', [
                'status' => $response->status(),
                'body' => $response->body(),
            ]);
            throw new RuntimeException('Gagal mengunggah gambar ke Cloudinary.');
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
