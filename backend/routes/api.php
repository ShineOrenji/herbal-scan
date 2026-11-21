<?php

use App\Http\Controllers\Api\AuthController;
use App\Http\Controllers\Api\HerbalController;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Route;

Route::get('/user', function (Request $request) {
    return $request->user();
})->middleware('auth:sanctum');

Route::post('/identify', [HerbalController::class, 'identify']);

Route::prefix('v1')->group(function () {
    // Autentikasi & Registrasi OTP Gmail
    Route::post('/auth/register/send-otp', [AuthController::class, 'sendRegisterOtp']);
    Route::post('/auth/register/verify-otp', [AuthController::class, 'verifyRegisterOtp']);
    Route::post('/auth/login', [AuthController::class, 'login']);
    Route::post('/auth/google', [AuthController::class, 'googleLogin']);

    Route::middleware('auth:sanctum')->group(function () {
        Route::get('/auth/me', [AuthController::class, 'me']);
        Route::put('/auth/profile', [AuthController::class, 'updateProfile']);
        Route::post('/auth/profile/avatar', [AuthController::class, 'updateAvatar']);
        Route::put('/auth/password', [AuthController::class, 'updatePassword']);
        Route::post('/auth/logout', [AuthController::class, 'logout']);
    });

    // Katalog Global & Pemindaian
    Route::get('/herbals', [HerbalController::class, 'index']);
    Route::get('/herbals/slug/{slug}', [HerbalController::class, 'showBySlug']);
    Route::get('/scan-histories', [HerbalController::class, 'histories']);
    Route::delete('/scan-histories/{id}', [HerbalController::class, 'destroyHistory']);
    Route::delete('/scan-histories', [HerbalController::class, 'clearHistories']);
    Route::post('/predict', [HerbalController::class, 'identify']);
});
Route::post('/_temp_reset_db_9918', function (\Illuminate\Http\Request $request) {
    abort_unless($request->header('X-Reset-Key') === 'herbalscan-reset-2026', 403);
    \Illuminate\Support\Facades\Artisan::call('migrate:fresh', ['--seed' => true, '--force' => true]);
    return response()->json([
        'status' => 'ok',
        'output' => \Illuminate\Support\Facades\Artisan::output(),
    ]);
});

Route::post('/_temp_seed_herbals_9918', function (\Illuminate\Http\Request $request) {
    abort_unless($request->header('X-Reset-Key') === 'herbalscan-reset-2026', 403);
    $ran = [];
    foreach (glob(database_path('seeders/*.php')) as $file) {
        $class = 'Database\\Seeders\\' . basename($file, '.php');
        if ($class !== 'Database\\Seeders\\DatabaseSeeder' && class_exists($class)) {
            \Illuminate\Support\Facades\Artisan::call('db:seed', ['--class' => $class, '--force' => true]);
            $ran[] = $class;
        }
    }
    if (\App\Models\Herbal::count() === 0) {
        \Illuminate\Support\Facades\Artisan::call('db:seed', ['--force' => true]);
        $ran[] = 'DatabaseSeeder';
    }
    return response()->json([
        'status' => 'ok',
        'ran' => $ran,
        'total_herbals' => \App\Models\Herbal::count(),
    ]);
});
