<?php
$file = __DIR__ . '/resources/views/receipt.blade.php';
$content = file_get_contents($file);

$old = '            <!-- Columna Izquierda (Firma del Cliente) -->' . "\r\n" .
'            <td width="50%" align="center" style="text-align: center; vertical-align: bottom; padding: 0 15px;">' . "\r\n" .
'                @if(!empty($payment->signature_base64) && str_starts_with($payment->signature_base64, \'data:image\') && !str_contains($payment->signature_base64, \'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII=\'))' . "\r\n" .
'                    <img src="{{ $payment->signature_base64 }}" style="max-height: 80px; max-width: 200px; object-fit: contain;" alt="Firma Cliente" />' . "\r\n" .
'                @else' . "\r\n" .
'                    <div style="height: 60px;"></div>' . "\r\n" .
'                @endif' . "\r\n" .
'                <hr style="width: 200px; border-top: 1px solid #000; margin: 5px auto 0 auto;">' . "\r\n" .
'                <p style="text-align: center; font-size: 11px; margin-top: 5px; margin-bottom: 0; line-height: 1.3;">' . "\r\n" .
'                    <strong style="color: #111111;">{{ $customerName }}</strong><br>' . "\r\n" .
'                    <span style="color: #555555;">Firma del Cliente / Solicitante</span>' . "\r\n" .
'                </p>' . "\r\n" .
'            </td>';

$new = '            <!-- Columna Izquierda (Firma Tactil del Cliente) -->' . "\r\n" .
'            <td width="50%" align="center" style="text-align: center; vertical-align: bottom; padding: 0 15px;">' . "\r\n" .
'                @php' . "\r\n" .
'                    $clientSigSrc = null;' . "\r\n" .
'                    if (!empty($payment->customer_signature) && str_starts_with($payment->customer_signature, \'data:image\')) {' . "\r\n" .
'                        $clientSigSrc = $payment->customer_signature;' . "\r\n" .
'                    } elseif (!empty($payment->signature_base64) && str_starts_with($payment->signature_base64, \'data:image\') && !str_contains($payment->signature_base64, \'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII=\')) {' . "\r\n" .
'                        $clientSigSrc = $payment->signature_base64;' . "\r\n" .
'                    }' . "\r\n" .
'                @endphp' . "\r\n" .
'                @if($clientSigSrc)' . "\r\n" .
'                    <img src="{{ $clientSigSrc }}" style="max-height: 80px; max-width: 200px; object-fit: contain;" alt="Firma Cliente" />' . "\r\n" .
'                @else' . "\r\n" .
'                    <div style="height: 60px;"></div>' . "\r\n" .
'                @endif' . "\r\n" .
'                <hr style="width: 200px; border-top: 1px solid #000; margin: 5px auto 0 auto;">' . "\r\n" .
'                <p style="text-align: center; font-size: 11px; margin-top: 5px; margin-bottom: 0; line-height: 1.3;">' . "\r\n" .
'                    <strong style="color: #111111;">{{ $customerName }}</strong><br>' . "\r\n" .
'                    <span style="color: #555555;">Firma del Cliente / Solicitante</span>' . "\r\n" .
'                </p>' . "\r\n" .
'            </td>';

if (strpos($content, $old) !== false) {
    $content = str_replace($old, $new, $content);
    file_put_contents($file, $content);
    echo "OK: receipt.blade.php actualizado con customer_signature.\n";
} else {
    // Try with \n
    $oldLf = str_replace("\r\n", "\n", $old);
    $contentLf = str_replace("\r\n", "\n", $content);
    if (strpos($contentLf, $oldLf) !== false) {
        $newLf = str_replace("\r\n", "\n", $new);
        $content = str_replace($oldLf, $newLf, $contentLf);
        file_put_contents($file, $content);
        echo "OK (LF): receipt.blade.php actualizado.\n";
    } else {
        echo "ERROR: fragmento no encontrado. Buscando posicion...\n";
        $pos = strpos($content, 'Firma del Cliente');
        echo "Posicion 'Firma del Cliente': " . ($pos !== false ? $pos : 'NO') . "\n";
    }
}

