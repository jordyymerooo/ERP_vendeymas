<!DOCTYPE html>
<html lang="es">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Tarea Completada - Vende & Más</title>
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
            color: #94a3b8;
            margin: 4px 0 0 0;
            font-size: 13px;
        }
        .content {
            padding: 32px;
        }
        .badge {
            display: inline-block;
            padding: 4px 12px;
            border-radius: 9999px;
            font-size: 12px;
            font-weight: 700;
            background-color: #ecfdf5;
            color: #065f46;
            border: 1px solid #a7f3d0;
            margin-bottom: 20px;
        }
        .priority-alta {
            background-color: #fef2f2;
            color: #991b1b;
            border-color: #fecaca;
        }
        .priority-media {
            background-color: #fffbeb;
            color: #92400e;
            border-color: #fde68a;
        }
        .priority-baja {
            background-color: #f1f5f9;
            color: #475569;
            border-color: #cbd5e1;
        }
        .card {
            background: #f8fafc;
            border: 1px solid #e2e8f0;
            border-left: 4px solid #10b981;
            border-radius: 8px;
            padding: 20px;
            margin-bottom: 24px;
        }
        .card h2 {
            margin: 0 0 8px 0;
            font-size: 16px;
            color: #0f172a;
            font-weight: 700;
        }
        .card p {
            margin: 0;
            font-size: 13px;
            color: #475569;
            line-height: 1.5;
        }
        .details-table {
            width: 100%;
            border-collapse: collapse;
            margin-top: 16px;
        }
        .details-table tr {
            border-bottom: 1px solid #f1f5f9;
        }
        .details-table td {
            padding: 10px 0;
            font-size: 13px;
        }
        .details-table td.label {
            color: #64748b;
            font-weight: 600;
            width: 40%;
        }
        .details-table td.value {
            color: #0f172a;
            font-weight: 700;
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
            <p>Sistema Integral de Gestión &bull; Notificación Oficial de Tareas</p>
        </div>
        <div class="content">
            <span class="badge">✓ TAREA FINALIZADA Y ARCHIVADA</span>

            <div class="card">
                <h2>{{ $task->title }}</h2>
                @if($task->description)
                    <p>{{ $task->description }}</p>
                @endif
            </div>

            <table class="details-table">
                <tr>
                    <td class="label">Proyecto Asignado:</td>
                    <td class="value">{{ $task->project->name ?? 'General / Sin Proyecto' }}</td>
                </tr>
                <tr>
                    <td class="label">Prioridad:</td>
                    <td class="value">
                        <span class="badge priority-{{ strtolower($task->priority ?? 'media') }}">
                            Prioridad {{ $task->priority ?? 'Media' }}
                        </span>
                    </td>
                </tr>
                <tr>
                    <td class="label">Completada por:</td>
                    <td class="value">{{ $adminWhoCompleted->name ?? $task->assignedTo->name ?? 'Administración' }}</td>
                </tr>
                <tr>
                    <td class="label">Fecha y Hora de Envío:</td>
                    <td class="value">{{ $task->created_at ? $task->created_at->format('d/m/Y H:i') : 'Reciente' }}</td>
                </tr>
                <tr>
                    <td class="label">Fecha y Hora de Cierre:</td>
                    <td class="value">{{ $task->completed_at ? \Carbon\Carbon::parse($task->completed_at)->format('d/m/Y H:i:s') : now()->format('d/m/Y H:i:s') }}</td>
                </tr>
                @if($task->due_date)
                <tr>
                    <td class="label">Fecha Límite Pactada:</td>
                    <td class="value">{{ \Carbon\Carbon::parse($task->due_date)->format('d/m/Y') }}</td>
                </tr>
                @endif
            </table>
        </div>
        <div class="footer">
            Este es un reporte automático generado por el Sistema Inmobiliario Vende & Más para el CEO / Gerencia General.<br>
            Sucúa, Morona Santiago, Ecuador &bull; Teléfono WhatsApp: 0989996421
        </div>
    </div>
</body>
</html>
