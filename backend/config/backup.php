<?php

return [
    'backup' => [
        'name' => env('APP_NAME', 'vende-y-mas'),
        'source' => [
            'files' => [
                'include' => [
                    storage_path('app/public'),
                ],
                'exclude' => [],
                'follow_links' => false,
                'ignore_unreadable_directories' => false,
                'relative_path' => base_path(),
            ],
            'databases' => [
                'pgsql',
            ],
        ],
    ],
    'destination' => [
        'disks' => [
            'local',
        ],
    ],
];
