<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Herbal;
use App\Models\HerbBotMessage;
use App\Models\HerbBotSession;
use App\Services\HerbBotService;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\Schema;
use Illuminate\Support\Str;

class HerbBotController extends Controller
{
    public function __construct(
        private readonly HerbBotService $herbBotService
    ) {}

    private function ensureTablesExist(): void
    {
        if (Cache::get('herbbot_tables_ready_v1')) {
            return;
        }

        if (!Schema::hasTable('herbbot_sessions')) {
            Schema::create('herbbot_sessions', function (Blueprint $table) {
                $table->id();
                $table->unsignedBigInteger('user_id')->index();
                $table->string('plant_slug', 140)->nullable()->index();
                $table->string('title', 160);
                $table->timestamps();
                $table->index(['user_id', 'plant_slug']);
            });
        }

        if (!Schema::hasTable('herbbot_messages')) {
            Schema::create('herbbot_messages', function (Blueprint $table) {
                $table->id();
                $table->unsignedBigInteger('session_id')->index();
                $table->string('role', 20);
                $table->text('content');
                $table->timestamps();
            });
        }

        Cache::put('herbbot_tables_ready_v1', true, now()->addDays(7));
    }

    private function sanitizeStoredText(string $raw): string
    {
        $trimmed = trim($raw);
        if (str_starts_with($trimmed, '{') && str_contains($trimmed, '"reply"')) {
            $decoded = json_decode($trimmed, true);
            if (is_array($decoded) && !empty($decoded['reply'])) {
                return trim((string) $decoded['reply']);
            }
            $extracted = preg_replace('/^\{\s*"reply"\s*:\s*"?/i', '', $trimmed);
            $extracted = preg_replace('/"?\s*,?\s*"suggestions"\s*:[\s\S]*$/i', '', (string) $extracted);
            $extracted = preg_replace('/"\s*\}$/', '', (string) $extracted);
            return trim(str_replace(['\\n', '\\"'], ["\n", '"'], (string) $extracted));
        }

        return trim((string) preg_replace('/<<<SUGGESTIONS>>>[\s\S]*$/', '', $trimmed));
    }

    public function listSessions(Request $request): JsonResponse
    {
        $user = $request->user();

        $sessions = HerbBotSession::where('user_id', $user->id)
            ->whereNull('plant_slug')
            ->has('messages')
            ->withCount('messages')
            ->orderByDesc('updated_at')
            ->limit(30)
            ->get()
            ->map(fn (HerbBotSession $s) => [
                'id' => $s->id,
                'title' => $s->title,
                'messages_count' => (int) $s->messages_count,
                'updated_at' => $s->updated_at?->toIso8601String(),
            ]);

        return response()->json([
            'status' => 'success',
            'sessions' => $sessions,
        ]);
    }

    public function getThread(Request $request): JsonResponse
    {
        $user = $request->user();

        $plantSlug = trim((string) $request->query('plant_slug', ''));
        $sessionId = $request->query('session_id');

        $session = null;
        if ($plantSlug !== '') {
            $session = HerbBotSession::where('user_id', $user->id)
                ->where('plant_slug', $plantSlug)
                ->first();
        } elseif (!empty($sessionId)) {
            $session = HerbBotSession::where('user_id', $user->id)
                ->whereNull('plant_slug')
                ->where('id', (int) $sessionId)
                ->first();
        }

        if (!$session) {
            return response()->json([
                'status' => 'success',
                'session' => null,
                'messages' => [],
            ]);
        }

        $messages = $session->messages()
            ->orderBy('id')
            ->get()
            ->map(fn (HerbBotMessage $m) => [
                'id' => $m->id,
                'role' => $m->role,
                'text' => $this->sanitizeStoredText((string) $m->content),
                'created_at' => $m->created_at?->toIso8601String(),
            ]);

        return response()->json([
            'status' => 'success',
            'session' => [
                'id' => $session->id,
                'title' => $session->title,
                'plant_slug' => $session->plant_slug,
                'updated_at' => $session->updated_at?->toIso8601String(),
            ],
            'messages' => $messages,
        ]);
    }

    public function chat(Request $request): JsonResponse
    {
        $user = $request->user();

        $validated = $request->validate([
            'message' => ['required', 'string', 'min:2', 'max:600'],
            'plant_slug' => ['nullable', 'string', 'max:140'],
            'session_id' => ['nullable', 'integer'],
        ]);

        $plant = null;
        $plantSlug = !empty($validated['plant_slug']) ? trim($validated['plant_slug']) : null;
        if ($plantSlug) {
            try {
                $plant = Herbal::where('slug', $plantSlug)->first();
            } catch (\Throwable $e) {
                $plant = null;
            }
        }

        if ($plantSlug) {
            $session = HerbBotSession::firstOrCreate(
                [
                    'user_id' => $user->id,
                    'plant_slug' => $plantSlug,
                ],
                [
                    'title' => $plant ? $plant->name : $plantSlug,
                ]
            );
        } elseif (!empty($validated['session_id'])) {
            $session = HerbBotSession::where('user_id', $user->id)
                ->whereNull('plant_slug')
                ->where('id', (int) $validated['session_id'])
                ->first();

            if (!$session) {
                $session = HerbBotSession::create([
                    'user_id' => $user->id,
                    'plant_slug' => null,
                    'title' => Str::limit(trim($validated['message']), 55),
                ]);
            }
        } else {
            $session = HerbBotSession::create([
                'user_id' => $user->id,
                'plant_slug' => null,
                'title' => Str::limit(trim($validated['message']), 55),
            ]);
        }

        // Bersihkan riwayat lama dari sisa JSON sebelum dikirim sebagai konteks AI
        $history = $session->messages()
            ->orderByDesc('id')
            ->limit(6)
            ->get()
            ->reverse()
            ->values()
            ->map(fn (HerbBotMessage $m) => [
                'role' => $m->role,
                'text' => $this->sanitizeStoredText((string) $m->content),
            ])
            ->all();

        $userMessage = HerbBotMessage::create([
            'session_id' => $session->id,
            'role' => 'user',
            'content' => trim($validated['message']),
        ]);

        try {
            $result = $this->herbBotService->chat(
                $validated['message'],
                $plant,
                $history
            );

            $cleanReply = $this->sanitizeStoredText((string) $result['reply']);

            $botMessage = HerbBotMessage::create([
                'session_id' => $session->id,
                'role' => 'assistant',
                'content' => $cleanReply,
            ]);

            $session->touch();

            return response()->json([
                'status' => 'success',
                'session' => [
                    'id' => $session->id,
                    'title' => $session->title,
                    'plant_slug' => $session->plant_slug,
                    'updated_at' => $session->updated_at?->toIso8601String(),
                ],
                'user_message' => [
                    'id' => $userMessage->id,
                    'role' => 'user',
                    'text' => $userMessage->content,
                ],
                'assistant_message' => [
                    'id' => $botMessage->id,
                    'role' => 'assistant',
                    'text' => $botMessage->content,
                ],
                'suggestions' => $result['suggestions'],
            ]);
        } catch (\Throwable $e) {
            $userMessage->delete();
            if ($session->messages()->count() === 0) {
                $session->delete();
            }

            return response()->json([
                'status' => 'error',
                'message' => $e->getMessage() ?: 'HerbBOT sedang sibuk, silakan coba beberapa saat lagi.',
            ], 503);
        }
    }

    public function deleteMessage(Request $request, int $id): JsonResponse
    {
        $user = $request->user();

        $msg = HerbBotMessage::where('id', $id)
            ->whereHas('session', fn ($q) => $q->where('user_id', $user->id))
            ->first();

        if (!$msg) {
            return response()->json(['status' => 'error', 'message' => 'Pesan tidak ditemukan.'], 404);
        }

        $msg->delete();

        return response()->json(['status' => 'success']);
    }

    public function resetPlantChat(Request $request, string $slug): JsonResponse
    {
        $user = $request->user();

        $sessionIds = HerbBotSession::where('user_id', $user->id)
            ->where('plant_slug', $slug)
            ->pluck('id');

        if ($sessionIds->isNotEmpty()) {
            HerbBotMessage::whereIn('session_id', $sessionIds)->delete();
            HerbBotSession::whereIn('id', $sessionIds)->delete();
        }

        // Bersihkan sisa pesan yatim (orphan) jika ada dari penghapusan lama
        HerbBotMessage::whereNotIn('session_id', HerbBotSession::select('id'))->delete();

        return response()->json(['status' => 'success']);
    }

    public function deleteSession(Request $request, int $id): JsonResponse
    {
        $user = $request->user();

        $session = HerbBotSession::where('user_id', $user->id)
            ->where('id', $id)
            ->first();

        if (!$session) {
            return response()->json(['status' => 'error', 'message' => 'Riwayat tidak ditemukan.'], 404);
        }

        HerbBotMessage::where('session_id', $session->id)->delete();
        $session->delete();

        // Bersihkan sisa pesan yatim (orphan) jika ada dari penghapusan lama
        HerbBotMessage::whereNotIn('session_id', HerbBotSession::select('id'))->delete();

        return response()->json(['status' => 'success']);
    }
}
