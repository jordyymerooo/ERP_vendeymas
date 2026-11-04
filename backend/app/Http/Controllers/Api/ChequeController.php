<?php

namespace App\Http\Controllers\Api;

use App\Helpers\RoleSecurity;
use App\Http\Controllers\Controller;
use App\Models\AuditLog;
use App\Models\Cheque;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class ChequeController extends Controller
{
    /**
     * Valida que el usuario sea Super Admin (CEO) real.
     */
    protected function ensureSuperAdmin(Request $request): ?JsonResponse
    {
        if (!RoleSecurity::isRealSuperAdmin($request->user())) {
            return response()->json([
                'success' => false,
                'message' => 'Acceso denegado. El módulo de emisión de cheques es exclusivo para el Super Administrador / CEO.',
            ], 403);
        }
        return null;
    }

    /**
     * Lista los cheques con filtros, paginación y tarjetas de resumen financiero.
     */
    public function index(Request $request): JsonResponse
    {
        if ($denied = $this->ensureSuperAdmin($request)) {
            return $denied;
        }

        $query = Cheque::query();

        // Filtro por término de búsqueda (N° cheque, beneficiario, concepto o banco)
        if ($request->filled('search')) {
            $search = trim($request->input('search'));
            $query->where(function ($q) use ($search) {
                $q->where('cheque_number', 'ilike', "%{$search}%")
                  ->orWhere('payee', 'ilike', "%{$search}%")
                  ->orWhere('concept', 'ilike', "%{$search}%")
                  ->orWhere('bank_name', 'ilike', "%{$search}%");
            });
        }

        // Filtro por banco
        if ($request->filled('bank_name') && !in_array(strtoupper($request->input('bank_name')), ['TODOS', 'ALL', ''])) {
            $query->where('bank_name', $request->input('bank_name'));
        }

        // Filtro por estado
        if ($request->filled('status') && !in_array(strtoupper($request->input('status')), ['TODOS', 'ALL', ''])) {
            $query->where('status', $request->input('status'));
        }

        // Filtro por rango de fechas
        if ($request->filled('start_date')) {
            $query->whereDate('issue_date', '>=', $request->input('start_date'));
        }
        if ($request->filled('end_date')) {
            $query->whereDate('issue_date', '<=', $request->input('end_date'));
        }

        // Resumen financiero global (o filtrado según periodo)
        $summaryQuery = clone $query;
        $totalEmitido = (float) (clone $summaryQuery)->where('status', 'Emitido')->sum('amount');
        $countEmitido = (int) (clone $summaryQuery)->where('status', 'Emitido')->count();

        $totalCobrado = (float) (clone $summaryQuery)->where('status', 'Cobrado')->sum('amount');
        $countCobrado = (int) (clone $summaryQuery)->where('status', 'Cobrado')->count();

        $totalAnulado = (float) (clone $summaryQuery)->where('status', 'Anulado')->sum('amount');
        $countAnulado = (int) (clone $summaryQuery)->where('status', 'Anulado')->count();

        $totalGeneral = (float) (clone $summaryQuery)->whereIn('status', ['Emitido', 'Cobrado'])->sum('amount');

        $cheques = $query->orderBy('issue_date', 'desc')->orderBy('id', 'desc')->paginate(15);

        // Bancos disponibles para selector en frontend
        $availableBanks = Cheque::select('bank_name')->distinct()->pluck('bank_name');

        return response()->json([
            'success' => true,
            'data' => $cheques,
            'summary' => [
                'total_emitido' => $totalEmitido,
                'count_emitido' => $countEmitido,
                'total_cobrado' => $totalCobrado,
                'count_cobrado' => $countCobrado,
                'total_anulado' => $totalAnulado,
                'count_anulado' => $countAnulado,
                'total_general' => $totalGeneral,
            ],
            'available_banks' => $availableBanks,
        ]);
    }

    /**
     * Registra la emisión de un nuevo cheque.
     */
    public function store(Request $request): JsonResponse
    {
        if ($denied = $this->ensureSuperAdmin($request)) {
            return $denied;
        }

        $validated = $request->validate([
            'bank_name' => 'required|string|max:255',
            'cheque_number' => 'required|string|max:100',
            'issue_date' => 'required|date',
            'payee' => 'required|string|max:255',
            'amount' => 'required|numeric|gt:0|max:999999999.99',
            'concept' => 'required|string|max:2000',
            'status' => 'nullable|string|in:Emitido,Cobrado,Anulado',
        ], [
            'bank_name.required' => 'El banco o cooperativa es obligatorio.',
            'cheque_number.required' => 'El número de cheque es obligatorio.',
            'issue_date.required' => 'La fecha de emisión es obligatoria.',
            'payee.required' => 'El beneficiario (A favor de) es obligatorio.',
            'amount.required' => 'El monto del cheque es obligatorio.',
            'amount.gt' => 'El monto debe ser mayor a cero.',
            'concept.required' => 'El concepto o detalle del cheque es obligatorio.',
        ]);

        $cheque = Cheque::create([
            'bank_name' => strip_tags(trim($validated['bank_name'])),
            'cheque_number' => strip_tags(trim($validated['cheque_number'])),
            'issue_date' => $validated['issue_date'],
            'payee' => strip_tags(trim($validated['payee'])),
            'amount' => $validated['amount'],
            'concept' => strip_tags(trim($validated['concept'])),
            'status' => $validated['status'] ?? 'Emitido',
        ]);

        AuditLog::record(
            $request->user()?->id ?? 1,
            'Control de Cheques',
            "Emitió cheque N° {$cheque->cheque_number} ({$cheque->bank_name}) por $" . number_format((float) $cheque->amount, 2) . " USD a favor de {$cheque->payee}",
            $request->ip(),
            $request->userAgent()
        );

        return response()->json([
            'success' => true,
            'message' => "Cheque N° {$cheque->cheque_number} emitido exitosamente.",
            'data' => $cheque,
        ], 201);
    }

    /**
     * Muestra el detalle de un cheque específico.
     */
    public function show(Request $request, int|string $id): JsonResponse
    {
        if ($denied = $this->ensureSuperAdmin($request)) {
            return $denied;
        }

        $cheque = Cheque::findOrFail($id);

        return response()->json([
            'success' => true,
            'data' => $cheque,
        ]);
    }

    /**
     * Actualiza los datos de un cheque.
     */
    public function update(Request $request, int|string $id): JsonResponse
    {
        if ($denied = $this->ensureSuperAdmin($request)) {
            return $denied;
        }

        $cheque = Cheque::findOrFail($id);

        $validated = $request->validate([
            'bank_name' => 'required|string|max:255',
            'cheque_number' => 'required|string|max:100',
            'issue_date' => 'required|date',
            'payee' => 'required|string|max:255',
            'amount' => 'required|numeric|gt:0|max:999999999.99',
            'concept' => 'required|string|max:2000',
            'status' => 'required|string|in:Emitido,Cobrado,Anulado',
        ]);

        $cheque->update([
            'bank_name' => strip_tags(trim($validated['bank_name'])),
            'cheque_number' => strip_tags(trim($validated['cheque_number'])),
            'issue_date' => $validated['issue_date'],
            'payee' => strip_tags(trim($validated['payee'])),
            'amount' => $validated['amount'],
            'concept' => strip_tags(trim($validated['concept'])),
            'status' => $validated['status'],
        ]);

        AuditLog::record(
            $request->user()?->id ?? 1,
            'Control de Cheques',
            "Actualizó información de cheque N° {$cheque->cheque_number} a favor de {$cheque->payee} (Estado: {$cheque->status})",
            $request->ip(),
            $request->userAgent()
        );

        return response()->json([
            'success' => true,
            'message' => 'Cheque actualizado exitosamente.',
            'data' => $cheque,
        ]);
    }

    /**
     * Actualiza únicamente el estado de un cheque ('Cobrado', 'Anulado', 'Emitido').
     */
    public function updateStatus(Request $request, int|string $id): JsonResponse
    {
        if ($denied = $this->ensureSuperAdmin($request)) {
            return $denied;
        }

        $cheque = Cheque::findOrFail($id);

        $validated = $request->validate([
            'status' => 'required|string|in:Emitido,Cobrado,Anulado',
        ]);

        $oldStatus = $cheque->status;
        $cheque->update([
            'status' => $validated['status'],
        ]);

        AuditLog::record(
            $request->user()?->id ?? 1,
            'Control de Cheques',
            "Cambió estado de cheque N° {$cheque->cheque_number} de '{$oldStatus}' a '{$cheque->status}'",
            $request->ip(),
            $request->userAgent()
        );

        return response()->json([
            'success' => true,
            'message' => "Estado del cheque N° {$cheque->cheque_number} actualizado a '{$cheque->status}'.",
            'data' => $cheque,
        ]);
    }

    /**
     * Elimina un cheque del sistema.
     */
    public function destroy(Request $request, int|string $id): JsonResponse
    {
        if ($denied = $this->ensureSuperAdmin($request)) {
            return $denied;
        }

        $cheque = Cheque::findOrFail($id);
        $chequeNumber = $cheque->cheque_number;
        $payee = $cheque->payee;
        $amount = $cheque->amount;

        $cheque->delete();

        AuditLog::record(
            $request->user()?->id ?? 1,
            'Control de Cheques',
            "Eliminó cheque N° {$chequeNumber} de {$payee} por $" . number_format((float) $amount, 2) . " USD",
            $request->ip(),
            $request->userAgent()
        );

        return response()->json([
            'success' => true,
            'message' => "Cheque N° {$chequeNumber} eliminado exitosamente.",
        ]);
    }
}

