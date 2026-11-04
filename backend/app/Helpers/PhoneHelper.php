<?php

namespace App\Helpers;

class PhoneHelper
{
    /**
     * Convierte un número celular de Ecuador a formato internacional para WhatsApp (5939...).
     * Ejemplo: '0989996421' -> '593989996421'
     */
    public static function formatEcuadorWhatsApp(?string $phone, string $default = '593989996421'): string
    {
        if (empty($phone)) {
            return $default;
        }

        // Remover todo carácter no numérico
        $clean = preg_replace('/\D/', '', $phone);

        // Si empieza con 09 y tiene 10 dígitos (ej: 0989996421)
        if (str_starts_with($clean, '09') && strlen($clean) === 10) {
            return '593' . substr($clean, 1);
        }

        // Si empieza con 9 y tiene 9 dígitos (ej: 989996421)
        if (str_starts_with($clean, '9') && strlen($clean) === 9) {
            return '593' . $clean;
        }

        // Si ya tiene código 593 (ej: 593989996421)
        if (str_starts_with($clean, '593') && strlen($clean) === 12) {
            return $clean;
        }

        // Si tiene dígitos pero no estándar, retornar limpio o default
        return !empty($clean) ? $clean : $default;
    }
}
