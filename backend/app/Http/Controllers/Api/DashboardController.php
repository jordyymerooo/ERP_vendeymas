<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Lot;
use App\Models\Payment;
use App\Models\Project;
use App\Services\DelinquentLots;
use Carbon\Carbon;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Str;

class DashboardController extends Controller
{
    public function delinquent(Request $request, DelinquentLots $delinquentLots): JsonResponse
    {
        $all = $delinquentLots->query()
            ->join('customers', 'customers.id', '=', 'balances.customer_id')
            ->join('projects', 'projects.id', '=', 'balances.project_id');

        $user = $request->user();
        if (!$user->hasRole('Super Admin')) {
            match ($user->roles->first()?->name) {
                'Administrador' => $all->whereIn('balances.project_id', $user->assignedProjects()->select('projects.id')),
                'Asesor Comercial' => $all->where('customers.assigned_user_id', $user->id),
                default => abort(403),
            };
        }

        $projects = (clone $all)->groupBy('projects.name')->orderBy('projects.name')
            ->selectRaw('projects.name, count(*) as count')->get();
        $query = clone $all;
        if ($request->filled('project') && $request->input('project') !== 'TODOS') {
            $query->where('projects.name', $request->input('project'));
        }
        if ($request->filled('search')) {
            $term = '%'.trim($request->input('search')).'%';
            $query->where(fn ($match) => $match->whereLike('customers.name', $term)
                ->orWhereLike('customers.id_card', $term)->orWhereLike('customers.phone', $term)
                ->orWhereLike('balances.lot_number', $term));
        }

        $filteredAmount = (float) (clone $query)->sum('overdue_balance');
        $sort = match ($request->input('sort')) {
            'monto_asc' => ['overdue_balance', 'asc'],
            'cuotas_desc' => ['overdue_installments', 'desc'],
            'nombre_asc' => ['customers.name', 'asc'],
            default => ['overdue_balance', 'desc'],
        };
        $page = $query->select([
            'balances.id as lot_id', 'balances.lot_number', 'balances.project_id',
            'balances.customer_id', 'balances.installment_amount', 'balances.payment_day',
            'balances.actual_paid', 'balances.total_price', 'projects.name as project_name',
            'customers.name as customer_name', 'customers.phone as customer_phone',
            'customers.id_card as customer_id_card', 'balances.overdue_balance as overdue_amount',
        ])->selectRaw('greatest(1, ceil(overdue_balance / greatest(1, installment_amount))) as overdue_installments')
            ->orderBy(...$sort)->orderBy('balances.id')
            ->paginate($this->perPage($request))->withQueryString()
            ->through(function ($lot) {
                $lot->overdue_installments = (int) $lot->overdue_installments;
                $lot->project_slug = Str::slug($lot->project_name);
                $lot->mora_status = 'EN MORA';
                return $lot;
            });

        return response()->json([
            ...$page->toArray(),
            'projects' => $projects,
            'delinquent_count' => (int) $projects->sum('count'),
            'total_mora_amount' => (float) $all->sum('overdue_balance'),
            'filtered_mora_amount' => $filteredAmount,
        ]);
    }

    /**
     * Retorna estadísticas en tiempo real calculadas directamente desde PostgreSQL,
     * incluyendo alertas de mora con los clientes y montos vencidos.
     */
    public function stats(DelinquentLots $delinquentLots): JsonResponse
    {
        // 1. Métricas de Lotes
        $totalLots = Lot::count();
        $availableLots = Lot::where('status', 'Disponible')->count();
        $soldLots = Lot::where('status', 'Vendido')->whereNotNull('customer_id')->count();
        $reservedLots = Lot::where('status', 'Reservado')->count();

        // 2. Métricas Financieras
        $totalPortfolioValue = (float) Lot::where('status', 'Vendido')
            ->whereNotNull('customer_id')
            ->sum('total_price');

        $currentMonth = Carbon::now()->month;
        $currentYear = Carbon::now()->year;

        $totalCollectedMonth = (float) Payment::where('status', 'Válido')
            ->whereMonth('created_at', $currentMonth)
            ->whereYear('created_at', $currentYear)
            ->sum('amount_paid');

        $receiptsMonthCount = Payment::where('status', 'Válido')
            ->whereMonth('created_at', $currentMonth)
            ->whereYear('created_at', $currentYear)
            ->count();

        $totalCollectedAllTime = (float) Payment::where('status', 'Válido')->sum('amount_paid');
        $totalReceiptsAllTime = Payment::where('status', 'Válido')->count();

        $totalDebtPending = max(0, $totalPortfolioValue - $totalCollectedAllTime);

        $mora = $delinquentLots->query()
            ->selectRaw('count(*) as count, coalesce(sum(overdue_balance), 0) as amount')->first();

        // 4. Resumen y Avance de Ventas por Proyecto
        $projects = Project::with(['administrators:id,name,email'])->withCount([
            'lots',
            'lots as sold_lots_count' => function ($q) {
                $q->where('status', 'Vendido')->whereNotNull('customer_id');
            },
            'lots as available_lots_count' => function ($q) {
                $q->where('status', 'Disponible');
            },
            'lots as reserved_lots_count' => function ($q) {
                $q->where('status', 'Reservado');
            },
        ])->with(['lots' => function ($q) {
            $q->select('id', 'project_id', 'total_price')->where('status', 'Vendido')->whereNotNull('customer_id')->with(['payments' => function ($pq) {
                $pq->where('status', 'Válido')->select('id', 'lot_id', 'amount_paid', 'status');
            }]);
        }])->orderBy('id', 'asc')->get();

        $projectsSummary = $projects->map(function ($project) {
            $pTotal = $project->lots_count;
            $pSold = $project->sold_lots_count;
            $pAvailable = $project->available_lots_count;
            $pPercentage = $pTotal > 0 ? round(($pSold / $pTotal) * 100) : 0;

            $pPortfolio = (float) $project->lots->sum('total_price');
            $pCollected = (float) $project->lots->flatMap->payments->where('status', 'Válido')->sum('amount_paid');
            $pDebt = max(0, $pPortfolio - $pCollected);

            $adminName = $project->administrators->pluck('name')->implode(', ') ?: 'Sin asignar';

            return [
                'id' => $project->id,
                'name' => $project->name,
                'location' => $project->location,
                'status' => $project->status,
                'slug' => Str::slug($project->name),
                'admin_name' => $adminName,
                'administrators' => $project->administrators,
                'total_lots' => $pTotal,
                'sold_lots' => $pSold,
                'available_lots' => $pAvailable,
                'reserved_lots' => $project->reserved_lots_count,
                'sales_percentage' => $pPercentage,
                'portfolio_value' => $pPortfolio,
                'collected' => $pCollected,
                'debt_pending' => $pDebt,
            ];
        });

        // 5. Últimos 5 Recibos de Cobro Registrados
        $recentPayments = Payment::with(['lot.project', 'lot.customer'])
            ->where('status', 'Válido')
            ->select('id', 'lot_id', 'amount_paid', 'payment_method', 'created_at', 'status')
            ->orderBy('id', 'desc')
            ->limit(5)
            ->get()
            ->map(function ($p) {
                return [
                    'id' => $p->id,
                    'receipt_number' => sprintf('REC-%05d', $p->id),
                    'customer_name' => $p->lot?->customer?->name ?? 'Cliente',
                    'project_name' => $p->lot?->project?->name ?? 'Proyecto',
                    'project_slug' => Str::slug($p->lot?->project?->name ?? 'proyecto'),
                    'lot_number' => $p->lot?->lot_number ?? 'Lote',
                    'amount_paid' => (float) $p->amount_paid,
                    'payment_method' => $p->payment_method ?? 'Efectivo',
                    'created_at' => $p->created_at ? $p->created_at->format('d/m/Y H:i') : 'N/A',
                ];
            });

        return response()->json([
            'success' => true,
            'stats' => [
                'total_lots' => $totalLots,
                'available_lots' => $availableLots,
                'sold_lots' => $soldLots,
                'reserved_lots' => $reservedLots,
                'total_portfolio_value' => $totalPortfolioValue,
                'total_collected_month' => $totalCollectedMonth,
                'receipts_month_count' => $receiptsMonthCount,
                'total_collected_all_time' => $totalCollectedAllTime,
                'total_receipts_all_time' => $totalReceiptsAllTime,
                'total_debt_pending' => $totalDebtPending,
                'delinquent_count' => (int) $mora->count,
                'total_mora_amount' => (float) $mora->amount,
                'projects_summary' => $projectsSummary,
                'recent_payments' => $recentPayments,
            ],
        ]);
    }
}
