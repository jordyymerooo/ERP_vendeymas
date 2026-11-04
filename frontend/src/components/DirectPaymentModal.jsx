/**
 * DirectPaymentModal.jsx  –  v2: Layout 2 columnas tablet/desktop + pad de firma táctil del cliente
 *
 * Columna Izquierda : datos del cobro (cliente, proyecto, lote, concepto, monto, método, ref.)
 * Columna Derecha   : Firma táctil del cliente (react-signature-canvas) + firma del emisor (lectura)
 *
 * Recibera asignada automáticamente por el backend (RoleSecurity::resolveEffectiveUser).
 * Numeración correlativa estricta con DB::transaction + lockForUpdate en el backend.
 */
import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import SignatureCanvas from 'react-signature-canvas';
import axios from 'axios';
import {
  X, User, Building2, MapPin, DollarSign, CreditCard, FileText,
  Hash, CheckCircle2, AlertTriangle, Loader2, Send, MessageCircle,
  Download, Receipt, PenLine, RotateCcw, Eye,
} from 'lucide-react';
import {
  DEFAULT_CEO_PHONE,
  openWhatsApp,
  buildPaymentCustomerWhatsAppMessage,
  buildPaymentCeoWhatsAppMessage,
} from '../utils/whatsapp';

// ─── Mapeo rol → recibera (solo para etiqueta UI) ────────────────────────────
const ROLE_TO_BOOK = {
  'Super Admin':      { book: 'GERENCIA',       prefix: 'GER', color: 'purple'  },
  'CEO / Gerente':    { book: 'GERENCIA',       prefix: 'GER', color: 'purple'  },
  'Administrador':    { book: 'ADMINISTRACION', prefix: 'ADM', color: 'blue'    },
  'Asesor Comercial': { book: 'ASESORIA',       prefix: 'ASE', color: 'emerald' },
  'Topógrafo':        { book: 'TOPOGRAFIA',     prefix: 'TOP', color: 'amber'   },
};
const COLORS = {
  purple:  { badge: 'bg-purple-100 text-purple-800 border-purple-200',   btn: 'bg-purple-700 hover:bg-purple-800'  },
  blue:    { badge: 'bg-blue-100 text-blue-800 border-blue-200',         btn: 'bg-blue-700 hover:bg-blue-800'     },
  emerald: { badge: 'bg-emerald-100 text-emerald-800 border-emerald-200', btn: 'bg-emerald-700 hover:bg-emerald-800' },
  amber:   { badge: 'bg-amber-100 text-amber-800 border-amber-200',      btn: 'bg-amber-700 hover:bg-amber-800'   },
};

const PAYMENT_METHODS = [
  'Efectivo',
  'Transferencia Bancaria',
  'Depósito Bancario',
  'Cheque',
  'Tarjeta de Débito',
  'Tarjeta de Crédito',
];
const BANK_METHODS = ['transferencia', 'depósito', 'deposito'];

export default function DirectPaymentModal({ onClose, onSuccess }) {
  const navigate = useNavigate();

  const userRole   = localStorage.getItem('user_role') || 'Super Admin';
  const bookInfo   = ROLE_TO_BOOK[userRole] || ROLE_TO_BOOK['Super Admin'];
  const colorCls   = COLORS[bookInfo.color];

  // ── Catálogos ────────────────────────────────────────────────────────────
  const [customers, setCustomers] = useState([]);
  const [projects,  setProjects]  = useState([]);
  const [lots,      setLots]      = useState([]);    // lotes del proyecto elegido
  const [allLots,   setAllLots]   = useState([]);    // todos los lotes con cliente (sync inversa)

  // ── Selecciones formulario ───────────────────────────────────────────────
  const [customerId,    setCustomerId]    = useState('');
  const [customerSearch,setCustomerSearch]= useState('');
  const [showCustDD,    setShowCustDD]    = useState(false);
  const [projectId,     setProjectId]     = useState('');
  const [lotId,         setLotId]         = useState('');
  const [concept,       setConcept]       = useState('');
  const [amount,        setAmount]        = useState('');
  const [payMethod,     setPayMethod]     = useState('Efectivo');
  const [bankRef,       setBankRef]       = useState('');

  // ── Firmas ───────────────────────────────────────────────────────────────
  const sigCanvasRef   = useRef(null);   // firma táctil del cliente
  const sigWrapperRef  = useRef(null);   // div contenedor del canvas (para resize)
  const initialDataRequested = useRef(false);
  const [emitterSig,   setEmitterSig]   = useState(null);    // firma del emisor (perfil)
  const [emitterName,  setEmitterName]  = useState('');
  const [canvasDims,   setCanvasDims]   = useState({ w: 400, h: 160 });

  // ── UI ────────────────────────────────────────────────────────────────────
  const [loadingData,  setLoadingData]  = useState(true);
  const [submitting,   setSubmitting]   = useState(false);
  const [formError,    setFormError]    = useState(null);
  const [successPayment, setSuccessPayment] = useState(null);

  const custDDRef = useRef(null);

  const needsBankRef = BANK_METHODS.some(m => payMethod.toLowerCase().includes(m));

  // ── 1. Cargar catálogos y firma del emisor ────────────────────────────────
  useEffect(() => {
    if (initialDataRequested.current) return;
    initialDataRequested.current = true;
    loadCatalogs();
    loadEmitterSignature();
  }, []);

  const loadEmitterSignature = async () => {
    try {
      const res = await axios.get('/api/profile/signature');
      setEmitterSig(res.data?.signature_base64 || null);
      setEmitterName(res.data?.name || localStorage.getItem('user_name') || 'Emisor');
    } catch { /* sin firma configurada */ }
  };

  const loadCatalogs = async () => {
    setLoadingData(true);
    try {
      const [custRes, projRes] = await Promise.all([
        axios.get('/api/customers?per_page=500'),
        axios.get('/api/projects'),
      ]);
      const custArr = Array.isArray(custRes.data) ? custRes.data : (custRes.data.data || []);
      const projArr = Array.isArray(projRes.data) ? projRes.data : (projRes.data.data || []);
      setCustomers(custArr);
      setProjects(projArr);

      // Cargar todos los lotes con cliente para sync inversa
      const lotsMatrix = await Promise.all(
        projArr.map(p =>
          axios.get(`/api/projects/${p.slug || p.id}/lots?per_page=500`)
            .then(r => {
              const items = Array.isArray(r.data) ? r.data : (r.data.data || []);
              return items.map(l => ({ ...l, project_id: p.id, project_name: p.name, project_slug: p.slug || p.id }));
            })
            .catch(() => [])
        )
      );
      setAllLots(lotsMatrix.flat().filter(l => l.customer_id));
    } catch (err) {
      console.error('Error cargando catálogos:', err);
    } finally {
      setLoadingData(false);
    }
  };

  // ── 2. Cuando cambia el proyecto → cargar sus lotes ───────────────────────
  useEffect(() => {
    if (!projectId) { setLots([]); setLotId(''); return; }
    const proj = projects.find(p => String(p.id) === String(projectId));
    if (!proj) return;
    axios.get(`/api/projects/${proj.slug || proj.id}/lots?per_page=500`)
      .then(r => {
        const items = Array.isArray(r.data) ? r.data : (r.data.data || []);
        setLots(items.filter(l => l.customer_id));
        setLotId('');
      })
      .catch(() => setLots([]));
  }, [projectId]);

  // ── 3. Sync DIRECTA: cliente → proyecto + lote ────────────────────────────
  const handleSelectCustomer = useCallback((cust) => {
    setCustomerId(String(cust.id));
    setCustomerSearch(cust.name);
    setShowCustDD(false);
    setFormError(null);

    const clientLot = allLots.find(l => String(l.customer_id) === String(cust.id));
    if (clientLot) {
      setProjectId(String(clientLot.project_id));
      const proj = projects.find(p => String(p.id) === String(clientLot.project_id));
      if (proj) {
        axios.get(`/api/projects/${proj.slug || proj.id}/lots?per_page=500`)
          .then(r => {
            const items = Array.isArray(r.data) ? r.data : (r.data.data || []);
            setLots(items.filter(l => l.customer_id));
            setLotId(String(clientLot.id));
          }).catch(() => {});
      }
    }
  }, [allLots, projects]);

  // ── 4. Sync INVERSA: lote → cliente ─────────────────────────────────────
  const handleSelectLot = useCallback((lotIdVal) => {
    setLotId(lotIdVal);
    if (!lotIdVal) return;
    const found = [...lots, ...allLots].find(l => String(l.id) === String(lotIdVal));
    if (found?.customer_id) {
      const cust = customers.find(c => String(c.id) === String(found.customer_id));
      if (cust) { setCustomerId(String(cust.id)); setCustomerSearch(cust.name); }
    }
  }, [lots, allLots, customers]);

  // ── 5. Cerrar dropdown cliente al click fuera ─────────────────────────────
  useEffect(() => {
    const h = e => { if (custDDRef.current && !custDDRef.current.contains(e.target)) setShowCustDD(false); };
    document.addEventListener('mousedown', h);
    return () => document.removeEventListener('mousedown', h);
  }, []);

  // ── 6. Resize del canvas de firma (maneja rotación tablet) ───────────────
  useEffect(() => {
    const updateDims = () => {
      if (sigWrapperRef.current) {
        const w = sigWrapperRef.current.clientWidth;
        const h = Math.max(140, Math.round(w * 0.38));
        setCanvasDims({ w, h });
        // Preservar el trazo existente al redibujar
        if (sigCanvasRef.current) {
          const data = sigCanvasRef.current.toData();
          sigCanvasRef.current.clear();
          sigCanvasRef.current.fromData(data);
        }
      }
    };
    updateDims();
    const observer = new ResizeObserver(updateDims);
    if (sigWrapperRef.current) observer.observe(sigWrapperRef.current);
    return () => observer.disconnect();
  }, []);

  // ── 7. Filtro de clientes buscados ────────────────────────────────────────
  const filteredCustomers = customerSearch.length >= 1
    ? customers.filter(c =>
        c.name?.toLowerCase().includes(customerSearch.toLowerCase()) ||
        c.id_card?.includes(customerSearch)
      ).slice(0, 10)
    : customers.slice(0, 10);

  // ── 8. Limpiar firma del cliente ──────────────────────────────────────────
  const clearClientSignature = () => { sigCanvasRef.current?.clear(); };

  // ── 9. Submit ─────────────────────────────────────────────────────────────
  const handleSubmit = async (e) => {
    e.preventDefault();
    setFormError(null);

    if (!lotId)                        { setFormError('Debes seleccionar un lote / contrato.'); return; }
    if (!amount || Number(amount) <= 0){ setFormError('El monto debe ser mayor a $0.00.'); return; }
    if (needsBankRef && !bankRef.trim()){ setFormError('El N° de comprobante / referencia bancaria es obligatorio para este método de pago.'); return; }

    // Firma táctil del cliente en base64
    let clientSigB64 = null;
    if (sigCanvasRef.current && !sigCanvasRef.current.isEmpty()) {
      clientSigB64 = sigCanvasRef.current.toDataURL('image/png');
    }

    setSubmitting(true);
    try {
      const payload = {
        lot_id: lotId,
        customer_id: customerId || undefined,
        concept_detail: concept.trim() || 'Pago de cuota',
        amount_paid: Number(amount),
        payment_method: payMethod,
        bank_reference: needsBankRef ? bankRef.trim() : undefined,
        // receipt_book NO se envía → backend lo asigna con resolveEffectiveUser
        signature_base64: emitterSig || undefined,      // firma del emisor
        customer_signature: clientSigB64 || undefined,  // firma táctil del cliente
      };

      const res = await axios.post('/api/payments', payload);
      const pd  = res.data?.data || res.data?.payment || res.data;

      setSuccessPayment({
        id:            pd.id,
        receipt_code:  pd.receipt_code  || res.data?.receipt_code,
        receipt_book:  pd.receipt_book  || bookInfo.book,
        amount_paid:   pd.amount_paid   || Number(amount),
        payment_method: pd.payment_method || payMethod,
        bank_reference: pd.bank_reference || bankRef,
        debt_balance:  pd.debt_balance,
        pdf_url:       res.data?.receipt_url || `/api/payments/${pd.id}/pdf`,
        customer_name:  pd.lot?.customer?.name  || customers.find(c => String(c.id) === customerId)?.name || 'Cliente',
        customer_phone: pd.lot?.customer?.phone || customers.find(c => String(c.id) === customerId)?.phone || '',
        project_name:   pd.lot?.project?.name   || projects.find(p => String(p.id) === projectId)?.name || '',
        lot_number:     pd.lot?.lot_number       || lots.find(l => String(l.id) === lotId)?.lot_number || '',
        concept_detail: concept.trim() || 'Pago de cuota',
        cashier_name:   localStorage.getItem('user_name') || emitterName || 'Emisor',
      });

      window.dispatchEvent(new Event('paymentUpdated'));
      window.dispatchEvent(new Event('notifications-updated'));
      if (onSuccess) onSuccess();
    } catch (err) {
      const msg = err.response?.data?.message
        || Object.values(err.response?.data?.errors || {}).flat().join(' ')
        || 'Error al procesar el cobro. Intenta nuevamente.';
      setFormError(msg);
    } finally {
      setSubmitting(false);
    }
  };

  // ── WhatsApp handlers ─────────────────────────────────────────────────────
  const handleWhatsAppCustomer = () => {
    if (!successPayment) return;
    openWhatsApp(successPayment.customer_phone, buildPaymentCustomerWhatsAppMessage({
      receiptCode: successPayment.receipt_code, receiptBook: successPayment.receipt_book,
      customerName: successPayment.customer_name, projectName: successPayment.project_name,
      lotNumber: successPayment.lot_number, concept: successPayment.concept_detail,
      amountPaid: successPayment.amount_paid, paymentMethod: successPayment.payment_method,
      bankReference: successPayment.bank_reference, debtBalance: successPayment.debt_balance,
      cashierName: successPayment.cashier_name,
    }));
  };
  const handleWhatsAppCeo = () => {
    if (!successPayment) return;
    openWhatsApp(DEFAULT_CEO_PHONE, buildPaymentCeoWhatsAppMessage({
      receiptCode: successPayment.receipt_code, receiptBook: successPayment.receipt_book,
      customerName: successPayment.customer_name, projectName: successPayment.project_name,
      lotNumber: successPayment.lot_number, concept: successPayment.concept_detail,
      amountPaid: successPayment.amount_paid, paymentMethod: successPayment.payment_method,
      bankReference: successPayment.bank_reference, cashierName: successPayment.cashier_name,
    }));
  };
  const handleCloseSuccess = () => { setSuccessPayment(null); onClose(); navigate('/recibos', { replace: true }); };

  // ─────────────────────────────────────────────────────────────────────────
  // PANEL DE ÉXITO
  // ─────────────────────────────────────────────────────────────────────────
  if (successPayment) {
    const token     = localStorage.getItem('auth_token');
    const baseUrl   = `http://${window.location.hostname}:8000`;
    const rawUrl    = successPayment.pdf_url.startsWith('http') ? successPayment.pdf_url : `${baseUrl}${successPayment.pdf_url}`;
    const pdfUrl    = `${rawUrl}${rawUrl.includes('?') ? '&' : '?'}token=${token}`;

    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
        <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl overflow-hidden flex flex-col max-h-[90vh]">
          {/* Header éxito */}
          <div className="flex items-center justify-between px-6 py-4 border-b bg-emerald-50">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-emerald-100 flex items-center justify-center">
                <CheckCircle2 className="w-6 h-6 text-emerald-600" />
              </div>
              <div>
                <h2 className="text-lg font-bold text-emerald-900">¡Recibo Emitido con Éxito!</h2>
                <p className="text-xs text-emerald-700 font-mono">
                  {successPayment.receipt_code} &mdash; ${Number(successPayment.amount_paid).toFixed(2)} USD
                </p>
              </div>
            </div>
            <button onClick={handleCloseSuccess} className="text-slate-400 hover:text-slate-600 cursor-pointer">
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* PDF inline */}
          <div className="flex-1 min-h-[340px] bg-slate-100">
            <iframe src={pdfUrl} title="Recibo PDF" className="w-full h-full border-0" style={{ minHeight: 340 }} />
          </div>

          {/* Acciones */}
          <div className="px-6 py-4 border-t space-y-2">
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
              <a href={pdfUrl} target="_blank" rel="noopener noreferrer"
                className="inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl text-sm font-bold text-white bg-slate-800 hover:bg-slate-900 transition cursor-pointer">
                <Download className="w-4 h-4" /> Abrir / Imprimir PDF
              </a>
              <button type="button" onClick={handleWhatsAppCustomer}
                className="inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl text-sm font-bold text-white bg-green-600 hover:bg-green-700 transition cursor-pointer">
                <MessageCircle className="w-4 h-4" /> 📲 Enviar al Cliente
              </button>
              <button type="button" onClick={handleWhatsAppCeo}
                className="inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl text-sm font-bold text-white bg-indigo-600 hover:bg-indigo-700 transition cursor-pointer">
                <MessageCircle className="w-4 h-4" /> 📲 Reportar al CEO
              </button>
            </div>
            <button type="button" onClick={handleCloseSuccess}
              className="w-full px-4 py-2 rounded-xl text-sm font-semibold text-slate-600 bg-slate-100 hover:bg-slate-200 transition cursor-pointer">
              Cerrar y volver a Recibos
            </button>
          </div>
        </div>
      </div>
    );
  }

  // ─────────────────────────────────────────────────────────────────────────
  // FORMULARIO DE COBRO — Layout 2 columnas (md)
  // ─────────────────────────────────────────────────────────────────────────
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-2 sm:p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-4xl overflow-hidden flex flex-col max-h-[90vh]">

        {/* Header */}
        <div className="flex items-center justify-between px-5 py-3.5 border-b border-slate-100 shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-slate-100 flex items-center justify-center text-slate-700">
              <Receipt className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-slate-900">Emitir Recibo Directo</h2>
              <p className="text-xs text-slate-500">Cobro universal · Recibera asignada automáticamente</p>
            </div>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <span className={`text-[10px] font-mono font-extrabold px-2 py-1 rounded border ${colorCls.badge}`}>
              {bookInfo.prefix}-XXXXX
            </span>
            <button onClick={onClose} className="text-slate-400 hover:text-slate-600 cursor-pointer ml-1">
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Body — scrollable */}
        <div className="flex-1 overflow-y-auto px-5 py-5">
          {loadingData ? (
            <div className="flex flex-col items-center justify-center py-20 gap-3 text-slate-400">
              <Loader2 className="w-8 h-8 animate-spin" />
              <p className="text-sm">Cargando clientes y proyectos...</p>
            </div>
          ) : (
            <form id="direct-payment-form" onSubmit={handleSubmit}>
              {/* Error global */}
              {formError && (
                <div className="flex items-start gap-2 p-3 mb-4 rounded-lg bg-rose-50 border border-rose-200 text-rose-800 text-sm">
                  <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
                  <span>{formError}</span>
                </div>
              )}

              {/* ── Grid 2 columnas ────────────────────────────────────── */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">

                {/* ════════════════════════════════════════════
                    COLUMNA IZQUIERDA – Datos del cobro
                ════════════════════════════════════════════ */}
                <div className="space-y-4">

                  {/* Cliente buscador */}
                  <div ref={custDDRef} className="relative">
                    <label className="block text-xs font-bold text-slate-700 mb-1.5">
                      <User className="w-3.5 h-3.5 inline mr-1" />
                      Cliente / Titular <span className="text-rose-500">*</span>
                    </label>
                    <input
                      type="text"
                      value={customerSearch}
                      onChange={e => {
                        setCustomerSearch(e.target.value);
                        setShowCustDD(true);
                        if (!e.target.value) { setCustomerId(''); setProjectId(''); setLotId(''); setLots([]); }
                      }}
                      onFocus={() => setShowCustDD(true)}
                      placeholder="Busca por nombre o cédula..."
                      autoComplete="off"
                      className="w-full px-3 py-2 rounded-lg border border-slate-200 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-slate-400 bg-slate-50"
                    />
                    {showCustDD && filteredCustomers.length > 0 && (
                      <ul className="absolute z-30 left-0 right-0 top-full mt-1 bg-white border border-slate-200 rounded-xl shadow-lg max-h-44 overflow-y-auto text-sm">
                        {filteredCustomers.map(c => (
                          <li key={c.id} onMouseDown={() => handleSelectCustomer(c)}
                            className="px-4 py-2.5 hover:bg-slate-50 cursor-pointer flex justify-between gap-2">
                            <span className="font-semibold text-slate-800">{c.name}</span>
                            <span className="text-xs text-slate-400 font-mono">{c.id_card}</span>
                          </li>
                        ))}
                      </ul>
                    )}
                    {showCustDD && customerSearch.length >= 1 && filteredCustomers.length === 0 && (
                      <div className="absolute z-30 left-0 right-0 top-full mt-1 bg-white border border-slate-200 rounded-xl shadow-lg px-4 py-3 text-sm text-slate-400">
                        No se encontraron clientes.
                      </div>
                    )}
                  </div>

                  {/* Proyecto */}
                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1.5">
                      <Building2 className="w-3.5 h-3.5 inline mr-1" />
                      Proyecto
                    </label>
                    <select value={projectId}
                      onChange={e => { setProjectId(e.target.value); setLotId(''); setCustomerId(''); setCustomerSearch(''); }}
                      className="w-full px-3 py-2 rounded-lg border border-slate-200 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-slate-400 bg-slate-50">
                      <option value="">— Selecciona un proyecto —</option>
                      {projects.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                    </select>
                  </div>

                  {/* Lote */}
                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1.5">
                      <MapPin className="w-3.5 h-3.5 inline mr-1" />
                      Lote / Contrato <span className="text-rose-500">*</span>
                    </label>
                    <select value={lotId} onChange={e => handleSelectLot(e.target.value)} required
                      disabled={!projectId}
                      className="w-full px-3 py-2 rounded-lg border border-slate-200 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-slate-400 bg-slate-50 disabled:opacity-50">
                      <option value="">{projectId ? '— Selecciona un lote —' : '— Primero elige proyecto o cliente —'}</option>
                      {lots.map(l => (
                        <option key={l.id} value={l.id}>
                          Lote {l.lot_number}{l.customer?.name ? ` · ${l.customer.name}` : ''}
                        </option>
                      ))}
                    </select>
                  </div>

                  {/* Concepto */}
                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1.5">
                      <FileText className="w-3.5 h-3.5 inline mr-1" />
                      Concepto del Recibo
                    </label>
                    <input type="text" value={concept} onChange={e => setConcept(e.target.value)}
                      placeholder="Ej: Abono cuota mensual, pago inicial..." maxLength={255}
                      className="w-full px-3 py-2 rounded-lg border border-slate-200 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-slate-400 bg-slate-50" />
                  </div>

                  {/* Monto + Método */}
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-xs font-bold text-slate-700 mb-1.5">
                        <DollarSign className="w-3.5 h-3.5 inline mr-1" />
                        Monto (USD) <span className="text-rose-500">*</span>
                      </label>
                      <input type="number" value={amount} onChange={e => setAmount(e.target.value)}
                        min="0.01" step="0.01" required placeholder="0.00"
                        className="w-full px-3 py-2 rounded-lg border border-slate-200 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-slate-400 bg-slate-50" />
                    </div>
                    <div>
                      <label className="block text-xs font-bold text-slate-700 mb-1.5">
                        <CreditCard className="w-3.5 h-3.5 inline mr-1" />
                        Método <span className="text-rose-500">*</span>
                      </label>
                      <select value={payMethod} onChange={e => { setPayMethod(e.target.value); setBankRef(''); }} required
                        className="w-full px-3 py-2 rounded-lg border border-slate-200 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-slate-400 bg-slate-50">
                        {PAYMENT_METHODS.map(m => <option key={m} value={m}>{m}</option>)}
                      </select>
                    </div>
                  </div>

                  {/* Referencia bancaria (condicional) */}
                  {needsBankRef && (
                    <div>
                      <label className="block text-xs font-bold text-slate-700 mb-1.5">
                        <Hash className="w-3.5 h-3.5 inline mr-1" />
                        N° Comprobante / Referencia Bancaria <span className="text-rose-500">*</span>
                      </label>
                      <input type="text" value={bankRef} onChange={e => setBankRef(e.target.value)}
                        placeholder="Ej: TRF-20241103-001234" minLength={3} maxLength={100} required
                        className="w-full px-3 py-2 rounded-lg border border-slate-200 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-slate-400 bg-slate-50" />
                    </div>
                  )}

                  {/* Recibera auto-asignada (informativo) */}
                  <div className={`flex items-center gap-2 px-3.5 py-2.5 rounded-xl border text-xs font-semibold ${colorCls.badge}`}>
                    <Receipt className="w-3.5 h-3.5 shrink-0" />
                    <span>
                      Recibera: <strong>{bookInfo.book}</strong> — Serie <strong>{bookInfo.prefix}-XXXXX</strong>
                      &nbsp;(rol: <em>{userRole}</em>)
                    </span>
                  </div>
                </div>

                {/* ════════════════════════════════════════════
                    COLUMNA DERECHA – Firmas
                ════════════════════════════════════════════ */}
                <div className="space-y-4 flex flex-col">

                  {/* ── Firma táctil del cliente ──────────────────────── */}
                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1.5">
                      <PenLine className="w-3.5 h-3.5 inline mr-1" />
                      Firma del Cliente (Pad Táctil)
                    </label>
                    <div ref={sigWrapperRef}
                      className="w-full rounded-xl border-2 border-dashed border-slate-300 bg-slate-50 overflow-hidden touch-none"
                      style={{ minHeight: 150 }}>
                      <SignatureCanvas
                        ref={sigCanvasRef}
                        penColor="#1e293b"
                        canvasProps={{
                          width: canvasDims.w,
                          height: canvasDims.h,
                          style: { display: 'block', width: '100%', height: `${canvasDims.h}px`, touchAction: 'none' },
                        }}
                        backgroundColor="rgba(248,250,252,0)"
                      />
                    </div>
                    <button type="button" onClick={clearClientSignature}
                      className="mt-2 inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold text-slate-600 bg-slate-100 hover:bg-slate-200 transition cursor-pointer">
                      <RotateCcw className="w-3.5 h-3.5" /> Limpiar Firma
                    </button>
                    <p className="text-[10px] text-slate-400 mt-1">
                      Firma con el dedo o el lápiz táctil. Se capturará en el recibo.
                    </p>
                  </div>

                  {/* ── Firma digital del emisor (solo lectura) ─────────── */}
                  <div className="flex-1">
                    <label className="block text-xs font-bold text-slate-700 mb-1.5">
                      <Eye className="w-3.5 h-3.5 inline mr-1" />
                      Firma Automática del Emisor
                    </label>
                    {emitterSig ? (
                      <div className="rounded-xl border border-slate-200 bg-slate-50 p-3 flex flex-col items-center gap-2">
                        <img src={emitterSig} alt="Firma del emisor"
                          className="h-16 object-contain" style={{ maxWidth: 200 }} />
                        <p className="text-[11px] text-slate-500 text-center font-semibold">
                          {emitterName} &bull; {bookInfo.book}
                        </p>
                      </div>
                    ) : (
                      <div className="rounded-xl border border-dashed border-slate-300 bg-slate-50 p-4 text-center">
                        <p className="text-xs text-slate-400">
                          No tienes firma digital configurada. Configúrala en tu perfil.
                          <br />El espacio quedará en blanco para firma manual.
                        </p>
                      </div>
                    )}
                  </div>
                </div>

              </div>{/* fin grid 2 cols */}
            </form>
          )}
        </div>

        {/* Footer */}
        {!loadingData && (
          <div className="px-5 py-4 border-t border-slate-100 shrink-0 flex items-center gap-3">
            <button type="button" onClick={onClose}
              className="flex-1 px-4 py-2.5 rounded-xl text-sm font-semibold text-slate-600 bg-slate-100 hover:bg-slate-200 transition cursor-pointer">
              Cancelar
            </button>
            <button type="submit" form="direct-payment-form" disabled={submitting}
              className={`flex-1 inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl text-sm font-bold text-white transition cursor-pointer disabled:opacity-60 disabled:cursor-not-allowed ${colorCls.btn}`}>
              {submitting
                ? <><Loader2 className="w-4 h-4 animate-spin" /> Procesando...</>
                : <><Send className="w-4 h-4" /> Emitir Recibo</>}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
