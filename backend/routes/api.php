<?php

use Illuminate\Http\Request;
use Illuminate\Support\Facades\Route;
use App\Http\Controllers\Api\HerbalController;

Route::get('/user', function (Request $request) {
    return $request->user();
})->middleware('auth:sanctum');

Route::post('/identify', [HerbalController::class, 'identify']);

Route::prefix('v1')->group(function () {
    Route::get('/herbals', [HerbalController::class, 'index']);
    Route::get('/herbals/slug/{slug}', [HerbalController::class, 'showBySlug']);
    Route::get('/scan-histories', [HerbalController::class, 'histories']);
    Route::delete('/scan-histories/{id}', [HerbalController::class, 'destroyHistory']);
    Route::delete('/scan-histories', [HerbalController::class, 'clearHistories']);
    Route::post('/predict', [HerbalController::class, 'identify']);
});
