<?php

define('LARAVEL_START', microtime(true));

// Register the Composer autoloader
require __DIR__.'/vendor/autoload.php';

// Bootstrap Laravel
$app = require_once __DIR__.'/bootstrap/app.php';
$kernel = $app->make(Illuminate\Contracts\Http\Kernel::class);

// Run a dummy request to boot the application and db
$dummyRequest = Illuminate\Http\Request::create('/up', 'GET');
$dummyResponse = $kernel->handle($dummyRequest);
$kernel->terminate($dummyRequest, $dummyResponse);

use App\Models\User;
use Illuminate\Http\Request;

$user = User::where('email', 'belal@admin.com')->first();
if (!$user) {
    echo "Admin user not found in database!\n";
    exit(1);
}

echo "Admin User found: " . $user->email . "\n";
echo "Role: " . $user->role . "\n";
echo "is_super_admin: " . ($user->is_super_admin ? 'true' : 'false') . "\n";
echo "is_super: " . ($user->is_super ? 'true' : 'false') . "\n";
echo "Permissions: " . json_encode($user->permissions) . "\n\n";

// Generate a temporary token for the request
$tokenResult = $user->createToken('test_token');
$plainTextToken = $tokenResult->plainTextToken;
echo "Generated Token: " . $plainTextToken . "\n\n";

$endpoints = [
    '/api/user',
    '/api/me',
    '/api/profile'
];

foreach ($endpoints as $endpoint) {
    echo "--- Testing GET $endpoint ---\n";
    $request = Request::create($endpoint, 'GET');
    $request->headers->set('Accept', 'application/json');
    $request->headers->set('Authorization', 'Bearer ' . $plainTextToken);
    
    $response = $kernel->handle($request);
    echo "Status Code: " . $response->getStatusCode() . "\n";
    echo "Body: " . $response->getContent() . "\n\n";
    
    $kernel->terminate($request, $response);
}

// Clean up the token
$user->tokens()->where('name', 'test_token')->delete();
echo "Cleaned up test tokens.\n";
