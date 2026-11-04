@php
    $logoPath = public_path('logos/logo-transparent.png');
    $logoBase64 = file_exists($logoPath) ? 'data:image/png;base64,' . base64_encode(file_get_contents($logoPath)) : '';
@endphp
<!DOCTYPE html>
<html lang="es">
<head>
    <meta charset="UTF-8">
    <title>Reporte de Cierre y Arqueo de Caja - Vende & Más</title>
    <style>
        body {
            font-family: Arial, Helvetica, sans-serif;
            font-size: 9.5px;
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
            color: #0f172a;
            font-size: 18px;
            font-weight: bold;
            margin: 0;
            letter-spacing: 0.5px;
        }
        .header-sub {
            font-size: 9px;
            color: #475569;
            margin-top: 3px;
            line-height: 1.3;
        }
        .badge-doc {
            font-size: 13px;
            font-weight: bold;
            color: #047857;
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
            font-size: 9px;
        }
        .info-label {
            font-weight: bold;
            color: #475569;
            width: 22%;
        }
        .info-val {
            color: #0f172a;
            font-weight: 600;
            width: 28%;
        }
        .kpi-table {
            width: 100%;
            margin-bottom: 12px;
            border-spacing: 6px;
            border-collapse: separate;
        }
        .kpi-box {
            padding: 8px;
            text-align: center;
            border: 1px solid #cbd5e1;
            background-color: #f8fafc;
        }
        .kpi-title {
            font-size: 8px;
            font-weight: bold;
            text-transform: uppercase;
            color: #64748b;
            margin-bottom: 4px;
        }
        .kpi-value {
            font-size: 14px;
            font-weight: bold;
            color: #0f172a;
        }
        .kpi-neto {
            background-color: #ecfdf5;
            border-color: #a7f3d0;
        }
        .kpi-neto .kpi-title {
            color: #047857;
        }
        .kpi-neto .kpi-value {
            color: #065f46;
        }
        .kpi-cash {
            background-color: #eff6ff;
            border-color: #bfdbfe;
        }
        .kpi-cash .kpi-title {
            color: #1d4ed8;
        }
        .kpi-cash .kpi-value {
            color: #1e40af;
        }
        .kpi-transfer {
            background-color: #f5f3ff;
            border-color: #ddd6fe;
        }
        .kpi-transfer .kpi-title {
            color: #6d28d9;
        }
        .kpi-transfer .kpi-value {
            color: #5b21b6;
        }
        .kpi-void {
            background-color: #fff1f2;
            border-color: #fecdd3;
        }
        .kpi-void .kpi-title {
            color: #be123c;
        }
        .kpi-void .kpi-value {
            color: #9f1239;
        }
        .report-table {
            width: 100%;
            border: 1px solid #cbd5e1;
            margin-top: 8px;
        }
        .report-table th {
            background-color: #0f172a;
            color: #ffffff;
            font-size: 8.5px;
            font-weight: bold;
            padding: 6px 5px;
            text-transform: uppercase;
            border: 1px solid #0f172a;
        }
        .report-table td {
            padding: 4px 6px;
            font-size: 8px;
            border: 1px solid #e2e8f0;
        }
        .row-even {
            background-color: #f8fafc;
        }
        .row-voided {
            background-color: #fff1f2;
            color: #9f1239;
        }
        .text-center {
            text-align: center;
        }
        .text-right {
            text-align: right;
        }
        .status-badge {
            display: inline-block;
            padding: 2px 5px;
            font-weight: bold;
            font-size: 7.5px;
            border-radius: 2px;
            text-transform: uppercase;
        }
        .status-valido {
            background-color: #dcfce7;
            color: #166534;
            border: 1px solid #86efac;
        }
        .status-anulado {
            background-color: #fee2e2;
            color: #991b1b;
            border: 1px solid #fca5a5;
        }
        .signature-table {
            width: 100%;
            margin-top: 36px;
            border: none;
        }
        .signature-cell {
            width: 48%;
            text-align: center;
            vertical-align: top;
            padding: 0 10px;
        }
        .sig-line {
            border-top: 1px solid #334155;
            width: 80%;
            margin: 0 auto 6px auto;
        }
        .sig-name {
            font-size: 9px;
            font-weight: bold;
            color: #0f172a;
        }
        .sig-title {
            font-size: 8px;
            color: #64748b;
            margin-top: 2px;
        }
        .footer-note {
            margin-top: 24px;
            padding-top: 8px;
            border-top: 1px dashed #cbd5e1;
            font-size: 7.5px;
            color: #64748b;
            text-align: center;
        }
    </style>
</head>
<body>
<div class="container">

    <!-- Encabezado Institucional con Logo Oficial -->
    <table style="margin-bottom: 10px;">
        <tr>
            <td style="width: 55%; vertical-align: middle;">
                @if(!empty($logoBase64))
                    <img src="{{ $logoBase64 }}" alt="Vende & más" style="height: 48px; width: auto; margin-bottom: 4px;">
                @else
                    <h1 class="header-title">VENDE & MÁS</h1>
                @endif
                <div class="header-sub">
                    <strong>Dirección:</strong> Domingo Comín S/N y Tres de Noviembre &bull; <strong>Celular:</strong> 0989996421<br>
                    <strong>Ubicación:</strong> Sucúa - Morona Santiago, Ecuador
                </div>
            </td>
            <td style="width: 45%; text-align: right; vertical-align: middle;">
                <div class="badge-doc">Reporte de Cierre y Arqueo de Caja</div>
                <div style="font-size: 8.5px; color: #475569; margin-top: 3px;">
                    <strong>Emisión:</strong> {{ $generated_at }}<br>
                    <strong>Usuario Responsable:</strong> {{ $cashier_name }}
                </div>
            </td>
        </tr>
    </table>

    <div style="border-top: 2px solid #0f172a; margin-bottom: 10px;"></div>

    <!-- Metadatos del Periodo y Filtros -->
    <div class="info-card">
        <table>
            <tr>
                <td class="info-label">Período Auditado:</td>
                <td class="info-val">{{ $period_label }}</td>
                <td class="info-label">Proyecto Filtrado:</td>
                <td class="info-val">{{ $project_filter }}</td>
            </tr>
            <tr>
                <td class="info-label">Método Filtrado:</td>
                <td class="info-val">{{ $method_filter }}</td>
                <td class="info-label">Total Comprobantes:</td>
                <td class="info-val">{{ $total_count }} ({{ $valid_count }} Válidos, {{ $voided_count }} Anulados)</td>
            </tr>
        </table>
    </div>

    <!-- Panel de Indicadores de Arqueo (KPIs) -->
    <table class="kpi-table">
        <tr>
            <td class="kpi-box kpi-neto" style="width: 25%;">
                <div class="kpi-title">Total Recaudado Neto</div>
                <div class="kpi-value">${{ number_format($summary['total_valid_amount'], 2) }}</div>
                <div style="font-size: 7.5px; color: #047857; margin-top: 2px;">{{ $valid_count }} Recibos Válidos</div>
            </td>
            <td class="kpi-box kpi-cash" style="width: 25%;">
                <div class="kpi-title">Efectivo en Caja</div>
                <div class="kpi-value">${{ number_format($summary['total_cash'], 2) }}</div>
                <div style="font-size: 7.5px; color: #1e40af; margin-top: 2px;">Físico a Entregar</div>
            </td>
            <td class="kpi-box kpi-transfer" style="width: 25%;">
                <div class="kpi-title">Transferencias / Bancos</div>
                <div class="kpi-value">${{ number_format($summary['total_transfer'], 2) }}</div>
                <div style="font-size: 7.5px; color: #5b21b6; margin-top: 2px;">Cuentas Bancarias</div>
            </td>
            <td class="kpi-box kpi-void" style="width: 25%;">
                <div class="kpi-title">Recibos Anulados</div>
                <div class="kpi-value">${{ number_format($summary['voided_amount'], 2) }}</div>
                <div style="font-size: 7.5px; color: #9f1239; margin-top: 2px;">{{ $voided_count }} Comprobantes Revertidos</div>
            </td>
        </tr>
    </table>

    <!-- Tabla Detallada de Recibos Emitidos en el Periodo -->
    <table class="report-table">
        <thead>
            <tr>
                <th style="width: 10%;">N° Recibo</th>
                <th style="width: 13%;">Fecha y Hora</th>
                <th style="width: 23%;">Cliente / Cédula</th>
                <th style="width: 20%;">Proyecto y Lote</th>
                <th style="width: 15%;">Método</th>
                <th style="width: 9%;">Estado</th>
                <th style="width: 10%; text-align: right;">Monto ($)</th>
            </tr>
        </thead>
        <tbody>
            @forelse($payments as $index => $p)
                @php
                    $isVoided = ($p->status === 'Anulado');
                    $rowClass = $isVoided ? 'row-voided' : ($index % 2 === 1 ? 'row-even' : '');
                @endphp
                <tr class="{{ $rowClass }}">
                    <td class="text-center font-mono">
                        <strong>{{ $p->receipt_code ?: ('REC-' . str_pad($p->id, 5, '0', STR_PAD_LEFT)) }}</strong>
                    </td>
                    <td class="text-center">
                        {{ $p->created_at ? $p->created_at->format('d/m/Y H:i') : 'N/A' }}
                    </td>
                    <td>
                        <strong>{{ $p->lot?->customer?->name ?? $p->deed?->customer?->name ?? $p->topographyJob?->client_name ?? 'Consumidor Final' }}</strong><br>
                        <span style="font-size: 7.5px; color: #64748b;">C.I.: {{ $p->lot?->customer?->id_card ?? $p->deed?->customer?->id_card ?? 'N/A' }}</span>
                    </td>
                    <td>
                        {{ $p->lot?->project?->name ?? $p->deed?->project?->name ?? ($p->topography_job_id ? 'Topografía' : 'Proyecto General') }}<br>
                        <span style="font-size: 7.5px; color: #64748b;">{{ $p->lot?->lot_number ?? ($p->deed_id ? "Escritura #{$p->deed_id}" : ($p->topography_job_id ? "Topografía #{$p->topography_job_id}" : 'Cobro General')) }}</span>
                    </td>
                    <td>
                        {{ $p->payment_method ?? 'N/A' }}
                    </td>
                    <td class="text-center">
                        @if($isVoided)
                            <span class="status-badge status-anulado">ANULADO</span>
                        @else
                            <span class="status-badge status-valido">VÁLIDO</span>
                        @endif
                    </td>
                    <td class="text-right">
                        @if($isVoided)
                            <span style="text-decoration: line-through;">${{ number_format((float)$p->amount_paid, 2) }}</span><br>
                            <span style="font-size: 7px; color: #be123c;">($0.00 neto)</span>
                        @else
                            <strong>${{ number_format((float)$p->amount_paid, 2) }}</strong>
                        @endif
                    </td>
                </tr>
            @empty
                <tr>
                    <td colspan="7" class="text-center" style="padding: 18px; color: #64748b;">
                        No se registraron comprobantes en el período seleccionado.
                    </td>
                </tr>
            @endforelse
        </tbody>
        <tfoot>
            <tr style="background-color: #f1f5f9; font-weight: bold; border-top: 2px solid #0f172a;">
                <td colspan="6" style="padding: 6px; text-align: right; text-transform: uppercase;">
                    Total Recaudación Neta Válida:
                </td>
                <td class="text-right" style="padding: 6px; color: #047857; font-size: 9.5px;">
                    ${{ number_format($summary['total_valid_amount'], 2) }}
                </td>
            </tr>
        </tfoot>
    </table>

    <!-- Bloque de Firmas de Entrega y Recepción de Caja -->
    <table class="signature-table">
        <tr>
            <td class="signature-cell">
                <div class="sig-line"></div>
                <div class="sig-name">{{ $cashier_name }}</div>
                <div class="sig-title">ENTREGA DE CAJA (Cajero / Responsable)</div>
                <div style="font-size: 7.5px; color: #94a3b8; margin-top: 2px;">C.I.: ___________________________</div>
            </td>
            <td style="width: 4%;"></td>
            <td class="signature-cell">
                <div class="sig-line"></div>
                <div class="sig-name">Administración y Contabilidad</div>
                <div class="sig-title">RECEPCIÓN DE CAJA (Auditoría / Gerencia)</div>
                <div style="font-size: 7.5px; color: #94a3b8; margin-top: 2px;">C.I.: ___________________________</div>
            </td>
        </tr>
    </table>

    <!-- Pie de Página -->
    <div class="footer-note">
        Este documento constituye el reporte oficial del arqueo y cierre de caja contable emitido por el sistema <strong>Vende & Más ERP</strong>.<br>
        Documento generado automáticamente el {{ $generated_at }}. Válido para conciliación bancaria y cuadre de caja física.
    </div>

</div>
</body>
</html>
