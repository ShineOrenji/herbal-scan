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