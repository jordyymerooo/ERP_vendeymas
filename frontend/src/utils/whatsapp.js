export const DEFAULT_CEO_PHONE = '0989996421';

/**
 * Convierte cualquier número de celular ecuatoriano (09... de 10 dígitos)
 * automáticamente al formato internacional 5939... para los enlaces de WhatsApp (https://wa.me/593...).
 */
export function formatEcuadorWhatsApp(phone, defaultPhone = DEFAULT_CEO_PHONE) {
  const target = phone || defaultPhone || DEFAULT_CEO_PHONE;
  const clean = String(target).replace(/\D/g, '');

  // 0989996421 -> 593989996421
  if (clean.startsWith('09') && clean.length === 10) {
    return '593' + clean.slice(1);
  }
  // 989996421 -> 593989996421
  if (clean.startsWith('9') && clean.length === 9) {
    return '593' + clean;
  }
  // 593989996421 -> 593989996421
  if (clean.startsWith('593') && clean.length === 12) {
    return clean;
  }
  return clean || '593989996421';
}

/**
 * Genera el enlace oficial de WhatsApp listo para abrir con mensaje codificado
 */
export function buildWhatsAppLink(phone, message) {
  const formattedPhone = formatEcuadorWhatsApp(phone);
  const encodedText = encodeURIComponent(message);
  return `https://wa.me/${formattedPhone}?text=${encodedText}`;
}

/**
 * Abre la ventana de WhatsApp Web / App
 */
export function openWhatsApp(phone, message) {
  const url = buildWhatsAppLink(phone, message);
  window.open(url, '_blank', 'noopener,noreferrer');
}

/**
 * Genera el mensaje oficial de reporte al CEO al completar una tarea
 */
export function buildTaskCompletedWhatsAppMessage({
  taskTitle,
  projectName,
  priority,
  adminName,
  closedAt,
}) {
  const dateStr = closedAt || new Date().toLocaleString('es-EC', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });

  return `*REPORTE DE TAREA COMPLETADA - VENDE & MÁS*
Hola, le informo que se ha completado la siguiente tarea asignada:
• *Tarea:* ${taskTitle || 'Tarea Administrativa'}
• *Proyecto:* ${projectName || 'General / Sin Proyecto'}
• *Prioridad:* ${priority || 'Media'}
• *Ejecutada por:* ${adminName || 'Área Administrativa'}
• *Fecha y Hora de Cierre:* ${dateStr}`;
}

/**
 * Mensaje oficial para enviar el recibo al Cliente por WhatsApp
 */
export function buildPaymentCustomerWhatsAppMessage({
  receiptCode,
  receiptBook,
  customerName,
  projectName,
  lotNumber,
  concept,
  amountPaid,
  paymentMethod,
  bankReference,
  debtBalance,
  cashierName,
  dateTime,
}) {
  const itemLocation = lotNumber ? `${projectName || 'Proyecto'} - ${lotNumber}` : (projectName || 'Inmobiliaria Vende & Más');
  const dateStr = dateTime || new Date().toLocaleString('es-EC', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
  const bankRefLine = bankReference ? `\n• *N° Comprobante / Ref. Bancaria:* ${bankReference}` : '';

  return `*COMPROBANTE OFICIAL DE PAGO - VENDE & MÁS*
Estimado/a *${customerName || 'Cliente'}*, confirmamos el registro de su pago:
• *Comprobante N°:* ${receiptCode || 'REC-00001'}
• *Área / Recibera:* ${receiptBook || 'ADMINISTRACION'}
• *Proyecto / Lote:* ${itemLocation}
• *Concepto:* ${concept || 'Abono / Cuota inmobiliaria'}
• *Monto Abonado:* $${Number(amountPaid || 0).toFixed(2)} USD (${paymentMethod || 'Efectivo'})${bankRefLine}
• *Saldo Pendiente:* $${Number(debtBalance || 0).toFixed(2)} USD
• *Atendido por:* ${cashierName || 'Asesor Autorizado'}
• *Fecha:* ${dateStr}`;
}

/**
 * Mensaje oficial para reportar el ingreso al CEO por WhatsApp
 */
export function buildPaymentCeoWhatsAppMessage({
  receiptCode,
  receiptBook,
  customerName,
  projectName,
  lotNumber,
  concept,
  amountPaid,
  paymentMethod,
  bankReference,
  cashierName,
  dateTime,
}) {
  const itemLocation = lotNumber ? `${projectName || 'Proyecto'} - ${lotNumber}` : (projectName || 'General');
  const dateStr = dateTime || new Date().toLocaleString('es-EC', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
  const bankRefLine = bankReference ? `\n• *N° Comprobante / Ref. Bancaria:* ${bankReference}` : '';

  return `*NUEVO INGRESO REGISTRADO EN CAJA - VENDE & MÁS*
• *Recibo N°:* ${receiptCode || 'REC-00001'} (${receiptBook || 'GENERAL'})
• *Cliente:* ${customerName || 'Cliente'}
• *Proyecto / Lote:* ${itemLocation}
• *Monto Recaudado:* $${Number(amountPaid || 0).toFixed(2)} USD (${paymentMethod || 'Efectivo'})${bankRefLine}
• *Concepto:* ${concept || 'Ingreso en caja'}
• *Cobrado por:* ${cashierName || 'Asesor / Administrador'}
• *Fecha y Hora:* ${dateStr}`;
}
