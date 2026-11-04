<?php

use Illuminate\Foundation\Inspiring;
use Illuminate\Support\Facades\Artisan;
use Illuminate\Support\Facades\Schedule;

Artisan::command('inspire', function () {
    $this->comment(Inspiring::quote());
})->purpose('Display an inspiring quote');

Schedule::command('backup:run')->dailyAt('18:00');
Schedule::command('backup:run --only-db')->dailyAt('18:00');
Schedule::command('backup:clean')->dailyAt('18:05');
