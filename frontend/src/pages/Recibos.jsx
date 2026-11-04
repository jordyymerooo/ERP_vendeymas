import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import DirectPaymentModal from '../components/DirectPaymentModal';
import axios from 'axios';
import {
  Receipt,
  Search,
  Clock,
  User,
  Building2,
  Eye,
  Download,
  Loader2,
  ChevronLeft,
  ChevronRight,
  Filter,
  DollarSign,
  FileCheck,
  Ban,
  AlertTriangle,
  CheckCircle2,
  X,
  ShieldAlert,
  FileSpreadsheet,
  Printer,
  Calendar,
  Wallet,
  Landmark,
  MessageCircle,
  Plus,
} from 'lucide-react';
import {
  DEFAULT_CEO_PHONE,
  openWhatsApp,
  buildPaymentCustomerWhatsAppMessage,
  buildPaymentCeoWhatsAppMessage,
} from '../utils/whatsapp';

export default function Recibos({ openDirectPaymentModal = false }) {
  const navigate = useNavigate();

  // ── Modal de cobro directo ────────────────────────────────────────────────
  const [directModalOpen, setDirectModalOpen] = useState(false);

  // Abrir automáticamente si la ruta es /recibos/emitir
  useEffect(() => {
    if (openDirectPaymentModal) {
      setDirectModalOpen(true);
    }
  }, [openDirectPaymentModal]);

  // Refrescar tabla cuando se emite un pago exitoso
  useEffect(() => {
    const handler = () => fetchPayments(1);
    window.addEventListener('paymentUpdated', handler);
    return () => window.removeEventListener('paymentUpdated', handler);
  }, []);

  const [payments, setPayments] = useState([]);
  const [pagination, setPagination] = useState({});
  const [loading, setLoading] = useState(true);

  // Rol activo del usuario y filtro por Recibera Oficial
  const [userRole, setUserRole] = useState(() => localStorage.getItem('user_role') || 'Super Admin');
  const isSuperAdmin = userRole === 'Super Admin';

  const getInitialReceiptBook = (role) => {
    if (role === 'Topógrafo') return 'TOPOGRAFIA';
    if (role === 'Asesor Comercial') return 'ASESORIA';
    if (role === 'Administrador') return 'ADMINISTRACION';
    return 'ALL';
  };

  const [receiptBookFilter, setReceiptBookFilter] = useState(() => {
    const role = localStorage.getItem('user_role') || 'Super Admin';
    return getInitialReceiptBook(role);
  });

  useEffect(() => {
    const handleAuthChange = () => {
      const nextRole = localStorage.getItem('user_role') || 'Super Admin';
      setUserRole(nextRole);
      setReceiptBookFilter(getInitialReceiptBook(nextRole));
    };
    window.addEventListener('storage', handleAuthChange);
    window.addEventListener('auth-change', handleAuthChange);
    return () => {
      window.removeEventListener('storage', handleAuthChange);
      window.removeEventListener('auth-change', handleAuthChange);
    };
  }, []);

  // Filtros generales
  const [projectsList, setProjectsList] = useState([]);
  const [selectedProject, setSelectedProject] = useState('');
  const [searchTerm, setSearchTerm] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');

  // Filtros de Arqueo y Cierre de Caja
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [paymentMethod, setPaymentMethod] = useState('');
  const [statusFilter, setStatusFilter] = useState('');

  // Resumen del Arqueo de Caja (en tiempo real desde el backend)
  const [cashCloseSummary, setCashCloseSummary] = useState({
    total_valid_amount: 0,
    valid_count: 0,
    total_cash: 0,
    cash_count: 0,
    total_transfer: 0,
    transfer_count: 0,
    voided_count: 0,
    voided_amount: 0,
    total_count: 0,
  });

  // Estado para Anulación de Recibo
  const [voidModalOpen, setVoidModalOpen] = useState(false);
  const [selectedPaymentForVoid, setSelectedPaymentForVoid] = useState(null);
  const [voidReason, setVoidReason] = useState('');
  const [voidSubmitting, setVoidSubmitting] = useState(false);
  const [voidError, setVoidError] = useState(null);
  const [toastMessage, setToastMessage] = useState(null);
  const [toastType, setToastType] = useState('success'); // 'success' | 'error'
  const handleSendWhatsAppCustomer = (payment) => {
    const msg = buildPaymentCustomerWhatsAppMessage({
      receiptCode: payment.receipt_code || payment.receipt_number,
      receiptBook: payment.receipt_book,
      customerName: payment.customer_name,
      projectName: payment.project_name,
      lotNumber: payment.lot_number,
      concept: payment.concept_detail,
      amountPaid: payment.amount_paid,
      paymentMethod: payment.payment_method,
      bankReference: payment.bank_reference || payment.bankReference,
      debtBalance: payment.debt_balance,
      cashierName: payment.cashier_name || 'Asesor Autorizado',
      dateTime: payment.date ? `${payment.date} ${payment.time || ''}` : null,
    });
    openWhatsApp(payment.customer_phone, msg);
  };

  const handleSendWhatsAppCeo = (payment) => {
    const msg = buildPaymentCeoWhatsAppMessage({
      receiptCode: payment.receipt_code || payment.receipt_number,
      receiptBook: payment.receipt_book,
      customerName: payment.customer_name,
      projectName: payment.project_name,
      lotNumber: payment.lot_number,
      concept: payment.concept_detail,
      amountPaid: payment.amount_paid,
      paymentMethod: payment.payment_method,
      bankReference: payment.bank_reference || payment.bankReference,
      cashierName: payment.cashier_name || 'Asesor / Administrador',
      dateTime: payment.date ? `${payment.date} ${payment.time || ''}` : null,
    });
    openWhatsApp(DEFAULT_CEO_PHONE, msg);
  };

  // Debounce para búsqueda fluida
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearch(searchTerm);
    }, 250);
    return () => clearTimeout(timer);
  }, [searchTerm]);

  // Cargar proyectos disponibles para el filtro
  const fetchProjects = async () => {
    try {
      const res = await axios.get('/api/projects');
      const data = Array.isArray(res.data) ? res.data : (res.data.data || []);
      setProjectsList(data);
    } catch (err) {
      console.error('Error al cargar proyectos para filtro:', err);
    }
  };

  // Cargar comprobantes emitidos y arqueo de caja
  const fetchPayments = async (page = 1) => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      params.append('page', page);
      if (selectedProject) {
        params.append('project', selectedProject);
      }
      if (debouncedSearch.trim()) {
        params.append('search', debouncedSearch.trim());
      }
      if (startDate) {
        params.append('start_date', startDate);
      }
      if (endDate) {
        params.append('end_date', endDate);
      }
      if (paymentMethod) {
        params.append('payment_method', paymentMethod);
      }
      if (statusFilter) {
        params.append('status', statusFilter);
      }
      if (receiptBookFilter && receiptBookFilter !== 'ALL') {
        params.append('receipt_book', receiptBookFilter);
      }

      const res = await axios.get(`/api/payments?${params.toString()}`);
      setPayments(res.data.data || []);
      setPagination({
        current_page: res.data.current_page,
        last_page: res.data.last_page,
        total: res.data.total,
        from: res.data.from,
        to: res.data.to,
      });

      if (res.data.cash_close_summary) {
        setCashCloseSummary(res.data.cash_close_summary);
      }
    } catch (err) {
      console.error('Error al consultar recibos:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchProjects();
  }, []);

  useEffect(() => {
    fetchPayments(1);
  }, [selectedProject, debouncedSearch, startDate, endDate, paymentMethod, statusFilter, receiptBookFilter]);

  // Accesos rápidos de fechas
  const setFilterToday = () => {
    const today = new Date().toISOString().split('T')[0];
    setStartDate(today);
    setEndDate(today);
  };

  const setFilterThisMonth = () => {
    const now = new Date();
    const firstDay = new Date(now.getFullYear(), now.getMonth(), 1).toISOString().split('T')[0];
    const today = now.toISOString().split('T')[0];
    setStartDate(firstDay);
    setEndDate(today);
  };

  const clearDateFilters = () => {
    setStartDate('');
    setEndDate('');
  };

  // Generador de URLs para descargas de Excel y PDF
  const buildExportUrl = (format = 'excel') => {
    const params = new URLSearchParams();
    const token = localStorage.getItem('auth_token') || '';
    if (token) params.append('token', token);
    if (startDate) params.append('start_date', startDate);
    if (endDate) params.append('end_date', endDate);
    if (selectedProject) params.append('project', selectedProject);
    if (paymentMethod) params.append('payment_method', paymentMethod);
    if (statusFilter) params.append('status', statusFilter);
    if (receiptBookFilter && receiptBookFilter !== 'ALL') params.append('receipt_book', receiptBookFilter);
    if (searchTerm.trim()) params.append('search', searchTerm.trim());

    const endpoint = format === 'excel' ? '/api/payments/export/excel' : '/api/payments/export/pdf';
    return `http://${window.location.hostname}:8000${endpoint}?${params.toString()}`;
  };

  const handleExportExcel = () => {
    const url = buildExportUrl('excel');
    window.open(url, '_blank');
  };

  const handleExportPdf = () => {
    const url = buildExportUrl('pdf');
    window.open(url, '_blank');
  };

  // Manejador para abrir modal de anulación
  const handleOpenVoidModal = (payment) => {
    setSelectedPaymentForVoid(payment);
    setVoidReason('');
    setVoidError(null);
    setVoidModalOpen(true);
  };

  // Confirmar anulación formal
  const handleConfirmVoid = async (e) => {
    e.preventDefault();
    if (!voidReason.trim() || voidReason.trim().length < 5) {
      setVoidError('El motivo de anulación es obligatorio y debe tener al menos 5 caracteres.');
      return;
    }

    setVoidSubmitting(true);
    setVoidError(null);
    try {
      const res = await axios.post(`/api/payments/${selectedPaymentForVoid.id}/void`, {
        reason: voidReason.trim(),
      });

      setToastType('success');
      setToastMessage(res.data.message || 'Comprobante anulado formalmente con éxito.');
      window.dispatchEvent(new Event('notifications-updated'));
      window.dispatchEvent(new Event('paymentUpdated'));
      setVoidModalOpen(false);
      setSelectedPaymentForVoid(null);
      setVoidReason('');
      fetchPayments(pagination.current_page || 1);
    } catch (err) {
      console.error('Error al anular comprobante:', err);
      const msg = err.response?.data?.message || 'Error al procesar la anulación del comprobante.';
      setVoidError(msg);
      setToastType('error');
      setToastMessage(msg);
    } finally {
      setVoidSubmitting(false);
      setTimeout(() => setToastMessage(null), 5000);
    }
  };

  return (
    <div className="space-y-6">
      {/* Toast Notification */}
      {toastMessage && (
        <div
          className={`p-4 rounded-xl flex items-center justify-between shadow-sm animate-fade-in border ${
            toastType === 'success'
              ? 'bg-emerald-50 border-emerald-200 text-emerald-800'
              : 'bg-rose-50 border-rose-200 text-rose-800'
          }`}
        >
          <div className="flex items-center gap-3">
            {toastType === 'success' ? (
              <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0" />
            ) : (
              <AlertTriangle className="w-5 h-5 text-rose-600 shrink-0" />
            )}
            <p className="text-sm font-semibold">{toastMessage}</p>
          </div>
          <button
            type="button"
            onClick={() => setToastMessage(null)}
            className="text-xs font-semibold underline cursor-pointer hover:opacity-80"
          >
            Cerrar
          </button>
        </div>
      )}

      {/* Cabecera Principal y Botones de Exportación Contable */}
      <div className="bg-white rounded-lg border border-slate-200 p-5 shadow-xs space-y-5">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-100 pb-5">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-slate-100 flex items-center justify-center text-slate-700 border border-slate-200">
              <Receipt className="w-5 h-5" />
            </div>
            <div>
              <h1 className="text-xl sm:text-2xl font-bold text-slate-900">
                Auditoría de Recibos y Cierre de Caja
              </h1>
              <p className="text-xs text-slate-500 mt-0.5">
                Comprobantes de cobro, arqueo diario y reportes contables ({pagination.total || 0} comprobantes)
              </p>
            </div>
          </div>

          {/* Botones de Exportación Solicitados */}
          <div className="flex items-center gap-2 flex-wrap">
            {/* ── Botón de Cobro Directo Universal ── */}
            <button
              type="button"
              onClick={() => { setDirectModalOpen(true); navigate('/recibos/emitir', { replace: true }); }}
              className="inline-flex items-center gap-2 px-3.5 py-2 rounded-lg text-xs font-bold text-white bg-indigo-600 hover:bg-indigo-700 active:bg-indigo-800 shadow-2xs transition cursor-pointer"
              title="Registrar un cobro sin navegar por proyectos"
            >
              <Plus className="w-4 h-4" />
              <span>Emitir Recibo Directo</span>
            </button>

            <button
              type="button"
              onClick={handleExportExcel}
              className="inline-flex items-center gap-2 px-3.5 py-2 rounded-lg text-xs font-bold text-white bg-emerald-700 hover:bg-emerald-800 active:bg-emerald-900 shadow-2xs transition cursor-pointer"
              title="Descargar reporte contable en Excel (.csv UTF-8)"
            >
              <FileSpreadsheet className="w-4 h-4" />
              <span>Exportar a Excel (.csv)</span>
            </button>

            <button
              type="button"
              onClick={handleExportPdf}
              className="inline-flex items-center gap-2 px-3.5 py-2 rounded-lg text-xs font-bold text-white bg-slate-900 hover:bg-slate-800 active:bg-black shadow-2xs transition cursor-pointer"
              title="Generar e imprimir Reporte Oficial de Cierre de Caja en PDF"
            >
              <Printer className="w-4 h-4" />
              <span>Imprimir Cierre de Caja (PDF)</span>
            </button>
          </div>
        </div>

        {/* Pestañas (Tabs) de las 4 Reciberas Oficiales e Independientes */}
        <div className="flex items-center gap-1.5 overflow-x-auto pb-1 border-b border-slate-100">
          {[
            { id: 'ALL', label: 'Todas las Reciberas', code: 'AUDITORÍA', desc: 'Auditoría Global' },
            { id: 'ADMINISTRACION', label: 'Recibera Administración (ADM-)', code: 'ADM', desc: 'Escrituras, Municipio, Hipotecas' },
            { id: 'ASESORIA', label: 'Recibera Asesores (ASE-)', code: 'ASE', desc: 'Ventas y Cuotas Comerciales' },
            { id: 'TOPOGRAFIA', label: 'Recibera Topografía (TOP-)', code: 'TOP', desc: 'Levantamientos y Planos' },
            { id: 'GERENCIA', label: 'Recibera Gerencia / CEO (GER-)', code: 'GER', desc: 'Cobros Directos Gerencia' },
          ]
            .filter((tab) => {
              if (isSuperAdmin) return true;
              if (userRole === 'Administrador') return tab.id === 'ADMINISTRACION';
              if (userRole === 'Asesor Comercial') return tab.id === 'ASESORIA';
              if (userRole === 'Topógrafo') return tab.id === 'TOPOGRAFIA';
              return false;
            })
            .map((tab) => {
              const isActive = receiptBookFilter === tab.id;
              return (
                <button
                  key={tab.id}
                  type="button"
                  onClick={() => setReceiptBookFilter(tab.id)}
                  className={`flex items-center gap-2 px-3.5 py-2 rounded-lg text-xs font-bold transition cursor-pointer shrink-0 border ${
                    isActive
                      ? 'bg-slate-900 text-white border-slate-900 shadow-xs'
                      : 'bg-slate-50 text-slate-600 border-slate-200 hover:bg-slate-100 hover:text-slate-900'
                  }`}
                >
                  <span
                    className={`text-[10px] font-mono px-1.5 py-0.5 rounded font-extrabold ${
                      isActive ? 'bg-white/20 text-white' : 'bg-slate-200 text-slate-700'
                    }`}
                  >
                    {tab.code}
                  </span>
                  <span>{tab.label}</span>
                </button>
              );
            })}
        </div>

        {/* Panel de Arqueo de Caja Diario (4 Indicadores Contables en Tiempo Real) */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {/* 1. Total Recaudado Neto */}
          <div className="bg-emerald-50/60 rounded-xl border border-emerald-200/80 p-4 shadow-2xs">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-bold text-emerald-800 uppercase tracking-wider">
                Total Recaudado Neto
              </span>
              <div className="w-8 h-8 rounded-lg bg-emerald-100 text-emerald-800 flex items-center justify-center font-bold">
                <DollarSign className="w-4 h-4" />
              </div>
            </div>
            <div className="mt-2 flex items-baseline gap-1">
              <span className="text-2xl font-black text-emerald-950">
                ${Number(cashCloseSummary.total_valid_amount || 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              </span>
              <span className="text-xs font-bold text-emerald-700">USD</span>
            </div>
            <p className="text-[11px] font-medium text-emerald-700 mt-1 flex items-center gap-1">
              <CheckCircle2 className="w-3.5 h-3.5" />
              <span>{cashCloseSummary.valid_count || 0} comprobante(s) válidos</span>
            </p>
          </div>

          {/* 2. Efectivo en Caja */}
          <div className="bg-blue-50/60 rounded-xl border border-blue-200/80 p-4 shadow-2xs">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-bold text-blue-800 uppercase tracking-wider">
                Efectivo en Caja
              </span>
              <div className="w-8 h-8 rounded-lg bg-blue-100 text-blue-800 flex items-center justify-center font-bold">
                <Wallet className="w-4 h-4" />
              </div>
            </div>
            <div className="mt-2 flex items-baseline gap-1">
              <span className="text-2xl font-black text-blue-950">
                ${Number(cashCloseSummary.total_cash || 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              </span>
              <span className="text-xs font-bold text-blue-700">USD</span>
            </div>
            <p className="text-[11px] font-medium text-blue-700 mt-1 flex items-center gap-1">
              <Clock className="w-3.5 h-3.5" />
              <span>{cashCloseSummary.cash_count || 0} pago(s) en físico</span>
            </p>
          </div>

          {/* 3. Transferencias / Bancos */}
          <div className="bg-purple-50/60 rounded-xl border border-purple-200/80 p-4 shadow-2xs">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-bold text-purple-800 uppercase tracking-wider">
                Transferencias / Bancos
              </span>
              <div className="w-8 h-8 rounded-lg bg-purple-100 text-purple-800 flex items-center justify-center font-bold">
                <Landmark className="w-4 h-4" />
              </div>
            </div>
            <div className="mt-2 flex items-baseline gap-1">
              <span className="text-2xl font-black text-purple-950">
                ${Number(cashCloseSummary.total_transfer || 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              </span>
              <span className="text-xs font-bold text-purple-700">USD</span>
            </div>
            <p className="text-[11px] font-medium text-purple-700 mt-1 flex items-center gap-1">
              <FileCheck className="w-3.5 h-3.5" />
              <span>{cashCloseSummary.transfer_count || 0} depósito(s) bancarios</span>
            </p>
          </div>

          {/* 4. Recibos Anulados */}
          <div className="bg-rose-50/60 rounded-xl border border-rose-200/80 p-4 shadow-2xs">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-bold text-rose-800 uppercase tracking-wider">
                Recibos Anulados
              </span>
              <div className="w-8 h-8 rounded-lg bg-rose-100 text-rose-800 flex items-center justify-center font-bold">
                <Ban className="w-4 h-4" />
              </div>
            </div>
            <div className="mt-2 flex items-baseline gap-1">
              <span className="text-2xl font-black text-rose-950">
                ${Number(cashCloseSummary.voided_amount || 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              </span>
              <span className="text-xs font-bold text-rose-700">USD</span>
            </div>
            <p className="text-[11px] font-medium text-rose-700 mt-1 flex items-center gap-1">
              <AlertTriangle className="w-3.5 h-3.5" />
              <span>{cashCloseSummary.voided_count || 0} comprobante(s) anulados</span>
            </p>
          </div>
        </div>

        {/* Barra de Filtros Avanzada: Fechas, Método, Estado, Proyecto y Buscador */}
        <div className="space-y-3 pt-2">
          {/* Fila 1: Filtro de Fechas y Accesos Rápidos */}
          <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3 bg-slate-50 p-3 rounded-xl border border-slate-200/90">
            <div className="flex items-center gap-2 flex-wrap">
              <div className="flex items-center gap-1.5 text-xs text-slate-700 font-bold">
                <Calendar className="w-4 h-4 text-slate-500" />
                <span>Fecha:</span>
              </div>
              <div className="flex items-center gap-1.5">
                <input
                  type="date"
                  value={startDate}
                  onChange={(e) => setStartDate(e.target.value)}
                  className="px-2.5 py-1.5 rounded-lg border border-slate-300 bg-white text-xs font-medium text-slate-800 focus:outline-none focus:ring-1 focus:ring-slate-900"
                  title="Fecha Desde"
                />
                <span className="text-xs text-slate-400 font-bold">a</span>
                <input
                  type="date"
                  value={endDate}
                  onChange={(e) => setEndDate(e.target.value)}
                  className="px-2.5 py-1.5 rounded-lg border border-slate-300 bg-white text-xs font-medium text-slate-800 focus:outline-none focus:ring-1 focus:ring-slate-900"
                  title="Fecha Hasta"
                />
              </div>

              {/* Botones de Selección Rápida */}
              <button
                type="button"
                onClick={setFilterToday}
                className="px-2.5 py-1.5 rounded-lg text-xs font-bold bg-white border border-slate-200 text-slate-700 hover:bg-slate-100 transition shadow-2xs cursor-pointer"
              >
                Hoy
              </button>
              <button
                type="button"
                onClick={setFilterThisMonth}
                className="px-2.5 py-1.5 rounded-lg text-xs font-bold bg-white border border-slate-200 text-slate-700 hover:bg-slate-100 transition shadow-2xs cursor-pointer"
              >
                Este Mes
              </button>
              {(startDate || endDate) && (
                <button
                  type="button"
                  onClick={clearDateFilters}
                  className="text-xs font-bold text-rose-600 hover:text-rose-800 underline cursor-pointer ml-1"
                >
                  Ver Todo
                </button>
              )}
            </div>

            {/* Selectores de Método de Pago y Estado */}
            <div className="flex items-center gap-2 flex-wrap">
              <select
                value={paymentMethod}
                onChange={(e) => setPaymentMethod(e.target.value)}
                className="px-3 py-1.5 rounded-lg border border-slate-300 bg-white text-xs font-semibold text-slate-800 focus:outline-none focus:ring-1 focus:ring-slate-900 cursor-pointer shadow-2xs"
              >
                <option value="">Todos los Métodos</option>
                <option value="Efectivo">Efectivo en Caja</option>
                <option value="Transferencia">Transferencia Bancaria</option>
                <option value="Depósito">Depósito en Cuenta</option>
              </select>

              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                className="px-3 py-1.5 rounded-lg border border-slate-300 bg-white text-xs font-semibold text-slate-800 focus:outline-none focus:ring-1 focus:ring-slate-900 cursor-pointer shadow-2xs"
              >
                <option value="">Todos los Estados</option>
                <option value="Válido">Solo Válidos</option>
                <option value="Anulado">Solo Anulados</option>
              </select>
            </div>
          </div>

          {/* Fila 2: Filtro por Proyecto y Buscador */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            {/* Filtro por Proyecto */}
            <div className="relative">
              <Filter className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
              <select
                value={selectedProject}
                onChange={(e) => setSelectedProject(e.target.value)}
                className="w-full pl-9 pr-4 py-2 rounded-md border border-slate-200 bg-slate-50 focus:bg-white text-xs sm:text-sm text-slate-800 focus:outline-none focus:ring-1 focus:ring-slate-900 focus:border-slate-400 transition cursor-pointer"
              >
                <option value="">Todos los Proyectos</option>
                {projectsList.map((p) => (
                  <option key={p.id} value={p.nombre || p.name}>
                    {p.nombre || p.name}
                  </option>
                ))}
              </select>
            </div>

            {/* Buscador por comprobante o cliente */}
            <div className="relative sm:col-span-2">
              <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
              <input
                type="text"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                placeholder="Buscar por N° comprobante (ej. REC-00001) o nombre del cliente..."
                className="w-full pl-9 pr-4 py-2 rounded-md border border-slate-200 bg-slate-50 focus:bg-white text-xs sm:text-sm text-slate-800 focus:outline-none focus:ring-1 focus:ring-slate-900 focus:border-slate-400 transition"
              />
            </div>
          </div>
        </div>
      </div>

      {/* Tabla Profesional de Recibos */}
      <div className="bg-white rounded-lg border border-slate-200 shadow-xs overflow-hidden">
        {loading ? (
          <div className="py-24 flex flex-col items-center justify-center gap-3 text-slate-400">
            <Loader2 className="w-7 h-7 animate-spin text-slate-600" />
            <p className="text-xs font-medium text-slate-500">Cargando comprobantes de recaudación...</p>
          </div>
        ) : payments.length === 0 ? (
          <div className="py-20 text-center text-slate-400 p-8 space-y-2">
            <FileCheck className="w-10 h-10 text-slate-300 mx-auto" />
            <h3 className="text-sm font-semibold text-slate-700">
              No se encontraron comprobantes registrados
            </h3>
            <p className="text-xs text-slate-400 max-w-sm mx-auto">
              Aún no hay recibos emitidos con los criterios de búsqueda actuales.
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-xs sm:text-sm">
              <thead>
                <tr className="bg-slate-50/80 border-b border-slate-200 text-slate-600 font-semibold uppercase tracking-wider text-[11px]">
                  <th className="py-3 px-4">N° Comprobante</th>
                  <th className="py-3 px-4">Estado</th>
                  <th className="py-3 px-4">Fecha y Hora</th>
                  <th className="py-3 px-4">Cliente</th>
                  <th className="py-3 px-4">Proyecto y Lote</th>
                  <th className="py-3 px-4">Método y Monto</th>
                  <th className="py-3 px-4 text-center">Acciones</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {payments.map((p) => {
                  const isVoided = p.status === 'Anulado';

                  return (
                    <tr
                      key={p.id}
                      className={`hover:bg-slate-50/70 transition duration-150 ${
                        isVoided ? 'bg-rose-50/30' : ''
                      }`}
                    >
                      {/* N° Comprobante y Recibera */}
                      <td className="py-3 px-4 whitespace-nowrap">
                        <div className="flex flex-col gap-1 items-start">
                          <span
                            className={`inline-flex items-center px-2 py-0.5 rounded-md font-mono font-bold text-xs ${
                              isVoided
                                ? 'bg-rose-100 text-rose-800 border border-rose-200'
                                : 'bg-slate-900 text-slate-100'
                            }`}
                          >
                            {p.receipt_code || p.receipt_number}
                          </span>
                          {p.receipt_book && (
                            <span
                              className={`text-[9px] font-bold px-1.5 py-0.2 rounded border ${
                                p.receipt_book === 'GERENCIA'
                                  ? 'bg-slate-100 text-slate-800 border-slate-300'
                                  : p.receipt_book === 'ADMINISTRACION'
                                  ? 'bg-indigo-50 text-indigo-800 border-indigo-200'
                                  : p.receipt_book === 'TOPOGRAFIA'
                                  ? 'bg-cyan-50 text-cyan-800 border-cyan-200'
                                  : 'bg-teal-50 text-teal-800 border-teal-200'
                              }`}
                            >
                              {p.receipt_book === 'ADMINISTRACION'
                                ? 'ADMIN'
                                : p.receipt_book === 'TOPOGRAFIA'
                                ? 'TOPOGRAFÍA'
                                : p.receipt_book}
                            </span>
                          )}
                        </div>
                      </td>

                      {/* Estado: Badge Válido o Anulado */}
                      <td className="py-3 px-4 whitespace-nowrap">
                        {isVoided ? (
                          <div>
                            <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-bold bg-rose-100 text-rose-800 border border-rose-200 shadow-2xs">
                              <span className="w-1.5 h-1.5 rounded-full bg-rose-600"></span>
                              Anulado
                            </span>
                            {p.voided_at && (
                              <p className="text-[10px] text-rose-600/80 mt-0.5 font-medium">
                                {p.voided_at}
                              </p>
                            )}
                          </div>
                        ) : (
                          <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-bold bg-emerald-50 text-emerald-700 border border-emerald-200 shadow-2xs">
                            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500"></span>
                            Válido
                          </span>
                        )}
                      </td>

                      {/* Fecha y Hora */}
                      <td className="py-3 px-4 whitespace-nowrap">
                        <div className="text-slate-900 font-medium">{p.date}</div>
                        <div className="flex items-center gap-1 text-[11px] text-slate-400 mt-0.5">
                          <Clock className="w-3 h-3 text-slate-400" />
                          <span>{p.time}</span>
                        </div>
                      </td>

                      {/* Cliente */}
                      <td className="py-3 px-4">
                        <div className="font-semibold text-slate-900">{p.customer_name}</div>
                        <div className="text-[11px] text-slate-400 font-mono">
                          C.I: {p.customer_id_card || 'S/N'}
                        </div>
                      </td>

                      {/* Concepto / Proyecto y Lote */}
                      <td className="py-3 px-4">
                        {p.project_slug ? (
                          <button
                            type="button"
                            onClick={() => navigate(`/proyectos/${p.project_slug}/clientes`)}
                            className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-slate-100 hover:bg-slate-200 text-slate-800 border border-slate-200 transition text-xs font-medium cursor-pointer text-left"
                          >
                            <Building2 className="w-3 h-3 text-slate-600 shrink-0" />
                            <span className="font-medium">{p.project_name}</span>
                            {p.lot_number && <span className="text-slate-500">• {p.lot_number}</span>}
                          </button>
                        ) : (
                          <div className="text-slate-700 font-medium text-xs">
                            {p.project_name || 'Vende & más'}
                          </div>
                        )}
                        {p.concept_detail && (
                          <div className="text-[11px] text-slate-500 mt-0.5 truncate max-w-xs" title={p.concept_detail}>
                            📝 {p.concept_detail}
                          </div>
                        )}
                      </td>

                      {/* Método y Monto (Tachado si está anulado) */}
                      <td className="py-3 px-4 whitespace-nowrap">
                        {isVoided ? (
                          <div>
                            <div className="text-rose-500 font-bold text-sm line-through">
                              ${Number(p.amount_paid).toLocaleString('en-US', { minimumFractionDigits: 2 })}
                            </div>
                            <div
                              className="text-[11px] text-rose-700 font-semibold max-w-[220px] truncate"
                              title={`Motivo: ${p.void_reason || 'Sin motivo especificado'}`}
                            >
                              Motivo: {p.void_reason || 'No especificado'}
                            </div>
                            <div className="text-[10px] text-slate-400 mt-0.5">
                              {p.payment_method}
                            </div>
                          </div>
                        ) : (
                          <div>
                            <div className="text-slate-900 font-bold text-sm">
                              ${Number(p.amount_paid).toLocaleString('en-US', { minimumFractionDigits: 2 })}
                            </div>
                            <div className="text-[11px] text-slate-500 font-medium">
                              {p.payment_method}
                            </div>
                            {p.bank_reference && (
                              <div className="text-[10px] font-mono font-bold text-indigo-700 bg-indigo-50 px-1.5 py-0.5 rounded border border-indigo-200 mt-0.5 w-fit" title={`Ref: ${p.bank_reference}`}>
                                Ref: {p.bank_reference}
                              </div>
                            )}
                          </div>
                        )}
                      </td>

                      {/* Acciones: Ver PDF, Descargar, WhatsApp Cliente, WhatsApp CEO, Correo y Anular */}
                      <td className="py-3 px-4 whitespace-nowrap text-center">
                        <div className="inline-flex items-center gap-1.5">
                          {/* Ver PDF */}
                          <a
                            href={`http://${window.location.hostname}:8000/api/payments/${p.id}/pdf?token=${encodeURIComponent(localStorage.getItem('auth_token') || '')}`}
                            target="_blank"
                            rel="noreferrer"
                            className="inline-flex items-center gap-1 px-2 py-1.5 rounded-md text-xs font-medium text-slate-700 bg-white hover:bg-slate-50 transition cursor-pointer shadow-xs border border-slate-300"
                            title="Ver Comprobante PDF"
                          >
                            <Eye className="w-3.5 h-3.5 text-slate-600" />
                            <span className="hidden lg:inline text-[11px]">Ver</span>
                          </a>

                          {/* Descargar */}
                          <a
                            href={`http://${window.location.hostname}:8000/api/payments/${p.id}/pdf?token=${encodeURIComponent(localStorage.getItem('auth_token') || '')}`}
                            download={`Recibo_${p.receipt_number}.pdf`}
                            target="_blank"
                            rel="noreferrer"
                            className="inline-flex items-center gap-1 px-2 py-1.5 rounded-md text-xs font-medium text-white bg-slate-900 hover:bg-slate-800 transition cursor-pointer shadow-xs"
                            title="Descargar Comprobante PDF"
                          >
                            <Download className="w-3.5 h-3.5" />
                          </a>

                          {/* Ícono Directo: WhatsApp Cliente */}
                          {!isVoided && (
                            <button
                              type="button"
                              onClick={() => handleSendWhatsAppCustomer(p)}
                              className="inline-flex items-center gap-1 px-2 py-1.5 rounded-md text-xs font-bold text-emerald-800 bg-emerald-50 hover:bg-emerald-100 border border-emerald-300 transition cursor-pointer shadow-2xs"
                              title={`Enviar comprobante por WhatsApp al Cliente (${p.customer_phone || 'Sin cel'})`}
                            >
                              <MessageCircle className="w-3.5 h-3.5 text-emerald-600" />
                              <span className="hidden xl:inline text-[11px]">Cliente</span>
                            </button>
                          )}

                          {/* Ícono Directo: WhatsApp CEO */}
                          {!isVoided && (
                            <button
                              type="button"
                              onClick={() => handleSendWhatsAppCeo(p)}
                              className="inline-flex items-center gap-1 px-2 py-1.5 rounded-md text-xs font-bold text-emerald-950 bg-emerald-100 hover:bg-emerald-200 border border-emerald-400 transition cursor-pointer shadow-2xs"
                              title="Reportar cobro por WhatsApp al CEO"
                            >
                              <MessageCircle className="w-3.5 h-3.5 text-emerald-800" />
                              <span className="hidden xl:inline text-[11px]">CEO</span>
                            </button>
                          )}

                          {/* Botón Anular (Exclusivo Super Admin para recibos Válidos) */}
                          {isSuperAdmin && !isVoided && (
                            <button
                              type="button"
                              onClick={() => handleOpenVoidModal(p)}
                              className="inline-flex items-center gap-1 px-2 py-1.5 rounded-md text-xs font-semibold text-rose-700 bg-rose-50 hover:bg-rose-100 border border-rose-200 transition cursor-pointer shadow-xs"
                              title="Anular formalmente este comprobante"
                            >
                              <Ban className="w-3.5 h-3.5 text-rose-600" />
                              <span className="hidden lg:inline text-[11px]">Anular</span>
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}

        {/* Paginación */}
        {pagination.total > 0 && (
          <div className="p-4 border-t border-slate-100 flex flex-col sm:flex-row items-center justify-between gap-3 text-xs text-slate-500 bg-slate-50/50">
            <span>
              Mostrando {pagination.from || 0} a {pagination.to || 0} de {pagination.total || 0} comprobantes
            </span>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => fetchPayments(pagination.current_page - 1)}
                disabled={pagination.current_page <= 1}
                className="inline-flex items-center gap-1 px-3 py-1.5 rounded-md border border-slate-200 bg-white text-slate-700 hover:bg-slate-50 disabled:opacity-40 disabled:cursor-not-allowed transition font-medium cursor-pointer shadow-xs"
              >
                <ChevronLeft className="w-3.5 h-3.5" />
                <span>Anterior</span>
              </button>

              <span className="font-semibold text-slate-700 px-2">
                Pág. {pagination.current_page} de {pagination.last_page}
              </span>

              <button
                type="button"
                onClick={() => fetchPayments(pagination.current_page + 1)}
                disabled={pagination.current_page >= pagination.last_page}
                className="inline-flex items-center gap-1 px-3 py-1.5 rounded-md border border-slate-200 bg-white text-slate-700 hover:bg-slate-50 disabled:opacity-40 disabled:cursor-not-allowed transition font-medium cursor-pointer shadow-xs"
              >
                <span>Siguiente</span>
                <ChevronRight className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>
        )}
      </div>

      {/* ================= MODAL FORMAL DE ANULACIÓN DE COMPROBANTE ================= */}
      {voidModalOpen && selectedPaymentForVoid && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center z-50 p-4 animate-fade-in">
          <div className="bg-white rounded-lg w-full max-w-lg p-6 shadow-xl border border-slate-200 transition-all">
            <div className="flex items-center justify-between border-b border-slate-100 pb-4 mb-4">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-lg bg-rose-50 border border-rose-200 text-rose-600 flex items-center justify-center shrink-0">
                  <ShieldAlert className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-slate-900">
                    Anular Comprobante Contable
                  </h3>
                  <p className="text-xs text-slate-500">
                    Facultad exclusiva de Auditoría y Super Administración
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setVoidModalOpen(false)}
                className="p-1 rounded-md text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Aviso informativo */}
            <div className="bg-amber-50 border border-amber-200 rounded-lg p-3.5 mb-4 text-xs text-amber-900 flex items-start gap-2.5">
              <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
              <div>
                <span className="font-bold block">Acción con impacto contable:</span>
                Esta anulación mantendrá el correlativo contable del comprobante en PostgreSQL, pero revertirá el abono en caja y restaurará el saldo adeudado del lote automáticamente.
              </div>
            </div>

            {/* Ficha Resumen del Recibo */}
            <div className="bg-slate-50 rounded-lg p-3.5 border border-slate-200 mb-4 text-xs space-y-1.5">
              <div className="flex justify-between items-center">
                <span className="text-slate-500 font-medium">Comprobante:</span>
                <span className="font-mono font-bold text-slate-900 bg-white px-2 py-0.5 rounded border border-slate-200">
                  {selectedPaymentForVoid.receipt_number}
                </span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-slate-500 font-medium">Cliente:</span>
                <span className="font-bold text-slate-900">{selectedPaymentForVoid.customer_name}</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-slate-500 font-medium">Proyecto y Lote:</span>
                <span className="font-medium text-slate-800">
                  {selectedPaymentForVoid.project_name} • {selectedPaymentForVoid.lot_number}
                </span>
              </div>
              <div className="flex justify-between items-center pt-1 border-t border-slate-200">
                <span className="text-slate-600 font-bold">Monto a revertir:</span>
                <span className="text-rose-600 font-extrabold text-sm">
                  ${Number(selectedPaymentForVoid.amount_paid).toLocaleString('en-US', { minimumFractionDigits: 2 })} USD
                </span>
              </div>
            </div>

            {/* Formulario con Motivo Obligatorio */}
            <form onSubmit={handleConfirmVoid} className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                  Motivo formal de anulación <span className="text-rose-600">*</span>
                </label>
                <textarea
                  rows="3"
                  value={voidReason}
                  onChange={(e) => setVoidReason(e.target.value)}
                  placeholder="Escriba la justificación contable (ej. Error en digitación del valor pagado, cheque rechazado, etc.)..."
                  required
                  className="w-full px-3.5 py-2.5 rounded-lg border border-slate-200 bg-slate-50 focus:bg-white text-xs sm:text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-rose-500 focus:border-transparent transition"
                />
                <p className="text-[11px] text-slate-400 mt-1">
                  Mínimo 5 caracteres. Este motivo quedará registrado en la Auditoría del Sistema y visible en el PDF anulado.
                </p>
              </div>

              {voidError && (
                <div className="bg-rose-50 text-rose-700 p-2.5 rounded-lg border border-rose-200 text-xs font-semibold">
                  {voidError}
                </div>
              )}

              {/* Botones de acción */}
              <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setVoidModalOpen(false)}
                  disabled={voidSubmitting}
                  className="px-4 py-2 text-xs font-medium text-slate-600 hover:text-slate-800 hover:bg-slate-100 rounded-md transition cursor-pointer"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={voidSubmitting || voidReason.trim().length < 5}
                  className="inline-flex items-center gap-2 px-5 py-2 text-xs font-medium text-white bg-rose-600 hover:bg-rose-700 active:bg-rose-800 rounded-md shadow-xs transition cursor-pointer disabled:opacity-50"
                >
                  {voidSubmitting && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                  <Ban className="w-3.5 h-3.5" />
                  <span>{voidSubmitting ? 'Anulando...' : 'Confirmar Anulación Contable'}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ── Modal de Cobro Directo Universal ─────────────────────────────── */}
      {directModalOpen && (
        <DirectPaymentModal
          onClose={() => {
            setDirectModalOpen(false);
            navigate('/recibos', { replace: true });
          }}
          onSuccess={() => {
            fetchPayments(1);
          }}
        />
      )}
    </div>
  );
}
