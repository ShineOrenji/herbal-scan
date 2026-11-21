<?php

namespace App\Services;

use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Log;

class EuropePmcService
{
    private const MIN_YEAR = 2020;

    public function fetchReferences(string $scientificName, int $limit = 3): array
    {
        $cleanName = trim(preg_replace('/\b(subsp\.|ssp\.|var\.).*$/i', '', $scientificName));
        if ($cleanName === '') {
            return [];
        }

        $maxYear = (int) date('Y') + 1;

        // 1. EMBL-EBI Europe PMC (2020 - Terbaru)
        $strictQuery = sprintf(
            'TITLE_ABS:"%s" AND HAS_DOI:Y AND PUB_YEAR:[%d TO %d] AND (phytochemical OR pharmacological OR medicinal OR extract OR clinical)',
            $cleanName,
            self::MIN_YEAR,
            $maxYear
        );
        $refs = $this->queryEuropePmc($strictQuery, $limit);

        if (count($refs) < $limit) {
            $broadQuery = sprintf(
                'TITLE_ABS:"%s" AND HAS_DOI:Y AND PUB_YEAR:[%d TO %d]',
                $cleanName,
                self::MIN_YEAR,
                $maxYear
            );
            $moreRefs = $this->queryEuropePmc($broadQuery, $limit - count($refs));
            $refs = $this->mergeUniqueRefs($refs, $moreRefs, $limit);
        }

        // 2. Crossref Official DOI Registry (2020 - Terbaru)
        if (count($refs) < $limit) {
            $crossrefRefs = $this->queryCrossref($cleanName, $limit - count($refs));
            $refs = $this->mergeUniqueRefs($refs, $crossrefRefs, $limit);
        }

        // 3. OpenAlex Academic Graph (2020 - Terbaru)
        if (count($refs) < $limit) {
            $openAlexRefs = $this->queryOpenAlex($cleanName, $limit - count($refs));
            $refs = $this->mergeUniqueRefs($refs, $openAlexRefs, $limit);
        }

        return $refs;
    }

    private function queryEuropePmc(string $query, int $limit): array
    {
        try {
            $response = Http::withOptions(['force_ip_resolve' => 'v4', 'version' => 1.1])
                ->connectTimeout(4)
                ->timeout(7)
                ->withHeaders([
                    'Accept' => 'application/json',
                    'User-Agent' => 'HerbalScan-BotanicalApp/1.0',
                ])
                ->get('https://www.ebi.ac.uk/europepmc/webservices/rest/search', [
                    'query' => $query,
                    'format' => 'json',
                    'resultType' => 'lite',
                    'pageSize' => $limit + 4,
                    'sort' => 'CITED desc',
                ]);

            if (!$response->successful()) {
                return [];
            }

            $results = $response->json('resultList.result', []);
            $references = [];

            foreach ($results as $article) {
                $doi = trim((string) ($article['doi'] ?? ''));
                $title = trim(strip_tags((string) ($article['title'] ?? '')));
                $year = (int) ($article['pubYear'] ?? 0);

                if ($doi === '' || $title === '' || $year < self::MIN_YEAR) {
                    continue;
                }

                $author = trim((string) ($article['authorString'] ?? 'Peneliti Botani'));
                $journal = trim((string) ($article['journalTitle'] ?? 'Europe PMC Indexed Journal'));
                $authorYear = "{$author} ({$year})";

                $references[] = [
                    'title' => rtrim($title, '.'),
                    'authors' => mb_substr($author, 0, 240),
                    'year' => $year,
                    'journal' => mb_substr($journal, 0, 240),
                    'author_year' => mb_substr($authorYear, 0, 240),
                    'evidence_level' => $this->classifyEvidenceLevel($title),
                    'doi' => ltrim($doi, '/'),
                    'doi_or_url' => 'https://doi.org/' . ltrim($doi, '/'),
                ];

                if (count($references) >= $limit) {
                    break;
                }
            }

            return $references;
        } catch (\Throwable $e) {
            Log::info('Europe PMC lookup dilewati: ' . $e->getMessage());
            return [];
        }
    }

    private function queryCrossref(string $scientificName, int $limit): array
    {
        try {
            $response = Http::withOptions(['force_ip_resolve' => 'v4', 'version' => 1.1])
                ->connectTimeout(4)
                ->timeout(7)
                ->withHeaders([
                    'Accept' => 'application/json',
                    'User-Agent' => 'HerbalScan-BotanicalApp/1.0 (mailto:research@herbalscan.local)',
                ])
                ->get('https://api.crossref.org/works', [
                    'query.title' => $scientificName,
                    'filter' => 'type:journal-article,from-pub-date:' . self::MIN_YEAR . '-01-01',
                    'rows' => $limit + 4,
                    'sort' => 'is-referenced-by-count',
                    'order' => 'desc',
                ]);

            if (!$response->successful()) {
                return [];
            }

            $items = $response->json('message.items', []);
            $references = [];

            foreach ($items as $work) {
                $doi = trim((string) ($work['DOI'] ?? ''));
                $titleArr = $work['title'] ?? [];
                $title = trim(strip_tags((string) (is_array($titleArr) ? ($titleArr[0] ?? '') : $titleArr)));
                $year = (int) ($work['published']['date-parts'][0][0] ?? 0);

                if ($doi === '' || $title === '' || $year < self::MIN_YEAR) {
                    continue;
                }

                $authorNames = [];
                foreach (array_slice($work['author'] ?? [], 0, 3) as $a) {
                    $family = trim((string) ($a['family'] ?? ''));
                    if ($family !== '') {
                        $authorNames[] = $family;
                    }
                }
                $authorStr = !empty($authorNames) ? implode(', ', $authorNames) . ' et al.' : 'Peer-Reviewed Authors';
                $container = $work['container-title'][0] ?? 'Peer-Reviewed Academic Journal';

                $references[] = [
                    'title' => rtrim($title, '.'),
                    'authors' => mb_substr($authorStr, 0, 240),
                    'year' => $year,
                    'journal' => mb_substr((string) $container, 0, 240),
                    'author_year' => mb_substr("{$authorStr} ({$year})", 0, 240),
                    'evidence_level' => $this->classifyEvidenceLevel($title),
                    'doi' => ltrim($doi, '/'),
                    'doi_or_url' => 'https://doi.org/' . ltrim($doi, '/'),
                ];

                if (count($references) >= $limit) {
                    break;
                }
            }

            return $references;
        } catch (\Throwable $e) {
            Log::info('Crossref lookup dilewati: ' . $e->getMessage());
            return [];
        }
    }

    private function queryOpenAlex(string $scientificName, int $limit): array
    {
        try {
            $response = Http::withOptions(['force_ip_resolve' => 'v4', 'version' => 1.1])
                ->connectTimeout(4)
                ->timeout(7)
                ->withHeaders([
                    'Accept' => 'application/json',
                    'User-Agent' => 'HerbalScan-BotanicalApp/1.0',
                ])
                ->get('https://api.openalex.org/works', [
                    'search' => $scientificName,
                    'filter' => 'has_doi:true,type:article,from_publication_date:' . self::MIN_YEAR . '-01-01',
                    'per-page' => $limit + 4,
                    'sort' => 'cited_by_count:desc',
                ]);

            if (!$response->successful()) {
                return [];
            }

            $results = $response->json('results', []);
            $references = [];

            foreach ($results as $work) {
                $rawDoi = trim((string) ($work['doi'] ?? ''));
                $title = trim(strip_tags((string) ($work['title'] ?? '')));
                $year = (int) ($work['publication_year'] ?? 0);

                if ($rawDoi === '' || $title === '' || $year < self::MIN_YEAR) {
                    continue;
                }

                $doiUrl = str_starts_with($rawDoi, 'http') ? $rawDoi : 'https://doi.org/' . ltrim($rawDoi, '/');
                $cleanDoi = preg_replace('#^https?://doi\.org/#i', '', $doiUrl);

                $authorNames = [];
                foreach (array_slice($work['authorships'] ?? [], 0, 3) as $auth) {
                    $name = trim((string) ($auth['author']['display_name'] ?? ''));
                    if ($name !== '') {
                        $authorNames[] = $name;
                    }
                }
                $authorStr = !empty($authorNames) ? implode(', ', $authorNames) : 'Peer-Reviewed Authors';
                $journal = trim((string) ($work['primary_location']['source']['display_name'] ?? 'Academic Journal'));

                $references[] = [
                    'title' => rtrim($title, '.'),
                    'authors' => mb_substr($authorStr, 0, 240),
                    'year' => $year,
                    'journal' => mb_substr($journal, 0, 240),
                    'author_year' => mb_substr("{$authorStr} ({$year})", 0, 240),
                    'evidence_level' => $this->classifyEvidenceLevel($title),
                    'doi' => $cleanDoi,
                    'doi_or_url' => $doiUrl,
                ];

                if (count($references) >= $limit) {
                    break;
                }
            }

            return $references;
        } catch (\Throwable $e) {
            Log::info('OpenAlex lookup dilewati: ' . $e->getMessage());
            return [];
        }
    }

    private function classifyEvidenceLevel(string $title): string
    {
        $lowerTitle = strtolower($title);
        if (str_contains($lowerTitle, 'randomized') || str_contains($lowerTitle, 'clinical trial') || str_contains($lowerTitle, 'human')) {
            return 'Uji Klinis';
        }
        if (str_contains($lowerTitle, 'in vivo') || str_contains($lowerTitle, 'mice') || str_contains($lowerTitle, 'rats')) {
            return 'Pra-Klinis (In Vivo)';
        }
        if (str_contains($lowerTitle, 'in vitro') || str_contains($lowerTitle, 'antioxidant') || str_contains($lowerTitle, 'antibacterial')) {
            return 'Uji Laboratorium (In Vitro)';
        }

        return 'Kajian Fitokimia';
    }

    private function mergeUniqueRefs(array $primary, array $secondary, int $limit): array
    {
        $seen = [];
        $merged = [];

        foreach (array_merge($primary, $secondary) as $ref) {
            $key = strtolower($ref['doi_or_url'] ?? $ref['title']);
            if (isset($seen[$key])) {
                continue;
            }
            $seen[$key] = true;
            $merged[] = $ref;
            if (count($merged) >= $limit) {
                break;
            }
        }

        return $merged;
    }
}
