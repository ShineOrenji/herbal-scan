<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Herbal;
use App\Models\ScanHistory;
use App\Models\ScientificReference;
use App\Services\BotanicalImageService;
use App\Services\EuropePmcService;
use App\Services\HerbalVisionService;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Facades\Schema;
use Illuminate\Support\Facades\Storage;
use Illuminate\Support\Str;
use Symfony\Component\Process\Process;

class HerbalController extends Controller
{
    private const MIN_JOURNAL_YEAR = 2020;

    public function __construct(
        private readonly HerbalVisionService $visionService,
        private readonly EuropePmcService $journalService,
        private readonly BotanicalImageService $botanicalImageService,
    ) {}

    public function index(Request $request): JsonResponse
    {
        $search = trim((string) $request->query('q', ''));

        $query = Herbal::withCount('references')
            ->orderByDesc('is_curated')
            ->orderByDesc('updated_at')
            ->orderBy('name', 'asc');

        if ($search !== '') {
            $query->where(function ($q) use ($search) {
                $q->where('name', 'LIKE', "%{$search}%")
                    ->orWhere('scientific_name', 'LIKE', "%{$search}%")
                    ->orWhere('local_name', 'LIKE', "%{$search}%");
            });
        }

        $herbals = $query->get();

        $missingMap = [];
        foreach ($herbals as $item) {
            $needsPhoto = empty($item->image_url) || str_contains(strtolower((string) $item->image_url), 'wikimedia.org');
            if ($needsPhoto && !empty($item->scientific_name)) {
                $missingMap[$item->id] = [
                    'scientific_name' => $item->scientific_name,
                    'name' => $item->name,
                ];
            }
        }

        if (!empty($missingMap)) {
            try {
                $batchPhotos = $this->botanicalImageService->fetchBatchReferencePhotos($missingMap);
                foreach ($herbals as $item) {
                    if (isset($batchPhotos[$item->id])) {
                        $photoUrl = $batchPhotos[$item->id];
                        Model::unguarded(fn () => $item->update(['image_url' => $photoUrl]));
                        $item->image_url = $photoUrl;
                    }
                }
            } catch (\Throwable $e) {
                Log::info('Batch foto di index dilewati: ' . $e->getMessage());
            }
        }

        return response()->json([
            'status' => 'success',
            'data' => $herbals,
        ]);
    }

    public function showBySlug(string $slug): JsonResponse
    {
        $herbal = Herbal::with('references')
            ->where('slug', $slug)
            ->firstOrFail();

        $needsPhoto = empty($herbal->image_url) || str_contains(strtolower((string) $herbal->image_url), 'wikimedia.org');
        if ($needsPhoto && !empty($herbal->scientific_name)) {
            try {
                $refPhoto = $this->botanicalImageService->fetchReferencePhoto($herbal->scientific_name, $herbal->name);
                if ($refPhoto) {
                    Model::unguarded(fn () => $herbal->update(['image_url' => $refPhoto]));
                    $herbal->image_url = $refPhoto;
                }
            } catch (\Throwable $e) {
                Log::info('Ambil foto detail dilewati: ' . $e->getMessage());
            }
        }

        // Bersihkan referensi lawas (< 2020) jika pernah tersimpan sebelumnya
        $staleIds = [];
        foreach ($herbal->references as $existingRef) {
            $refYear = $this->extractReferenceYear($existingRef);
            if ($refYear > 0 && $refYear < self::MIN_JOURNAL_YEAR) {
                $staleIds[] = $existingRef->id;
            }
        }

        if (!empty($staleIds)) {
            ScientificReference::whereIn('id', $staleIds)->delete();
            $herbal->load('references');
        }

        $fetchedFallbackRefs = [];

        if ($herbal->references->count() < 2 && !empty($herbal->scientific_name)) {
            try {
                $references = $this->journalService->fetchReferences($herbal->scientific_name, 3);
                if (!empty($references)) {
                    $fetchedFallbackRefs = $references;
                    $this->persistScientificReferences($herbal, $references);
                    $herbal->load('references');
                }
            } catch (\Throwable $e) {
                Log::warning('Ambil/simpan jurnal detail dilewati: ' . $e->getMessage());
            }
        }

        $payload = $herbal->toArray();

        if (empty($payload['references']) && !empty($fetchedFallbackRefs)) {
            $payload['references'] = array_map(function ($ref, $index) {
                return [
                    'id' => $index + 1,
                    'title' => $ref['title'],
                    'author_year' => $ref['author_year'],
                    'authors' => $ref['authors'] ?? $ref['author_year'],
                    'year' => $ref['year'] ?? (int) date('Y'),
                    'journal' => $ref['journal'] ?? 'Peer-Reviewed Journal',
                    'evidence_level' => $ref['evidence_level'],
                    'doi' => $ref['doi'] ?? '',
                    'doi_or_url' => $ref['doi_or_url'],
                    'url' => $ref['doi_or_url'],
                ];
            }, $fetchedFallbackRefs, array_keys($fetchedFallbackRefs));
        }

        return response()->json([
            'status' => 'success',
            'data' => $payload,
        ]);
    }

    private function extractReferenceYear(ScientificReference $ref): int
    {
        if (!empty($ref->year) && is_numeric($ref->year)) {
            return (int) $ref->year;
        }

        $authorYear = (string) ($ref->author_year ?? '');
        if (preg_match('/\b(19\d{2}|20\d{2})\b/', $authorYear, $matches)) {
            return (int) $matches[1];
        }

        return 0;
    }

    private function persistScientificReferences(Herbal $herbal, array $references): void
    {
        try {
            $columns = Schema::getColumnListing('scientific_references');

            Model::unguarded(function () use ($herbal, $references, $columns) {
                foreach ($references as $ref) {
                    if (($ref['year'] ?? 0) < self::MIN_JOURNAL_YEAR) {
                        continue;
                    }

                    $attributes = [
                        'herbal_id' => $herbal->id,
                        'title' => mb_substr($ref['title'], 0, 250),
                    ];

                    $values = [];
                    if (in_array('author_year', $columns, true)) {
                        $values['author_year'] = $ref['author_year'];
                    }
                    if (in_array('authors', $columns, true)) {
                        $values['authors'] = $ref['authors'] ?? $ref['author_year'];
                    }
                    if (in_array('year', $columns, true)) {
                        $values['year'] = $ref['year'] ?? (int) date('Y');
                    }
                    if (in_array('journal', $columns, true)) {
                        $values['journal'] = $ref['journal'] ?? 'Peer-Reviewed Journal';
                    }
                    if (in_array('evidence_level', $columns, true)) {
                        $values['evidence_level'] = $ref['evidence_level'];
                    }
                    if (in_array('doi_or_url', $columns, true)) {
                        $values['doi_or_url'] = $ref['doi_or_url'];
                    }
                    if (in_array('doi', $columns, true)) {
                        $values['doi'] = $ref['doi'] ?? '';
                    }
                    if (in_array('url', $columns, true)) {
                        $values['url'] = $ref['doi_or_url'];
                    }

                    ScientificReference::firstOrCreate($attributes, $values);
                }
            });
        } catch (\Throwable $e) {
            Log::warning('Persist scientific_references fallback aktif: ' . $e->getMessage());
        }
    }

    public function histories(Request $request): JsonResponse
    {
        $user = $request->user('sanctum');
        if (!$user) {
            return response()->json([
                'status' => 'success',
                'requires_auth' => true,
                'data' => [],
            ]);
        }

        $hostUrl = rtrim($request->getSchemeAndHttpHost(), '/');

        $items = ScanHistory::with('herbal')
            ->where('user_id', $user->id)
            ->orderByDesc('created_at')
            ->limit(60)
            ->get()
            ->map(function (ScanHistory $history) use ($hostUrl) {
                $fullPhotoUrl = !empty($history->image_path)
                    ? (str_starts_with($history->image_path, 'http') ? $history->image_path : $hostUrl . '/storage/' . ltrim($history->image_path, '/'))
                    : null;

                return [
                    'id' => $history->id,
                    'detected_slug' => $history->detected_slug,
                    'confidence_score' => round((float) $history->confidence_score),
                    'image_url' => $fullPhotoUrl,
                    'created_at' => $history->created_at?->toIso8601String(),
                    'plant_name' => $history->herbal?->name ?? Str::headline($history->detected_slug),
                    'scientific_name' => $history->herbal?->scientific_name ?? '',
                    'is_toxic' => str_contains(strtolower((string) ($history->herbal?->name ?? '')), 'beracun'),
                ];
            });

        return response()->json([
            'status' => 'success',
            'data' => $items,
        ]);
    }

    public function destroyHistory(Request $request, int $id): JsonResponse
    {
        $user = $request->user('sanctum');
        if (!$user) {
            return response()->json([
                'status' => 'error',
                'message' => 'Silakan masuk terlebih dahulu.',
            ], 401);
        }

        $history = ScanHistory::where('user_id', $user->id)
            ->where('id', $id)
            ->firstOrFail();

        $this->deleteFileIfUnused($history->image_path, $history->id);
        $history->delete();

        return response()->json([
            'status' => 'success',
            'message' => 'Riwayat pemindaian berhasil dihapus.',
        ]);
    }

    public function clearHistories(Request $request): JsonResponse
    {
        $user = $request->user('sanctum');
        if (!$user) {
            return response()->json([
                'status' => 'error',
                'message' => 'Silakan masuk terlebih dahulu.',
            ], 401);
        }

        $items = ScanHistory::where('user_id', $user->id)->get();
        foreach ($items as $item) {
            $this->deleteFileIfUnused($item->image_path, $item->id);
            $item->delete();
        }

        return response()->json([
            'status' => 'success',
            'message' => 'Seluruh riwayat pemindaian berhasil dibersihkan.',
        ]);
    }

    public function identify(Request $request): JsonResponse
    {
        @set_time_limit(120);

        $request->validate([
            'image' => ['required', 'image', 'mimes:jpg,jpeg,png,webp', 'max:20480'],
        ]);

        $hostUrl = rtrim($request->getSchemeAndHttpHost(), '/');
        $fullImagePath = $request->file('image')->getRealPath();
        $publicScanPath = null;
        $userId = $request->user('sanctum')?->id;

        $knownSpecies = Herbal::select('name', 'scientific_name')
            ->orderBy('id', 'asc')
            ->get()
            ->toArray();

        try {
            $vision = $this->visionService->identifyPlant($fullImagePath, $knownSpecies);
        } catch (\Throwable $visionError) {
            Log::warning('Vision AI gagal, mencoba fallback TFLite offline: ' . $visionError->getMessage());

            $tfliteResult = $this->runLocalTflite($fullImagePath);
            if (
                ($tfliteResult['is_herbal'] ?? false) === true &&
                ($tfliteResult['confidence'] ?? 0) >= 85
            ) {
                $fallbackHerbal = Herbal::where('slug', $tfliteResult['slug'])->first();
                if ($fallbackHerbal) {
                    $publicScanPath = app(\App\Services\CloudinaryService::class)->upload($fullImagePath, 'herbal-scan/history_scans');
                    $history = $userId !== null
                        ? $this->recordHistory($userId, $fallbackHerbal->slug, (float) $tfliteResult['confidence'], $publicScanPath)
                        : null;

                    $scanFrameUrl = $publicScanPath;

                    return $this->formatSuccessResponse(
                        [
                            $this->buildDetectedPlantPayload(
                                $fallbackHerbal,
                                (int) $tfliteResult['confidence'],
                                false,
                                [150, 150, 850, 850],
                                $history,
                                $scanFrameUrl
                            ),
                        ],
                        'tflite_offline_fallback',
                        $scanFrameUrl
                    );
                }
            }

            return response()->json([
                'status' => 'error',
                'message' => $visionError->getMessage(),
            ], 502);
        }

        $isPlant = (bool) ($vision['is_plant'] ?? false);
        $isCookedFood = (bool) ($vision['is_cooked_or_processed_food'] ?? false);
        $rawDetected = is_array($vision['detected_plants'] ?? null) ? $vision['detected_plants'] : [];

        if (!$isPlant || $isCookedFood || empty($rawDetected)) {
            $defaultMsg = $isCookedFood
                ? 'Objek terdeteksi sebagai olahan masakan/makanan matang. HerbalScan hanya memindai spesimen tumbuhan segar/mentah.'
                : (!$isPlant
                    ? 'Objek pada foto tidak terdeteksi sebagai tumbuhan. Arahkan kamera ke daun, batang, atau bunga segar.'
                    : 'Ciri morfologi tumbuhan belum cukup jelas untuk dipastikan spesiesnya. Coba foto ulang lebih dekat dengan pencahayaan terang.');

            $rejectPayload = [
                'mode' => 'rejected',
                'slug' => 'bukan_herbal',
                'confidence' => 0,
                'is_herbal' => false,
                'is_toxic' => false,
                'message' => !empty($vision['rejection_reason']) ? $vision['rejection_reason'] : $defaultMsg,
                'plants' => [],
                'top_3' => [],
                'source' => $isCookedFood ? 'cooked_food_rejected' : 'vision_uncertain_rejected',
            ];

            return response()->json([
                'status' => 'success',
                'data' => $rejectPayload,
                ...$rejectPayload,
            ]);
        }

        $validPlantsPayload = [];
        $seenSlugsInFrame = [];
        $scanFrameUrl = '';

        foreach ($rawDetected as $plantData) {
            $confidence = (int) ($plantData['confidence'] ?? 0);
            $isConfidentSpecies = (bool) ($plantData['is_confident_species'] ?? false);

            if ($confidence < 55 || (!$isConfidentSpecies && $confidence < 65)) {
                continue;
            }

            $herbal = $this->upsertGlobalHerbal($plantData);
            if (!$herbal || isset($seenSlugsInFrame[$herbal->slug])) {
                continue;
            }

            $seenSlugsInFrame[$herbal->slug] = true;

            if ($publicScanPath === null) {
                $publicScanPath = app(\App\Services\CloudinaryService::class)->upload($fullImagePath, 'herbal-scan/history_scans');
                $scanFrameUrl = $publicScanPath;
            }

            $history = $userId !== null
                ? $this->recordHistory($userId, $herbal->slug, (float) $confidence, $publicScanPath)
                : null;

            $validPlantsPayload[] = $this->buildDetectedPlantPayload(
                $herbal,
                $confidence,
                (bool) ($plantData['is_toxic'] ?? false),
                $plantData['box_2d'] ?? null,
                $history,
                $scanFrameUrl
            );
        }

        if (empty($validPlantsPayload)) {
            $rejectPayload = [
                'mode' => 'rejected',
                'slug' => 'bukan_herbal',
                'confidence' => 0,
                'is_herbal' => false,
                'is_toxic' => false,
                'message' => !empty($vision['rejection_reason'])
                    ? $vision['rejection_reason']
                    : 'Bentuk helai dan tangkai daun belum terlihat cukup tajam untuk memastikan spesiesnya secara akurat. Coba foto ulang lebih dekat.',
                'plants' => [],
                'top_3' => [],
                'source' => 'low_confidence_rejected',
            ];

            return response()->json([
                'status' => 'success',
                'data' => $rejectPayload,
                ...$rejectPayload,
            ]);
        }

        return $this->formatSuccessResponse(
            $validPlantsPayload,
            'hybrid_vision_inaturalist_gbif',
            $scanFrameUrl
        );
    }

    private function upsertGlobalHerbal(array $plantData): ?Herbal
    {
        $canonicalScientific = $this->visionService->canonicalScientificName((string) ($plantData['scientific_name'] ?? ''));
        $commonName = trim((string) ($plantData['common_name_id'] ?? ''));
        if ($commonName === '') {
            return null;
        }

        $baseNameWithoutTag = preg_replace('/\s*\(Beracun\)\s*/i', '', $commonName);
        $rawSlug = Str::slug($baseNameWithoutTag, '_');
        $coreSlug = preg_replace('/^(daun|pohon|tanaman|bunga|buah|rimpang|akar)_/', '', $rawSlug);

        $slugCandidates = array_values(array_unique(array_filter([$rawSlug, $coreSlug, 'daun_' . $coreSlug])));
        $herbal = Herbal::whereIn('slug', $slugCandidates)->first();

        if (!$herbal && $canonicalScientific !== '') {
            $herbal = Herbal::where('scientific_name', $canonicalScientific)->first();
        }

        $isToxic = (bool) ($plantData['is_toxic'] ?? false);
        $formattedWarning = $isToxic
            ? "⚠️ PERINGATAN TANAMAN BERACUN: {$plantData['safety_warning']}"
            : $plantData['safety_warning'];

        if (!$herbal) {
            $herbal = Model::unguarded(function () use ($plantData, $rawSlug, $commonName, $canonicalScientific, $formattedWarning) {
                return Herbal::firstOrCreate(
                    ['slug' => $rawSlug],
                    [
                        'name' => Str::limit($commonName, 250, ''),
                        'scientific_name' => Str::limit($canonicalScientific, 250, ''),
                        'local_name' => Str::limit(trim((string) ($plantData['local_name'] ?? '')) ?: $commonName, 250, ''),
                        'description' => $plantData['description'],
                        'plant_parts_used' => Str::limit((string) ($plantData['plant_parts_used'] ?? 'Daun'), 250, ''),
                        'traditional_usage' => $plantData['traditional_usage'],
                        'lab_evidence' => $plantData['lab_evidence'] ?: null,
                        'clinical_evidence' => $plantData['clinical_evidence'] ?: null,
                        'safety_warning' => $formattedWarning,
                        'image_url' => null,
                        'is_curated' => true,
                    ]
                );
            });
        } else {
            Model::unguarded(function () use ($herbal, $isToxic, $commonName, $formattedWarning, $plantData) {
                $updates = ['is_curated' => true];

                if ($isToxic && !str_contains(strtolower($herbal->name), 'beracun')) {
                    $updates['name'] = Str::limit($commonName, 250, '');
                    $updates['traditional_usage'] = $plantData['traditional_usage'];
                    $updates['lab_evidence'] = $plantData['lab_evidence'] ?: $herbal->lab_evidence;
                    $updates['clinical_evidence'] = $plantData['clinical_evidence'] ?: $herbal->clinical_evidence;
                    $updates['safety_warning'] = $formattedWarning;
                }

                $herbal->update($updates);
            });
        }

        return $herbal;
    }

    private function buildDetectedPlantPayload(
        Herbal $herbal,
        int $confidence,
        bool $isToxic,
        ?array $box2d,
        ?ScanHistory $history,
        string $scanFrameUrl
    ): array {
        return [
            'slug' => $herbal->slug,
            'name' => $herbal->name,
            'scientific_name' => $herbal->scientific_name,
            'plant_parts_used' => $herbal->plant_parts_used,
            'confidence' => $confidence,
            'is_toxic' => $isToxic || str_contains(strtolower($herbal->name), 'beracun'),
            'box_2d' => $box2d,
            'reference_image_url' => $herbal->image_url,
            'scan_image_url' => $scanFrameUrl,
            'history_id' => $history?->id,
        ];
    }

    private function recordHistory(?int $userId, string $slug, float $confidence, string $newImagePath): ScanHistory
    {
        $existing = ScanHistory::where('detected_slug', $slug)
            ->when(
                $userId !== null,
                fn ($q) => $q->where('user_id', $userId),
                fn ($q) => $q->whereNull('user_id')
            )
            ->first();

        if ($existing) {
            $oldPath = $existing->image_path;
            $existing->confidence_score = $confidence;
            $existing->image_path = $newImagePath;
            $existing->created_at = now();
            $existing->updated_at = now();
            $existing->save();

            if (!empty($oldPath) && $oldPath !== $newImagePath) {
                $this->deleteFileIfUnused($oldPath, $existing->id);
            }

            return $existing;
        }

        return ScanHistory::create([
            'user_id' => $userId,
            'detected_slug' => $slug,
            'confidence_score' => $confidence,
            'image_path' => $newImagePath,
        ]);
    }

    private function deleteFileIfUnused(?string $imagePath, int $excludeHistoryId): void
    {
        if (empty($imagePath)) {
            return;
        }

        $stillUsed = ScanHistory::where('image_path', $imagePath)
            ->where('id', '!=', $excludeHistoryId)
            ->exists();

        if (!$stillUsed) {
            if (str_starts_with($imagePath, 'http')) {
                app(\App\Services\CloudinaryService::class)->deleteByUrl($imagePath);
            } else {
                Storage::disk('public')->delete($imagePath);
            }
        }
    }

    private function formatSuccessResponse(
        array $plants,
        string $source,
        string $scanFrameUrl
    ): JsonResponse {
        $primary = $plants[0];
        $mode = count($plants) > 1 ? 'multiple' : 'single';

        $top3 = array_map(fn ($p) => [
            'slug' => $p['slug'],
            'confidence' => $p['confidence'],
        ], array_slice($plants, 0, 3));

        $payload = [
            'mode' => $mode,
            'count' => count($plants),
            'slug' => $primary['slug'],
            'name' => $primary['name'],
            'scientific_name' => $primary['scientific_name'],
            'confidence' => $primary['confidence'],
            'is_herbal' => true,
            'is_toxic' => $primary['is_toxic'],
            'plants' => $plants,
            'top_3' => $top3,
            'source' => $source,
            'history_id' => $primary['history_id'],
            'scan_image_url' => $scanFrameUrl,
        ];

        return response()->json([
            'status' => 'success',
            'data' => $payload,
            ...$payload,
        ]);
    }

    private function runLocalTflite(string $imagePath): array
    {
        $scriptPath = base_path('predict.py');
        $modelPath = base_path('../mobile/assets/model/herbal_model.tflite');
        $labelsPath = base_path('../mobile/assets/model/labels.txt');

        if (!file_exists($scriptPath) || !file_exists($modelPath)) {
            return ['is_herbal' => false, 'confidence' => 0];
        }

        try {
            $process = new Process(['python3', $scriptPath, $imagePath, $modelPath, $labelsPath]);
            $process->setTimeout(25);
            $process->run();

            if (!$process->isSuccessful()) {
                return ['is_herbal' => false, 'confidence' => 0];
            }

            $decoded = json_decode(trim($process->getOutput()), true);
            return is_array($decoded) ? $decoded : ['is_herbal' => false, 'confidence' => 0];
        } catch (\Throwable $e) {
            Log::warning('TFLite lokal dilewati: ' . $e->getMessage());
            return ['is_herbal' => false, 'confidence' => 0];
        }
    }
}