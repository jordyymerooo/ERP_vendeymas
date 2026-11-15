import useSingleSubmit from '../hooks/useSingleSubmit';
import ActionButton from '../components/ActionButton';
import { receiptPdfUrl } from '../utils/receiptPdfUrl';
import React, { useState, useEffect, useRef } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import axios from 'axios';
import SignaturePadField from '../components/SignaturePadField';
import EmitterSignaturePreview from '../components/EmitterSignaturePreview';
import {
  Compass,
  Plus,
  Search,
  Filter,
  CheckCircle,
  Clock,
  HardHat,
  FileCheck,
  DollarSign,
  User,
  Phone,
  MapPin,
  Maximize2,
  Trash2,
  Edit3,
  Loader2,
  AlertCircle,
  X,
  CreditCard,
  FileText,
  Layers,
  Sparkles,
  MessageCircle,
  Download,
  ExternalLink,
} from 'lucide-react';
import {
  DEFAULT_CEO_PHONE,
  openWhatsApp,
  buildPaymentCustomerWhatsAppMessage,
  buildPaymentCeoWhatsAppMessage,
} from '../utils/whatsapp';

const API_BASE = '/api/topography-jobs';

const SERVICE_TYPES = [
  'Levantamiento Planimétrico',
  'Replanteo de Linderos',
  'Lotización / Fraccionamiento',
  'Medición con GPS / Estación Total',
  'Curvas de Nivel / Altimetría',
  'Deslinde y Amojonamiento',
  'Otros Servicios Topográficos',
];

const STATUS_OPTIONS = [
  { value: 'Pendiente', label: 'Pendiente', color: 'bg-amber-50 text-amber-700 border-amber-200' },
  { value: 'En Campo', label: 'En Campo', color: 'bg-blue-50 text-blue-700 border-blue-200' },
  { value: 'En Planos (AutoCAD)', label: 'En Planos (AutoCAD)', color: 'bg-indigo-50 text-indigo-700 border-indigo-200' },
  { value: 'Entregado', label: 'Entregado', color: 'bg-emerald-50 text-emerald-700 border-emerald-200' },
];

export default function Topografia({ openCobroModal = false }) {
  const navigate = useNavigate();
  const location = useLocation();

  const [jobs, setJobs] = useState([]);
  const [stats, setStats] = useState({
    total_jobs: 0,
    pending: 0,
    in_field: 0,
    in_progress: 0,
    in_cad: 0,
    completed: 0,
    total_revenue: 0,
    total_collected: 0,
    total_pending: 0,
  });
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');

  // Modales
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [isPaymentModalOpen, setIsPaymentModalOpen] = useState(
    () => openCobroModal || (typeof window !== 'undefined' && window.location.pathname === '/topografia/cobro')
  );
  const [selectedJobForPayment, setSelectedJobForPayment] = useState(null);
  const [selectedJobId, setSelectedJobId] = useState(''); // '' para Cobro Libre / Solicitante Directo
  const [freeClientName, setFreeClientName] = useState('');
  const [freeClientPhone, setFreeClientPhone] = useState('');
  const [paymentAmount, setPaymentAmount] = useState('');
  const [paymentMethod, setPaymentMethod] = useState('Transferencia Bancaria');
  const [bankReference, setBankReference] = useState('');
  const [conceptDetail, setConceptDetail] = useState('');
  const [paymentSuccessModal, setPaymentSuccessModal] = useState(null);
  const sigCanvasRef = useRef(null);

  const isBankMethod = paymentMethod === 'Transferencia Bancaria' || paymentMethod === 'Depósito' || paymentMethod?.toLowerCase().includes('transferencia') || paymentMethod?.toLowerCase().includes('depósito') || paymentMethod?.toLowerCase().includes('deposito');

  // Detección automática de la ruta directa /topografia/cobro
  useEffect(() => {
    if (openCobroModal || location.pathname === '/topografia/cobro') {
      setIsPaymentModalOpen(true);
    }
  }, [openCobroModal, location.pathname]);

  const handleClosePaymentModal = () => {
    setIsPaymentModalOpen(false);
    setSelectedJobForPayment(null);
    setSelectedJobId('');
    setFreeClientName('');
    setFreeClientPhone('');
    setPaymentAmount('');
    setConceptDetail('');
    setBankReference('');
    if (sigCanvasRef.current) sigCanvasRef.current.clear();
    if (location.pathname === '/topografia/cobro') {
      navigate('/topografia');
    }
  };

  const handleCloseSuccessModal = () => {
    setPaymentSuccessModal(null);
    if (location.pathname === '/topografia/cobro') navigate('/topografia');
  };

  const handleNewPayment = () => {
    setPaymentSuccessModal(null);
    setSelectedJobForPayment(null);
    setSelectedJobId('');
    setFreeClientName('');
    setFreeClientPhone('');
    setPaymentAmount('');
    setConceptDetail('');
    setBankReference('');
    setIsPaymentModalOpen(true);
  };

  const handleJobSelectChange = (jobId) => {
    setSelectedJobId(jobId);
    if (!jobId || jobId === 'DIRECT') {
      setSelectedJobForPayment(null);
      setConceptDetail('');
      setPaymentAmount('');
    } else {
      const found = jobs.find((j) => String(j.id) === String(jobId));
      if (found) {
        setSelectedJobForPayment(found);
        setConceptDetail(`Servicio Topográfico: ${found.service_type}`);
        const pending = found.pending_balance ?? Math.max(0, (found.cost || 0) - (found.amount_paid || 0));
        if (pending > 0) {
          setPaymentAmount(String(pending));
        }
      }
    }
  };

  // Formulario de Creación
  const [formData, setFormData] = useState({
    client_name: '',
    client_phone: '',
    service_type: SERVICE_TYPES[0],
    location: '',
    area_m2: '',
    cost: '',
    amount_paid: '0',
    status: 'Pendiente',
    notes: '',
  });

  const [submitting, setSubmitting] = useState(false);
  const [toastMessage, setToastMessage] = useState(null);

  // Cargar trabajos y métricas reales
  const fetchJobs = async () => {
    setLoading(true);
    try {
      const params = {};
      if (statusFilter !== 'all') params.status = statusFilter;
      if (searchTerm.trim()) params.search = searchTerm.trim();

      const res = await axios.get(API_BASE, { params });
      setJobs(res.data.data || []);
      if (res.data.stats) {
        setStats(res.data.stats);
      }
    } catch (err) {
      console.error('Error al cargar trabajos topográficos:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchJobs();
  }, [statusFilter, searchTerm]);

  // Toast temporizador
  const showToast = (msg) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 4000);
  };

  // Guardar nuevo trabajo técnico
  const [handleCreateSubmit, handleCreateSubmitPending] = useSingleSubmit(async (e) => {
    if (!formData.client_name || !formData.service_type || !formData.location || !formData.cost) {
      alert('Por favor completa todos los campos requeridos (*).');
      return;
    }

    setSubmitting(true);
    try {
      const res = await axios.post(API_BASE, {
        ...formData,
        cost: Number(formData.cost),
        area_m2: formData.area_m2 ? Number(formData.area_m2) : null,
        amount_paid: formData.amount_paid ? Number(formData.amount_paid) : 0,
      });

      showToast(res.data.message || 'Trabajo topográfico registrado con éxito.');
      setIsCreateModalOpen(false);
      setFormData({
        client_name: '',
        client_phone: '',
        service_type: SERVICE_TYPES[0],
        location: '',
        area_m2: '',
        cost: '',
        amount_paid: '0',
        status: 'Pendiente',
        notes: '',
      });
      fetchJobs();
    } catch (err) {
      if (err?.isDuplicateBlocked) return;
      console.error('Error al registrar trabajo:', err);
      alert('Ocurrió un error al guardar el trabajo técnico.');
    } finally {
      setSubmitting(false);
    }
  }, { form: true });

  // Cambio directo de estado operativo
  const [handleStatusChange, handleStatusChangePending] = useSingleSubmit(async (jobId, newStatus) => {
    try {
      const res = await axios.put(`${API_BASE}/${jobId}`, { status: newStatus });
      showToast(`Estado actualizado a "${newStatus}".`);
      // Actualizar localmente para máxima reactividad
      setJobs((prev) =>
        prev.map((job) => (job.id === jobId ? { ...job, status: newStatus } : job))
      );
      fetchJobs();
    } catch (err) {
      if (err?.isDuplicateBlocked) return;
      console.error('Error al actualizar estado:', err);
      alert('Error al actualizar el estado en el servidor.');
    }
  });

  // Emitir Recibo Oficial de Topografía (TOP-XXXXX)
  const [handlePaymentSubmit, handlePaymentSubmitPending] = useSingleSubmit(async (e) => {
    const amount = Number(paymentAmount);
    if (!amount || amount <= 0) {
      alert('Por favor ingresa un monto válido mayor a 0.');
      return;
    }

    const isDirectClient = !selectedJobForPayment && (!selectedJobId || selectedJobId === 'DIRECT');
    if (isDirectClient && !freeClientName.trim()) {
      alert('Por favor ingresa el Nombre del Cliente / Solicitante.');
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

    setSubmitting(true);
    try {
      const activeJob = selectedJobForPayment || (selectedJobId && selectedJobId !== 'DIRECT' ? jobs.find(j => String(j.id) === String(selectedJobId)) : null);

      const payload = {
        amount_paid: amount,
        payment_method: paymentMethod,
        bank_reference: isBankMethod ? bankReference.trim() : null,
        concept_detail: conceptDetail || (activeJob ? `Servicio Topográfico: ${activeJob.service_type}` : 'Servicio Topográfico Oficial'),
        receipt_book: 'TOPOGRAFIA',
        customer_signature: firmaBase64,
      };

      if (activeJob?.id) {
        payload.topography_job_id = activeJob.id;
      } else {
        payload.client_name = freeClientName.trim();
        payload.client_phone = freeClientPhone.trim() || null;
      }

      const res = await axios.post('/api/payments', payload);

      const payment = res.data?.payment || res.data?.data;
      const receiptCode = payment?.receipt_code || ('TOP-' + String(payment?.id || '').padStart(5, '0'));

      let currentUserName = 'Topógrafo Autorizado';
      try {
        const u = JSON.parse(localStorage.getItem('user'));
        if (u?.name) currentUserName = u.name;
      } catch (e) {}

      const customerName = activeJob?.client_name || freeClientName.trim() || payment?.topographyJob?.client_name || 'Cliente';
      const customerPhone = activeJob?.client_phone || freeClientPhone.trim() || payment?.topographyJob?.client_phone || '';
      const conceptText = payload.concept_detail;

      const successData = {
        paymentId: payment?.id,
        receiptCode: receiptCode,
        receiptBook: 'TOPOGRAFIA',
        customerName: customerName,
        customerPhone: customerPhone,
        projectName: 'Servicios de Topografía',
        lotNumber: activeJob?.service_type || 'Trabajo Topográfico',
        concept: conceptText,
        amountPaid: amount,
        paymentMethod: paymentMethod,
        bankReference: payment?.bank_reference || (isBankMethod ? bankReference.trim() : null),
        debtBalance: payment?.debt_balance ?? Math.max(0, (activeJob?.cost || 0) - (activeJob?.amount_paid || 0) - amount),
        cashierName: currentUserName,
        dateTime: new Date().toLocaleString('es-EC', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' }),
        receiptUrl: `/api/payments/${payment?.id}/pdf`,
      };

      setPaymentSuccessModal(successData);
      showToast(`Recibo Topográfico emitido con éxito (${receiptCode}).`);
      setIsPaymentModalOpen(false);
      setSelectedJobForPayment(null);
      setSelectedJobId('');
      setFreeClientName('');
      setFreeClientPhone('');
      setPaymentAmount('');
      setConceptDetail('');
      setBankReference('');

      // Abrir PDF oficial al instante en nueva pestaña
      if (payment?.id) {
        window.open(`/api/payments/${payment.id}/pdf`, '_blank');
      }
      fetchJobs();
      window.dispatchEvent(new Event('paymentUpdated'));
      window.dispatchEvent(new Event('notifications-updated'));
    } catch (err) {
      if (err?.isDuplicateBlocked) return;
      console.error('Error al emitir recibo topográfico:', err);
      alert(err.response?.data?.message || 'No se pudo emitir el recibo de topografía.');
    } finally {
      setSubmitting(false);
    }
  }, { form: true });

  // Eliminar trabajo topográfico
  const [handleDeleteJob, handleDeleteJobPending] = useSingleSubmit(async (job) => {
    if (!window.confirm(`¿Estás seguro de eliminar el trabajo de "${job.client_name}"?`)) {
      return;
    }

    try {
      const res = await axios.delete(`${API_BASE}/${job.id}`);
      showToast(res.data.message || 'Registro eliminado.');
      fetchJobs();
    } catch (err) {
      if (err?.isDuplicateBlocked) return;
      console.error('Error al eliminar trabajo:', err);
      alert('Error al eliminar el registro.');
    }
  });

  return (
    <div className="space-y-6 animate-fade-in font-sans">
      {/* Toast Notificación */}
      {toastMessage && (
        <div className="bg-emerald-50 border border-emerald-200 text-emerald-800 p-4 rounded-xl flex items-center justify-between shadow-sm animate-fade-in">
          <div className="flex items-center gap-3">
            <CheckCircle className="w-5 h-5 text-emerald-600 shrink-0" />
            <p className="text-sm font-semibold">{toastMessage}</p>
          </div>
          <button
            type="button"
            onClick={() => setToastMessage(null)}
            className="text-xs font-semibold text-emerald-700 hover:text-emerald-900 underline cursor-pointer"
          >
            Cerrar
          </button>
        </div>
      )}

      {/* Cabecera Principal */}
      <div className="bg-white rounded-lg border border-slate-200 p-5 shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex items-center gap-3.5">
          <div className="w-10 h-10 rounded-lg bg-slate-100 flex items-center justify-center text-slate-700 border border-slate-200 shrink-0">
            <Compass className="w-5 h-5" />
          </div>
          <div>
            <h1 className="text-xl sm:text-2xl font-bold text-slate-900 tracking-tight">
              Gestión de Trabajos Topográficos
            </h1>
            <p className="text-xs sm:text-sm text-slate-500 mt-0.5">
              Control de levantamientos, replanteos, mediciones en campo y entrega de planos para Vende & Más.
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 shrink-0 flex-wrap">
          {/* Botón Cobro de Topografía */}
          <button
            type="button"
            onClick={() => navigate('/topografia/cobro')}
            className="inline-flex items-center justify-center gap-1.5 px-3.5 py-2 rounded-md font-bold text-emerald-800 bg-emerald-50 hover:bg-emerald-100 border border-emerald-300 transition text-xs sm:text-sm cursor-pointer shadow-xs"
          >
            <DollarSign className="w-4 h-4 text-emerald-700" />
            <span>Cobro Topografía (/cobro)</span>
          </button>

          {/* Botón Registrar Trabajo */}
          <button
            type="button"
            onClick={() => setIsCreateModalOpen(true)}
            className="inline-flex items-center justify-center gap-2 px-4 py-2 rounded-md font-medium text-white bg-slate-900 hover:bg-slate-800 active:bg-black transition text-xs sm:text-sm cursor-pointer shadow-xs"
          >
            <Plus className="w-4 h-4" />
            <span>Registrar Trabajo Topográfico</span>
          </button>
        </div>
      </div>

      {/* 4 Tarjetas de Resumen Superiores */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {/* Total Trabajos */}
        <button
          type="button"
          onClick={() => setStatusFilter('all')}
          className={`p-4 rounded-lg border transition-all text-left cursor-pointer flex flex-col justify-between ${
            statusFilter === 'all'
              ? 'bg-slate-900 text-white border-slate-900 shadow-xs'
              : 'bg-white border-slate-200 hover:border-slate-300 text-slate-900'
          }`}
        >
          <div className="flex items-center justify-between">
            <span className={`text-xs font-bold uppercase tracking-wider ${statusFilter === 'all' ? 'text-slate-400' : 'text-slate-400'}`}>
              Total Trabajos
            </span>
            <Layers className={`w-4 h-4 ${statusFilter === 'all' ? 'text-slate-200' : 'text-slate-400'}`} />
          </div>
          <div className="mt-3 flex items-baseline justify-between">
            <span className="text-2xl font-bold">{stats.total_jobs}</span>
            <span className={`text-[11px] font-semibold ${statusFilter === 'all' ? 'text-slate-300' : 'text-slate-500'}`}>
              ${Number(stats.total_revenue).toLocaleString()} USD
            </span>
          </div>
        </button>

        {/* En Campo / Pendientes */}
        <button
          type="button"
          onClick={() => setStatusFilter(statusFilter === 'En Campo / Pendientes' ? 'all' : 'En Campo / Pendientes')}
          className={`p-4 rounded-lg border transition-all text-left cursor-pointer flex flex-col justify-between ${
            statusFilter === 'En Campo / Pendientes'
              ? 'bg-amber-600 text-white border-amber-600 shadow-xs'
              : 'bg-white border-slate-200 hover:border-amber-300 text-slate-900'
          }`}
        >
          <div className="flex items-center justify-between">
            <span className={`text-xs font-bold uppercase tracking-wider ${statusFilter === 'En Campo / Pendientes' ? 'text-amber-100' : 'text-amber-600'}`}>
              En Campo / Pendientes
            </span>
            <HardHat className={`w-4 h-4 ${statusFilter === 'En Campo / Pendientes' ? 'text-white' : 'text-amber-500'}`} />
          </div>
          <div className="mt-3 flex items-baseline justify-between">
            <span className="text-2xl font-bold">{stats.in_progress}</span>
            <span className={`text-[11px] font-semibold ${statusFilter === 'En Campo / Pendientes' ? 'text-amber-100' : 'text-slate-500'}`}>
              {stats.pending} pend. / {stats.in_field} campo
            </span>
          </div>
        </button>

        {/* En Planos (AutoCAD) */}
        <button
          type="button"
          onClick={() => setStatusFilter(statusFilter === 'En Planos (AutoCAD)' ? 'all' : 'En Planos (AutoCAD)')}
          className={`p-4 rounded-lg border transition-all text-left cursor-pointer flex flex-col justify-between ${
            statusFilter === 'En Planos (AutoCAD)'
              ? 'bg-slate-800 text-white border-slate-800 shadow-xs'
              : 'bg-white border-slate-200 hover:border-slate-300 text-slate-900'
          }`}
        >
          <div className="flex items-center justify-between">
            <span className={`text-xs font-bold uppercase tracking-wider ${statusFilter === 'En Planos (AutoCAD)' ? 'text-slate-300' : 'text-slate-600'}`}>
              En Planos (AutoCAD)
            </span>
            <FileText className={`w-4 h-4 ${statusFilter === 'En Planos (AutoCAD)' ? 'text-white' : 'text-slate-500'}`} />
          </div>
          <div className="mt-3 flex items-baseline justify-between">
            <span className="text-2xl font-bold">{stats.in_cad}</span>
            <span className={`text-[11px] font-semibold ${statusFilter === 'En Planos (AutoCAD)' ? 'text-slate-300' : 'text-slate-500'}`}>
              En edición digital
            </span>
          </div>
        </button>

        {/* Entregados */}
        <button
          type="button"
          onClick={() => setStatusFilter(statusFilter === 'Entregado' ? 'all' : 'Entregado')}
          className={`p-4 rounded-lg border transition-all text-left cursor-pointer flex flex-col justify-between ${
            statusFilter === 'Entregado'
              ? 'bg-emerald-700 text-white border-emerald-700 shadow-xs'
              : 'bg-white border-slate-200 hover:border-emerald-300 text-slate-900'
          }`}
        >
          <div className="flex items-center justify-between">
            <span className={`text-xs font-bold uppercase tracking-wider ${statusFilter === 'Entregado' ? 'text-emerald-100' : 'text-emerald-700'}`}>
              Entregados
            </span>
            <FileCheck className={`w-4 h-4 ${statusFilter === 'Entregado' ? 'text-white' : 'text-emerald-600'}`} />
          </div>
          <div className="mt-3 flex items-baseline justify-between">
            <span className="text-2xl font-bold">{stats.completed}</span>
            <span className={`text-[11px] font-semibold ${statusFilter === 'Entregado' ? 'text-emerald-100' : 'text-slate-500'}`}>
              Servicios culminados
            </span>
          </div>
        </button>
      </div>

      {/* Barra de Filtros y Búsqueda */}
      <div className="bg-white p-4 rounded-lg border border-slate-200 shadow-xs flex flex-col sm:flex-row items-center justify-between gap-3">
        <div className="relative w-full sm:w-96">
          <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
          <input id="topografia-search" name="topografia_search"
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="Buscar por cliente, servicio o ubicación..."
            className="w-full pl-9 pr-4 py-2 text-xs sm:text-sm rounded-md border border-slate-200 bg-slate-50 focus:bg-white focus:outline-none focus:ring-1 focus:ring-slate-900 focus:border-slate-400 transition"
          />
        </div>

        <div className="flex items-center gap-2 self-end sm:self-auto">
          {statusFilter !== 'all' && (
            <button
              type="button"
              onClick={() => setStatusFilter('all')}
              className="text-xs text-slate-500 hover:text-slate-700 underline font-medium px-2 cursor-pointer"
            >
              Limpiar filtro ({statusFilter})
            </button>
          )}
          <span className="text-xs text-slate-500 font-medium">
            {jobs.length} {jobs.length === 1 ? 'trabajo' : 'trabajos'}
          </span>
        </div>
      </div>

      {/* Tabla Principal */}
      <div className="bg-white rounded-lg border border-slate-200 shadow-xs overflow-hidden">
        {loading ? (
          <div className="py-24 flex flex-col items-center justify-center gap-2 text-slate-400">
            <Loader2 className="w-7 h-7 animate-spin text-slate-600" />
            <span className="text-xs font-medium text-slate-500">Cargando trabajos topográficos...</span>
          </div>
        ) : jobs.length === 0 ? (
          /* Estado Vacío */
          <div className="py-20 px-4 text-center space-y-4">
            <div className="w-14 h-14 rounded-lg bg-slate-100 flex items-center justify-center text-slate-400 mx-auto border border-slate-200">
              <Compass className="w-7 h-7" />
            </div>
            <div className="space-y-1">
              <h3 className="text-base font-semibold text-slate-900">
                {searchTerm || statusFilter !== 'all'
                  ? 'No se encontraron trabajos con los filtros seleccionados'
                  : 'Aún no hay trabajos topográficos registrados'}
              </h3>
              <p className="text-xs text-slate-500 max-w-md mx-auto">
                {searchTerm || statusFilter !== 'all'
                  ? 'Prueba modificando la búsqueda o quitando el filtro de estado.'
                  : 'Registra el primer levantamiento, replanteo o medición topográfica para comenzar la gestión.'}
              </p>
            </div>
            {!searchTerm && statusFilter === 'all' && (
              <button
                type="button"
                onClick={() => setIsCreateModalOpen(true)}
                className="inline-flex items-center gap-2 px-4 py-2 rounded-md text-xs font-medium text-white bg-slate-900 hover:bg-slate-800 transition cursor-pointer shadow-xs"
              >
                <Plus className="w-4 h-4" />
                <span>Registrar Primer Trabajo</span>
              </button>
            )}
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="bg-slate-50/80 border-b border-slate-200 text-slate-500 font-extrabold uppercase tracking-wider text-[11px]">
                  <th className="py-3.5 px-4">Cliente / Solicitante</th>
                  <th className="py-3.5 px-4">Tipo de Trabajo</th>
                  <th className="py-3.5 px-4">Ubicación y Área</th>
                  <th className="py-3.5 px-4">Costo / Saldo</th>
                  <th className="py-3.5 px-4">Estado Operativo</th>
                  <th className="py-3.5 px-4 text-right">Acciones</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {jobs.map((job) => {
                  const pendingBalance = job.pending_balance ?? Math.max(0, job.cost - job.amount_paid);
                  const isPaidFull = pendingBalance <= 0;

                  return (
                    <tr key={job.id} className="hover:bg-slate-50/60 transition-colors">
                      {/* Cliente */}
                      <td className="py-3.5 px-4">
                        <div className="font-bold text-slate-900 text-sm">{job.client_name}</div>
                        {job.client_phone ? (
                          <div className="flex items-center gap-1 text-[11px] text-slate-500 mt-0.5">
                            <Phone className="w-3 h-3 text-slate-400" />
                            <span>{job.client_phone}</span>
                          </div>
                        ) : (
                          <span className="text-[10px] text-slate-400 italic">Sin teléfono registrado</span>
                        )}
                      </td>

                      {/* Tipo de Trabajo */}
                      <td className="py-3.5 px-4">
                        <span className="inline-block px-2.5 py-1 rounded-lg text-xs font-bold bg-cyan-50 text-cyan-800 border border-cyan-200">
                          {job.service_type}
                        </span>
                        {job.notes && (
                          <div className="text-[11px] text-slate-500 mt-1 max-w-xs truncate" title={job.notes}>
                            📝 {job.notes}
                          </div>
                        )}
                      </td>

                      {/* Ubicación y Área */}
                      <td className="py-3.5 px-4">
                        <div className="flex items-center gap-1.5 font-medium text-slate-800">
                          <MapPin className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                          <span>{job.location}</span>
                        </div>
                        <div className="text-[11px] text-slate-500 mt-0.5">
                          {job.area_m2 ? (
                            <span>Área: <b>{Number(job.area_m2).toLocaleString()} m²</b></span>
                          ) : (
                            <span className="text-slate-400">Área no especificada</span>
                          )}
                        </div>
                      </td>

                      {/* Costo / Saldo */}
                      <td className="py-3.5 px-4">
                        <div className="font-extrabold text-slate-900">
                          ${Number(job.cost).toLocaleString()} USD
                        </div>
                        <div className="text-[11px] mt-0.5">
                          <span className="text-slate-500">Abono: ${Number(job.amount_paid).toLocaleString()}</span>
                          <span className="mx-1 text-slate-300">|</span>
                          {isPaidFull ? (
                            <span className="font-bold text-emerald-600">Saldado</span>
                          ) : (
                            <span className="font-bold text-amber-600">
                              Saldo: ${Number(pendingBalance).toLocaleString()}
                            </span>
                          )}
                        </div>
                      </td>

                      {/* Estado Operativo con Selector Directo */}
                      <td className="py-3.5 px-4">
                        <select id={`topografia-row-status-${job.id}`} name={`topografia_row_status_${job.id}`}
                          value={job.status}
                          onChange={(e) => handleStatusChange(job.id, e.target.value)}
                          disabled={handleStatusChangePending}
                          className={`text-xs font-extrabold px-3 py-1.5 rounded-xl border focus:outline-none focus:ring-2 focus:ring-cyan-500 cursor-pointer shadow-sm transition ${
                            job.status === 'Pendiente'
                              ? 'bg-amber-50 text-amber-800 border-amber-300'
                              : job.status === 'En Campo'
                              ? 'bg-blue-50 text-blue-800 border-blue-300'
                              : job.status === 'En Planos (AutoCAD)'
                              ? 'bg-indigo-50 text-indigo-800 border-indigo-300'
                              : 'bg-emerald-50 text-emerald-800 border-emerald-300'
                          }`}
                        >
                          {STATUS_OPTIONS.map((opt) => (
                            <option key={opt.value} value={opt.value} className="bg-white text-slate-800 font-semibold">
                              {opt.label}
                            </option>
                          ))}
                        </select>
                      </td>

                      {/* Acciones */}
                      <td className="py-3.5 px-4 text-right">
                        <div className="flex items-center justify-end gap-1.5">
                          {/* Botón Emitir Recibo Topográfico (TOP) */}
                          <button
                            type="button"
                            onClick={() => {
                              setSelectedJobForPayment(job);
                              setSelectedJobId(String(job.id));
                              setPaymentAmount('');
                              setConceptDetail(`Servicio Topográfico: ${job.service_type}`);
                              setPaymentMethod('Transferencia Bancaria');
                              setBankReference('');
                              setIsPaymentModalOpen(true);
                            }}
                            title="Emitir Recibo Topográfico (TOP)"
                            className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-md text-[11px] font-bold text-cyan-800 bg-cyan-50 hover:bg-cyan-100 border border-cyan-200 transition cursor-pointer shadow-xs"
                          >
                            <CreditCard className="w-3.5 h-3.5 text-cyan-700" />
                            <span>Emitir Recibo (TOP)</span>
                          </button>

                          {/* Botón Eliminar */}
                          <ActionButton loading={handleDeleteJobPending}
                            type="button"
                            onClick={() => handleDeleteJob(job)}
                            title="Eliminar Registro"
                            className="p-1.5 rounded-lg text-rose-600 hover:bg-rose-50 border border-transparent hover:border-rose-200 transition cursor-pointer"
                          >
                            <Trash2 className="w-4 h-4" />
                          </ActionButton>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* ========================================================================= */}
      {/* MODAL 1: REGISTRAR TRABAJO TOPOGRÁFICO */}
      {/* ========================================================================= */}
      {isCreateModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-fade-in">
          <div className="bg-white rounded-lg shadow-xl border border-slate-200 w-full max-w-xl overflow-hidden animate-scale-up">
            {/* Cabecera Modal */}
            <div className="flex items-center justify-between p-5 border-b border-slate-100 bg-slate-50/50">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-md bg-slate-100 flex items-center justify-center text-slate-700 border border-slate-200">
                  <Compass className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="font-bold text-base text-slate-900">
                    Registrar Trabajo Topográfico
                  </h3>
                  <p className="text-xs text-slate-500">
                    Registro técnico de levantamiento y planos
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setIsCreateModalOpen(false)}
                className="text-slate-400 hover:text-slate-600 p-1 rounded-lg"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Formulario */}
            <form onSubmit={handleCreateSubmit} className="p-5 space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {/* Nombre del Cliente */}
                <div>
                  <label htmlFor="topografia-client-name" className="block text-xs font-bold text-slate-700 mb-1">
                    Cliente / Solicitante *
                  </label>
                  <input id="topografia-client-name" name="topografia_client_name"
                    type="text"
                    required
                    value={formData.client_name}
                    onChange={(e) => setFormData({ ...formData, client_name: e.target.value })}
                    placeholder="Ej. Ing. Marco Vinces"
                    className="w-full px-3.5 py-2 text-xs rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-cyan-500"
                  />
                </div>

                {/* Teléfono */}
                <div>
                  <label htmlFor="topografia-client-phone" className="block text-xs font-bold text-slate-700 mb-1">
                    Teléfono / WhatsApp
                  </label>
                  <input id="topografia-client-phone" name="topografia_client_phone"
                    type="text"
                    value={formData.client_phone}
                    onChange={(e) => setFormData({ ...formData, client_phone: e.target.value })}
                    placeholder="Ej. 0987654321"
                    className="w-full px-3.5 py-2 text-xs rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-cyan-500"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {/* Tipo de Servicio */}
                <div>
                  <label htmlFor="topografia-service" className="block text-xs font-bold text-slate-700 mb-1">
                    Tipo de Servicio Topográfico *
                  </label>
                  <select id="topografia-service" name="topografia_service"
                    value={formData.service_type}
                    onChange={(e) => setFormData({ ...formData, service_type: e.target.value })}
                    className="w-full px-3.5 py-2 text-xs rounded-xl border border-slate-200 bg-white focus:outline-none focus:ring-2 focus:ring-cyan-500 cursor-pointer"
                  >
                    {SERVICE_TYPES.map((service) => (
                      <option key={service} value={service}>
                        {service}
                      </option>
                    ))}
                  </select>
                </div>

                {/* Estado Inicial */}
                <div>
                  <label htmlFor="topografia-status" className="block text-xs font-bold text-slate-700 mb-1">
                    Estado Operativo Inicial
                  </label>
                  <select id="topografia-status" name="topografia_status"
                    value={formData.status}
                    onChange={(e) => setFormData({ ...formData, status: e.target.value })}
                    className="w-full px-3.5 py-2 text-xs rounded-xl border border-slate-200 bg-white focus:outline-none focus:ring-2 focus:ring-cyan-500 cursor-pointer"
                  >
                    {STATUS_OPTIONS.map((opt) => (
                      <option key={opt.value} value={opt.value}>
                        {opt.label}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                {/* Ubicación del Terreno */}
                <div className="sm:col-span-2">
                  <label htmlFor="topografia-location" className="block text-xs font-bold text-slate-700 mb-1">
                    Ubicación / Sector del Terreno *
                  </label>
                  <input id="topografia-location" name="topografia_location"
                    type="text"
                    required
                    value={formData.location}
                    onChange={(e) => setFormData({ ...formData, location: e.target.value })}
                    placeholder="Ej. Sector San Mateo, Km 4.5 Vía Costanera"
                    className="w-full px-3.5 py-2 text-xs rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-cyan-500"
                  />
                </div>

                {/* Área en m2 */}
                <div>
                  <label htmlFor="topografia-area" className="block text-xs font-bold text-slate-700 mb-1">
                    Área aprox. (m²)
                  </label>
                  <input id="topografia-area" name="topografia_area"
                    type="number"
                    step="0.01"
                    value={formData.area_m2}
                    onChange={(e) => setFormData({ ...formData, area_m2: e.target.value })}
                    placeholder="Ej. 500"
                    className="w-full px-3.5 py-2 text-xs rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-cyan-500"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {/* Costo del Trabajo */}
                <div>
                  <label htmlFor="topografia-cost" className="block text-xs font-bold text-slate-700 mb-1">
                    Costo Total del Servicio ($ USD) *
                  </label>
                  <input id="topografia-cost" name="topografia_cost"
                    type="number"
                    step="0.01"
                    required
                    value={formData.cost}
                    onChange={(e) => setFormData({ ...formData, cost: e.target.value })}
                    placeholder="Ej. 450.00"
                    className="w-full px-3.5 py-2 text-xs rounded-xl border border-slate-200 font-bold focus:outline-none focus:ring-2 focus:ring-cyan-500"
                  />
                </div>

                {/* Abono Inicial */}
                <div>
                  <label htmlFor="topografia-amount-paid" className="block text-xs font-bold text-slate-700 mb-1">
                    Abono Inicial Recibido ($ USD)
                  </label>
                  <input id="topografia-amount-paid" name="topografia_amount_paid"
                    type="number"
                    step="0.01"
                    value={formData.amount_paid}
                    onChange={(e) => setFormData({ ...formData, amount_paid: e.target.value })}
                    placeholder="0.00"
                    className="w-full px-3.5 py-2 text-xs rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-cyan-500"
                  />
                </div>
              </div>

              {/* Observaciones */}
              <div>
                <label htmlFor="topografia-notes" className="block text-xs font-bold text-slate-700 mb-1">
                  Observaciones Técnicas / Detalles
                </label>
                <textarea id="topografia-notes" name="topografia_notes"
                  rows="2"
                  value={formData.notes}
                  onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                  placeholder="Detalles de linderos, coordenadas de referencia o especificaciones de entrega de planos AutoCAD..."
                  className="w-full px-3.5 py-2 text-xs rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-cyan-500"
                />
              </div>

              {/* Botones de Acción */}
              <div className="pt-3 border-t border-slate-100 flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setIsCreateModalOpen(false)}
                  className="px-4 py-2 text-xs font-medium text-slate-600 hover:bg-slate-100 rounded-md transition cursor-pointer"
                >
                  Cancelar
                </button>
                <ActionButton loading={handleCreateSubmitPending}
                  type="submit"
                  disabled={submitting}
                  className="px-5 py-2 text-xs font-medium text-white bg-slate-900 hover:bg-slate-800 active:bg-black rounded-md shadow-xs transition flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
                >
                  {submitting && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                  <span>Guardar Registro</span>
                </ActionButton>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* MODAL 2: EMITIR RECIBO OFICIAL DE TOPOGRAFÍA (TOP-XXXXX) / /topografia/cobro */}
      {/* ========================================================================= */}
      {isPaymentModalOpen && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-2 sm:p-4 bg-slate-900/60 backdrop-blur-sm">
          <div className="w-full max-w-4xl max-h-[92dvh] flex flex-col overflow-hidden bg-white rounded-xl shadow-xl">
            <div className="p-4 border-b border-slate-100 bg-slate-900 text-white flex items-center justify-between shrink-0">
              <div className="flex items-center gap-2">
                <Compass className="w-5 h-5 text-cyan-400" />
                <div>
                  <h3 className="font-bold text-sm">Recibo de Área de Topografía (TOP)</h3>
                  <p className="text-[10px] text-slate-300">Cobro de Levantamientos, Planos y Medición Técnica</p>
                </div>
              </div>
              <button
                type="button"
                onClick={handleClosePaymentModal}
                className="text-slate-400 hover:text-white p-1 rounded-md cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form id="topografia-payment" onSubmit={handlePaymentSubmit} className="min-h-0 flex-1 overflow-y-auto overscroll-contain p-4 sm:p-6 text-sm">
              <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                <div className="min-w-0 space-y-3">
              {/* Selector de Trabajo Existente o Cobro Libre Directo */}
              <div>
                <label htmlFor="topografia-payment-job" className="block text-xs font-bold text-slate-700 mb-1">
                  Trabajo Topográfico Asignado o Cobro Libre Directo *
                </label>
                <select id="topografia-payment-job" name="topografia_payment_job"
                  value={selectedJobId || (selectedJobForPayment ? String(selectedJobForPayment.id) : '')}
                  onChange={(e) => handleJobSelectChange(e.target.value)}
                  className="w-full px-3 py-2 text-xs rounded-md border border-slate-200 bg-slate-50 text-slate-800 font-semibold focus:outline-none focus:ring-1 focus:ring-slate-900 cursor-pointer"
                >
                  <option value="">-- Cobro Libre / Solicitante Directo --</option>
                  {jobs.map((j) => {
                    const pend = j.pending_balance ?? Math.max(0, (j.cost || 0) - (j.amount_paid || 0));
                    return (
                      <option key={j.id} value={j.id}>
                        {j.client_name} - {j.service_type} ({j.location}) [Saldo: ${pend.toLocaleString()} USD]
                      </option>
                    );
                  })}
                </select>
              </div>

              {/* Ficha Resumen si hay Trabajo Seleccionado */}
              {selectedJobForPayment && (
                <div className="bg-slate-50 p-2.5 rounded-md border border-slate-200 text-xs space-y-1">
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-slate-800">{selectedJobForPayment.client_name}</span>
                    <span className="text-[10px] px-2 py-0.5 rounded bg-slate-200 font-bold text-slate-700">Trabajo #{selectedJobForPayment.id}</span>
                  </div>
                  <div className="text-slate-500">{selectedJobForPayment.service_type} &bull; {selectedJobForPayment.location}</div>
                  <div className="flex justify-between pt-1 border-t border-slate-200 font-bold">
                    <span>Costo Total: ${Number(selectedJobForPayment.cost).toLocaleString()}</span>
                    <span className="text-amber-700">
                      Saldo: ${Number(selectedJobForPayment.pending_balance ?? (selectedJobForPayment.cost - selectedJobForPayment.amount_paid)).toLocaleString()} USD
                    </span>
                  </div>
                </div>
              )}

              {/* Campos de Cliente Libre cuando no se elige un trabajo previo */}
              {!selectedJobForPayment && (
                <div className="space-y-2.5 bg-slate-50 p-3 rounded-md border border-slate-200">
                  <div className="flex items-center gap-1.5 text-xs font-bold text-slate-800">
                    <User className="w-3.5 h-3.5 text-cyan-700" />
                    <span>Datos del Solicitante / Cliente Directo</span>
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                    <div>
                      <label className="block text-[11px] font-bold text-slate-700 mb-0.5">
                        Nombre del Solicitante / Cliente <span className="text-rose-600">*</span>
                      </label>
                      <input id="topografia-payment-client-name" name="topografia_payment_client_name"
                        type="text"
                        required
                        value={freeClientName}
                        onChange={(e) => setFreeClientName(e.target.value)}
                        placeholder="Ej: Ing. Carlos Mendoza"
                        className="w-full px-3 py-1.5 text-xs rounded-md border border-slate-200 bg-white font-medium focus:outline-none focus:ring-1 focus:ring-slate-900"
                      />
                    </div>
                    <div>
                      <label htmlFor="topografia-payment-client-phone" className="block text-[11px] font-bold text-slate-700 mb-0.5">
                        Celular de Contacto
                      </label>
                      <input id="topografia-payment-client-phone" name="topografia_payment_client_phone"
                        type="tel"
                        value={freeClientPhone}
                        onChange={(e) => setFreeClientPhone(e.target.value)}
                        placeholder="Ej: 0989996421"
                        className="w-full px-3 py-1.5 text-xs rounded-md border border-slate-200 bg-white font-medium focus:outline-none focus:ring-1 focus:ring-slate-900"
                      />
                    </div>
                  </div>
                </div>
              )}

              {/* Monto del Cobro */}
              <div>
                <label htmlFor="topografia-payment-amount" className="block text-xs font-bold text-slate-700 mb-1">
                  Monto del Cobro ($ USD) *
                </label>
                <input id="topografia-payment-amount" name="topografia_payment_amount"
                  type="number"
                  step="0.01"
                  min="0.01"
                  required
                  autoFocus
                  value={paymentAmount}
                  onChange={(e) => setPaymentAmount(e.target.value)}
                  placeholder="Ej. 150.00"
                  className="w-full px-3 py-2 text-sm rounded-md border border-slate-200 font-bold focus:outline-none focus:ring-1 focus:ring-slate-900"
                />
              </div>

              {/* Concepto Detallado */}
              <div>
                <label htmlFor="topografia-payment-concept" className="block text-xs font-bold text-slate-700 mb-1">
                  Concepto Detallado del Recibo *
                </label>
                <input id="topografia-payment-concept" name="topografia_payment_concept"
                  type="text"
                  required
                  value={conceptDetail}
                  onChange={(e) => setConceptDetail(e.target.value)}
                  placeholder="Ej. Levantamiento Topográfico y Planos AutoCAD"
                  className="w-full px-3 py-2 text-xs rounded-md border border-slate-200 text-slate-800"
                />
              </div>

              {/* Método de Pago */}
              <div>
                <label htmlFor="topografia-payment-method" className="block text-xs font-bold text-slate-700 mb-1">
                  Método de Pago *
                </label>
                <select id="topografia-payment-method" name="topografia_payment_method"
                  value={paymentMethod}
                  onChange={(e) => setPaymentMethod(e.target.value)}
                  className="w-full px-3 py-2 text-xs rounded-md border border-slate-200 bg-slate-50 text-slate-800 font-semibold"
                >
                  <option value="Transferencia Bancaria">Transferencia Bancaria</option>
                  <option value="Efectivo">Efectivo en Caja</option>
                  <option value="Depósito">Depósito Bancario</option>
                </select>
              </div>

              {/* N° de Comprobante / Referencia Bancaria (Obligatorio para Transferencia y Depósito) */}
              {isBankMethod && (
                <div className="p-2.5 bg-amber-50/70 border border-amber-300 rounded-md space-y-1 animate-fade-in">
                  <label className="block font-bold text-amber-950 text-xs">
                    N° de Comprobante / Referencia Bancaria <span className="text-rose-600">*</span>
                  </label>
                  <input id="topografia-bank-reference" name="topografia_bank_reference"
                    type="text"
                    required
                    value={bankReference}
                    onChange={(e) => setBankReference(e.target.value)}
                    placeholder="Ej. Comp. 0048291"
                    className="w-full px-3 py-2 rounded-md border border-amber-300 bg-white font-bold text-xs text-slate-900 focus:outline-none focus:ring-1 focus:ring-amber-500 shadow-inner"
                  />
                  {(!bankReference || !bankReference.trim()) ? (
                    <p className="text-[10px] text-rose-600 font-bold flex items-center gap-1 mt-0.5">
                      ⚠️ Debe ingresar el número de comprobante o referencia bancaria
                    </p>
                  ) : (
                    <p className="text-[10px] text-amber-800">
                      Obligatorio para que Gerencia audite la acreditación en la banca web (mínimo 3 caracteres).
                    </p>
                  )}
                </div>
              )}

              {isBankMethod && (!bankReference || bankReference.trim().length < 3) && (
                <div className="p-2 rounded-md bg-rose-50 border border-rose-200 text-rose-700 text-xs font-bold text-center">
                  ⚠️ Debe ingresar el número de comprobante o referencia bancaria
                </div>
              )}

                </div>
                <div className="min-w-0 space-y-4">
                  <SignaturePadField ref={sigCanvasRef} />
                  <EmitterSignaturePreview />
                </div>
              </div>
            </form>
            <div className="shrink-0 border-t bg-white p-3 sm:p-4 flex flex-col-reverse sm:flex-row gap-2 sm:justify-end">
              <button type="button" onClick={handleClosePaymentModal} disabled={submitting} className="w-full sm:w-auto min-h-[46px] text-base font-semibold justify-center rounded-md px-4 text-slate-700 hover:bg-slate-100">
                Cancelar
              </button>
              <ActionButton loading={handlePaymentSubmitPending} type="submit" form="topografia-payment" disabled={submitting || (isBankMethod && (!bankReference || bankReference.trim().length < 3))} className="w-full sm:w-auto min-h-[46px] text-base font-semibold justify-center inline-flex items-center gap-2 rounded-md bg-slate-900 px-4 text-white disabled:opacity-50">
                {submitting && <Loader2 className="h-4 w-4 animate-spin" />}
                Emitir Recibo TOP
              </ActionButton>
            </div>
          </div>
        </div>
      )}

      {/* ================= MODAL DE NOTIFICACIÓN WHATSAPP Y CONFIRMACIÓN DE COBRO TOP ================= */}
      {paymentSuccessModal && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-2 sm:p-4 bg-slate-900/60 backdrop-blur-sm">
          <div className="w-full max-w-4xl max-h-[92dvh] flex flex-col overflow-hidden bg-white rounded-xl shadow-xl">
            <div className="shrink-0 p-4 border-b border-slate-100 bg-emerald-50/90 flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-full bg-emerald-600 text-white flex items-center justify-center shadow-xs">
                  <CheckCircle className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="font-extrabold text-sm text-emerald-950">¡Cobro Topográfico Registrado!</h3>
                  <p className="text-[11px] text-emerald-800 font-medium">
                    Recibo Oficial: <b>{paymentSuccessModal.receiptCode}</b> (Recibera TOP)
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={handleCloseSuccessModal}
                className="text-slate-400 hover:text-slate-600 p-1 rounded-md cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain p-4 sm:p-6 space-y-4 text-xs">
              <div className="p-3.5 rounded-lg bg-slate-50 border border-slate-200 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Detalles del Comprobante</span>
                  <span className="px-2 py-0.5 rounded-full text-[10px] font-mono font-extrabold bg-slate-900 text-white">
                    {paymentSuccessModal.receiptCode}
                  </span>
                </div>
                <div className="text-sm font-black text-slate-900">
                  Monto: ${Number(paymentSuccessModal.amountPaid).toFixed(2)} USD ({paymentSuccessModal.paymentMethod})
                </div>
                {paymentSuccessModal.bankReference && (
                  <div className="text-xs font-mono font-bold text-emerald-950 bg-emerald-100/80 px-2 py-0.5 rounded border border-emerald-300 w-fit">
                    N° Comprobante / Ref. Bancaria: {paymentSuccessModal.bankReference}
                  </div>
                )}
                <div className="grid grid-cols-2 gap-2 text-[11px] text-slate-600 pt-1 border-t border-slate-200/60">
                  <div>
                    <span className="text-slate-400 block text-[10px]">Cliente:</span>
                    <strong className="text-slate-800">{paymentSuccessModal.customerName}</strong>
                    {paymentSuccessModal.customerPhone && (
                      <span className="text-[10px] text-slate-500 block">Tel: {paymentSuccessModal.customerPhone}</span>
                    )}
                  </div>
                  <div>
                    <span className="text-slate-400 block text-[10px]">Servicio:</span>
                    <strong className="text-slate-800">{paymentSuccessModal.lotNumber}</strong>
                  </div>
                </div>
                <div className="text-[11px] text-slate-600 pt-1 border-t border-slate-200/60">
                  <span className="text-slate-400 block text-[10px]">Concepto:</span>
                  <span className="text-slate-800">{paymentSuccessModal.concept}</span>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 lg:flex lg:flex-wrap gap-3">
              {/* Botón 1: Enviar al Cliente por WhatsApp */}
              <button
                type="button"
                onClick={() => {
                  const msg = buildPaymentCustomerWhatsAppMessage({
                    receiptCode: paymentSuccessModal.receiptCode,
                    receiptBook: paymentSuccessModal.receiptBook,
                    customerName: paymentSuccessModal.customerName,
                    projectName: paymentSuccessModal.projectName,
                    lotNumber: paymentSuccessModal.lotNumber,
                    concept: paymentSuccessModal.concept,
                    amountPaid: paymentSuccessModal.amountPaid,
                    paymentMethod: paymentSuccessModal.paymentMethod,
                    bankReference: paymentSuccessModal.bankReference,
                    debtBalance: paymentSuccessModal.debtBalance,
                    cashierName: paymentSuccessModal.cashierName,
                    dateTime: paymentSuccessModal.dateTime,
                  });
                  openWhatsApp(paymentSuccessModal.customerPhone, msg);
                }}
                className="w-full py-2.5 px-4 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs flex items-center justify-center gap-2 shadow-xs transition cursor-pointer w-full sm:w-auto min-h-[46px] text-base font-semibold justify-center"
              >
                <MessageCircle className="w-4 h-4" />
                <span>📲 Enviar Recibo al Cliente (WhatsApp)</span>
              </button>

              {/* Botón 2: Reportar al CEO por WhatsApp */}
              <button
                type="button"
                onClick={() => {
                  const msg = buildPaymentCeoWhatsAppMessage({
                    receiptCode: paymentSuccessModal.receiptCode,
                    receiptBook: paymentSuccessModal.receiptBook,
                    customerName: paymentSuccessModal.customerName,
                    projectName: paymentSuccessModal.projectName,
                    lotNumber: paymentSuccessModal.lotNumber,
                    concept: paymentSuccessModal.concept,
                    amountPaid: paymentSuccessModal.amountPaid,
                    paymentMethod: paymentSuccessModal.paymentMethod,
                    bankReference: paymentSuccessModal.bankReference,
                    cashierName: paymentSuccessModal.cashierName,
                    dateTime: paymentSuccessModal.dateTime,
                  });
                  openWhatsApp(DEFAULT_CEO_PHONE, msg);
                }}
                className="w-full py-2.5 px-4 rounded-lg bg-emerald-50 hover:bg-emerald-100 text-emerald-900 border border-emerald-300 font-bold text-xs flex items-center justify-center gap-2 shadow-xs transition cursor-pointer w-full sm:w-auto min-h-[46px] text-base font-semibold justify-center"
              >
                <MessageCircle className="w-4 h-4 text-emerald-700" />
                <span>📲 Reportar Cobro al CEO (WhatsApp)</span>
              </button>


                {/* Botón Abrir PDF */}
                <a
                  href={receiptPdfUrl(paymentSuccessModal.receiptUrl)}
                  target="_blank"
                  rel="noreferrer"
                  className="flex-1 py-2 px-3 rounded-md bg-slate-900 hover:bg-slate-800 text-white font-semibold text-xs flex items-center justify-center gap-1.5 transition shadow-xs cursor-pointer w-full sm:w-auto min-h-[46px] text-base font-semibold justify-center"
                >
                  <Download className="w-3.5 h-3.5" />
                  <span>Abrir Recibo (PDF)</span>
                </a>


              <button
                type="button"
                onClick={handleNewPayment}
                className="w-full py-1 text-center text-xs font-semibold text-slate-400 hover:text-slate-700 transition cursor-pointer w-full sm:w-auto min-h-[46px] text-base font-semibold justify-center"
              >
                Nuevo Cobro
              </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
