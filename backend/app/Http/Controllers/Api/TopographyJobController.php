<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\TopographyJob;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class TopographyJobController extends Controller
{
    /**
     * Lista todos los trabajos topográficos ordenados por más recientes
     * y retorna métricas reales consolidadas.
     */
    public function index(Request $request): JsonResponse
    {
        $query = TopographyJob::query();

        // Filtro por estado operativo
        if ($request->filled('status') && $request->status !== 'all') {
            if ($request->status === 'En Campo / Pendientes') {
                $query->whereIn('status', ['Pendiente', 'En Campo']);
            } else {
                $query->where('status', $request->status);
            }
        }

        // Búsqueda por cliente, tipo de servicio o ubicación
        if ($request->filled('search')) {
            $search = $request->search;
            $query->where(function ($q) use ($search) {
                $q->where('client_name', 'ilike', "%{$search}%")
                  ->orWhere('service_type', 'ilike', "%{$search}%")
                  ->orWhere('location', 'ilike', "%{$search}%")
                  ->orWhere('client_phone', 'ilike', "%{$search}%");
            });
        }

        $jobs = $query->orderBy('created_at', 'desc')->get();

        // Métricas reales consolidadas desde PostgreSQL
        $all = TopographyJob::all();
        $stats = [
            'total_jobs' => $all->count(),
            'pending' => $all->where('status', 'Pendiente')->count(),
            'in_field' => $all->where('status', 'En Campo')->count(),
            'in_progress' => $all->whereIn('status', ['Pendiente', 'En Campo'])->count(),
            'in_cad' => $all->where('status', 'En Planos (AutoCAD)')->count(),
            'completed' => $all->where('status', 'Entregado')->count(),
            'total_revenue' => (float) $all->sum('cost'),
            'total_collected' => (float) $all->sum('amount_paid'),
            'total_pending' => (float) max(0, $all->sum('cost') - $all->sum('amount_paid')),
        ];

        return response()->json([
            'success' => true,
            'data' => $jobs,
            'stats' => $stats,
        ]);
    }

    /**
     * Valida y guarda un nuevo trabajo topográfico en PostgreSQL
     */
    public function store(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'client_name' => 'required|string|max:255',
            'client_phone' => 'nullable|string|max:50',
            'service_type' => 'required|string|max:255',
            'location' => 'required|string|max:255',
            'area_m2' => 'nullable|numeric|min:0',
            'cost' => 'required|numeric|min:0|max:999999',
            'amount_paid' => 'nullable|numeric|min:0|max:999999',
            'status' => 'nullable|string|in:Pendiente,En Campo,En Planos (AutoCAD),Entregado',
            'notes' => 'nullable|string|max:1000',
        ]);

        $job = TopographyJob::create([
            'client_name' => strip_tags(trim($validated['client_name'])),
            'client_phone' => !empty($validated['client_phone']) ? strip_tags(trim($validated['client_phone'])) : null,
            'service_type' => strip_tags(trim($validated['service_type'])),
            'location' => strip_tags(trim($validated['location'])),
            'area_m2' => $validated['area_m2'] ?? null,
            'cost' => $validated['cost'],
            'amount_paid' => $validated['amount_paid'] ?? 0,
            'status' => $validated['status'] ?? 'Pendiente',
            'notes' => !empty($validated['notes']) ? strip_tags(trim($validated['notes'])) : null,
        ]);

        return response()->json([
            'success' => true,
            'message' => "Trabajo topográfico para '{$job->client_name}' registrado exitosamente.",
            'data' => $job,
        ], 201);
    }

    /**
     * Actualiza el estado operativo, abonos o detalles del trabajo
     */
    public function update(Request $request, int|string $id): JsonResponse
    {
        $job = TopographyJob::findOrFail($id);

        $validated = $request->validate([
            'status' => 'nullable|string|in:Pendiente,En Campo,En Planos (AutoCAD),Entregado',
            'amount_paid' => 'nullable|numeric|min:0|max:999999',
            'add_payment' => 'nullable|numeric|min:0|max:999999',
            'client_name' => 'nullable|string|max:255',
            'client_phone' => 'nullable|string|max:50',
            'service_type' => 'nullable|string|max:255',
            'location' => 'nullable|string|max:255',
            'area_m2' => 'nullable|numeric|min:0',
            'cost' => 'nullable|numeric|min:0|max:999999',
            'notes' => 'nullable|string|max:1000',
        ]);

        if (isset($validated['client_name'])) {
            $validated['client_name'] = strip_tags(trim($validated['client_name']));
        }
        if (isset($validated['client_phone'])) {
            $validated['client_phone'] = strip_tags(trim($validated['client_phone']));
        }
        if (isset($validated['service_type'])) {
            $validated['service_type'] = strip_tags(trim($validated['service_type']));
        }
        if (isset($validated['location'])) {
            $validated['location'] = strip_tags(trim($validated['location']));
        }
        if (isset($validated['notes'])) {
            $validated['notes'] = strip_tags(trim($validated['notes']));
        }

        if (isset($validated['add_payment'])) {
            $validated['amount_paid'] = (float) $job->amount_paid + (float) $validated['add_payment'];
            unset($validated['add_payment']);
        }

        $job->update($validated);

        return response()->json([
            'success' => true,
            'message' => "Trabajo topográfico #{$job->id} actualizado exitosamente.",
            'data' => $job,
        ]);
    }

    /**
     * Elimina un trabajo topográfico si hubo error de registro
     */
    public function destroy(int|string $id): JsonResponse
    {
        $job = TopographyJob::findOrFail($id);
        $clientName = $job->client_name;
        $job->delete();

        return response()->json([
            'success' => true,
            'message' => "Trabajo topográfico de '{$clientName}' eliminado correctamente.",
        ]);
    }
}
