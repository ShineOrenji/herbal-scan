<?php

namespace App\Services;

use Illuminate\Http\Client\Pool;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Log;

class BotanicalImageService
{
    public function normalizeTaxonQuery(string $scientificName): string
    {
        $clean = str_replace(['×', '✕'], ' ', trim($scientificName));
        $clean = preg_replace('/\s*\([^)]*\)/', '', $clean);
        $clean = preg_replace('/\b(subsp\.|ssp\.|var\.|f\.|cv\.)\s*/i', '', $clean);
        $clean = preg_replace('/[^a-zA-Z\s-]/', ' ', $clean);
        $parts = array_values(array_filter(preg_split('/\s+/', trim($clean))));

        if (count($parts) >= 3) {
            return ucfirst(strtolower($parts[0])) . ' ' . strtolower($parts[1]) . ' ' . strtolower($parts[2]);
        }

        if (count($parts) === 2) {
            return ucfirst(strtolower($parts[0])) . ' ' . strtolower($parts[1]);
        }

        return ucfirst(strtolower($parts[0] ?? ''));
    }

    public function extractBinomialOnly(string $scientificName): string
    {
        $full = $this->normalizeTaxonQuery($scientificName);
        $parts = array_values(array_filter(preg_split('/\s+/', $full)));

        if (count($parts) >= 2) {
            return $parts[0] . ' ' . $parts[1];
        }

        return $parts[0] ?? '';
    }

    public function fetchReferencePhoto(string $scientificName, string $commonNameId = ''): ?string
    {
        $fullQuery = $this->normalizeTaxonQuery($scientificName);
        $binomial = $this->extractBinomialOnly($scientificName);

        if ($binomial === '' || !str_contains($binomial, ' ')) {
            return null;
        }

        // 1. iNaturalist Research-Grade (prioritaskan takson spesifik seperti subspesies/varietas)
        if ($fullQuery !== $binomial) {
            $subspPhoto = $this->fetchFromINaturalist($fullQuery, true);
            if ($subspPhoto !== null) {
                return $subspPhoto;
            }
        }

        $speciesPhoto = $this->fetchFromINaturalist($binomial, false);
        if ($speciesPhoto !== null) {
            return $speciesPhoto;
        }

        // 2. GBIF (Global Biodiversity Information Facility) Specimen & Observation Media
        $gbifSubsp = $fullQuery !== $binomial ? $this->fetchFromGbif($fullQuery) : null;
        if ($gbifSubsp !== null) {
            return $gbifSubsp;
        }

        return $this->fetchFromGbif($binomial);
    }

    /**
     * Ambil foto referensi secara paralel dari iNaturalist Research-Grade.
     *
     * @param array<int, array{scientific_name: string, name: string}> $itemsMap
     * @return array<int, string>
     */
    public function fetchBatchReferencePhotos(array $itemsMap): array
    {
        if (empty($itemsMap)) {
            return [];
        }

        $slice = array_slice($itemsMap, 0, 12, true);
        $queryMap = [];
        foreach ($slice as $id => $meta) {
            $sci = $this->normalizeTaxonQuery((string) ($meta['scientific_name'] ?? ''));
            if ($sci !== '' && str_contains($sci, ' ')) {
                $queryMap[$id] = $sci;
            }
        }

        if (empty($queryMap)) {
            return [];
        }

        $resolved = [];

        try {
            $responses = Http::pool(function (Pool $pool) use ($queryMap) {
                foreach ($queryMap as $id => $taxonQuery) {
                    $pool->as((string) $id)
                        ->timeout(4)
                        ->withHeaders([
                            'Accept' => 'application/json',
                            'User-Agent' => 'HerbalScan-BotanicalApp/1.0',
                        ])
                        ->get('https://api.inaturalist.org/v1/taxa', [
                            'q' => $taxonQuery,
                            'rank' => 'subspecies,variety,form,species',
                            'per_page' => 8,
                        ]);
                }
            });

            foreach ($queryMap as $id => $taxonQuery) {
                $resp = $responses[(string) $id] ?? null;
                if ($resp && method_exists($resp, 'successful') && $resp->successful()) {
                    $photo = $this->extractExactINatPhoto($resp->json('results', []), $taxonQuery);
                    if ($photo !== null) {
                        $resolved[$id] = $photo;
                    }
                }
            }
        } catch (\Throwable $e) {
            Log::info('Batch iNaturalist lookup dilewati: ' . $e->getMessage());
        }

        return $resolved;
    }

    private function fetchFromINaturalist(string $taxonQuery, bool $preferInfraspecies): ?string
    {
        try {
            $params = [
                'q' => $taxonQuery,
                'rank' => $preferInfraspecies ? 'subspecies,variety,form' : 'species,subspecies,variety',
                'per_page' => 8,
            ];

            $response = Http::timeout(4)
                ->withHeaders([
                    'Accept' => 'application/json',
                    'User-Agent' => 'HerbalScan-BotanicalApp/1.0',
                ])
                ->get('https://api.inaturalist.org/v1/taxa', $params);

            if (!$response->successful()) {
                return null;
            }

            return $this->extractExactINatPhoto($response->json('results', []), $taxonQuery);
        } catch (\Throwable) {
            return null;
        }
    }

    private function extractExactINatPhoto(array $results, string $targetQuery): ?string
    {
        $targetCanonical = strtolower($this->normalizeTaxonQuery($targetQuery));

        foreach ($results as $taxon) {
            $rawName = (string) ($taxon['name'] ?? '');
            $taxonCanonical = strtolower($this->normalizeTaxonQuery($rawName));

            if ($taxonCanonical !== $targetCanonical) {
                continue;
            }

            $defaultPhoto = $taxon['default_photo'] ?? null;
            if (!is_array($defaultPhoto)) {
                continue;
            }

            $hdUrl = (string) ($defaultPhoto['large_url'] ?? $defaultPhoto['medium_url'] ?? '');
            if ($hdUrl !== '' && str_starts_with($hdUrl, 'https://')) {
                return $hdUrl;
            }
        }

        return null;
    }

    private function fetchFromGbif(string $taxonName): ?string
    {
        try {
            $response = Http::timeout(4)
                ->withHeaders([
                    'Accept' => 'application/json',
                    'User-Agent' => 'HerbalScan-BotanicalApp/1.0',
                ])
                ->get('https://api.gbif.org/v1/occurrence/search', [
                    'scientificName' => $taxonName,
                    'mediaType' => 'StillImage',
                    'basisOfRecord' => 'HUMAN_OBSERVATION',
                    'limit' => 6,
                ]);

            if (!$response->successful()) {
                return null;
            }

            foreach ($response->json('results', []) as $occurrence) {
                foreach ($occurrence['media'] ?? [] as $media) {
                    $url = trim((string) ($media['identifier'] ?? ''));
                    $format = strtolower((string) ($media['format'] ?? ''));
                    if (
                        ($media['type'] ?? '') === 'StillImage' &&
                        str_starts_with($url, 'https://') &&
                        ($format === '' || str_contains($format, 'jpeg') || str_contains($format, 'jpg') || str_contains($format, 'png') || str_contains($format, 'webp'))
                    ) {
                        return $url;
                    }
                }
            }
        } catch (\Throwable) {
            return null;
        }

        return null;
    }
}
