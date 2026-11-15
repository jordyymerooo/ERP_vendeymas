<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\AuditLog;
use App\Models\ReceiptSequence;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\Rule;

class ReceiptSequenceController extends Controller
{
    public function index(): JsonResponse
    {
        return response()->json([
            'data' => ReceiptSequence::orderBy('id')->get()->map->summary(),
        ]);
    }

    public function update(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'sequences' => 'required|array|min:1|max:4',
            'sequences.*.prefix' => ['required', 'distinct', Rule::in(array_values(ReceiptSequence::PREFIXES))],
            'sequences.*.last_manual_number' => 'required|integer|min:0|max:999999',
        ]);

        DB::transaction(function () use ($request, $validated) {
            $changes = collect($validated['sequences'])->keyBy('prefix');
            $sequences = ReceiptSequence::whereIn('prefix', $changes->keys())->orderBy('id')->lockForUpdate()->get();

            foreach ($sequences as $sequence) {
                $before = $sequence->last_manual_number;
                $after = (int) $changes[$sequence->prefix]['last_manual_number'];
                if ($before === $after) {
                    continue;
                }
                $sequence->update(['last_manual_number' => $after]);
                AuditLog::record(
                    $request->user()->id,
                    'Recibos',
                    "Cambió el último número manual de {$sequence->prefix} de {$before} a {$after}.",
                    $request->ip(),
                    $request->userAgent()
                );
            }
        }, 3);

        return $this->index();
    }
}
