<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Customer;
use App\Models\Lot;
use App\Models\Project;
use Barryvdh\DomPDF\Facade\Pdf;
use Carbon\Carbon;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Str;

class LotController extends Controller
{
    /**
     * Crea un nuevo lote real en la tabla lots para el proyecto especificado.
     */
    public function storeLot(Request $request, string $slug): JsonResponse
    {
        $normalizedName = str_replace('-', ' ', strtolower(urldecode($slug)));

        $project = Project::whereRaw('LOWER(name) = ?', [$normalizedName])
            ->orWhereRaw("LOWER(REPLACE(name, ' ', '-')) = ?", [strtolower(urldecode($slug))])
            ->orWhere('id', is_numeric($slug) ? (int)$slug : 0)
            ->firstOrFail();

        $validated = $request->validate([
            'lot_number' => 'required|string|max:50',
            'area_m2' => 'required|numeric|min:1',
            'total_price' => 'required|numeric|min:1',
            'status' => 'nullable|string|max:50',
        ]);

        $lot = Lot::create([
            'project_id' => $project->id,
            'customer_id' => null,
            'lot_number' => $validated['lot_number'],
            'area_m2' => $validated['area_m2'],
            'total_price' => $validated['total_price'],
            'status' => 'Disponible',
        ]);

        return response()->json([
            'success' => true,
            'message' => 'Lote registrado con éxito en PostgreSQL.',
            'data' => $lot->load('customer'),
        ], 201);
    }

    /**
     * Vende / Asigna un lote disponible a un cliente real de la tabla customers.
     */
    public function assignCustomer(Request $request, int|string $id): JsonResponse
    {
        $validated = $request->validate([
            'customer_id' => 'required|exists:customers,id',
            'installments_count' => 'nullable|integer|min:1|max:120',
            'payment_day' => 'nullable|integer|min:1|max:31',
            'sale_date' => 'nullable|date',
        ]);

        $lot = Lot::findOrFail($id);
        $customer = Customer::findOrFail($validated['customer_id']);

        $lot->update([
            'customer_id' => $customer->id,
            'status' => 'Vendido',
            'installments_count' => $validated['installments_count'] ?? 12,
            'payment_day' => $validated['payment_day'] ?? 15,
            'sale_date' => $validated['sale_date'] ?? now()->toDateString(),
        ]);

        Cache::forget('system_mora_count');

        return response()->json([
            'success' => true,
            'message' => "Lote {$lot->lot_number} asignado y vendido con éxito a {$customer->name}.",
            'data' => $lot->load(['customer', 'project']),
        ]);
    }

    /**
     * Libera un lote (pone customer_id = null y status = 'Disponible').
     */
    public function releaseLot(int|string $id): JsonResponse
    {
        $lot = Lot::findOrFail($id);

        $lot->update([
            'customer_id' => null,
            'status' => 'Disponible',
        ]);

        Cache::forget('system_mora_count');

        return response()->json([
            'success' => true,
            'message' => "Lote {$lot->lot_number} liberado con éxito. Ahora está Disponible.",
            'data' => $lot->load(['customer', 'project']),
        ]);
    }

    /**
     * Guarda o actualiza los polígonos topográficos GeoJSON de un lote.
     */
    public function updateGeojson(Request $request, int|string $id): JsonResponse
    {
        $validated = $request->validate([
            'coordinates_geojson' => 'required',
        ]);

        $lot = Lot::findOrFail($id);

        $geojson = $validated['coordinates_geojson'];
        if (is_string($geojson)) {
            $decoded = json_decode($geojson, true);
            if ($decoded !== null) {
                $geojson = $decoded;
            }
        }

        $lot->update([
            'coordinates_geojson' => $geojson,
        ]);

        return response()->json([
            'success' => true,
            'message' => "Polígono topográfico del Lote {$lot->lot_number} guardado con éxito.",
            'data' => $lot->fresh(['customer', 'project']),
        ]);
    }

    /**
     * Construye la matriz de amortización y cronograma real de pagos para un lote.
     */
    public static function buildAmortizationSchedule(Lot $lot): array
    {
        $lot->loadMissing(['customer', 'project', 'payments' => function ($q) {
            $q->where('status', 'Válido')->orderBy('created_at', 'asc');
        }]);

        $totalPrice = (float) $lot->total_price;
        $installmentsCount = max(1, (int) ($lot->installments_count ?: 12));
        $paymentDay = (int) ($lot->payment_day ?: 15);

        $startDate = $lot->sale_date 
            ? Carbon::parse($lot->sale_date)->startOfDay()
            : ($lot->created_at ? $lot->created_at->copy()->startOfDay() : Carbon::now()->startOfDay());

        $cuotaBase = round($totalPrice / $installmentsCount, 2);
        $totalAbonado = (float) $lot->payments->where('status', 'Válido')->sum('amount_paid');
        $saldoDeudor = max(0, $totalPrice - $totalAbonado);
        $fondoDisponible = $totalAbonado;
        $today = Carbon::now()->startOfDay();

        $rows = [];
        $totalCuotas = 0;
        $totalCubierto = 0;
        $cuotasPagadas = 0;
        $cuotasParciales = 0;
        $cuotasVencidas = 0;
        $cuotasPendientes = 0;

        for ($i = 1; $i <= $installmentsCount; $i++) {
            // Última cuota absorbe posibles centavos de redondeo
            $valorCuota = ($i === $installmentsCount)
                ? round($totalPrice - ($cuotaBase * ($installmentsCount - 1)), 2)
                : $cuotaBase;

            $totalCuotas += $valorCuota;

            // Fecha de vencimiento para la cuota $i
            $targetMonth = $startDate->copy()->addMonths($i);
            $day = min((int)$targetMonth->daysInMonth, $paymentDay);
            $dueDate = Carbon::create($targetMonth->year, $targetMonth->month, $day)->startOfDay();

            if ($fondoDisponible >= $valorCuota) {
                $montoCubierto = $valorCuota;
                $saldoCuota = 0.0;
                $fondoDisponible = round($fondoDisponible - $valorCuota, 2);
                $estado = 'PAGADA';
                $cuotasPagadas++;
            } elseif ($fondoDisponible > 0) {
                $montoCubierto = $fondoDisponible;
                $saldoCuota = round($valorCuota - $montoCubierto, 2);
                $fondoDisponible = 0.0;
                $estado = 'ABONO PARCIAL';
                $cuotasParciales++;
            } else {
                $montoCubierto = 0.0;
                $saldoCuota = $valorCuota;
                if ($dueDate->lt($today)) {
                    $estado = 'VENCIDA (EN MORA)';
                    $cuotasVencidas++;
                } else {
                    $estado = 'PENDIENTE';
                    $cuotasPendientes++;
                }
            }

            $totalCubierto += $montoCubierto;

            $rows[] = [
                'installment_number' => $i,
                'due_date' => $dueDate->format('d/m/Y'),
                'due_date_iso' => $dueDate->toDateString(),
                'installment_amount' => $valorCuota,
                'covered_amount' => $montoCubierto,
                'remaining_amount' => $saldoCuota,
                'status' => $estado,
                'is_overdue' => ($estado === 'VENCIDA (EN MORA)'),
            ];
        }

        return [
            'lot' => $lot,
            'customer' => $lot->customer,
            'project' => $lot->project,
            'total_price' => $totalPrice,
            'installments_count' => $installmentsCount,
            'payment_day' => $paymentDay,
            'sale_date' => $startDate->format('d/m/Y'),
            'total_paid' => $totalAbonado,
            'debt_balance' => $saldoDeudor,
            'installment_base' => $cuotaBase,
            'rows' => $rows,
            'summary' => [
                'total_installments' => $installmentsCount,
                'paid_count' => $cuotasPagadas,
                'partial_count' => $cuotasParciales,
                'overdue_count' => $cuotasVencidas,
                'pending_count' => $cuotasPendientes,
                'total_paid' => $totalAbonado,
                'debt_balance' => $saldoDeudor,
            ],
        ];
    }

    /**
     * Retorna los datos estructurados en JSON del cronograma de amortización.
     */
    public function amortizationSchedule(int|string $id): JsonResponse
    {
        $lot = Lot::with(['customer', 'project', 'payments' => function ($q) {
            $q->where('status', 'Válido')->orderBy('created_at', 'asc');
        }])->findOrFail($id);

        $scheduleData = self::buildAmortizationSchedule($lot);

        return response()->json([
            'success' => true,
            'data' => $scheduleData,
        ]);
    }

    /**
     * Genera y descarga el PDF formal de la tabla de amortización.
     */
    public function amortizationPdf(int|string $id)
    {
        $lot = Lot::with(['customer', 'project', 'payments' => function ($q) {
            $q->where('status', 'Válido')->orderBy('created_at', 'asc');
        }])->findOrFail($id);

        $scheduleData = self::buildAmortizationSchedule($lot);

        $pdf = Pdf::loadView('amortization', $scheduleData)
            ->setOptions([
                'isHtml5ParserEnabled' => true,
                'isRemoteEnabled' => true,
            ]);

        $fileName = 'Cronograma_' . Str::slug($lot->project?->name ?? 'Proyecto') . '_' . Str::slug($lot->lot_number) . '.pdf';

        return $pdf->stream($fileName);
    }
}
