<?php

namespace App\Http\Controllers;

use Illuminate\Http\Request;
use Illuminate\Support\Facades\Storage;

class UploadController extends Controller
{
    /**
     * Upload an image and return its public URL.
     */
    public function upload(Request $request)
    {
        $request->validate([
            'file' => 'required|file|mimes:jpeg,png,jpg,gif,svg,webp|max:256000',
        ]);

        if ($request->hasFile('file')) {
            $file = $request->file('file');
            // Store file under storage/app/public/uploads
            $path = $file->store('uploads', 'public');
            $url = asset('storage/' . $path);
            $url = str_replace('http://', 'https://', $url);

            return response()->json([
                'url' => $url,
                'path' => $path
            ], 200);
        }

        return response()->json(['message' => 'لم يتم رفع أي ملف.'], 400);
    }
}
