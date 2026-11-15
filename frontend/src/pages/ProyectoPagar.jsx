import useSingleSubmit from '../hooks/useSingleSubmit';
import ActionButton from '../components/ActionButton';
import React, { useState, useRef, useEffect } from 'react';
import { useParams, useNavigate, useSearchParams, Link } from 'react-router-dom';
import axios from 'axios';
import SignaturePadField from '../components/SignaturePadField';
import EmitterSignaturePreview from '../components/EmitterSignaturePreview';
import { authenticatedApiUrl, receiptPdfUrl } from '../utils/receiptPdfUrl';
import {
  ArrowLeft,
  Receipt,
  CreditCard,
  DollarSign,
  User,
  MapPin,
  CheckCircle,
  Building2,
  Loader2,
  AlertTriangle,
  ShieldCheck,
  Download,
  ExternalLink,
  ChevronRight,
  FileCheck2,
  Calendar,
  Layers,
  Sparkles,
  FileSpreadsheet,
  MessageCircle,
} from 'lucide-react';
import AmortizationModal from '../components/AmortizationModal';
import {
  DEFAULT_CEO_PHONE,
  openWhatsApp,
  buildPaymentCustomerWhatsAppMessage,
  buildPaymentCeoWhatsAppMessage,
} from '../utils/whatsapp';

export default function ProyectoPagar() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();

  const queryLotId = searchParams.get('lot_id');
  const queryCustomerId = searchParams.get('customer_id');

  // Estados de carga e información general
  const [loading, setLoading] = useState(true);
  const [projectInfo, setProjectInfo] = useState(null);
  const [lots, setLots] = useState([]);
  const [customers, setCustomers] = useState([]);

  // Selección activa
  const [selectedLotId, setSelectedLotId] = useState(queryLotId || '');
  const [selectedCustomerId, setSelectedCustomerId] = useState(queryCustomerId || '');

  // Formulario de pago
  const [monto, setMonto] = useState('');
  const [metodoPago, setMetodoPago] = useState('Transferencia Bancaria');
  const [bankReference, setBankReference] = useState('');
  const [concepto, setConcepto] = useState('Abono correspondiente a cuota de terreno');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const isBankMethod = metodoPago === 'Transferencia Bancaria' || metodoPago === 'Depósito en Cuenta' || metodoPago === 'Depósito' || metodoPago?.toLowerCase().includes('transferencia') || metodoPago?.toLowerCase().includes('depósito') || metodoPago?.toLowerCase().includes('deposito');

  // Estado de éxito / Recibo emitido
  const [pagoExitoso, setPagoExitoso] = useState(null);
  // Modal para Cronograma de Pagos y Amortización
  const [amortizationModalOpen, setAmortizationModalOpen] = useState(false);

  const sigCanvasRef = useRef(null);

  // Cargar datos del proyecto, lotes y clientes
  const fetchData = async () => {
    setLoading(true);
    try {
      const [lotsRes, custRes] = await Promise.all([
        axios.get(`/api/projects/${id}/lots`),
        axios.get(`/api/projects/${id}/customers`),
      ]);

      const lotsData = lotsRes.data?.data || [];
      const projectData = lotsRes.data?.project || custRes.data?.project || null;
      const customersData = custRes.data?.data || [];

      setLots(lotsData);
      setProjectInfo(projectData);
      setCustomers(customersData);

      // Determinar selección inicial
      let targetLot = null;
      if (queryLotId) {
        targetLot = lotsData.find((l) => String(l.id) === String(queryLotId));
      }

      if (!targetLot && queryCustomerId) {
        targetLot = lotsData.find(
          (l) => l.customer && String(l.customer.id) === String(queryCustomerId)
        );
      }

      // Si no hay parámetro, elegir el primer lote vendido
      if (!targetLot) {
        targetLot = lotsData.find((l) => l.status === 'Vendido' && l.customer) || lotsData[0];
      }

      if (targetLot) {
        setSelectedLotId(String(targetLot.id));
        if (targetLot.customer) {
          setSelectedCustomerId(String(targetLot.customer.id));
        }

        // Sugerir monto inicial
        const cuotaSugerida = targetLot.installment_amount || 200;
        setMonto(String(cuotaSugerida));
      }
    } catch (err) {
      console.error('Error al cargar datos para el módulo de pagos:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, [id]);

  // Obtener lote y cliente seleccionados en vivo
  const currentLot = lots.find((l) => String(l.id) === String(selectedLotId));
  const currentCustomer =
    currentLot?.customer ||
    customers.find((c) => String(c.id) === String(selectedCustomerId)) ||
    (currentLot && customers.find((c) => c.lots?.some((l) => String(l.id) === String(currentLot.id))));

  // Calcular métricas financieras del lote seleccionado
  const lotTotalPrice = Number(currentLot?.total_price) || 0;
  const lotPayments = currentLot?.payments || [];
  const lotTotalPaid = lotPayments
    .filter((p) => (p.status || 'Válido') === 'Válido')
    .reduce((acc, p) => acc + (Number(p.amount_paid) || 0), 0);
  const lotRemainingDebt = Math.max(0, lotTotalPrice - lotTotalPaid);
  const installmentAmount = Number(currentLot?.installment_amount) || Math.round(lotTotalPrice / 12) || 200;

  // Actualizar monto sugerido si cambia de lote
  const handleLotChange = (newLotId) => {
    setSelectedLotId(newLotId);
    setPagoExitoso(null);
    const chosen = lots.find((l) => String(l.id) === String(newLotId));
    if (chosen) {
      if (chosen.customer) {
        setSelectedCustomerId(String(chosen.customer.id));
      }
      const sugerido = chosen.installment_amount || Math.min(200, chosen.total_price);
      setMonto(String(sugerido));
    }
  };

  // Limpiar pad de firma
  const handleClearSignature = () => {
    if (sigCanvasRef.current) {
      sigCanvasRef.current.clear();
    }
  };

  // Registrar pago y emitir recibo oficial
  const [handleProcesarPago, handleProcesarPagoPending] = useSingleSubmit(async (e) => {

    if (!selectedLotId) {
      alert('Por favor selecciona un lote para aplicar el pago.');
      return;
    }

    const numMonto = parseFloat(monto);
    if (isNaN(numMonto) || numMonto <= 0) {
      alert('Por favor ingresa un monto válido mayor a 0.');
      return;
    }

    if (isBankMethod && (!bankReference || bankReference.trim().length < 3)) {
      alert('Debe ingresar el número de comprobante o referencia bancaria (mínimo 3 caracteres).');
      return;
    }

    let firmaBase64 = null;
    if (sigCanvasRef.current && !sigCanvasRef.current.isEmpty()) {
      firmaBase64 = sigCanvasRef.current.toDataURL('image/png');
    }

    setIsSubmitting(true);
    try {
      const res = await axios.post('/api/payments', {
        lot_id: parseInt(selectedLotId, 10),
        amount_paid: numMonto,
        payment_method: metodoPago,
        bank_reference: isBankMethod ? bankReference.trim() : null,
        customer_signature: firmaBase64,
      });

      const paymentData = res.data?.data || res.data?.payment;
      const receiptUrl = res.data?.receipt_url;
      const receiptCode = paymentData?.receipt_code || ('ASE-' + String(paymentData?.id || '').padStart(5, '0'));
      const receiptBook = paymentData?.receipt_book || 'ASESORIA';

      let currentUserName = 'Asesor Autorizado';
      try {
        const u = JSON.parse(localStorage.getItem('user'));
        if (u?.name) currentUserName = u.name;
      } catch (e) {}

      setPagoExitoso({
        paymentId: paymentData?.id,
        receiptCode: receiptCode,
        receiptBook: receiptBook,
        receiptNumber: receiptCode,
        amountPaid: numMonto,
        paymentMethod: metodoPago,
        bankReference: paymentData?.bank_reference || (isBankMethod ? bankReference.trim() : null),
        concept: concepto || 'Abono correspondiente a cuota de terreno',
        newDebtBalance: paymentData?.debt_balance ?? Math.max(0, lotRemainingDebt - numMonto),
        customerName: currentCustomer?.name || currentCustomer?.nombre || 'Cliente Comprador',
        customerPhone: currentCustomer?.phone || currentCustomer?.telefono || '',
        projectName: projectName,
        lotNumber: currentLot?.lot_number || 'Lote',
        cashierName: currentUserName,
        dateTime: new Date().toLocaleString('es-EC', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' }),
        receiptUrl: receiptPdfUrl(receiptUrl || `/api/payments/${paymentData?.id}/pdf`),
      });

      setBankReference('');
      handleClearSignature();
      window.dispatchEvent(new Event('notifications-updated'));
      window.dispatchEvent(new Event('paymentUpdated'));

      // Recargar datos actualizados
      await fetchData();
    } catch (err) {
      if (err?.isDuplicateBlocked) return;
      console.error('Error al procesar el pago en el backend:', err);
      const msg = err.response?.data?.message || 'Error al registrar el pago.';
      alert(msg);
    } finally {
      setIsSubmitting(false);
    }
  }, { form: true });

  const projectName = projectInfo?.name || projectInfo?.nombre || id?.replace(/-/g, ' ').toUpperCase();

  return (
    <div className="space-y-6 animate-fade-in w-full pb-8">
      {/* ================= CABECERA DE LA VISTA DEDICADA ================= */}
      <div className="bg-white rounded-lg border border-slate-200 p-5 shadow-xs flex flex-col lg:flex-row lg:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={() => navigate(`/proyectos/${id}/lotes`)}
            className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-bold text-slate-600 hover:text-slate-900 hover:bg-slate-100 rounded-xl transition cursor-pointer"
          >
            <ArrowLeft className="w-4 h-4" />
            <span>Volver a Lotes</span>
          </button>
          <div className="h-6 w-px bg-slate-200 hidden sm:block" />
          <div>
            <div className="flex items-center gap-2">
              <span className="text-xs font-bold text-cyan-600 uppercase tracking-wider">
                {projectName}
              </span>
              <span className="text-slate-300">•</span>
              <span className="text-xs font-semibold text-slate-500">Módulo de Caja Oficial</span>
            </div>
            <h1 className="text-xl sm:text-2xl font-extrabold text-slate-900 flex items-center gap-2">
              <Receipt className="w-6 h-6 text-cyan-600" />
              <span>Registrar Pago y Emitir Recibo</span>
            </h1>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <Link
            to={`/proyectos/${id}/clientes`}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-bold text-cyan-700 bg-cyan-50 hover:bg-cyan-100 rounded-xl border border-cyan-200/70 transition"
          >
            <User className="w-3.5 h-3.5" />
            <span>Ver Clientes y Contratos</span>
          </Link>
          <Link
            to="/recibos"
            className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-bold text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-xl transition"
          >
            <Layers className="w-3.5 h-3.5" />
            <span>Auditoría de Recibos</span>
          </Link>
        </div>
      </div>

      {/* ================= MODAL / BANNER DE CONFIRMACIÓN DE PAGO ================= */}
      {pagoExitoso && (
        <div className="bg-gradient-to-r from-emerald-50 via-teal-50 to-emerald-100/60 border border-emerald-300 rounded-lg p-6 shadow-xs animate-fade-in">
          <div className="flex flex-col items-start gap-5">
            <div className="flex items-start gap-4">
              <div className="w-10 h-10 rounded-lg bg-emerald-600 text-white flex items-center justify-center shrink-0 shadow-xs">
                <CheckCircle className="w-6 h-6" />
              </div>
              <div>
                <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-md text-xs font-semibold bg-emerald-100 text-emerald-900 border border-emerald-200 mb-1">
                  <Sparkles className="w-3 h-3 text-emerald-700" />
                  <span>¡Transacción Registrada con Éxito!</span>
                </div>
                <h3 className="text-lg font-bold text-slate-900">
                  Recibo Oficial Emitido: {pagoExitoso.receiptNumber}
                </h3>
                <p className="text-xs sm:text-sm text-slate-700 mt-1">
                  Se abonaron <strong className="text-emerald-800 font-bold">${Number(pagoExitoso.amountPaid).toLocaleString('en-US', { minimumFractionDigits: 2 })} USD</strong> ({pagoExitoso.paymentMethod}) al lote <strong className="text-slate-900">{pagoExitoso.lotNumber}</strong> de <strong className="text-slate-900">{pagoExitoso.customerName}</strong>.
                  {pagoExitoso.bankReference && (
                    <span className="block mt-1 font-mono font-bold text-emerald-950 text-xs bg-emerald-200/60 px-2 py-0.5 rounded border border-emerald-300 w-fit">
                      N° Comprobante / Ref. Bancaria: {pagoExitoso.bankReference}
                    </span>
                  )}
                  Nuevo saldo deudor restante: <strong className="text-rose-700 font-bold">${Number(pagoExitoso.newDebtBalance).toLocaleString('en-US', { minimumFractionDigits: 2 })} USD</strong>.
                </p>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:flex lg:flex-wrap gap-3 w-full">
              {/* Botón 1: Enviar Recibo al Cliente (WhatsApp) */}
              <button
                type="button"
                onClick={() => {
                  const msg = buildPaymentCustomerWhatsAppMessage({
                    receiptCode: pagoExitoso.receiptCode,
                    receiptBook: pagoExitoso.receiptBook,
                    customerName: pagoExitoso.customerName,
                    projectName: pagoExitoso.projectName,
                    lotNumber: pagoExitoso.lotNumber,
                    concept: pagoExitoso.concept,
                    amountPaid: pagoExitoso.amountPaid,
                    paymentMethod: pagoExitoso.paymentMethod,
                    bankReference: pagoExitoso.bankReference,
                    debtBalance: pagoExitoso.newDebtBalance,
                    cashierName: pagoExitoso.cashierName,
                    dateTime: pagoExitoso.dateTime,
                  });
                  openWhatsApp(pagoExitoso.customerPhone, msg);
                }}
                className="w-full lg:w-auto min-h-[46px] inline-flex items-center justify-center gap-1.5 px-3.5 py-2.5 rounded-md font-bold text-white bg-emerald-600 hover:bg-emerald-700 transition text-xs sm:text-sm cursor-pointer shadow-xs"
                title="Enviar comprobante oficial al WhatsApp del cliente"
              >
                <MessageCircle className="w-4 h-4" />
                <span>📲 Enviar Recibo al Cliente (WhatsApp)</span>
              </button>

              {/* Botón 2: Reportar Cobro al CEO (WhatsApp) */}
              <button
                type="button"
                onClick={() => {
                  const msg = buildPaymentCeoWhatsAppMessage({
                    receiptCode: pagoExitoso.receiptCode,
                    receiptBook: pagoExitoso.receiptBook,
                    customerName: pagoExitoso.customerName,
                    projectName: pagoExitoso.projectName,
                    lotNumber: pagoExitoso.lotNumber,
                    concept: pagoExitoso.concept,
                    amountPaid: pagoExitoso.amountPaid,
                    paymentMethod: pagoExitoso.paymentMethod,
                    bankReference: pagoExitoso.bankReference,
                    cashierName: pagoExitoso.cashierName,
                    dateTime: pagoExitoso.dateTime,
                  });
                  openWhatsApp(DEFAULT_CEO_PHONE, msg);
                }}
                className="w-full lg:w-auto min-h-[46px] inline-flex items-center justify-center gap-1.5 px-3.5 py-2.5 rounded-md font-bold text-emerald-900 bg-emerald-100 hover:bg-emerald-200 border border-emerald-300 transition text-xs sm:text-sm cursor-pointer shadow-xs"
                title="Notificar este ingreso de caja al WhatsApp del CEO"
              >
                <MessageCircle className="w-4 h-4 text-emerald-700" />
                <span>📲 Reportar Cobro al CEO (WhatsApp)</span>
              </button>

              {/* Botón PDF */}
              <a
                href={pagoExitoso.receiptUrl}
                target="_blank"
                rel="noreferrer"
                className="w-full lg:w-auto min-h-[46px] inline-flex items-center justify-center gap-1.5 px-3 py-2.5 rounded-md font-medium text-white bg-slate-900 hover:bg-slate-800 transition text-xs sm:text-sm cursor-pointer shadow-xs"
              >
                <Download className="w-4 h-4" />
                <span>Abrir Recibo (PDF)</span>
                <ExternalLink className="w-3.5 h-3.5 opacity-80" />
              </a>

              <button
                type="button"
                onClick={() => setPagoExitoso(null)}
                className="w-full lg:w-auto min-h-[46px] px-3 py-2.5 rounded-md text-xs sm:text-sm font-medium text-slate-600 hover:text-slate-900 transition cursor-pointer"
              >
                Nuevo Cobro
              </button>
            </div>
          </div>
        </div>
      )}

      {loading ? (
        <div className="py-28 flex flex-col items-center justify-center gap-3 bg-white rounded-lg border border-slate-200 text-slate-400">
          <Loader2 className="w-7 h-7 animate-spin text-slate-600" />
          <p className="text-sm font-medium text-slate-600">Cargando datos de cobro y clientes...</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
          {/* ================= COLUMNA IZQUIERDA: RESUMEN DEL LOTE Y CLIENTE ================= */}
          <div className="lg:col-span-5 space-y-5">
            {/* Tarjeta de Selección de Lote */}
            <div className="bg-white rounded-lg border border-slate-200 p-5 shadow-xs space-y-4">
              <div>
                <label htmlFor="proyecto-pago-lot" className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-2">
                  Seleccionar Lote a Cobrar
                </label>
                <select id="proyecto-pago-lot" name="proyecto_pago_lot"
                  value={selectedLotId}
                  onChange={(e) => handleLotChange(e.target.value)}
                  className="w-full px-3.5 py-3 rounded-xl border border-slate-200 bg-slate-50 focus:bg-white text-sm font-bold text-slate-900 focus:outline-none focus:ring-2 focus:ring-cyan-500 transition cursor-pointer shadow-sm"
                >
                  {lots.length === 0 && (
                    <option value="">No hay lotes en este proyecto</option>
                  )}
                  {lots.map((lote) => {
                    const isSold = lote.status === 'Vendido' && lote.customer;
                    return (
                      <option key={lote.id} value={lote.id}>
                        {lote.lot_number} — {isSold ? `Comprador: ${lote.customer.name}` : '(Disponible)'} — ${Number(lote.total_price).toLocaleString()} USD
                      </option>
                    );
                  })}
                </select>
              </div>

              {/* Información del Lote Actual */}
              {currentLot && (
                <div className="p-4 rounded-md bg-slate-50 border border-slate-200 space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
                      Detalle del Terreno
                    </span>
                    <span
                      className={`px-2 py-0.5 rounded-md text-[10px] font-semibold uppercase ${
                        currentLot.status === 'Vendido'
                          ? 'bg-rose-50 text-rose-800 border border-rose-200'
                          : 'bg-emerald-50 text-emerald-800 border border-emerald-200'
                      }`}
                    >
                      {currentLot.status}
                    </span>
                  </div>

                  <div className="grid grid-cols-2 gap-3 text-xs">
                    <div>
                      <span className="text-slate-400 block text-[11px]">Identificador:</span>
                      <strong className="text-slate-900 font-bold text-sm">
                        {currentLot.lot_number}
                      </strong>
                    </div>
                    <div>
                      <span className="text-slate-400 block text-[11px]">Superficie:</span>
                      <strong className="text-slate-900 font-bold text-sm">
                        {Number(currentLot.area_m2)} m²
                      </strong>
                    </div>
                  </div>

                  <div className="pt-2 border-t border-slate-200/80 flex items-center justify-between">
                    <span className="text-xs font-semibold text-slate-500">Valor Total Pactado:</span>
                    <span className="text-base font-extrabold text-slate-900">
                      ${lotTotalPrice.toLocaleString()} USD
                    </span>
                  </div>
                </div>
              )}
            </div>

            {/* Tarjeta del Comprador y Estado Financiero */}
            <div className="bg-white rounded-lg border border-slate-200 p-5 shadow-xs space-y-4">
              <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                <div className="flex items-center gap-2">
                  <div className="w-8 h-8 rounded-lg bg-cyan-50 flex items-center justify-center text-cyan-600">
                    <User className="w-4 h-4" />
                  </div>
                  <div>
                    <h3 className="text-sm font-bold text-slate-900">Titular del Lote</h3>
                    <p className="text-[11px] text-slate-400">Datos para la emisión del recibo</p>
                  </div>
                </div>

                {currentCustomer?.moraStatus === 'EN MORA' ? (
                  <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-[10px] font-black bg-rose-100 text-rose-800 border border-rose-200">
                    <AlertTriangle className="w-3 h-3 text-rose-600" />
                    <span>EN MORA</span>
                  </span>
                ) : (
                  <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-[10px] font-black bg-emerald-100 text-emerald-800 border border-emerald-200">
                    <ShieldCheck className="w-3 h-3 text-emerald-600" />
                    <span>AL DÍA</span>
                  </span>
                )}
              </div>

              {currentCustomer ? (
                <div className="space-y-3">
                  <div>
                    <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block">
                      Nombre Completo
                    </span>
                    <p className="text-sm font-extrabold text-slate-900">
                      {currentCustomer.name || currentCustomer.nombre}
                    </p>
                  </div>

                  <div className="grid grid-cols-2 gap-3 text-xs">
                    <div>
                      <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block">
                        Cédula / RUC
                      </span>
                      <p className="font-mono font-bold text-slate-800">
                        {currentCustomer.id_card || currentCustomer.documento || 'N/A'}
                      </p>
                    </div>
                    <div>
                      <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block">
                        Celular
                      </span>
                      <p className="font-semibold text-slate-800">
                        {currentCustomer.phone || currentCustomer.telefono || 'N/A'}
                      </p>
                    </div>
                  </div>
                </div>
              ) : (
                <div className="p-4 bg-amber-50 rounded-xl border border-amber-200 text-xs text-amber-800">
                  Este lote aún no tiene un comprador registrado. Puedes asignarle uno desde la pestaña de lotes.
                </div>
              )}

              {/* Desglose de Saldos */}
              <div className="grid grid-cols-2 gap-3 pt-3 border-t border-slate-100">
                <div className="bg-emerald-50/70 p-3 rounded-xl border border-emerald-100">
                  <span className="text-[10px] font-bold text-emerald-700 uppercase tracking-wider block mb-0.5">
                    Saldo Pagado
                  </span>
                  <span className="text-base font-black text-emerald-900">
                    ${lotTotalPaid.toLocaleString('en-US', { minimumFractionDigits: 2 })}
                  </span>
                </div>

                <div className="bg-rose-50/70 p-3 rounded-xl border border-rose-100">
                  <span className="text-[10px] font-bold text-rose-700 uppercase tracking-wider block mb-0.5">
                    Saldo Deudor Restante
                  </span>
                  <span className="text-base font-black text-rose-900">
                    ${lotRemainingDebt.toLocaleString('en-US', { minimumFractionDigits: 2 })}
                  </span>
                </div>
              </div>

              {/* Botón Cronograma de Cuotas (PDF) */}
              <div className="mt-3 flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setAmortizationModalOpen(true)}
                  disabled={!currentLot?.id}
                  className="flex-1 inline-flex items-center justify-center gap-2 px-3 py-2.5 rounded-lg text-xs font-bold text-indigo-700 bg-indigo-50 hover:bg-indigo-100 border border-indigo-200 transition shadow-2xs cursor-pointer disabled:opacity-50"
                  title="Ver cronograma detallado de cuotas en pantalla"
                >
                  <FileSpreadsheet className="w-4 h-4 text-indigo-600" />
                  <span>Cronograma de Cuotas</span>
                </button>
                {currentLot?.id && (
                  <a
                    href={authenticatedApiUrl(`/api/lots/${currentLot.id}/amortization-pdf`)}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex items-center justify-center gap-1.5 px-3 py-2.5 rounded-lg text-xs font-bold text-white bg-indigo-600 hover:bg-indigo-700 transition shadow-2xs cursor-pointer shrink-0"
                    title="Abrir Cronograma en PDF en nueva pestaña"
                  >
                    <span>PDF</span>
                    <ExternalLink className="w-3.5 h-3.5" />
                  </a>
                )}
              </div>
            </div>

            {/* Historial de Comprobantes Previos de este Lote */}
            {lotPayments.length > 0 && (
              <div className="bg-white rounded-lg border border-slate-200 p-5 shadow-xs space-y-3">
                <span className="text-xs font-bold text-slate-700 uppercase tracking-wider block">
                  Comprobantes Emitidos ({lotPayments.length})
                </span>
                <div className="space-y-2 max-h-52 overflow-y-auto pr-1">
                  {lotPayments.map((p) => {
                    const isVoided = p.status === 'Anulado';

                    return (
                      <div
                        key={p.id}
                        className={`p-2.5 rounded-xl border flex items-center justify-between text-xs transition ${
                          isVoided
                            ? 'bg-rose-50/40 border-rose-200'
                            : 'border-slate-200/70 bg-slate-50'
                        }`}
                      >
                        <div>
                          <div className="flex items-center gap-1.5 flex-wrap">
                            <span
                              className={`font-mono font-bold ${
                                isVoided ? 'text-rose-800' : 'text-cyan-800'
                              }`}
                            >
                              N° {String(p.id).padStart(7, '0')}
                            </span>
                            {isVoided ? (
                              <span className="px-1.5 py-0.2 rounded-full text-[10px] font-bold bg-rose-100 text-rose-800 border border-rose-200">
                                Anulado
                              </span>
                            ) : (
                              <span className="px-1.5 py-0.2 rounded-full text-[10px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
                                Válido
                              </span>
                            )}
                          </div>
                          <p className="text-[10px] text-slate-400 mt-0.5">
                            {p.created_at ? new Date(p.created_at).toLocaleDateString() : 'Reciente'} • {p.payment_method}
                          </p>
                          {isVoided && p.void_reason && (
                            <p className="text-[10px] text-rose-600 mt-0.5 truncate max-w-[180px]" title={p.void_reason}>
                              Motivo: {p.void_reason}
                            </p>
                          )}
                        </div>
                        <div className="flex items-center gap-2">
                          <span
                            className={`font-extrabold ${
                              isVoided ? 'text-rose-500 line-through' : 'text-slate-900'
                            }`}
                          >
                            ${Number(p.amount_paid).toLocaleString('en-US', { minimumFractionDigits: 2 })}
                          </span>
                          <a
                            href={receiptPdfUrl(`/api/payments/${p.id}/pdf`)}
                            target="_blank"
                            rel="noreferrer"
                            className="p-1.5 rounded-lg text-cyan-700 hover:bg-cyan-100 transition"
                            title="Descargar Recibo PDF"
                          >
                            <Download className="w-3.5 h-3.5" />
                          </a>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </div>

          {/* ================= COLUMNA DERECHA: TERMINAL DE COBRO Y FIRMA DIGITAL ================= */}
          <div className="lg:col-span-7">
            <div className="bg-white rounded-lg border border-slate-200 p-6 shadow-xs space-y-6">
              <div className="flex items-center justify-between border-b border-slate-100 pb-4">
                <div>
                  <h2 className="text-lg font-bold text-slate-900 flex items-center gap-2">
                    <CreditCard className="w-5 h-5 text-slate-700" />
                    <span>Datos de la Transacción</span>
                  </h2>
                  <p className="text-xs text-slate-500 mt-0.5">
                    El recibo se generará inmediatamente con el diseño oficial de Vende & más.
                  </p>
                </div>
                <div className="text-right">
                  <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest block">
                    Moneda Oficial
                  </span>
                  <span className="text-xs font-extrabold text-slate-700">Dólares (USD)</span>
                </div>
              </div>

              <form onSubmit={handleProcesarPago} className="space-y-5">
                {/* Monto a Cobrar con Chips Rápidos */}
                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-2">
                    Monto a Abonar ($ USD) *
                  </label>
                  <div className="relative">
                    <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none text-slate-400 font-extrabold text-lg">
                      $
                    </div>
                    <input id="proyecto-pago-amount" name="proyecto_pago_amount"
                      type="number"
                      step="any"
                      min="0.01"
                      required
                      value={monto}
                      onChange={(e) => setMonto(e.target.value)}
                      placeholder="0.00"
                      className="w-full pl-9 pr-4 py-3.5 rounded-xl border border-slate-200 bg-slate-50 focus:bg-white text-xl font-black text-slate-900 focus:outline-none focus:ring-2 focus:ring-cyan-500 focus:border-transparent transition shadow-inner"
                    />
                  </div>

                  {/* Botones de Selección Rápida */}
                  <div className="flex items-center gap-2 mt-2.5 flex-wrap">
                    <span className="text-[11px] font-bold text-slate-400">Sugerencias:</span>
                    <button
                      type="button"
                      onClick={() => setMonto(String(installmentAmount))}
                      className="px-2.5 py-1 rounded-lg text-xs font-bold bg-cyan-50 text-cyan-800 border border-cyan-200 hover:bg-cyan-100 transition cursor-pointer"
                    >
                      Cuota Mensual (${installmentAmount.toLocaleString()})
                    </button>
                    <button
                      type="button"
                      onClick={() => setMonto('200')}
                      className="px-2.5 py-1 rounded-lg text-xs font-bold bg-slate-100 text-slate-700 border border-slate-200 hover:bg-slate-200 transition cursor-pointer"
                    >
                      $200.00
                    </button>
                    <button
                      type="button"
                      onClick={() => setMonto('500')}
                      className="px-2.5 py-1 rounded-lg text-xs font-bold bg-slate-100 text-slate-700 border border-slate-200 hover:bg-slate-200 transition cursor-pointer"
                    >
                      $500.00
                    </button>
                    {lotRemainingDebt > 0 && (
                      <button
                        type="button"
                        onClick={() => setMonto(String(lotRemainingDebt))}
                        className="px-2.5 py-1 rounded-lg text-xs font-bold bg-emerald-50 text-emerald-800 border border-emerald-200 hover:bg-emerald-100 transition cursor-pointer"
                      >
                        Total Deudor (${lotRemainingDebt.toLocaleString()})
                      </button>
                    )}
                  </div>
                </div>

                {/* Forma de Pago */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label htmlFor="proyecto-pago-payment-method" className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-2">
                      Forma de Pago *
                    </label>
                    <select id="proyecto-pago-payment-method" name="proyecto_pago_payment_method"
                      value={metodoPago}
                      onChange={(e) => setMetodoPago(e.target.value)}
                      className="w-full px-3.5 py-3 rounded-xl border border-slate-200 bg-slate-50 focus:bg-white text-sm font-semibold text-slate-900 focus:outline-none focus:ring-2 focus:ring-cyan-500 transition cursor-pointer"
                    >
                      <option value="Transferencia Bancaria">Transferencia Bancaria</option>
                      <option value="Efectivo en Caja">Efectivo en Caja</option>
                      <option value="Depósito en Cuenta">Depósito en Cuenta</option>
                      <option value="Cheque Certificado">Cheque Certificado</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-2">
                      Fecha de Emisión
                    </label>
                    <div className="flex items-center gap-2 px-3.5 py-3 rounded-xl border border-slate-200 bg-slate-100 text-sm font-semibold text-slate-600">
                      <Calendar className="w-4 h-4 text-slate-400" />
                      <span>{new Date().toLocaleDateString('es-EC', { day: '2-digit', month: '2-digit', year: 'numeric' })} (Hoy)</span>
                    </div>
                  </div>
                </div>

                {/* N° de Referencia Bancaria (Obligatorio para Transferencia / Depósito) */}
                {isBankMethod && (
                  <div className="p-3.5 bg-amber-50/70 border border-amber-300 rounded-xl space-y-1 animate-fade-in">
                    <label className="block text-xs font-bold text-amber-950 uppercase tracking-wider">
                      N° de Comprobante / Referencia Bancaria <span className="text-rose-600">*</span>
                    </label>
                    <input id="proyecto-pago-bank-reference" name="proyecto_pago_bank_reference"
                      type="text"
                      required
                      value={bankReference}
                      onChange={(e) => setBankReference(e.target.value)}
                      placeholder="Ej. Comp. 0048291"
                      className="w-full px-3.5 py-2.5 rounded-lg border border-amber-300 bg-white text-sm font-bold text-slate-900 focus:outline-none focus:ring-2 focus:ring-amber-500 shadow-inner"
                    />
                    {(!bankReference || !bankReference.trim()) ? (
                      <p className="text-[11px] text-rose-600 font-bold flex items-center gap-1 mt-1">
                        ⚠️ Debe ingresar el número de comprobante o referencia bancaria
                      </p>
                    ) : (
                      <p className="text-[11px] text-amber-800">
                        Obligatorio para que Gerencia audite la acreditación en la banca web (mínimo 3 caracteres).
                      </p>
                    )}
                  </div>
                )}

                {/* Concepto del Recibo */}
                <div>
                  <label htmlFor="proyecto-pago-concept" className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-2">
                    Por Concepto de
                  </label>
                  <input id="proyecto-pago-concept" name="proyecto_pago_concept"
                    type="text"
                    value={concepto}
                    onChange={(e) => setConcepto(e.target.value)}
                    placeholder="Ej: Abono correspondiente a cuota de terreno"
                    className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 bg-slate-50 focus:bg-white text-xs sm:text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-cyan-500 transition"
                  />
                  <p className="text-[11px] text-slate-400 mt-1">
                    Se redactará automáticamente en el cuerpo del recibo junto al Proyecto y Lote.
                  </p>
                </div>

                <SignaturePadField key={selectedLotId} ref={sigCanvasRef} />
                <EmitterSignaturePreview />

                {/* Botón Principal de Envío */}
                <div className="pt-2 space-y-2">
                  {isBankMethod && (!bankReference || bankReference.trim().length < 3) && (
                    <div className="p-2.5 rounded-lg bg-rose-50 border border-rose-200 text-rose-700 text-xs font-bold flex items-center justify-center gap-1.5">
                      <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0" />
                      <span>Debe ingresar el número de comprobante o referencia bancaria</span>
                    </div>
                  )}
                </div>
                <div className="sticky bottom-0 z-10 shrink-0 border-t bg-white p-3 sm:p-4 flex flex-col-reverse sm:flex-row gap-2 sm:justify-end">
                  <button type="button" disabled={isSubmitting} onClick={() => navigate(`/proyectos/${id}/clientes`)} className="w-full sm:w-auto min-h-[46px] text-base font-semibold rounded-md px-4 text-slate-700 hover:bg-slate-100">
                    Cancelar
                  </button>
                  <ActionButton loading={handleProcesarPagoPending}
                    type="submit"
                    disabled={isSubmitting || !selectedLotId || (isBankMethod && (!bankReference || bankReference.trim().length < 3))}
                    className="w-full sm:w-auto min-h-[46px] py-2 px-4 rounded-md font-semibold text-white bg-slate-900 hover:bg-slate-800 active:bg-black shadow-xs transition flex items-center justify-center gap-2 text-base cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {isSubmitting ? (
                      <>
                        <Loader2 className="w-5 h-5 animate-spin" />
                        <span>Procesando pago y generando PDF oficial...</span>
                      </>
                    ) : (
                      <>
                        <Receipt className="w-5 h-5" />
                        <span>
                          Confirmar Pago de ${Number(monto || 0).toLocaleString('en-US', { minimumFractionDigits: 2 })} y Emitir Recibo
                        </span>
                      </>
                    )}
                  </ActionButton>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}

      {/* Modal de Cronograma y Tabla de Amortización */}
      <AmortizationModal
        isOpen={amortizationModalOpen}
        onClose={() => setAmortizationModalOpen(false)}
        lotId={currentLot?.id}
        customerName={currentCustomer?.name}
      />
    </div>
  );
}
