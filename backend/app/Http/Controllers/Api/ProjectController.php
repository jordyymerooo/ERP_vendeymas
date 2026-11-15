<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\AuditLog;
use App\Models\Customer;
use App\Models\Lot;
use App\Models\Payment;
use App\Models\TopographyJob;
use App\Models\Project;
use App\Models\User;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\DB;

class ProjectController extends Controller
{
    /**
     * Retorna los proyectos reales desde PostgreSQL con conteo de lotes totales y vendidos,
     * administradores a cargo y filtrado estricto por asignación para el rol Administrador.
     */
    public function index(Request $request): JsonResponse
    {
        $user = $request->user() ?: auth()->user();
        $simulatedRole = $request->header('X-Simulate-Role') ?: $request->header('X-Simulated-Role') ?: $request->query('simulate_role');

        $query = Project::select(['id', 'name', 'location', 'description', 'status', 'created_at', 'updated_at'])->with([
            'administrators:id,name,email',
        ])->withCount([
            'lots',
            'lots as available_lots_count' => fn ($lots) => $lots->where('status', 'Disponible'),
            'lots as sold_lots_count' => function ($query) {
                $query->whereIn('status', ['Vendido', 'Pagado / Vendido'])->whereNotNull('customer_id');
            },
        ])->withSum([
            'lotPayments as total_collected' => function ($payments) use ($user) {
                $payments->where('payments.status', 'Válido');
                if (!$user?->hasRole('Super Admin')) {
                    $payments->where('payments.user_id', $user?->id);
                }
            },
        ], 'amount_paid')->withCasts(['total_collected' => 'float']);

        // Determinar si aplica el filtro estricto de proyectos asignados
        $isAdminRole = ($user && $user->hasRole('Administrador') && !$user->hasRole('Super Admin') && $user->id !== 1)
            || ($simulatedRole === 'Administrador');

        if ($isAdminRole) {
            $effectiveAdmin = ($user && $user->hasRole('Administrador')) 
                ? $user 
                : (User::where('email', 'administrador1@vendeymas.com')->first() 
                   ?: User::whereHas('assignedProjects')->first() 
                   ?: User::role('Administrador')->first());

            if ($effectiveAdmin) {
                $query->whereIn('id', $effectiveAdmin->assignedProjects()->select('projects.id'));
            } else {
                $query->whereRaw('1 = 0');
            }
        }

        $projects = $query->orderBy('id', 'asc')->get();
        foreach ($projects as $project) {
            $project->setRelation('assignedUsers', $project->administrators);
            $project->total_collected ??= 0.0;
        }

        return response()->json([
            'success' => true,
            'data' => $projects,
        ]);
    }

    /**
     * Almacena un nuevo proyecto real en la tabla projects y genera sus lotes iniciales.
     */
    public function store(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'name' => 'nullable|string|max:255',
            'nombre' => 'nullable|string|max:255',
            'location' => 'nullable|string|max:255',
            'ubicacion' => 'nullable|string|max:255',
            'status' => 'nullable|string|max:50',
            'estado' => 'nullable|string|max:50',
            'description' => 'nullable|string|max:5000',
            'lot_blocks' => 'nullable|array|max:100',
            'lot_blocks.*.quantity' => 'required|integer|min:1|max:500',
            'lot_blocks.*.area' => 'required|numeric|gt:0|max:99999999.99|decimal:0,2',
            'lot_blocks.*.price' => 'required|numeric|gt:0|max:9999999999.99|decimal:0,2',
            'lot_blocks.*.prefix' => 'nullable|string|max:40',
        ]);

        $name = strip_tags(trim($validated['name'] ?? $validated['nombre'] ?? 'Nuevo Proyecto'));
        $location = strip_tags(trim($validated['location'] ?? $validated['ubicacion'] ?? 'Ubicación Principal'));
        $status = strip_tags(trim($validated['status'] ?? $validated['estado'] ?? 'En Desarrollo'));

        $project = DB::transaction(function () use ($validated, $name, $location, $status) {
            $project = Project::create([
                'name' => $name,
                'location' => $location,
                'status' => $status,
                'description' => isset($validated['description']) ? strip_tags($validated['description']) : null,
            ]);

            $number = 1;
            $now = now();
            foreach ($validated['lot_blocks'] ?? [] as $block) {
                $prefix = trim(strip_tags($block['prefix'] ?? '')) ?: 'Lote';
                $rows = [];
                for ($i = 0; $i < $block['quantity']; $i++) {
                    $rows[] = [
                        'project_id' => $project->id,
                        'lot_number' => $prefix.' '.$number++,
                        'area_m2' => $block['area'],
                        'total_price' => $block['price'],
                        'status' => 'Disponible',
                        'created_at' => $now,
                        'updated_at' => $now,
                    ];
                }
                Lot::insert($rows);
            }

            return $project;
        });

        $project->loadCount([
            'lots',
            'lots as sold_lots_count' => function ($query) {
                $query->where('status', 'Vendido')->whereNotNull('customer_id');
            },
        ]);

        return response()->json([
            'success' => true,
            'data' => $project,
        ], 201);
    }

    public function destroy(Request $request, int $id): JsonResponse
    {
        DB::transaction(function () use ($request, $id) {
            $project = Project::lockForUpdate()->findOrFail($id);
            $lots = $project->lots()->orderBy('id')->lockForUpdate()->pluck('id');
            $deeds = $project->deeds()->orderBy('id')->lockForUpdate()->pluck('id');
            $jobs = TopographyJob::where('project_id', $id)->orderBy('id')->lockForUpdate()->pluck('id');

            Payment::whereIn('lot_id', $lots)
                ->orWhereIn('deed_id', $deeds)
                ->orWhereIn('topography_job_id', $jobs)
                ->delete();
            $project->deeds()->delete();
            $project->lots()->delete();
            TopographyJob::whereKey($jobs)->delete();
            $project->delete();

            AuditLog::record(
                $request->user()->id,
                'Proyectos',
                "Eliminó el proyecto {$project->name} (#{$id}) y sus registros asociados.",
                $request->ip(),
                $request->userAgent()
            );
        }, 3);

        Cache::forget('system_mora_count');
        Cache::forget('dashboard_stats');

        return response()->json(['success' => true, 'message' => 'Proyecto eliminado.']);
    }

    /**
     * Retorna ÚNICAMENTE los clientes reales con lotes asignados en el proyecto especificado.
     */
    public function customersByProject(string $slug): JsonResponse
    {
        $normalizedName = str_replace('-', ' ', strtolower(urldecode($slug)));

        $project = Project::whereRaw('LOWER(name) = ?', [$normalizedName])
            ->orWhereRaw("LOWER(REPLACE(name, ' ', '-')) = ?", [strtolower(urldecode($slug))])
            ->orWhere('id', is_numeric($slug) ? (int)$slug : 0)
            ->first();

        if (!$project) {
            return response()->json([
                'success' => false,
                'message' => 'Proyecto no encontrado en la base de datos.',
                'project' => null,
                'data' => [],
            ], 404);
        }

        $customers = Customer::whereHas('lots', function ($query) use ($project) {
            $query->where('project_id', $project->id);
        })->with(['lots' => function ($query) use ($project) {
            $query->where('project_id', $project->id)->with(['payments' => function ($pQuery) {
                $pQuery->orderBy('created_at', 'desc');
            }]);
        }])->get();

        $customersData = $customers->map(function ($customer) use ($project) {
            $lots = $customer->lots;
            $totalPrice = (float) $lots->sum('total_price');

            $allPayments = $lots->flatMap(function ($lot) {
                return $lot->payments;
            })->sortByDesc('created_at')->values();

            $totalPaid = (float) $allPayments->where('status', 'Válido')->sum('amount_paid');
            $debtBalance = max(0, $totalPrice - $totalPaid);

            // Calcular mora para cada lote del cliente
            $lotsWithMora = $lots->map(function ($lot) {
                $mora = $lot->calculateMoraStatus();
                return array_merge([
                    'id' => $lot->id,
                    'lot_number' => $lot->lot_number,
                    'area_m2' => (float) $lot->area_m2,
                    'total_price' => (float) $lot->total_price,
                    'status' => $lot->status,
                ], $mora);
            });

            // Determinar estado de mora global del cliente
            $hasMora = $lotsWithMora->contains('status', 'EN MORA');
            $hasPorVencer = $lotsWithMora->contains('status', 'POR VENCER');

            $totalOverdue = $lotsWithMora->sum('overdue_amount');
            $totalOverdueInstallments = $lotsWithMora->sum('overdue_installments');
            $totalInstallmentsPactadas = $lotsWithMora->sum('installments_count');
            $totalInstallmentAmountMonthly = $lotsWithMora->sum('installment_amount');

            if ($hasMora) {
                $moraStatus = 'EN MORA';
                $moraLabel = 'EN MORA: $' . number_format($totalOverdue, 2) . ' vencidos';
            } elseif ($hasPorVencer) {
                $moraStatus = 'POR VENCER';
                $moraLabel = 'POR VENCER';
            } else {
                $moraStatus = 'AL DÍA';
                $moraLabel = 'AL DÍA';
            }

            $historialPagos = $allPayments->map(function ($payment) {
                return [
                    'id' => 'REC-' . str_pad($payment->id, 5, '0', STR_PAD_LEFT),
                    'payment_id' => $payment->id,
                    'receipt_code' => $payment->receipt_code,
                    'fecha' => $payment->created_at ? $payment->created_at->format('d/m/Y') : 'Reciente',
                    'hora' => $payment->created_at ? $payment->created_at->format('H:i:s') : '',
                    'monto' => (float) $payment->amount_paid,
                    'status' => $payment->status ?? 'Válido',
                    'void_reason' => $payment->void_reason,
                    'voided_at' => $payment->voided_at ? $payment->voided_at->format('d/m/Y H:i') : null,
                    'voided_by' => $payment->voided_by,
                    'metodo' => $payment->payment_method,
                    'pdf_url' => url('/api/payments/' . $payment->id . '/pdf'),
                    'lot_id' => $payment->lot_id,
                ];
            });

            $lotesNombres = $lots->pluck('lot_number')->toArray();
            $cuotasPagadas = $allPayments->where('status', 'Válido')->count();

            return [
                'id' => $customer->id,
                'nombre' => $customer->name,
                'name' => $customer->name,
                'documento' => $customer->id_card,
                'id_card' => $customer->id_card,
                'telefono' => $customer->phone,
                'phone' => $customer->phone,
                'email' => $customer->email,
                'proyecto' => $project->name,
                'lotes' => $lotesNombres,
                'lots' => $lotsWithMora,
                'valorTotal' => $totalPrice,
                'saldoPagado' => $totalPaid,
                'saldoDeudor' => $debtBalance,
                'cuotasTotales' => $totalInstallmentsPactadas,
                'cuotasPagadas' => $cuotasPagadas,
                'cuotaMensual' => $totalInstallmentAmountMonthly,
                'cuotaSugerida' => $totalOverdue > 0 ? $totalOverdue : ($totalInstallmentAmountMonthly ?: 1000),
                'moraStatus' => $moraStatus,
                'moraLabel' => $moraLabel,
                'totalOverdue' => $totalOverdue,
                'totalOverdueInstallments' => $totalOverdueInstallments,
                'historialPagos' => $historialPagos,
            ];
        });

        return response()->json([
            'success' => true,
            'project' => [
                'id' => $project->id,
                'name' => $project->name,
                'nombre' => $project->name,
                'location' => $project->location,
                'ubicacion' => $project->location,
                'status' => $project->status,
                'center_lat' => (float) ($project->center_lat ?: -0.9538),
                'center_lng' => (float) ($project->center_lng ?: -80.7456),
                'blueprint_image_url' => $project->blueprint_image_url,
            ],
            'data' => $customersData,
        ]);
    }

    /**
     * Retorna TODOS los lotes reales de un proyecto con sus datos de cliente y resumen de inventario.
     * Solo los lotes con status = 'Vendido' Y customer_id IS NOT NULL cuentan como vendidos.
     */
    public function lotsByProject(string $slug): JsonResponse
    {
        $normalizedName = str_replace('-', ' ', strtolower(urldecode($slug)));

        $project = Project::whereRaw('LOWER(name) = ?', [$normalizedName])
            ->orWhereRaw("LOWER(REPLACE(name, ' ', '-')) = ?", [strtolower(urldecode($slug))])
            ->orWhere('id', is_numeric($slug) ? (int)$slug : 0)
            ->first();

        if (!$project) {
            return response()->json([
                'success' => false,
                'message' => 'Proyecto no encontrado en la base de datos.',
                'project' => null,
                'summary' => [
                    'total_lots' => 0,
                    'available_lots' => 0,
                    'sold_lots' => 0,
                ],
                'data' => [],
            ], 404);
        }

        $lots = Lot::with(['customer', 'payments' => function ($q) {
            $q->orderBy('created_at', 'desc');
        }])
            ->where('project_id', $project->id)
            ->orderBy('id', 'asc')
            ->get();

        $totalLots = $lots->count();
        $availableLots = $lots->where('status', 'Disponible')->count();
        $soldLots = $lots->where('status', 'Vendido')->whereNotNull('customer_id')->count();

        return response()->json([
            'success' => true,
            'project' => [
                'id' => $project->id,
                'name' => $project->name,
                'nombre' => $project->name,
                'location' => $project->location,
                'ubicacion' => $project->location,
                'status' => $project->status,
                'center_lat' => (float) ($project->center_lat ?: -0.9538),
                'center_lng' => (float) ($project->center_lng ?: -80.7456),
                'blueprint_image_url' => $project->blueprint_image_url,
            ],
            'summary' => [
                'total_lots' => $totalLots,
                'available_lots' => $availableLots,
                'sold_lots' => $soldLots,
            ],
            'data' => $lots,
        ]);
    }

    /**
     * Actualiza las coordenadas de centro y plano topográfico del proyecto.
     */
    public function updateCoordinates(Request $request, int|string $id): JsonResponse
    {
        $validated = $request->validate([
            'center_lat' => 'required|numeric',
            'center_lng' => 'required|numeric',
            'blueprint_image_url' => 'nullable|string',
        ]);

        $project = Project::findOrFail($id);
        $project->update($validated);

        return response()->json([
            'success' => true,
            'message' => "Coordenadas de centro del proyecto {$project->name} actualizadas.",
            'data' => $project,
        ]);
    }

    /**
     * Actualiza la latitude y longitude general del proyecto
     */
    public function updateLocation(Request $request, int|string $id): JsonResponse
    {
        $validated = $request->validate([
            'latitude' => 'required|numeric',
            'longitude' => 'required|numeric',
        ]);

        $project = Project::findOrFail($id);
        $project->update([
            'latitude' => $validated['latitude'],
            'longitude' => $validated['longitude'],
            'center_lat' => $validated['latitude'],
            'center_lng' => $validated['longitude'],
        ]);

        return response()->json([
            'success' => true,
            'message' => "Ubicación del proyecto '{$project->name}' actualizada a [{$project->latitude}, {$project->longitude}] en PostgreSQL.",
            'data' => $project,
        ]);
    }

    /**
     * Asigna uno o varios Administradores al proyecto (Exclusivo CEO / Super Admin).
     */
    public function assignAdmin(Request $request, int|string $id): JsonResponse
    {
        $project = Project::findOrFail($id);

        $validated = $request->validate([
            'admin_id' => 'nullable|exists:users,id',
            'user_id' => 'nullable|exists:users,id',
            'admin_ids' => 'nullable|array',
            'admin_ids.*' => 'exists:users,id',
        ]);

        $adminId = $validated['admin_id'] ?? $validated['user_id'] ?? null;
        if (isset($validated['admin_ids'])) {
            $project->administrators()->sync($validated['admin_ids']);
        } elseif ($adminId !== null && $adminId != 0) {
            $project->administrators()->sync([$adminId]);
        } else {
            $project->administrators()->sync([]);
        }

        $admins = $project->administrators()->get(['users.id', 'users.name', 'users.email']);
        $adminNames = $admins->pluck('name')->implode(', ') ?: 'Sin asignar';

        AuditLog::record(
            auth()->id() ?? 1,
            'Proyectos',
            "Asignó administrador(es) [{$adminNames}] al proyecto '{$project->name}'",
            $request->ip(),
            $request->userAgent()
        );

        return response()->json([
            'success' => true,
            'message' => "Administrador ({$adminNames}) asignado correctamente al proyecto {$project->name}.",
            'project' => $project->fresh(['administrators', 'assignedUsers']),
            'administrators' => $admins,
        ]);
    }
}
