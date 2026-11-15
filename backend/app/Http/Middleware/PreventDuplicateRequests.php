<?php

namespace App\Http\Middleware;

use Closure;
use Illuminate\Http\Request;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\Cache;
use Symfony\Component\HttpFoundation\Response;

class PreventDuplicateRequests
{
    public function handle(Request $request, Closure $next): Response
    {
        if (!in_array($request->method(), ['POST', 'PUT', 'PATCH', 'DELETE'], true)) {
            return $next($request);
        }

        $identity = $request->user() ? 'user:'.$request->user()->getAuthIdentifier() : 'ip:'.$request->ip();
        $hash = hash('sha256', json_encode([
            $identity,
            $request->method(),
            $request->path(),
            $this->normalize($request->except(['_token', 'token'])),
        ], JSON_THROW_ON_ERROR));

        $key = 'dup_guard:'.$hash;
        // Keep slow operations guarded even when the short debounce window ends.
        $active = Cache::lock($key.':active', 300);
        if (!$active->get()) {
            return $this->duplicate();
        }

        try {
            $lock = Cache::lock($key, 4);
            if (!$lock->get()) {
                return $this->duplicate();
            }

            $completed = false;
            try {
                $response = $next($request);
                $completed = $response->isSuccessful();

                return $response;
            } finally {
                $lock->release();
                if ($completed) {
                    Cache::lock($key, 4)->get();
                }
            }
        } finally {
            $active->release();
        }
    }

    private function duplicate(): Response
    {
        return response()->json([
            'message' => 'Operación duplicada bloqueada. La solicitud anterior ya fue procesada.',
            'isDuplicateBlocked' => true,
        ], 409);
    }

    private function normalize(mixed $value): mixed
    {
        if ($value instanceof UploadedFile) {
            return [$value->getClientOriginalName(), hash_file('sha256', $value->getPathname())];
        }
        if (!is_array($value)) {
            return $value;
        }
        if (!array_is_list($value)) {
            ksort($value);
        }

        return array_map($this->normalize(...), $value);
    }
}
