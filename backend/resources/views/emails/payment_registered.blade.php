<!DOCTYPE html>
<html lang="es">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Comprobante Oficial de Pago - Vende & Más</title>
    <style>
        body {
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;
            background-color: #f8fafc;
            margin: 0;
            padding: 24px;
            color: #1e293b;
        }
        .container {
            max-width: 600px;
            margin: 0 auto;
            background: #ffffff;
            border-radius: 12px;
            overflow: hidden;
            box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.05), 0 2px 4px -2px rgba(0, 0, 0, 0.05);
            border: 1px solid #e2e8f0;
        }
        .header {
            background-color: #0f172a;
            padding: 28px 32px;
            text-align: center;
        }
        .header h1 {
            color: #ffffff;
            margin: 0;
            font-size: 20px;
            font-weight: 800;
            letter-spacing: -0.025em;
        }
        .header p {
            color: #38bdf8;
            margin: 4px 0 0 0;
            font-size: 13px;
            font-weight: 600;
        }
        .content {
            padding: 32px;
        }
        .receipt-badge {
            display: inline-block;
            padding: 6px 14px;
            border-radius: 6px;
            font-size: 14px;
            font-weight: 800;
            background-color: #f0fdf4;
            color: #15803d;
            border: 1px solid #bbf7d0;
            margin-bottom: 20px;
        }
        .amount-box {
            background: #f8fafc;
            border: 1px solid #e2e8f0;
            border-radius: 8px;
            padding: 20px;
            text-align: center;
            margin-bottom: 24px;
        }
        .amount-box .label {
            font-size: 12px;
            font-weight: 700;
            color: #64748b;
            text-transform: uppercase;
            letter-spacing: 0.05em;
        }
        .amount-box .value {
            font-size: 32px;
            font-weight: 900;
            color: #0f172a;
            margin-top: 4px;
        }
        .amount-box .method {
            font-size: 12px;
            font-weight: 600;
            color: #059669;
            margin-top: 4px;
        }
        .details-table {
            width: 100%;
            border-collapse: collapse;
            margin-bottom: 24px;
        }
        .details-table tr {
            border-bottom: 1px solid #f1f5f9;
        }
        .details-table td {
            padding: 9px 0;
            font-size: 13px;
        }
        .details-table td.label {
            color: #64748b;
            font-weight: 600;
            width: 38%;
        }
        .details-table td.value {
            color: #0f172a;
            font-weight: 700;
        }
        .attachment-note {
            background-color: #eff6ff;
            border: 1px solid #bfdbfe;
            border-radius: 8px;
            padding: 12px 16px;
            font-size: 12px;
            color: #1e40af;
            font-weight: 600;
            margin-top: 20px;
            display: flex;
            align-items: center;
        }
        .footer {
            background-color: #f8fafc;
            padding: 20px 32px;
            text-align: center;
            border-top: 1px solid #e2e8f0;
            font-size: 11px;
            color: #64748b;
        }
    </style>
</head>
<body>
    <div class="container">
        <div class="header">
            <h1>INMOBILIARIA VENDE & MÁS</h1>
            <p>Comprobante Oficial de Ingreso en Caja &bull; {{ $payment->receipt_book ?? 'GENERAL' }}</p>
        </div>
        <div class="content">
            <div style="display: flex; justify-content: space-between; align-items: center;">
                <span class="receipt-badge">RECIBO: {{ $payment->receipt_code }}</span>
            </div>

            <div class="amount-box">
                <div class="label">Monto Abonado</div>
                <div class="value">${{ number_format((float) $payment->amount_paid, 2) }} USD</div>
                <div class="method">
                    {{ $payment->payment_method ?? 'Efectivo en Caja' }}
                    @if(!empty($payment->bank_reference))
                        &bull; <b>(Ref: {{ $payment->bank_reference }})</b>
                    @endif
                </div>
            </div>

            <table class="details-table">
                <tr>
                    <td class="label">Método de Pago:</td>
                    <td class="value">
                        {{ $payment->payment_method ?? 'Efectivo en Caja' }}
                        @if(!empty($payment->bank_reference))
                            <span style="color: #0284c7; font-weight: bold; margin-left: 4px;">(Ref: {{ $payment->bank_reference }})</span>
                        @endif
                    </td>
                </tr>
                @if(!empty($payment->bank_reference))
                <tr>
                    <td class="label">N° Comprobante / Ref:</td>
                    <td class="value" style="color: #0369a1; font-family: monospace; font-weight: bold;">
                        {{ $payment->bank_reference }}
                    </td>
                </tr>
                @endif
                <tr>
                    <td class="label">Recibera / Área:</td>
                    <td class="value"><b>{{ $payment->receipt_book }}</b> (Serie N° {{ str_pad($payment->book_sequence ?? 1, 5, '0', STR_PAD_LEFT) }})</td>
                </tr>
                <tr>
                    <td class="label">Cliente Titular:</td>
                    <td class="value">{{ $customerName }}</td>
                </tr>
                @if($customerIdCard)
                <tr>
                    <td class="label">Cédula / RUC:</td>
                    <td class="value">{{ $customerIdCard }}</td>
                </tr>
                @endif
                <tr>
                    <td class="label">Proyecto / Inmueble:</td>
                    <td class="value">{{ $projectName }} @if($lotNumber)- {{ $lotNumber }}@endif</td>
                </tr>
                <tr>
                    <td class="label">Concepto Detallado:</td>
                    <td class="value">{{ $payment->concept_detail ?? 'Abono / Cuota inmobiliaria' }}</td>
                </tr>
                <tr>
                    <td class="label">Saldo Pendiente:</td>
                    <td class="value" style="color: {{ ((float)($payment->debt_balance ?? 0) > 0) ? '#b45309' : '#059669' }};">
                        ${{ number_format((float) ($payment->debt_balance ?? 0), 2) }} USD
                    </td>
                </tr>
                <tr>
                    <td class="label">Atendido por:</td>
                    <td class="value">{{ $payment->cashier->name ?? 'Cajero / Asesor Autorizado' }}</td>
                </tr>
                <tr>
                    <td class="label">Fecha y Hora:</td>
                    <td class="value">{{ $payment->created_at ? $payment->created_at->format('d/m/Y H:i:s') : now()->format('d/m/Y H:i:s') }}</td>
                </tr>
            </table>

            <div class="attachment-note">
                📎 <b>Archivo Adjunto:</b> Hemos adjuntado a este correo electrónico el documento oficial en formato PDF <b>Comprobante_{{ $payment->receipt_code }}.pdf</b> con las firmas digitales correspondientes.
            </div>
        </div>
        <div class="footer">
            Inmobiliaria Vende & Más &bull; Sistema Oficial de Cobranzas y Recibos<br>
            Sucúa, Morona Santiago, Ecuador &bull; Consultas y soporte WhatsApp: 0989996421
        </div>
    </div>
</body>
</html>
