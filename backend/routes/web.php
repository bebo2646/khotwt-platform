<?php

use Illuminate\Support\Facades\Route;
use App\Http\Controllers\SitemapController;

Route::get('/', function () {
    return view('welcome');
});

Route::get('/sitemap.xml', [SitemapController::class, 'index']);
Route::get('/sitemap-teachers.xml', [SitemapController::class, 'teachers']);
Route::get('/sitemap-courses.xml', [SitemapController::class, 'courses']);
Route::get('/robots.txt', [SitemapController::class, 'robots']);

