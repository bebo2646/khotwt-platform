<?php

return [

    /*
    |--------------------------------------------------------------------------
    | Third Party Services
    |--------------------------------------------------------------------------
    |
    | This file is for storing the credentials for third party services such
    | as Mailgun, Postmark, AWS and more. This file provides the de facto
    | location for this type of information, allowing packages to have
    | a conventional file to locate the various service credentials.
    |
    */

    'postmark' => [
        'key' => env('POSTMARK_API_KEY'),
    ],

    'resend' => [
        'key' => env('RESEND_API_KEY'),
    ],

    'ses' => [
        'key' => env('AWS_ACCESS_KEY_ID'),
        'secret' => env('AWS_SECRET_ACCESS_KEY'),
        'region' => env('AWS_DEFAULT_REGION', 'us-east-1'),
    ],

    'slack' => [
        'notifications' => [
            'bot_user_oauth_token' => env('SLACK_BOT_USER_OAUTH_TOKEN'),
            'channel' => env('SLACK_BOT_USER_DEFAULT_CHANNEL'),
        ],
    ],

    'bunny' => [
        'library_id' => env('BUNNY_STREAM_LIBRARY_ID', env('BUNNY_LIBRARY_ID')),
        'stream_library_id' => env('BUNNY_STREAM_LIBRARY_ID', env('BUNNY_LIBRARY_ID')),
        'api_key' => env('BUNNY_STREAM_API_KEY', env('BUNNY_API_KEY')),
        'stream_api_key' => env('BUNNY_STREAM_API_KEY', env('BUNNY_API_KEY')),
        'cdn_hostname' => env('BUNNY_STREAM_CDN_HOSTNAME', env('BUNNY_CDN_HOSTNAME', 'vz-2403286f-8fc.b-cdn.net')),
        'pull_zone' => env('BUNNY_STREAM_PULL_ZONE', env('BUNNY_PULL_ZONE', 'vz-2403286f-8fc')),
        'webhook_secret' => env('BUNNY_STREAM_WEBHOOK_SECRET', env('BUNNY_WEBHOOK_SECRET')),
    ],

];
