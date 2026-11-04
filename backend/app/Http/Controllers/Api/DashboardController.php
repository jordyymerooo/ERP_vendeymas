<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Lot;
use App\Models\Payment;
use App\Models\Project;
use Carbon\Carbon;
use Illuminate\Http\JsonResponse;
use Illuminate\Support\Str;

class DashboardController extends Controller
{
    /**
     * Retorna estadísticas en tiempo real calculadas directamente desde PostgreSQL,
     * incluyendo alertas de mora con los clientes y montos vencidos.
     */
    public function stats(): JsonResponse
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

        // 3. Alertas de Mora Reales en PostgreSQL
        $soldLotsRecords = Lot::with(['customer', 'project', 'payments'])
            ->where('status', 'Vendido')
            ->whereNotNull('customer_id')
            ->get();

        $delinquentCustomers = [];
        $totalMoraAmount = 0;

        foreach ($soldLotsRecords as $lot) {
            $moraInfo = $lot->calculateMoraStatus();
            if ($moraInfo['status'] === 'EN MORA') {
                $totalMoraAmount += $moraInfo['overdue_amount'];
                $delinquentCustomers[] = [
                    'lot_id' => $lot->id,
                    'lot_number' => $lot->lot_number,
                    'project_id' => $lot->project_id,
                    'project_name' => $lot->project?->name ?? 'Proyecto',
                    'project_slug' => Str::slug($lot->project?->name ?? 'proyecto'),
                    'customer_id' => $lot->customer_id,
                    'customer_name' => $lot->customer?->name ?? 'Cliente',
                    'customer_id_card' => $lot->customer?->id_card ?? 'N/A',
                    'customer_phone' => $lot->customer?->phone ?? 'N/A',
                    'overdue_amount' => $moraInfo['overdue_amount'],
                    'overdue_installments' => $moraInfo['overdue_installments'],
                    'installment_amount' => $moraInfo['installment_amount'],
                    'payment_day' => $moraInfo['payment_day'],
                    'actual_paid' => $moraInfo['actual_paid'],
                    'total_price' => (float) $lot->total_price,
                    'mora_status' => 'EN MORA',
                ];
            }
        }

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
            $q->where('status', 'Vendido')->whereNotNull('customer_id')->with(['payments' => function ($pq) {
                $pq->where('status', 'Válido');
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
                'delinquent_customers' => $delinquentCustomers,
                'delinquent_count' => count($delinquentCustomers),
                'total_mora_amount' => $totalMoraAmount,
                'projects_summary' => $projectsSummary,
                'recent_payments' => $recentPayments,
            ],
        ]);
    }
}
