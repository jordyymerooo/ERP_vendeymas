@php
    $logoPath = public_path('logos/logo-transparent.png');
    $logoBase64 = file_exists($logoPath) ? 'data:image/png;base64,' . base64_encode(file_get_contents($logoPath)) : '';
@endphp
<!DOCTYPE html>
<html lang="es">
<head>
    <meta charset="UTF-8">
    <title>Tabla de Amortización - {{ $lot->lot_number }}</title>
    <style>
        body {
            font-family: Arial, Helvetica, sans-serif;
            font-size: 10px;
            color: #1e293b;
            margin: 0;
            padding: 12px 18px;
            background: #ffffff;
        }
        .container {
            width: 100%;
        }
        table {
            width: 100%;
            border-collapse: collapse;
        }
        .header-title {
            color: #1e3a8a;
            font-size: 20px;
            font-weight: bold;
            margin: 0;
            letter-spacing: 0.5px;
        }
        .header-sub {
            font-size: 9.5px;
            color: #475569;
            margin-top: 3px;
            line-height: 1.3;
        }
        .badge-doc {
            font-size: 13px;
            font-weight: bold;
            color: #1e3a8a;
            text-transform: uppercase;
            letter-spacing: 0.5px;
        }
        .info-card {
            border: 1px solid #cbd5e1;
            background-color: #f8fafc;
            padding: 8px 10px;
            margin-bottom: 12px;
        }
        .info-card td {
            padding: 3px 6px;
            font-size: 9.5px;
        }
        .info-label {
            font-weight: bold;
            color: #475569;
            width: 20%;
        }
        .info-val {
            color: #0f172a;
            font-weight: 600;
            width: 30%;
        }
        .schedule-table {
            width: 100%;
            border: 1px solid #cbd5e1;
            margin-top: 8px;
        }
        .schedule-table th {
            background-color: #1e3a8a;
            color: #ffffff;
            font-size: 9px;
            font-weight: bold;
            padding: 6px 5px;
            text-transform: uppercase;
            border: 1px solid #1e3a8a;
        }
        .schedule-table td {
            padding: 4px 6px;
            font-size: 8.5px;
            border: 1px solid #e2e8f0;
        }
        .row-even {
            background-color: #f8fafc;
        }
        .text-center {
            text-align: center;
        }
        .text-right {
            text-align: right;
        }
        .status-badge {
            display: inline-block;
            padding: 2px 6px;
            font-weight: bold;
            font-size: 8px;
            border-radius: 3px;
            text-transform: uppercase;
        }
        .status-pagada {
            background-color: #dcfce7;
            color: #166534;
            border: 1px solid #86efac;
        }
        .status-parcial {
            background-color: #fef3c7;
            color: #92400e;
            border: 1px solid #fcd34d;
        }
        .status-mora {
            background-color: #fee2e2;
            color: #991b1b;
            border: 1px solid #fca5a5;
        }
        .status-pendiente {
            background-color: #f1f5f9;
            color: #475569;
            border: 1px solid #cbd5e1;
        }
        .summary-box {
            border: 1px solid #e2e8f0;
            background-color: #ffffff;
            padding: 6px;
            text-align: center;
        }
        .signatures-table {
            margin-top: 30px;
            page-break-inside: avoid;
        }
        .signature-line {
            border-top: 1px solid #334155;
            width: 80%;
            margin: 0 auto;
            padding-top: 4px;
            font-size: 9px;
            font-weight: bold;
            color: #1e293b;
        }
    </style>
</head>
<body>

<div class="container">
    <!-- Encabezado de la Empresa con Logo Oficial -->
    <table cellpadding="0" cellspacing="0" style="margin-bottom: 8px;">
        <tr>
            <td align="center" style="text-align: center;">
                @if(!empty($logoBase64))
                    <img src="{{ $logoBase64 }}" alt="Vende & más" style="height: 50px; width: auto; margin-bottom: 3px;">
                @else
                    <h1 class="header-title">VENDE & MÁS</h1>
                @endif
                <div class="header-sub">
                    Dirección: Domingo Comín S/N y Tres de Noviembre &bull; Celular: 0989996421 &bull; Sucúa - Morona Santiago
                </div>
            </td>
        </tr>
    </table>

    <!-- Título del Documento -->
    <table cellpadding="4" cellspacing="0" style="margin-bottom: 10px; border-bottom: 2px solid #1e3a8a; padding-bottom: 4px;">
        <tr>
            <td width="65%" align="left" class="badge-doc">
                CRONOGRAMA DE PAGOS Y TABLA DE AMORTIZACIÓN
            </td>
            <td width="35%" align="right" style="text-align: right; font-size: 10px; font-weight: bold; color: #475569;">
                Emisión: {{ date('d/m/Y H:i') }}
            </td>
        </tr>
    </table>

    <!-- Bloque de Datos del Contrato -->
    <div class="info-card">
        <table cellpadding="0" cellspacing="0">
            <tr>
                <td class="info-label">Cliente / Titular:</td>
                <td class="info-val">{{ $customer->name ?? 'Consumidor Final' }}</td>
                <td class="info-label">Proyecto Inmobiliario:</td>
                <td class="info-val">{{ $project->name ?? 'Proyecto General' }}</td>
            </tr>
            <tr>
                <td class="info-label">Cédula / RUC:</td>
                <td class="info-val">{{ $customer->id_card ?? 'N/A' }}</td>
                <td class="info-label">Lote Asignado:</td>
                <td class="info-val">{{ $lot->lot_number }}</td>
            </tr>
            <tr>
                <td class="info-label">Teléfono de Contacto:</td>
                <td class="info-val">{{ $customer->phone ?? 'N/A' }}</td>
                <td class="info-label">Superficie Terreno:</td>
                <td class="info-val">{{ number_format((float)$lot->area_m2, 2) }} m&sup2;</td>
            </tr>
            <tr>
                <td class="info-label">Valor Total del Lote:</td>
                <td class="info-val" style="color: #1e3a8a; font-weight: bold;">
                    $ {{ number_format($total_price, 2) }} USD
                </td>
                <td class="info-label">Plan Pactado:</td>
                <td class="info-val">
                    {{ $installments_count }} cuotas (Día {{ $payment_day }} de cada mes)
                </td>
            </tr>
            <tr>
                <td class="info-label">Total Abonado a la Fecha:</td>
                <td class="info-val" style="color: #166534; font-weight: bold;">
                    $ {{ number_format($total_paid, 2) }} USD
                </td>
                <td class="info-label">Fecha de Venta / Inicio:</td>
                <td class="info-val">{{ $sale_date }}</td>
            </tr>
            <tr>
                <td class="info-label">Saldo Deudor Pendiente:</td>
                <td class="info-val" style="color: #b91c1c; font-weight: bold;">
                    $ {{ number_format($debt_balance, 2) }} USD
                </td>
                <td class="info-label">Cuota Mensual Base:</td>
                <td class="info-val">$ {{ number_format($installment_base, 2) }} USD / mes</td>
            </tr>
        </table>
    </div>

    <!-- Resumen de Cuotas -->
    <table cellpadding="3" cellspacing="4" style="margin-bottom: 8px;">
        <tr>
            <td width="25%">
                <div class="summary-box" style="border-left: 3px solid #166534; background-color: #f0fdf4;">
                    <div style="font-size: 8px; color: #166534; font-weight: bold;">PAGADAS</div>
                    <div style="font-size: 13px; font-weight: bold; color: #15803d;">{{ $summary['paid_count'] }}</div>
                </div>
            </td>
            <td width="25%">
                <div class="summary-box" style="border-left: 3px solid #d97706; background-color: #fffbeb;">
                    <div style="font-size: 8px; color: #b45309; font-weight: bold;">ABONO PARCIAL</div>
                    <div style="font-size: 13px; font-weight: bold; color: #d97706;">{{ $summary['partial_count'] }}</div>
                </div>
            </td>
            <td width="25%">
                <div class="summary-box" style="border-left: 3px solid #dc2626; background-color: #fef2f2;">
                    <div style="font-size: 8px; color: #991b1b; font-weight: bold;">EN MORA</div>
                    <div style="font-size: 13px; font-weight: bold; color: #dc2626;">{{ $summary['overdue_count'] }}</div>
                </div>
            </td>
            <td width="25%">
                <div class="summary-box" style="border-left: 3px solid #64748b; background-color: #f8fafc;">
                    <div style="font-size: 8px; color: #475569; font-weight: bold;">PENDIENTES</div>
                    <div style="font-size: 13px; font-weight: bold; color: #475569;">{{ $summary['pending_count'] }}</div>
                </div>
            </td>
        </tr>
    </table>

    <!-- Tabla Detallada del Cronograma de Cuotas -->
    <table class="schedule-table" cellpadding="0" cellspacing="0">
        <thead>
            <tr>
                <th width="8%" class="text-center">N°</th>
                <th width="20%" class="text-center">Vencimiento</th>
                <th width="18%" class="text-right">Valor Cuota ($)</th>
                <th width="18%" class="text-right">Abono Cubierto ($)</th>
                <th width="18%" class="text-right">Saldo Cuota ($)</th>
                <th width="18%" class="text-center">Estado</th>
            </tr>
        </thead>
        <tbody>
            @foreach($rows as $index => $row)
            <tr class="{{ $index % 2 === 1 ? 'row-even' : '' }}">
                <td class="text-center" style="font-weight: bold; color: #334155;">
                    {{ str_pad($row['installment_number'], 2, '0', STR_PAD_LEFT) }}
                </td>
                <td class="text-center" style="font-weight: 600;">
                    {{ $row['due_date'] }}
                </td>
                <td class="text-right" style="font-weight: bold;">
                    ${{ number_format($row['installment_amount'], 2) }}
                </td>
                <td class="text-right" style="color: #166534; font-weight: bold;">
                    ${{ number_format($row['covered_amount'], 2) }}
                </td>
                <td class="text-right" style="color: {{ $row['remaining_amount'] > 0 ? '#b91c1c' : '#64748b' }}; font-weight: bold;">
                    ${{ number_format($row['remaining_amount'], 2) }}
                </td>
                <td class="text-center">
                    @if($row['status'] === 'PAGADA')
                        <span class="status-badge status-pagada">Pagada</span>
                    @elseif($row['status'] === 'ABONO PARCIAL')
                        <span class="status-badge status-parcial">Parcial</span>
                    @elseif($row['status'] === 'VENCIDA (EN MORA)')
                        <span class="status-badge status-mora">En Mora</span>
                    @else
                        <span class="status-badge status-pendiente">Pendiente</span>
                    @endif
                </td>
            </tr>
            @endforeach
        </tbody>
        <tfoot>
            <tr style="background-color: #e2e8f0; font-weight: bold; font-size: 9px;">
                <td colspan="2" class="text-center" style="padding: 5px; text-transform: uppercase;">
                    TOTALES CONTRATO
                </td>
                <td class="text-right" style="padding: 5px; color: #1e3a8a;">
                    ${{ number_format($total_price, 2) }}
                </td>
                <td class="text-right" style="padding: 5px; color: #166534;">
                    ${{ number_format($total_paid, 2) }}
                </td>
                <td class="text-right" style="padding: 5px; color: #b91c1c;">
                    ${{ number_format($debt_balance, 2) }}
                </td>
                <td class="text-center" style="padding: 5px; font-size: 8px;">
                    {{ $summary['paid_count'] }} / {{ $installments_count }}
                </td>
            </tr>
        </tfoot>
    </table>

    <!-- Tabla de Firmas -->
    <table class="signatures-table" width="100%" cellpadding="0" cellspacing="0">
        <tr>
            <td width="50%" align="center" style="text-align: center; vertical-align: bottom; padding: 0 35px;">
                <div style="height: 45px;"></div>
                <div class="signature-line">
                    {{ $customer->name ?? 'Cliente' }}<br>
                    <span style="font-size: 8px; font-weight: normal; color: #64748b;">
                        C.I: {{ $customer->id_card ?? 'N/A' }} &bull; Promitente Comprador
                    </span>
                </div>
            </td>
            <td width="50%" align="center" style="text-align: center; vertical-align: bottom; padding: 0 35px;">
                <div style="height: 45px;"></div>
                <div class="signature-line">
                    Vende &amp; más &bull; Administración<br>
                    <span style="font-size: 8px; font-weight: normal; color: #64748b;">
                        Sucúa - Morona Santiago, Ecuador
                    </span>
                </div>
            </td>
        </tr>
    </table>

    <!-- Nota al pie -->
    <table width="100%" cellpadding="4" cellspacing="0" style="margin-top: 18px; border-top: 1px dashed #cbd5e1;">
        <tr>
            <td align="center" style="text-align: center; font-size: 8px; color: #64748b;">
                Documento Oficial de Control Contable y Amortización &bull; Vende &amp; más ERP &bull; Lote ID #{{ $lot->id }}
            </td>
        </tr>
    </table>
</div>

</body>
</html>
