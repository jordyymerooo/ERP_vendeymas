<?php

namespace App\Http\Controllers\Api;

use App\Helpers\RoleSecurity;
use App\Http\Controllers\Controller;
use App\Models\AuditLog;
use App\Models\Lot;
use App\Models\Payment;
use App\Models\User;
use Barryvdh\DomPDF\Facade\Pdf;
use Carbon\Carbon;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Storage;
use Illuminate\Support\Str;

class PaymentController extends Controller
{
    /**
     * Construye la consulta filtrada de pagos con base en los parámetros del request.
     */
    protected function buildPaymentsFilteredQuery(Request $request)
    {
        $query = Payment::select([
            'id', 'lot_id', 'deed_id', 'topography_job_id', 'user_id',
            'receipt_book', 'book_sequence', 'receipt_code', 'concept_detail',
            'amount_paid', 'debt_balance', 'payment_method', 'bank_reference',
            'status', 'void_reason', 'voided_at', 'voided_by', 'created_at', 'updated_at'
        ])->with([
            'lot:id,project_id,customer_id,lot_number',
            'lot.project:id,name',
            'lot.customer:id,name,id_card,phone,email',
            'deed:id,project_id,customer_id,stage',
            'deed.project:id,name',
            'deed.customer:id,name,id_card,phone,email',
            'topographyJob:id,client_name,client_phone,service_type',
            'cashier:id,name',
            'voidedByUser:id,name'
        ]);

        $requestedBook = $request->filled('receipt_book') && !in_array(strtoupper($request->input('receipt_book')), ['TODOS', 'ALL', ''])
            ? strtoupper($request->input('receipt_book'))
            : null;

        // Filtro por recibera independiente ('GERENCIA', 'ADMINISTRACION', 'ASESORIA', 'TOPOGRAFIA')
        if ($requestedBook) {
            $query->where('receipt_book', $requestedBook);
        }

        // Filtro estricto por proyecto asignado para el rol Administrador
        // Regla: No restringir por lote/proyecto si se consulta explícitamente TOPOGRAFIA
        $user = $request->user() ?: auth()->user();
        $simulatedRole = $request->header('X-Simulate-Role') ?: $request->header('X-Simulated-Role') ?: $request->query('simulate_role');
        $isAdminRole = ($user && $user->hasRole('Administrador') && !$user->hasRole('Super Admin') && $user->id !== 1)
            || ($simulatedRole === 'Administrador');

        if ($isAdminRole && $requestedBook !== 'TOPOGRAFIA') {
            $effectiveAdmin = ($user && $user->hasRole('Administrador')) 
                ? $user 
                : (User::where('email', 'administrador1@vendeymas.com')->first() 
                   ?: User::whereHas('assignedProjects')->first() 
                   ?: User::role('Administrador')->first());

            if ($effectiveAdmin) {
                $assignedProjectIds = $effectiveAdmin->assignedProjects()->pluck('projects.id')->toArray();
                $query->where(function ($q) use ($assignedProjectIds) {
                    $q->where(function ($sub) use ($assignedProjectIds) {
                        $sub->whereHas('lot', fn($l) => $l->whereIn('project_id', $assignedProjectIds))
                            ->orWhereHas('deed', fn($d) => $d->whereIn('project_id', $assignedProjectIds));
                    })->orWhere(function ($sub) {
                        $sub->where('receipt_book', 'TOPOGRAFIA')
                            ->orWhereNotNull('topography_job_id');
                    });
                });
            }
        }

        // Filtro por rango de fechas (start_date, end_date)
        if ($request->filled('start_date')) {
            try {
                $start = Carbon::parse($request->input('start_date'))->startOfDay();
                $query->where('created_at', '>=', $start);
            } catch (\Throwable $e) {}
        }

        if ($request->filled('end_date')) {
            try {
                $end = Carbon::parse($request->input('end_date'))->endOfDay();
                $query->where('created_at', '<=', $end);
            } catch (\Throwable $e) {}
        }

        // Filtro por proyecto (project_id o nombre/slug)
        // Regla: Los recibos de topografía no pertenecen a lotes, por lo que los filtros por proyecto
        // aplican solo si el recibo está vinculado a un proyecto, evitando excluir los comprobantes TOP.
        if ($request->filled('project_id') && $requestedBook !== 'TOPOGRAFIA') {
            $projectId = $request->input('project_id');
            $query->where(function ($q) use ($projectId) {
                $q->where(function ($sub) use ($projectId) {
                    $sub->whereHas('lot', fn($lotQ) => $lotQ->where('project_id', $projectId))
                        ->orWhereHas('deed', fn($deedQ) => $deedQ->where('project_id', $projectId));
                })->orWhere(function ($sub) {
                    $sub->where('receipt_book', 'TOPOGRAFIA')
                        ->orWhereNotNull('topography_job_id');
                });
            });
        } elseif ($request->filled('project') && $requestedBook !== 'TOPOGRAFIA') {
            $projectTerm = $request->input('project');
            $query->where(function ($q) use ($projectTerm) {
                $q->where(function ($sub) use ($projectTerm) {
                    $sub->whereHas('lot.project', function ($lotQ) use ($projectTerm) {
                        $lotQ->where('name', 'ilike', '%' . $projectTerm . '%')
                             ->orWhereRaw("LOWER(REPLACE(name, ' ', '-')) = ?", [strtolower($projectTerm)]);
                    })->orWhereHas('deed.project', function ($deedQ) use ($projectTerm) {
                        $deedQ->where('name', 'ilike', '%' . $projectTerm . '%')
                              ->orWhereRaw("LOWER(REPLACE(name, ' ', '-')) = ?", [strtolower($projectTerm)]);
                    });
                })->orWhere(function ($sub) {
                    $sub->where('receipt_book', 'TOPOGRAFIA')
                        ->orWhereNotNull('topography_job_id');
                });
            });
        }

        // Filtro por método de pago
        if ($request->filled('payment_method') && !in_array(strtoupper($request->input('payment_method')), ['TODOS', 'ALL', ''])) {
            $method = $request->input('payment_method');
            if (stripos($method, 'efectivo') !== false) {
                $query->where('payment_method', 'ilike', '%efectivo%');
            } elseif (stripos($method, 'transferencia') !== false) {
                $query->where('payment_method', 'ilike', '%transferencia%');
            } elseif (stripos($method, 'depósito') !== false || stripos($method, 'deposito') !== false) {
                $query->where(function ($q) {
                    $q->where('payment_method', 'ilike', '%depósito%')
                      ->orWhere('payment_method', 'ilike', '%deposito%');
                });
            } else {
                $query->where('payment_method', 'ilike', '%' . $method . '%');
            }
        }

        // Filtro por término de búsqueda (número de recibo, código oficial, cliente, lote o concepto)
        if ($request->filled('search')) {
            $search = $request->input('search');
            $numericSearch = preg_replace('/[^0-9]/', '', $search);

            $query->where(function ($q) use ($search, $numericSearch) {
                if (!empty($numericSearch)) {
                    $q->where('id', (int) $numericSearch);
                }
                $q->orWhere('receipt_code', 'ilike', '%' . $search . '%')
                  ->orWhere('concept_detail', 'ilike', '%' . $search . '%')
                  ->orWhereHas('lot.customer', function ($cQ) use ($search) {
                    $cQ->where('name', 'ilike', '%' . $search . '%')
                       ->orWhere('id_card', 'like', '%' . $search . '%');
                })->orWhereHas('lot', function ($lQ) use ($search) {
                    $lQ->where('lot_number', 'ilike', '%' . $search . '%');
                })->orWhereHas('deed.customer', function ($dCQ) use ($search) {
                    $dCQ->where('name', 'ilike', '%' . $search . '%')
                        ->orWhere('id_card', 'like', '%' . $search . '%');
                })->orWhereHas('topographyJob', function ($tQ) use ($search) {
                    $tQ->where('client_name', 'ilike', '%' . $search . '%');
                });
            });
        }

        return $query;
    }

    /**
     * Calcula los totales de cierre y arqueo de caja del periodo/filtros seleccionados.
     */
    protected function buildCashCloseSummary($baseQuery, Request $request): array
    {
        // 1. Total Neto Válido
        $validQuery = (clone $baseQuery)->where('status', 'Válido');
        $totalValidAmount = (float) $validQuery->sum('amount_paid');
        $validCount = (int) $validQuery->count();

        // 2. Desglose: Efectivo en Caja (donde status = 'Válido')
        $cashQuery = (clone $baseQuery)->where('status', 'Válido')
            ->where('payment_method', 'ilike', '%efectivo%');
        $totalCash = (float) $cashQuery->sum('amount_paid');
        $cashCount = (int) $cashQuery->count();

        // 3. Desglose: Transferencias / Bancos / Depósitos (donde status = 'Válido')
        $transferQuery = (clone $baseQuery)->where('status', 'Válido')
            ->where(function ($q) {
                $q->where('payment_method', 'ilike', '%transferencia%')
                  ->orWhere('payment_method', 'ilike', '%depósito%')
                  ->orWhere('payment_method', 'ilike', '%deposito%')
                  ->orWhere('payment_method', 'ilike', '%banco%')
                  ->orWhere('payment_method', 'ilike', '%cheque%');
            });
        $totalTransfer = (float) $transferQuery->sum('amount_paid');
        $transferCount = (int) $transferQuery->count();

        // Otros métodos válidos (si los hubiera)
        $otherValidAmount = max(0, round($totalValidAmount - ($totalCash + $totalTransfer), 2));

        // 4. Recibos Anulados (en el mismo periodo y filtros)
        $voidedQuery = (clone $baseQuery)->where('status', 'Anulado');
        $voidedCount = (int) $voidedQuery->count();
        $voidedAmount = (float) $voidedQuery->sum('amount_paid');

        return [
            'total_valid_amount' => round($totalValidAmount, 2),
            'valid_count' => $validCount,
            'total_cash' => round($totalCash, 2),
            'cash_count' => $cashCount,
            'total_transfer' => round($totalTransfer, 2),
            'transfer_count' => $transferCount,
            'total_other' => $otherValidAmount,
            'voided_count' => $voidedCount,
            'voided_amount' => round($voidedAmount, 2),
            'total_count' => $validCount + $voidedCount,
            'filters' => [
                'start_date' => $request->input('start_date'),
                'end_date' => $request->input('end_date'),
                'project' => $request->input('project'),
                'payment_method' => $request->input('payment_method'),
            ],
        ];
    }

    /**
     * Retorna el listado paginado de todos los pagos con sus relaciones de Lote, Proyecto y Cliente,
     * junto con el bloque de arqueo y cierre contable de caja diario.
     */
    public function index(Request $request): JsonResponse
    {
        $baseQuery = $this->buildPaymentsFilteredQuery($request);

        // Resumen contable de Arqueo de Caja del periodo filtrado
        $cashCloseSummary = $this->buildCashCloseSummary($baseQuery, $request);

        // Si se filtra específicamente por estado en la vista de tabla
        $tableQuery = clone $baseQuery;
        if ($request->filled('status') && !in_array(strtoupper($request->input('status')), ['TODOS', 'ALL', ''])) {
            $tableQuery->where('status', $request->input('status'));
        }

        $paginated = $tableQuery->orderBy('created_at', 'desc')->paginate(50);

        // Formatear cada registro para el frontend
        $paginated->getCollection()->transform(function ($payment) {
            $receiptNumber = $payment->receipt_code ?: ('REC-' . str_pad($payment->id, 5, '0', STR_PAD_LEFT));
            $projectName = $payment->lot?->project?->name ?? $payment->deed?->project?->name ?? 'Proyecto General';
            $projectSlug = Str::slug($projectName);
            $customerName = $payment->lot?->customer?->name ?? $payment->deed?->customer?->name ?? $payment->topographyJob?->client_name ?? 'Consumidor Final';
            $customerIdCard = $payment->lot?->customer?->id_card ?? $payment->deed?->customer?->id_card ?? 'N/A';
            $customerPhone = $payment->lot?->customer?->phone ?? $payment->deed?->customer?->phone ?? $payment->topographyJob?->client_phone ?? 'N/A';

            return [
                'id' => $payment->id,
                'receipt_number' => $receiptNumber,
                'receipt_code' => $receiptNumber,
                'receipt_book' => $payment->receipt_book ?? 'ASESORIA',
                'book_sequence' => $payment->book_sequence ?? 1,
                'concept_detail' => $payment->concept_detail,
                'deed_id' => $payment->deed_id,
                'topography_job_id' => $payment->topography_job_id,
                'date' => $payment->created_at ? $payment->created_at->format('d/m/Y') : '',
                'time' => $payment->created_at ? $payment->created_at->format('H:i:s') : '',
                'amount_paid' => (float) $payment->amount_paid,
                'debt_balance' => (float) $payment->debt_balance,
                'status' => $payment->status ?? 'Válido',
                'void_reason' => $payment->void_reason,
                'voided_at' => $payment->voided_at ? $payment->voided_at->format('d/m/Y H:i') : null,
                'voided_by' => $payment->voided_by,
                'voided_by_user' => $payment->voidedByUser?->name,
                'payment_method' => $payment->payment_method,
                'bank_reference' => $payment->bank_reference,
                'project_name' => $projectName,
                'project_slug' => $projectSlug,
                'lot_id' => $payment->lot_id,
                'lot_number' => $payment->lot?->lot_number ?? ($payment->deed_id ? "Escritura #{$payment->deed_id}" : ($payment->topography_job_id ? "Topografía #{$payment->topography_job_id}" : 'Cobro General')),
                'customer_name' => $customerName,
                'customer_id_card' => $customerIdCard,
                'customer_phone' => $customerPhone,
                'customer_email' => $payment->lot?->customer?->email ?? $payment->deed?->customer?->email ?? null,
                'cashier_name' => $payment->cashier?->name ?? 'Asesor Autorizado',
                'pdf_url' => url('/api/payments/' . $payment->id . '/pdf'),
            ];
        });

        $responseArray = $paginated->toArray();
        $responseArray['cash_close_summary'] = $cashCloseSummary;

        return response()->json($responseArray);
    }

    /**
     * Exporta el reporte contable a archivo .csv con BOM UTF-8 y delimitador ; para Microsoft Excel.
     */
    public function exportExcel(Request $request)
    {
        $query = $this->buildPaymentsFilteredQuery($request);

        if ($request->filled('status') && !in_array(strtoupper($request->input('status')), ['TODOS', 'ALL', ''])) {
            $query->where('status', $request->input('status'));
        }

        $payments = $query->orderBy('created_at', 'desc')->get();

        $startDate = $request->input('start_date') ? str_replace('-', '', $request->input('start_date')) : date('Ymd');
        $endDate = $request->input('end_date') ? str_replace('-', '', $request->input('end_date')) : date('Ymd');
        $filename = "cierre_caja_{$startDate}_{$endDate}.csv";

        return response()->streamDownload(function () use ($payments) {
            $handle = fopen('php://output', 'w');

            // BOM UTF-8 para compatibilidad directa con Microsoft Excel en español
            fwrite($handle, "\xEF\xBB\xBF");

            // Encabezados contables oficiales
            fputcsv($handle, [
                'N° Comprobante',
                'Fecha',
                'Hora',
                'Estado',
                'Cliente',
                'Cédula',
                'Proyecto',
                'Lote',
                'Método de Pago',
                'Monto ($)',
                'Cajero/Usuario',
                'Observación/Motivo Anulación',
            ], ';');

            foreach ($payments as $p) {
                $receiptNum = $p->receipt_code ?: ('REC-' . str_pad($p->id, 5, '0', STR_PAD_LEFT));
                $client = $p->lot?->customer?->name ?? $p->deed?->customer?->name ?? $p->topographyJob?->client_name ?? 'Consumidor Final';
                $idCard = $p->lot?->customer?->id_card ?? $p->deed?->customer?->id_card ?? 'N/A';
                $proj = $p->lot?->project?->name ?? $p->deed?->project?->name ?? ($p->topography_job_id ? 'Topografía' : 'Proyecto General');
                $item = $p->lot?->lot_number ?? ($p->deed_id ? "Escritura #{$p->deed_id}" : ($p->topography_job_id ? "Topografía #{$p->topography_job_id}" : 'Cobro General'));
                $cashier = $p->cashier?->name ?? $p->voidedByUser?->name ?? 'Administración';

                fputcsv($handle, [
                    $receiptNum,
                    $p->created_at ? $p->created_at->format('d/m/Y') : '',
                    $p->created_at ? $p->created_at->format('H:i:s') : '',
                    $p->status ?? 'Válido',
                    $client,
                    $idCard,
                    $proj,
                    $item,
                    $p->payment_method ?? 'N/A',
                    number_format((float) $p->amount_paid, 2, '.', ''),
                    $cashier,
                    $p->void_reason ?? '',
                ], ';');
            }

            fclose($handle);
        }, $filename, [
            'Content-Type' => 'text/csv; charset=UTF-8',
            'Content-Disposition' => 'attachment; filename="' . $filename . '"',
        ]);
    }

    /**
     * Genera el Reporte Oficial de Cierre y Arqueo de Caja en PDF con DOMPDF.
     */
    public function exportPdf(Request $request)
    {
        $baseQuery = $this->buildPaymentsFilteredQuery($request);
        $summary = $this->buildCashCloseSummary($baseQuery, $request);

        $tableQuery = clone $baseQuery;
        if ($request->filled('status') && !in_array(strtoupper($request->input('status')), ['TODOS', 'ALL', ''])) {
            $tableQuery->where('status', $request->input('status'));
        }

        $payments = $tableQuery->orderBy('created_at', 'desc')->get();

        // Determinar etiquetas de período
        $startDate = $request->input('start_date');
        $endDate = $request->input('end_date');
        if ($startDate && $endDate) {
            $periodLabel = Carbon::parse($startDate)->format('d/m/Y') . ' al ' . Carbon::parse($endDate)->format('d/m/Y');
        } elseif ($startDate) {
            $periodLabel = 'Desde ' . Carbon::parse($startDate)->format('d/m/Y');
        } elseif ($endDate) {
            $periodLabel = 'Hasta ' . Carbon::parse($endDate)->format('d/m/Y');
        } else {
            $periodLabel = 'Histórico General (' . now()->format('d/m/Y') . ')';
        }

        $projectFilter = 'Todos los Proyectos';
        if ($request->filled('project')) {
            $projectFilter = $request->input('project');
        } elseif ($request->filled('project_id')) {
            $project = \App\Models\Project::find($request->input('project_id'));
            $projectFilter = $project ? $project->name : 'Proyecto #' . $request->input('project_id');
        }

        $methodFilter = $request->filled('payment_method') ? $request->input('payment_method') : 'Todos los Métodos';
        $cashierName = $request->user()?->name ?? 'Caja General / Administración';
        $generatedAt = now()->format('d/m/Y H:i');

        $pdf = Pdf::loadView('cash_close', [
            'payments' => $payments,
            'summary' => $summary,
            'valid_count' => $summary['valid_count'],
            'voided_count' => $summary['voided_count'],
            'total_count' => $summary['total_count'],
            'period_label' => $periodLabel,
            'project_filter' => $projectFilter,
            'method_filter' => $methodFilter,
            'cashier_name' => $cashierName,
            'generated_at' => $generatedAt,
        ])->setPaper('a4', 'portrait')->setOptions([
            'isHtml5ParserEnabled' => true,
            'isRemoteEnabled' => true,
        ]);

        $filename = 'cierre_caja_' . ($startDate ? str_replace('-', '', $startDate) : date('Ymd')) . '_' . ($endDate ? str_replace('-', '', $endDate) : date('Ymd')) . '.pdf';
        return $pdf->stream($filename);
    }

    /**
     * Determina la recibera independiente y genera el correlativo correspondiente.
     * Roles: Super Admin -> GER-XXXXX (GERENCIA), Administrador -> ADM-XXXXX (ADMINISTRACION),
     * Topógrafo -> TOP-XXXXX (TOPOGRAFIA), Asesor Comercial -> ASE-XXXXX (ASESORIA).
     */
    public static function generateReceiptBookAndCode(?User $user, ?string $requestedBook = null): array
    {
        if ($requestedBook && in_array(strtoupper($requestedBook), ['GERENCIA', 'ADMINISTRACION', 'ASESORIA', 'TOPOGRAFIA'])) {
            $book = strtoupper($requestedBook);
        } else {
            if ($user && ($user->hasRole('Super Admin') || $user->id === 1)) {
                $book = 'GERENCIA';
            } elseif ($user && $user->hasRole('Administrador')) {
                $book = 'ADMINISTRACION';
            } elseif ($user && $user->hasRole('Topógrafo')) {
                $book = 'TOPOGRAFIA';
            } else {
                $book = 'ASESORIA';
            }
        }

        $prefix = match ($book) {
            'GERENCIA' => 'GER',
            'ADMINISTRACION' => 'ADM',
            'TOPOGRAFIA' => 'TOP',
            default => 'ASE',
        };

        // Numeración correlativa estricta con bloqueo de fila para evitar duplicados
        // en cobros simultáneos desde múltiples tablets/dispositivos.
        $lastPayment = Payment::where('receipt_code', 'like', $prefix . '-%')
            ->orderBy('id', 'desc')
            ->lockForUpdate()
            ->first();

        $nextNumber = 1;
        if ($lastPayment && $lastPayment->receipt_code) {
            $stripped = str_replace($prefix . '-', '', $lastPayment->receipt_code);
            $lastNumber = (int) $stripped;
            if ($lastNumber > 0) {
                $nextNumber = $lastNumber + 1;
            }
        }

        $receiptCode = $prefix . '-' . str_pad($nextNumber, 5, '0', STR_PAD_LEFT);

        return [
            'receipt_book' => $book,
            'book_sequence' => $nextNumber,
            'receipt_code' => $receiptCode,
        ];
    }

    /**
     * Registra un nuevo pago, calcula el saldo deudor y genera el recibo en PDF bajo la recibera correspondiente.
     */
    public function store(Request $request): JsonResponse
    {
        $paymentMethod = (string) $request->input('payment_method');
        $isBankMethod = in_array($paymentMethod, [
            'Transferencia Bancaria',
            'Depósito Bancario',
            'Transferencia',
            'Depósito',
            'Deposito',
            'Deposito Bancario',
            'Depósito en Cuenta',
            'Deposito en Cuenta',
        ])
        || stripos($paymentMethod, 'transferencia') !== false
        || stripos($paymentMethod, 'depósito') !== false
        || stripos($paymentMethod, 'deposito') !== false;

        $bankRefRule = 'nullable|string|min:3|max:100|required_if:payment_method,Transferencia Bancaria,Depósito Bancario,Transferencia,Depósito';
        if ($isBankMethod) {
            $bankRefRule = 'required|string|min:3|max:100';
        }

        $validated = $request->validate([
            'lot_id' => 'nullable|exists:lots,id',
            'deed_id' => 'nullable|exists:deeds,id',
            'topography_job_id' => 'nullable|exists:topography_jobs,id',
            'receipt_book' => 'nullable|string|in:GERENCIA,ADMINISTRACION,ASESORIA,TOPOGRAFIA',
            'concept_detail' => 'nullable|string|max:1000',
            'client_name' => 'nullable|string|max:255',
            'client_phone' => 'nullable|string|max:50',
            'amount_paid' => 'required|numeric|gt:0|max:999999',
            'payment_method' => 'required|string',
            'bank_reference' => $bankRefRule,
            'signature_base64' => 'nullable|string',
            'customer_signature' => 'nullable|string',
        ], [
            'amount_paid.required' => 'El monto del pago es obligatorio.',
            'amount_paid.gt' => 'El monto a pagar debe ser mayor a 0.',
            'amount_paid.max' => 'El monto excede el límite máximo permitido ($999,999 USD).',
            'bank_reference.required' => 'El número de comprobante o referencia bancaria es obligatorio para transferencias y depósitos.',
            'bank_reference.required_if' => 'El número de comprobante o referencia bancaria es obligatorio para transferencias y depósitos.',
            'bank_reference.min' => 'El número de comprobante o referencia bancaria debe tener al menos 3 caracteres.',
            'bank_reference.max' => 'El número de comprobante no puede superar los 100 caracteres.',
        ]);

        // Sanitización contra etiquetas HTML y scripts
        if (!empty($validated['concept_detail'])) {
            $validated['concept_detail'] = strip_tags($validated['concept_detail']);
        }
        if (!empty($validated['client_name'])) {
            $validated['client_name'] = strip_tags($validated['client_name']);
        }
        if (!empty($validated['client_phone'])) {
            $validated['client_phone'] = strip_tags($validated['client_phone']);
        }

        // Si es cobro directo de topografía con cliente libre sin ID previo de trabajo
        if (empty($validated['topography_job_id']) && ($validated['receipt_book'] ?? '') === 'TOPOGRAFIA' && !empty($validated['client_name'])) {
            $newJob = \App\Models\TopographyJob::create([
                'client_name' => $validated['client_name'],
                'client_phone' => $validated['client_phone'] ?? null,
                'service_type' => $validated['concept_detail'] ?: 'Servicio Topográfico',
                'location' => 'Sucúa / Morona Santiago',
                'cost' => (float) $validated['amount_paid'],
                'amount_paid' => 0,
                'status' => 'Pendiente',
                'notes' => 'Cobro Directo en Recibera TOP',
            ]);
            $validated['topography_job_id'] = $newJob->id;
        }

        $emitter = RoleSecurity::resolveEffectiveUser($request);
        $user = $emitter;
        $effectiveUserId = $emitter->id;

        $nuevoSaldoDeudor = 0;
        $contextAudit = 'Cobro General';

        if (!empty($validated['lot_id'])) {
            $lot = Lot::with(['customer', 'project'])->findOrFail($validated['lot_id']);

            // Validar que el lote pertenece al cliente si se envía customer_id desde el frontend
            if ($request->filled('customer_id') && $lot->customer_id && (int)$lot->customer_id !== (int)$request->input('customer_id')) {
                return response()->json([
                    'success' => false,
                    'message' => 'El lote seleccionado no pertenece al cliente indicado. Verifique la selección.',
                ], 422);
            }

            $pagosPrevios = (float) $lot->payments()->where('status', 'Válido')->sum('amount_paid');
            $saldoAnterior = max(0, (float) $lot->total_price - $pagosPrevios);
            $nuevoSaldoDeudor = max(0, $saldoAnterior - (float) $validated['amount_paid']);
            if ($nuevoSaldoDeudor == 0) {
                $lot->update(['status' => 'Pagado / Vendido']);
            }
            $contextAudit = "Lote {$lot->lot_number} - {$lot->project?->name}";
        } elseif (!empty($validated['deed_id'])) {
            $deed = \App\Models\Deed::with(['customer', 'project'])->findOrFail($validated['deed_id']);
            $pagosPrevios = (float) $deed->payments()->where('status', 'Válido')->sum('amount_paid');
            $saldoAnterior = max(0, (float) $deed->total_budget - $pagosPrevios);
            $nuevoSaldoDeudor = max(0, $saldoAnterior - (float) $validated['amount_paid']);
            $contextAudit = "Escritura #{$deed->id} (Etapa: {$deed->stage}) - {$deed->customer?->name}";
        } elseif (!empty($validated['topography_job_id'])) {
            $job = \App\Models\TopographyJob::findOrFail($validated['topography_job_id']);
            $pagosPrevios = (float) $job->payments()->where('status', 'Válido')->sum('amount_paid');
            $saldoAnterior = max(0, (float) $job->cost - $pagosPrevios);
            $nuevoSaldoDeudor = max(0, $saldoAnterior - (float) $validated['amount_paid']);
            $job->increment('amount_paid', (float) $validated['amount_paid']);
            if ($nuevoSaldoDeudor == 0) {
                $job->update(['status' => 'Completado']);
            }
            $contextAudit = "Topografía #{$job->id} ({$job->service_type}) - {$job->client_name}";
        }

        $defaultSignature = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII=';
        $signature = !empty($validated['signature_base64']) ? $validated['signature_base64'] : $defaultSignature;

        $payment = DB::transaction(function () use ($validated, $effectiveUserId, $nuevoSaldoDeudor, $signature, $user, $request) {
            $bookInfo = self::generateReceiptBookAndCode($user, $validated['receipt_book'] ?? null);
            return Payment::create([
                'lot_id' => $validated['lot_id'] ?? null,
                'deed_id' => $validated['deed_id'] ?? null,
                'topography_job_id' => $validated['topography_job_id'] ?? null,
                'user_id' => $effectiveUserId,
                'receipt_book' => $bookInfo['receipt_book'],
                'book_sequence' => $bookInfo['book_sequence'],
                'receipt_code' => $bookInfo['receipt_code'],
                'concept_detail' => $validated['concept_detail'] ?? null,
                'amount_paid' => $validated['amount_paid'],
                'status' => 'Válido',
                'debt_balance' => $nuevoSaldoDeudor,
                'payment_method' => $validated['payment_method'],
                'bank_reference' => !empty($validated['bank_reference']) ? trim((string) $validated['bank_reference']) : ($request->filled('bank_reference') ? trim((string) $request->input('bank_reference')) : null),
                'signature_base64' => $signature,
                'customer_signature' => !empty($validated['customer_signature']) ? $validated['customer_signature'] : null,
            ]);
        });

        // Invalidar caché de mora para que se recalcule ante este nuevo pago
        Cache::forget('system_mora_count');

        // Generar y almacenar el PDF
        try {
            $payment->load([
                'lot.customer',
                'lot.project',
                'deed.customer',
                'deed.project',
                'topographyJob',
                'cashier.roles',
            ]);
            $pdf = Pdf::loadView('receipt', compact('payment'))
                ->setOptions([
                    'isHtml5ParserEnabled' => true,
                    'isRemoteEnabled' => true,
                ]);

            Storage::disk('public')->makeDirectory('receipts');
            $fileName = 'receipts/recibo_' . $payment->id . '_' . time() . '.pdf';

            Storage::disk('public')->put($fileName, $pdf->output());
            $receiptUrl = url('/api/payments/' . $payment->id . '/pdf');

            $payment->update([
                'receipt_pdf_url' => $receiptUrl,
            ]);
        } catch (\Throwable $e) {
            $receiptUrl = url('/api/payments/' . $payment->id . '/pdf');
        }

        // Disparo automático de notificación en tiempo real para el CEO
        try {
            $customerName = $payment->lot?->customer?->name 
                ?? $payment->deed?->customer?->name 
                ?? $payment->topographyJob?->client_name 
                ?? 'Cliente';
            $projectName = $payment->lot?->project?->name 
                ?? $payment->deed?->project?->name 
                ?? ($payment->topographyJob ? 'Topografía' : 'Vende & más');
            $cashierName = $user?->name ?? 'Asesor Autorizado';

            \App\Models\AppNotification::create([
                'target_role' => 'Super Admin',
                'target_user_id' => null,
                'type' => 'payment_created',
                'title' => "Nuevo Pago Registrado ({$payment->receipt_code})",
                'message' => "Se cobró $" . number_format((float) $payment->amount_paid, 2) . " USD a {$customerName} ({$projectName}) por {$cashierName} en recibera {$payment->receipt_book}.",
                'action_url' => '/recibos',
                'is_read' => false,
            ]);
        } catch (\Throwable $e) {
            \Illuminate\Support\Facades\Log::warning('Aviso notificación pago: ' . $e->getMessage());
        }

        // Registrar en Auditoría del Sistema
        AuditLog::record(
            $user?->id ?? 1,
            'Cobros',
            "Emitió recibo oficial {$payment->receipt_code} ({$payment->receipt_book}) por $" . number_format((float) $payment->amount_paid, 2) . " USD ({$contextAudit})",
            $request->ip(),
            $request->userAgent()
        );

        return response()->json([
            'success' => true,
            'message' => "Pago registrado y recibo oficial {$payment->receipt_code} emitido con éxito.",
            'data' => $payment->load(['lot.customer', 'lot.project', 'deed.customer', 'deed.project', 'topographyJob', 'cashier']),
            'payment' => $payment,
            'bank_reference' => $payment->bank_reference,
            'receipt_url' => url('/api/payments/' . $payment->id . '/pdf'),
        ], 201);
    }

    /**
     * Endpoint directo para ver o descargar el recibo PDF generado.
     */
    /**
     * Convierte un monto numérico a su representación en letras en español.
     */
    public static function numberToWords(float $number): string
    {
        $number = round($number, 2);
        $entero = (int) floor($number);
        $centavos = (int) round(($number - $entero) * 100);

        $unidades = ['', 'UN', 'DOS', 'TRES', 'CUATRO', 'CINCO', 'SEIS', 'SIETE', 'OCHO', 'NUEVE'];
        $decenas = ['', 'DIEZ', 'VEINTE', 'TREINTA', 'CUARENTA', 'CINCUENTA', 'SESENTA', 'SETENTA', 'OCHENTA', 'NOVENTA'];
        $dieces = ['DIEZ', 'ONCE', 'DOCE', 'TRECE', 'CATORCE', 'QUINCE', 'DIECISÉIS', 'DIECISIETE', 'DIECIOCHO', 'DIECINUEVE'];
        $veintes = ['VEINTE', 'VEINTIUNO', 'VEINTIDÓS', 'VEINTITRÉS', 'VEINTICUATRO', 'VEINTICINCO', 'VEINTISÉIS', 'VEINTISIETE', 'VEINTIOCHO', 'VEINTINUEVE'];
        $centenas = ['', 'CIENTO', 'DOSCIENTOS', 'TRESCIENTOS', 'CUATROCIENTOS', 'QUINIENTOS', 'SEISCIENTOS', 'SETECIENTOS', 'OCHOCIENTOS', 'NOVECIENTOS'];

        $convertir3 = function($n) use ($unidades, $decenas, $dieces, $veintes, $centenas, &$convertir3) {
            if ($n === 0) return '';
            if ($n === 100) return 'CIEN';

            $c = (int) floor($n / 100);
            $d = (int) floor(($n % 100) / 10);
            $u = $n % 10;
            $du = $n % 100;

            $res = '';
            if ($c > 0) {
                $res .= $centenas[$c] . ' ';
            }

            if ($du >= 10 && $du <= 19) {
                $res .= $dieces[$du - 10];
            } elseif ($du >= 20 && $du <= 29) {
                $res .= $veintes[$du - 20];
            } else {
                if ($d > 0) {
                    $res .= $decenas[$d];
                    if ($u > 0) {
                        $res .= ' Y ' . $unidades[$u];
                    }
                } elseif ($u > 0) {
                    $res .= $unidades[$u];
                }
            }
            return trim($res);
        };

        if ($entero === 0) {
            $texto = 'CERO';
        } else {
            $millones = (int) floor($entero / 1000000);
            $restoMillones = $entero % 1000000;
            $miles = (int) floor($restoMillones / 1000);
            $unidadesCentenas = $restoMillones % 1000;

            $partes = [];
            if ($millones > 0) {
                if ($millones === 1) {
                    $partes[] = 'UN MILLÓN';
                } else {
                    $partes[] = $convertir3($millones) . ' MILLONES';
                }
            }

            if ($miles > 0) {
                if ($miles === 1) {
                    $partes[] = 'MIL';
                } else {
                    $partes[] = $convertir3($miles) . ' MIL';
                }
            }

            if ($unidadesCentenas > 0) {
                $partes[] = $convertir3($unidadesCentenas);
            }

            $texto = implode(' ', $partes);
        }

        $centavosStr = str_pad((string)$centavos, 2, '0', STR_PAD_LEFT) . '/100';
        return trim($texto) . ' CON ' . $centavosStr;
    }

    /**
     * Anulación controlada de recibo exclusivo para el Super Administrador.
     */
    public function voidReceipt(Request $request, int|string $id): JsonResponse
    {
        $user = $request->user();

        // 1. Validar que el usuario tenga rol Super Admin
        $isSuperAdmin = $user && (
            (method_exists($user, 'hasRole') && $user->hasRole('Super Admin')) ||
            (isset($user->roles) && $user->roles->contains('name', 'Super Admin')) ||
            $user->id === 1
        );

        if (!$isSuperAdmin) {
            return response()->json([
                'success' => false,
                'message' => 'Acceso denegado. La anulación de comprobantes contables es exclusiva del rol Super Admin.',
            ], 403);
        }

        // 2. Validar motivo obligatorio (mínimo 5 caracteres, máximo 1000)
        $validated = $request->validate([
            'reason' => 'required|string|min:5|max:1000',
        ], [
            'reason.required' => 'El motivo de anulación es obligatorio.',
            'reason.min' => 'El motivo de anulación debe tener al menos 5 caracteres.',
            'reason.max' => 'El motivo de anulación no puede superar los 1000 caracteres.',
        ]);
        $validated['reason'] = strip_tags($validated['reason']);

        $payment = Payment::with(['lot.project', 'lot.customer'])->findOrFail($id);

        if ($payment->status === 'Anulado') {
            return response()->json([
                'success' => false,
                'message' => 'Este comprobante ya ha sido anulado anteriormente.',
            ], 422);
        }

        // 3. Cambiar estado a 'Anulado', registrar motivo, fecha y autor
        $payment->update([
            'status' => 'Anulado',
            'void_reason' => $validated['reason'],
            'voided_at' => now(),
            'voided_by' => $user->id,
        ]);

        // Invalidar caché de conteo de mora
        Cache::forget('system_mora_count');

        // 4. Recalcular el estado y saldo del lote si estaba marcado como Pagado / Vendido
        $lot = $payment->lot;
        if ($lot) {
            $pagosValidos = (float) $lot->payments()->where('status', 'Válido')->sum('amount_paid');
            $saldoDeudor = max(0, (float) $lot->total_price - $pagosValidos);
            if ($saldoDeudor > 0 && $lot->status === 'Pagado / Vendido') {
                $lot->update(['status' => 'Vendido']);
            }
        }

        // 5. Regenerar el PDF para plasmar el sello de ANULADO
        try {
            $payment->load([
                'lot.customer',
                'lot.project',
                'deed.customer',
                'deed.project',
                'topographyJob',
                'voidedByUser',
                'cashier.roles',
            ]);
            $pdf = Pdf::loadView('receipt', compact('payment'))
                ->setOptions([
                    'isHtml5ParserEnabled' => true,
                    'isRemoteEnabled' => true,
                ]);

            Storage::disk('public')->makeDirectory('receipts');
            $fileName = 'receipts/recibo_' . $payment->id . '_' . time() . '.pdf';
            Storage::disk('public')->put($fileName, $pdf->output());
        } catch (\Throwable $e) {
            // Regeneración silenciosa de archivo en disco
        }

        // 6. Registrar en Auditoría del Sistema
        $receiptCode = $payment->receipt_code ?: ('REC-' . str_pad($payment->id, 5, '0', STR_PAD_LEFT));
        $montoRevertido = number_format((float) $payment->amount_paid, 2);
        AuditLog::record(
            $user->id,
            'Cobros',
            "Anuló comprobante contable {$receiptCode} por valor revertido de \${$montoRevertido} USD ({$lot?->lot_number} - {$lot?->project?->name}). Motivo: {$validated['reason']}",
            $request->ip(),
            $request->userAgent()
        );

        return response()->json([
            'success' => true,
            'message' => "Comprobante contable {$receiptCode} anulado con éxito. El saldo fue recalculado en la cartera.",
            'data' => $payment->fresh(['lot.customer', 'lot.project', 'deed.customer', 'deed.project', 'topographyJob', 'voidedByUser', 'cashier']),
        ]);
    }

    public function downloadPdf(int|string $id)
    {
        $payment = Payment::with([
            'lot.customer',
            'lot.project',
            'deed',
            'deed.customer',
            'deed.project',
            'topographyJob',
            'voidedByUser',
            'cashier.roles',
        ])->findOrFail($id);

        $pdf = Pdf::loadView('receipt', compact('payment'))
            ->setOptions([
                'isHtml5ParserEnabled' => true,
                'isRemoteEnabled' => true,
            ]);

        return $pdf->stream('Recibo.pdf');
    }
}
