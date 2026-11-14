<?php

namespace App\Services;

use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Str;

class EuropePmcService
{
    public function fetchReferences(string $scientificName, int $limit = 3): array
    {
        $cleanName = trim($scientificName);
        if ($cleanName === '') {
            return [];
        }

        // 1. Cari di Europe PMC: Jurnal terbaru (2020-2026) yang wajib punya DOI
        $references = $this->searchEuropePmc(
            sprintf('"%s" AND (medicinal OR pharmacological OR phytochemical OR extract OR bioactivity) AND PUB_YEAR:[2020 TO 2026] AND HAS_DOI:y', $cleanName),
            $limit,
            'CITED desc'
        );

        // 2. Jika kurang dari limit, perluas ke semua studi spesies tersebut (2020-2026) urut terbaru
        if (count($references) < $limit) {
            $more = $this->searchEuropePmc(
                sprintf('"%s" AND PUB_YEAR:[2020 TO 2026] AND HAS_DOI:y', $cleanName),
                $limit,
                'DATE desc'
            );
            $references = $this->mergeUniqueReferences($references, $more, $limit);
        }

        // 3. Cadangan CrossRef API (mengindeks jurnal Google Scholar, Scopus & SINTA Indonesia 2020-2026)
        if (count($references) < $limit) {
            $crossref = $this->searchCrossRef($cleanName, $limit);
            $references = $this->mergeUniqueReferences($references, $crossref, $limit);
        }

        return $references;
    }

    private function searchEuropePmc(string $query, int $limit, string $sort): array
    {
        try {
            $response = Http::timeout(12)
                ->acceptJson()
                ->get('https://www.ebi.ac.uk/europepmc/webservices/rest/search', [
                    'query' => $query,
                    'format' => 'json',
                    'resultType' => 'lite',
                    'pageSize' => $limit,
                    'sort' => $sort,
                ]);

            if ($response->failed()) {
                return [];
            }

            $items = [];
            foreach ($response->json('resultList.result', []) as $item) {
                $title = rtrim((string) ($item['title'] ?? ''), '. ');
                $doi = trim((string) ($item['doi'] ?? ''));

                if ($title === '' || $doi === '') {
                    continue;
                }

                $authors = trim((string) ($item['authorString'] ?? 'Tim Peneliti'), '. ');
                $year = trim((string) ($item['pubYear'] ?? ''));
                $authorYear = $year !== '' ? "{$authors} ({$year})" : $authors;

                $items[] = [
                    'title' => Str::limit($title, 250, '...'),
                    'author_year' => Str::limit($authorYear, 250, '...'),
                    'evidence_level' => $this->detectEvidenceLevel($title),
                    'doi_or_url' => Str::limit("https://doi.org/{$doi}", 250, ''),
                ];
            }

            return $items;
        } catch (\Throwable $e) {
            Log::warning('Europe PMC query error: ' . $e->getMessage());
            return [];
        }
    }

    private function searchCrossRef(string $scientificName, int $limit): array
    {
        try {
            $response = Http::timeout(12)
                ->withHeaders([
                    'User-Agent' => 'HerbalScanApp/1.0 (mailto:research@herbalscan.local)',
                ])
                ->get('https://api.crossref.org/works', [
                    'query' => "{$scientificName} medicinal pharmacological",
                    'filter' => 'from-pub-date:2020-01-01,type:journal-article',
                    'rows' => $limit,
                    'sort' => 'relevance',
                ]);

            if ($response->failed()) {
                return [];
            }

            $items = [];
            foreach ($response->json('message.items', []) as $item) {
                $title = rtrim((string) ($item['title'][0] ?? ''), '. ');
                $doi = trim((string) ($item['DOI'] ?? ''));

                if ($title === '' || $doi === '') {
                    continue;
                }

                // Pastikan judul/abstrak benar-benar membahas spesies tersebut
                if (!Str::contains(strtolower($title), strtolower(explode(' ', $scientificName)[0]))) {
                    continue;
                }

                $authorList = [];
                foreach (array_slice($item['author'] ?? [], 0, 3) as $author) {
                    $family = $author['family'] ?? '';
                    $given = isset($author['given']) ? mb_substr($author['given'], 0, 1) . '.' : '';
                    if ($family !== '') {
                        $authorList[] = trim("{$family} {$given}");
                    }
                }
                $authors = !empty($authorList) ? implode(', ', $authorList) . ' et al.' : 'Tim Peneliti';
                $year = $item['published']['date-parts'][0][0] ?? '';
                $authorYear = $year !== '' ? "{$authors} ({$year})" : $authors;

                $items[] = [
                    'title' => Str::limit($title, 250, '...'),
                    'author_year' => Str::limit($authorYear, 250, '...'),
                    'evidence_level' => $this->detectEvidenceLevel($title),
                    'doi_or_url' => Str::limit("https://doi.org/{$doi}", 250, ''),
                ];
            }

            return $items;
        } catch (\Throwable $e) {
            Log::warning('CrossRef query error: ' . $e->getMessage());
            return [];
        }
    }

    private function detectEvidenceLevel(string $title): string
    {
        $lowerTitle = strtolower($title);
        $isClinical = Str::contains($lowerTitle, [
            'clinical',
            'randomized',
            'trial',
            'patients',
            'human',
            'placebo',
            'double-blind',
        ]);

        return $isClinical ? 'Uji Klinis' : 'Laboratorium';
    }

    private function mergeUniqueReferences(array $primary, array $secondary, int $limit): array
    {
        $seenDois = array_column($primary, 'doi_or_url');

        foreach ($secondary as $item) {
            if (count($primary) >= $limit) {
                break;
            }
            if (!in_array($item['doi_or_url'], $seenDois, true)) {
                $primary[] = $item;
                $seenDois[] = $item['doi_or_url'];
            }
        }

        return $primary;
    }
}
