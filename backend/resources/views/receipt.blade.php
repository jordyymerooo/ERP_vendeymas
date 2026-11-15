@php
    $logoPath = public_path('logos/logo-transparent.png');
    $logoBase64 = file_exists($logoPath) ? 'data:image/png;base64,' . base64_encode(file_get_contents($logoPath)) : '';

    $book = strtoupper($payment->receipt_book ?? '');
    $bookTitle = match($book) {
        'GERENCIA' => 'RECIBO DE GERENCIA GENERAL',
        'ADMINISTRACION' => 'RECIBO DE ÁREA ADMINISTRATIVA',
        'TOPOGRAFIA' => 'RECIBO DE TOPOGRAFÍA',
        'ASESORIA' => 'RECIBO COMERCIAL',
        default => 'RECIBO DE CAJA',
    };
    $officialReceiptCode = $payment->receipt_code ?: ('REC-' . str_pad($payment->id, 5, '0', STR_PAD_LEFT));
    $customerName = $payment->lot?->customer?->name ?? $payment->deed?->customer?->name ?? $payment->topographyJob?->client_name ?? 'Consumidor Final';

    $emitterRole = match($book) {
        'GERENCIA' => 'Gerencia General',
        'ADMINISTRACION' => 'Área Administrativa',
        'TOPOGRAFIA' => 'Área de Topografía',
        'ASESORIA' => 'Asesor Comercial',
        default => ($payment->cashier?->roles?->first()?->name ?? 'Asesor Comercial'),
    };

    $customerSignature = $payment->customer_signature ?: $payment->signature_base64;
    $signatureFooter = $emitterRole . ' &bull; Vende & más';
@endphp
<!DOCTYPE html>
<html lang="es">
<head>
    <meta charset="UTF-8">
    <title>{{ $bookTitle }}</title>
    <style>
        body {
            font-family: Arial, Helvetica, sans-serif;
            font-size: 12px;
            color: #111111;
            margin: 0;
            padding: 10px;
            background: #ffffff;
        }
        .recibo-card {
            border: 2px solid {{ ($payment->status ?? '') === 'Anulado' ? '#b91c1c' : '#1e3a8a' }};
            padding: 18px 22px;
            background-color: #ffffff;
        }
        table {
            border-collapse: collapse;
        }
        .dotted-line {
            border-bottom: 1px dotted #000000;
            padding-bottom: 3px;
            font-weight: bold;
        }
    </style>
</head>
<body>

<div class="recibo-card">
    <!-- Tabla Principal Encabezado con Logo Oficial -->
    <table width="100%" cellpadding="0" cellspacing="0" style="margin-bottom: 12px;">
        <tr>
            <td align="center" style="text-align: center;">
                @if(!empty($logoBase64))
                    <img src="{{ $logoBase64 }}" alt="Vende & más" style="height: 56px; width: auto; margin-bottom: 4px;">
                @else
                    <h1 style="color: #1e292b; font-family: sans-serif; font-size: 24px; margin: 0; letter-spacing: 1px;">VENDE & MÁS</h1>
                @endif
                <div style="font-size: 11px; color: #444444; margin-top: 3px; line-height: 1.4;">
                    Dirección: Domingo Comín S/N &bull; Celular: 0989996421 &bull; Sucúa - Morona Santiago
                </div>
            </td>
        </tr>
    </table>

    @if(($payment->status ?? '') === 'Anulado')
    <!-- SELLO DESTACADO EN ROJO DE COMPROBANTE ANULADO -->
    <table width="100%" cellpadding="8" cellspacing="0" style="margin-bottom: 14px; border: 2px dashed #b91c1c; background-color: #fef2f2;">
        <tr>
            <td align="center" style="text-align: center; color: #b91c1c;">
                <div style="font-size: 14px; font-weight: bold; letter-spacing: 1.5px; text-transform: uppercase;">
                    *** COMPROBANTE ANULADO - SIN VALIDEZ CONTABLE ***
                </div>
                <div style="font-size: 11px; margin-top: 4px; color: #991b1b; line-height: 1.4;">
                    <strong>Motivo de anulación:</strong> {{ $payment->void_reason ?? 'No especificado' }}<br>
                    @if($payment->voided_at)
                    <strong>Fecha de anulación:</strong> {{ \Carbon\Carbon::parse($payment->voided_at)->format('d/m/Y H:i') }}
                    @endif
                    @if($payment->voidedByUser)
                    &bull; <strong>Autorizado por:</strong> {{ $payment->voidedByUser->name }}
                    @endif
                </div>
            </td>
        </tr>
    </table>
    @endif

    <!-- Fila Título y Número de Recibo -->
    <table width="100%" cellpadding="4" cellspacing="0" style="margin-bottom: 14px; border-bottom: 2px solid {{ ($payment->status ?? '') === 'Anulado' ? '#b91c1c' : '#1e3a8a' }}; padding-bottom: 6px;">
        <tr>
            <td width="60%" align="left" style="font-size: 13px; font-weight: bold; color: {{ ($payment->status ?? '') === 'Anulado' ? '#b91c1c' : '#1e3a8a' }}; text-transform: uppercase;">
                {{ $bookTitle }} {{ ($payment->status ?? '') === 'Anulado' ? '(ANULADO)' : '' }}
            </td>
            <td width="40%" align="right" style="text-align: right; font-size: 16px; font-weight: bold; color: #dc2626; font-family: monospace;">
                N° {{ $officialReceiptCode }}
            </td>
        </tr>
    </table>

    <!-- Fila Monto y Fecha -->
    <table width="100%" cellpadding="4" cellspacing="0" style="margin-bottom: 16px;">
        <tr>
            <td width="50%" align="left" style="vertical-align: middle;">
                <table cellpadding="6" cellspacing="0" style="border: 2px solid {{ ($payment->status ?? '') === 'Anulado' ? '#b91c1c' : '#111111' }}; background-color: {{ ($payment->status ?? '') === 'Anulado' ? '#fef2f2' : '#f8fafc' }};">
                    <tr>
                        <td style="font-size: 15px; font-weight: bold; color: {{ ($payment->status ?? '') === 'Anulado' ? '#b91c1c' : '#111111' }}; {{ ($payment->status ?? '') === 'Anulado' ? 'text-decoration: line-through;' : '' }}">
                            Por $ {{ number_format($payment->amount_paid, 2) }}
                        </td>
                        @if(($payment->status ?? '') === 'Anulado')
                        <td style="font-size: 11px; font-weight: bold; color: #b91c1c; padding-left: 6px;">
                            [ANULADO]
                        </td>
                        @endif
                    </tr>
                </table>
            </td>
            <td width="50%" align="right" style="vertical-align: middle; text-align: right; font-size: 12px; font-weight: bold; color: #333333;">
                Fecha: {{ $payment->created_at ? $payment->created_at->format('d / m / Y') : date('d / m / Y') }}
            </td>
        </tr>
    </table>

    <!-- Líneas de Detalle con border-bottom dotted -->
    <table width="100%" cellpadding="6" cellspacing="0" style="margin-bottom: 24px;">
        <tr>
            <td width="15%" style="font-weight: bold; color: #111111; white-space: nowrap;">
                Recibo de:
            </td>
            <td width="85%" class="dotted-line">
                {{ $customerName }}
            </td>
        </tr>
        <tr>
            <td width="15%" style="font-weight: bold; color: #111111; white-space: nowrap; padding-top: 10px;">
                La cantidad de:
            </td>
            <td width="85%" class="dotted-line" style="padding-top: 10px;">
                {{ number_format($payment->amount_paid, 2) }} dólares
            </td>
        </tr>
        <tr>
            <td width="15%" style="font-weight: bold; color: #111111; white-space: nowrap; padding-top: 10px;">
                Por concepto de:
            </td>
            <td width="85%" class="dotted-line" style="padding-top: 10px;">
                @if(!empty($payment->concept_detail))
                    {{ $payment->concept_detail }}
                    @if($payment->lot)
                        &bull; {{ $payment->lot->project->name ?? '' }} - {{ $payment->lot->lot_number }}
                    @elseif($payment->deed)
                        &bull; Trámite Escritura: {{ $payment->deed->project->name ?? '' }} (Etapa: {{ $payment->deed->stage }})
                    @endif
                @elseif($payment->deed)
                    Abono a Trámite de Escrituración &bull; {{ $payment->deed->project->name ?? '' }} &bull; Etapa: {{ $payment->deed->stage }}
                @elseif($payment->topographyJob)
                    Abono a Levantamiento Topográfico &bull; {{ $payment->topographyJob->service_type }} ({{ $payment->topographyJob->location }})
                @elseif($payment->lot)
                    Abono a cuota, {{ $payment->lot->project->name ?? '' }} - {{ str_starts_with($payment->lot->lot_number ?? '', 'Lote') ? ($payment->lot->lot_number ?? '') : ('Lote ' . ($payment->lot->lot_number ?? '')) }}
                @else
                    Cobro Oficial de Cartera
                @endif
                @if(($payment->status ?? '') === 'Anulado')
                <span style="color: #b91c1c; font-weight: bold;"> [ANULADO: {{ $payment->void_reason }}]</span>
                @endif
            </td>
        </tr>
        <tr>
            <td width="15%" style="font-weight: bold; color: #111111; white-space: nowrap; padding-top: 10px;">
                Método de pago:
            </td>
            <td width="85%" class="dotted-line" style="padding-top: 10px;">
                <span style="font-weight: bold; color: #111111;">
                    {{ $payment->payment_method ?? 'Efectivo en Caja' }}@if(!empty($payment->bank_reference)) <span style="color: #1e3a8a; font-weight: bold; font-family: monospace;">(Ref: {{ $payment->bank_reference }})</span>@endif
                </span>
                @if(!empty($payment->bank_reference))
                    <div style="font-size: 11px; margin-top: 4px; color: #1e3a8a; font-family: monospace; font-weight: bold; background-color: #eff6ff; padding: 3px 6px; border: 1px dashed #bfdbfe; display: inline-block;">
                        N° DE COMPROBANTE / REF. BANCARIA: {{ $payment->bank_reference }}
                    </div>
                @endif
            </td>
        </tr>
    </table>

    <!-- Tabla de Firmas -->
    <table width="100%" cellpadding="0" cellspacing="0" style="margin-top: 25px;">
        <tr>
            <!-- Columna Izquierda (Firma del Cliente) -->
            <td width="50%" align="center" style="text-align: center; vertical-align: bottom; padding: 0 15px;">
                @if(!empty($customerSignature) && str_starts_with($customerSignature, 'data:image') && !str_contains($customerSignature, 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII='))
                    <img src="{{ $customerSignature }}" style="max-height: 80px; max-width: 200px; object-fit: contain;" alt="Firma Cliente" />
                @else
                    <div style="height: 60px;"></div>
                @endif
                <hr style="width: 200px; border-top: 1px solid #000; margin: 5px auto 0 auto;">
                <p style="text-align: center; font-size: 11px; margin-top: 5px; margin-bottom: 0; line-height: 1.3;">
                    <strong style="color: #111111;">{{ $customerName }}</strong><br>
                    <span style="color: #555555;">Firma del Cliente / Solicitante</span>
                </p>
            </td>

            <!-- Columna Derecha (Firma del Emisor - Asesor / Administrador / Topógrafo / Gerente) -->
            <td width="50%" align="center" style="text-align: center; vertical-align: bottom; padding: 0 15px;">
                @if(!empty($payment->cashier?->signature_base64) && str_starts_with($payment->cashier->signature_base64, 'data:image'))
                    <img src="{{ $payment->cashier->signature_base64 }}" style="max-height: 80px; max-width: 200px; object-fit: contain;" alt="Firma Emisor" />
                @else
                    <div style="height: 60px;"></div>
                @endif
                <hr style="width: 200px; border-top: 1px solid #000; margin: 5px auto 0 auto;">
                <p style="text-align: center; font-size: 11px; margin-top: 5px; margin-bottom: 0; line-height: 1.3;">
                    <strong style="color: #111111;">{{ $payment->cashier?->name ?? 'Emisor Autorizado' }}</strong><br>
                    <span style="color: #555555;">{{ $emitterRole }} &bull; Vende & más</span>
                </p>
            </td>
        </tr>
    </table>

    <!-- Pie del comprobante -->
    <table width="100%" cellpadding="4" cellspacing="0" style="margin-top: 25px; border-top: 1px dashed #cccccc;">
        <tr>
            <td align="center" style="text-align: center; font-size: 9px; color: {{ ($payment->status ?? '') === 'Anulado' ? '#b91c1c' : '#777777' }};">
                Comprobante {{ ($payment->status ?? '') === 'Anulado' ? 'ANULADO (SIN EFECTO CONTABLE)' : 'Oficial de Pago' }} &bull; {{ $officialReceiptCode }} &bull; Recibera: {{ $bookTitle }}
            </td>
        </tr>
    </table>
</div>

</body>
</html>
