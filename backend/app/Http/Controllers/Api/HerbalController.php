<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Herbal;
use App\Models\ScientificReference;
use App\Services\EuropePmcService;
use App\Services\HerbalVisionService;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Facades\Storage;
use Illuminate\Support\Str;
use Symfony\Component\Process\Process;

class HerbalController extends Controller
{
    public function __construct(
        private readonly HerbalVisionService $visionService,
        private readonly EuropePmcService $journalService,
    ) {}

    public function index(): JsonResponse
    {
        $herbals = Herbal::orderBy('name', 'asc')->get();

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

        if ($herbal->references->count() < 2 && !empty($herbal->scientific_name)) {
            $references = $this->journalService->fetchReferences($herbal->scientific_name, 3);
            Model::unguarded(function () use ($herbal, $references) {
                foreach ($references as $ref) {
                    ScientificReference::firstOrCreate(
                        [
                            'herbal_id' => $herbal->id,
                            'title' => $ref['title'],
                        ],
                        [
                            'author_year' => $ref['author_year'],
                            'evidence_level' => $ref['evidence_level'],
                            'doi_or_url' => $ref['doi_or_url'],
                        ]
                    );
                }
            });
            $herbal->load('references');
        }

        return response()->json([
            'status' => 'success',
            'data' => $herbal,
        ]);
    }

    public function identify(Request $request): JsonResponse
    {
        $request->validate([
            'image' => ['required', 'image', 'mimes:jpg,jpeg,png,webp', 'max:20480'],
        ]);

        $storedPath = $request->file('image')->store('scans', 'local');
        $fullImagePath = Storage::disk('local')->path($storedPath);

        try {
            // =================================================================
            // TAHAP 1: ANALISIS VISUAL PRESISI (Mendeteksi Semua Spesies & Racun)
            // =================================================================
            try {
                $vision = $this->visionService->identifyPlant($fullImagePath);
            } catch (\Throwable $visionError) {
                Log::warning('Vision AI gagal, mengaktifkan fallback TFLite offline: ' . $visionError->getMessage());

                $tfliteResult = $this->runLocalTflite($fullImagePath);
                if (
                    ($tfliteResult['is_herbal'] ?? false) === true &&
                    ($tfliteResult['confidence'] ?? 0) >= 82
                ) {
                    $fallbackHerbal = Herbal::where('slug', $tfliteResult['slug'])->first();
                    if ($fallbackHerbal) {
                        return $this->formatSuccessResponse(
                            $fallbackHerbal->slug,
                            (int) $tfliteResult['confidence'],
                            $tfliteResult['top_3'] ?? [],
                            'tflite_offline_fallback'
                        );
                    }
                }

                return response()->json([
                    'status' => 'error',
                    'message' => $visionError->getMessage(),
                ], 502);
            }

            // Tolak hanya jika BUKAN tumbuhan atau tingkat keyakinan terlalu rendah
            if (
                !($vision['is_plant'] ?? false) ||
                (!$vision['is_medicinal_herb'] && !$vision['is_toxic']) ||
                ($vision['confidence'] ?? 0) < 60
            ) {
                $rejectPayload = [
                    'slug' => 'bukan_herbal',
                    'confidence' => (int) ($vision['confidence'] ?? 0),
                    'is_herbal' => false,
                    'is_toxic' => false,
                    'message' => 'Objek tidak terdeteksi sebagai tumbuhan. Arahkan kamera lebih dekat ke daun, batang, atau bunga.',
                    'top_3' => [],
                    'source' => 'vision_rejected',
                ];

                return response()->json([
                    'status' => 'success',
                    'data' => $rejectPayload,
                    ...$rejectPayload,
                ]);
            }

            // =================================================================
            // TAHAP 2: SIMPAN / PERBARUI DATA BOTANI & TOKSIKOLOGI + JURNAL DOI
            // =================================================================
            $scientificName = trim($vision['scientific_name']);
            $commonName = trim($vision['common_name_id']);
            $baseNameWithoutTag = preg_replace('/\s*\(Beracun\)\s*/i', '', $commonName);
            $rawSlug = Str::slug($baseNameWithoutTag, '_');
            $shortSlug = preg_replace('/^daun_/', '', $rawSlug);

            $herbal = Herbal::whereIn('slug', [$rawSlug, $shortSlug])
                ->orWhere(function ($q) use ($scientificName) {
                    if ($scientificName !== '') {
                        $q->where('scientific_name', 'LIKE', "%{$scientificName}%");
                    }
                })
                ->first();

            $formattedWarning = ($vision['is_toxic'] ?? false)
                ? "⚠️ PERINGATAN TANAMAN BERACUN: {$vision['safety_warning']}"
                : $vision['safety_warning'];

            if (!$herbal) {
                $herbal = Model::unguarded(function () use ($vision, $rawSlug, $commonName, $scientificName, $formattedWarning) {
                    return Herbal::firstOrCreate(
                        ['slug' => $rawSlug],
                        [
                            'name' => Str::limit($commonName, 250, ''),
                            'scientific_name' => Str::limit($scientificName, 250, ''),
                            'local_name' => Str::limit(trim($vision['local_name'] ?? '') ?: $commonName, 250, ''),
                            'description' => $vision['description'],
                            'plant_parts_used' => Str::limit($vision['plant_parts_used'], 250, ''),
                            'traditional_usage' => $vision['traditional_usage'],
                            'lab_evidence' => $vision['lab_evidence'] ?: null,
                            'clinical_evidence' => $vision['clinical_evidence'] ?: null,
                            'safety_warning' => $formattedWarning,
                            'image_url' => null,
                        ]
                    );
                });
            } elseif ($vision['is_toxic'] ?? false) {
                Model::unguarded(function () use ($herbal, $commonName, $formattedWarning, $vision) {
                    $herbal->update([
                        'name' => Str::limit($commonName, 250, ''),
                        'traditional_usage' => $vision['traditional_usage'],
                        'lab_evidence' => $vision['lab_evidence'] ?: $herbal->lab_evidence,
                        'clinical_evidence' => $vision['clinical_evidence'] ?: $herbal->clinical_evidence,
                        'safety_warning' => $formattedWarning,
                    ]);
                });
            }

            if ($herbal->references()->count() < 2 && $scientificName !== '') {
                $references = $this->journalService->fetchReferences($scientificName, 3);

                Model::unguarded(function () use ($herbal, $references) {
                    foreach ($references as $ref) {
                        ScientificReference::firstOrCreate(
                            [
                                'herbal_id' => $herbal->id,
                                'title' => $ref['title'],
                            ],
                            [
                                'author_year' => $ref['author_year'],
                                'evidence_level' => $ref['evidence_level'],
                                'doi_or_url' => $ref['doi_or_url'],
                            ]
                        );
                    }
                });
            }

            return $this->formatSuccessResponse(
                $herbal->slug,
                (int) $vision['confidence'],
                [
                    [
                        'slug' => $herbal->slug,
                        'confidence' => (int) $vision['confidence'],
                    ],
                ],
                'hybrid_vision_europepmc'
            );
        } finally {
            Storage::disk('local')->delete($storedPath);
        }
    }

    private function formatSuccessResponse(string $slug, int $confidence, array $top3, string $source): JsonResponse
    {
        $payload = [
            'slug' => $slug,
            'confidence' => $confidence,
            'is_herbal' => true,
            'top_3' => $top3,
            'source' => $source,
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
