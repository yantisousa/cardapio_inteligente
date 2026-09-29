<?php

use App\Http\Controllers\Api\AdminAuthController;
use App\Http\Controllers\Api\AdminCategoryController;
use App\Http\Controllers\Api\AdminCustomerController;
use App\Http\Controllers\Api\AdminMenuController;
use App\Http\Controllers\Api\AdminOrderController;
use App\Http\Controllers\Api\AdminProductController;
use App\Http\Controllers\Api\AdminSettingsController;
use App\Http\Controllers\Api\CustomerAddressController;
use App\Http\Controllers\Api\OrderController;
use App\Http\Controllers\Api\PublicMediaController;
use App\Http\Controllers\Api\StorefrontController;
use Illuminate\Support\Facades\Route;

Route::get('/media/{tenant}/{filename}', PublicMediaController::class)
    ->whereUuid('tenant')
    ->where('filename', '[0-9a-f-]{36}\.(?:jpe?g|png|webp)');

Route::middleware('tenant')->group(function () {
    Route::get('/storefront', StorefrontController::class);
    Route::get('/customers/addresses', [CustomerAddressController::class, 'index'])->middleware('throttle:30,1');
    Route::post('/orders', [OrderController::class, 'store'])->middleware('throttle:30,1');
    Route::get('/orders/{publicId}', [OrderController::class, 'show'])->middleware('throttle:60,1');

    Route::post('/admin/login', [AdminAuthController::class, 'store'])->middleware('throttle:10,1');
    Route::middleware('tenant.auth:owner,manager,operator')->prefix('admin')->group(function () {
        Route::get('/orders', [AdminOrderController::class, 'index']);
        Route::get('/orders/{order}', [AdminOrderController::class, 'show']);
        Route::patch('/orders/{order}', [AdminOrderController::class, 'update']);
        Route::patch('/orders/{order}/payment', [AdminOrderController::class, 'updatePayment']);
        Route::get('/customers', [AdminCustomerController::class, 'index']);
        Route::get('/customers/{customer}', [AdminCustomerController::class, 'show']);
        Route::get('/menu', AdminMenuController::class);
        Route::patch('/products/{product}/availability', [AdminProductController::class, 'updateAvailability']);
        Route::get('/settings', [AdminSettingsController::class, 'show']);
        Route::patch('/store/operational-status', [AdminSettingsController::class, 'updateOperationalStatus']);
    });

    Route::middleware('tenant.auth:owner,manager')->prefix('admin')->group(function () {
        Route::post('/categories', [AdminCategoryController::class, 'store']);
        Route::patch('/categories/{category}', [AdminCategoryController::class, 'update']);
        Route::delete('/categories/{category}', [AdminCategoryController::class, 'destroy']);
        Route::post('/products', [AdminProductController::class, 'store']);
        Route::put('/products/{product}', [AdminProductController::class, 'update']);
        Route::delete('/products/{product}', [AdminProductController::class, 'destroy']);
        Route::put('/settings', [AdminSettingsController::class, 'update']);
        Route::post('/settings/assets', [AdminSettingsController::class, 'uploadBrandAsset']);
        Route::patch('/customers/{customer}', [AdminCustomerController::class, 'update']);
        Route::delete('/customers/{customer}/addresses/{address}', [AdminCustomerController::class, 'destroyAddress']);
    });
});
