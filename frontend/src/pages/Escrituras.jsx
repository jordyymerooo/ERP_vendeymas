import React, { useState, useEffect, useRef } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import axios from 'axios';
import SignatureCanvas from 'react-signature-canvas';
import {
  FileText,
  Search,
  Plus,
  Filter,
  CheckCircle2,
  Clock,
  ArrowRight,
  ArrowLeft,
  DollarSign,
  User,
  Building2,
  Scale,
  Calendar,
  AlertCircle,
  Loader2,
  X,
  CreditCard,
  Download,
  Eye,
  Layers,
  ChevronRight,
  ShieldCheck,
  RotateCcw,
  Sparkles,
  MapPin,
  ExternalLink,
  MessageSquareWarning,
  Edit3,
  MessageCircle,
} from 'lucide-react';
import {
  DEFAULT_CEO_PHONE,
  openWhatsApp,
  buildPaymentCustomerWhatsAppMessage,
  buildPaymentCeoWhatsAppMessage,
} from '../utils/whatsapp';

export const STAGES = [
  'Informe',
  'Demanda',
  'Inscripción',
  'Calificación',
  'Citaciones',
  'Audiencia Uno',
  'Audiencia Dos',
  'Sentencia',
  'Copias de Sentencia',
  'Municipio',
  'Notaría',
  'Registro de la Propiedad',
];

const STAGE_COLORS = {
  'Informe': 'border-slate-300 bg-slate-50 text-slate-800',
  'Demanda': 'border-amber-300 bg-amber-50 text-amber-800',
  'Inscripción': 'border-blue-300 bg-blue-50 text-blue-800',
  'Calificación': 'border-sky-300 bg-sky-50 text-sky-800',
  'Citaciones': 'border-indigo-300 bg-indigo-50 text-indigo-800',
  'Audiencia Uno': 'border-purple-300 bg-purple-50 text-purple-800',
  'Audiencia Dos': 'border-violet-300 bg-violet-50 text-violet-800',
  'Sentencia': 'border-teal-300 bg-teal-50 text-teal-800',
  'Copias de Sentencia': 'border-cyan-300 bg-cyan-50 text-cyan-800',
  'Municipio': 'border-orange-300 bg-orange-50 text-orange-800',
  'Notaría': 'border-emerald-300 bg-emerald-50 text-emerald-800',
  'Registro de la Propiedad': 'border-green-400 bg-green-50 text-green-900',
};

// Chips rápidos de motivos frecuentes para autocompletar en 1 clic
export const QUICK_NOTE_CHIPS = [
  '⚠️ Se terminó el presupuesto abonado para continuar con la escritura',
  '⏳ En espera de pago de alcabalas / impuestos en Municipio',
  '📄 Pendiente entrega de documentos firmados por el cliente',
  '✅ Presupuesto al día - Trámite en curso normal',
];

// Formateador limpio de lote para evitar redundancias ("Lote Lote 1" -> "Lote 1" o "MZ-1-L01")
export const formatLotBadge = (lotNumber) => {
  if (!lotNumber) return 'S/N';
  const str = String(lotNumber).trim();
  if (/^lote\s+/i.test(str)) {
    return str;
  }
  if (/^mz/i.test(str) || /^mza/i.test(str) || /^manzana/i.test(str)) {
    return str;
  }
  return `Lote ${str}`;
};

// Estilizador visual destacado de notas de situación / bloqueo
export const getNoteCardStyle = (notes) => {
  if (!notes) {
    return {
      container: 'bg-slate-50 border-slate-200 text-slate-500',
      badge: 'bg-slate-200 text-slate-700',
      iconColor: 'text-slate-400',
      label: 'Nota Legal / Trámite',
    };
  }
  const lower = notes.toLowerCase();
  if (
    lower.includes('terminó') ||
    lower.includes('bloqueo') ||
    lower.includes('alerta') ||
    (lower.includes('presupuesto') && (lower.includes('terminó') || lower.includes('falta') || lower.includes('agot') || lower.includes('insuficiente'))) ||
    notes.includes('⚠️')
  ) {
    return {
      container: 'bg-red-50 border-red-300 text-red-950 font-medium',
      badge: 'bg-red-200 text-red-900 font-bold',
      iconColor: 'text-red-600',
      label: 'Bloqueo / Presupuesto Agotado',
    };
  }
  if (
    lower.includes('espera') ||
    lower.includes('impuesto') ||
    lower.includes('municipio') ||
    lower.includes('alcabala') ||
    lower.includes('pendiente') ||
    notes.includes('⏳') ||
    notes.includes('📄')
  ) {
    return {
      container: 'bg-amber-50 border-amber-300 text-amber-950 font-medium',
      badge: 'bg-amber-200 text-amber-900 font-bold',
      iconColor: 'text-amber-600',
      label: 'En Espera / Trámite Pendiente',
    };
  }
  if (lower.includes('al día') || lower.includes('normal') || notes.includes('✅')) {
    return {
      container: 'bg-emerald-50 border-emerald-300 text-emerald-950 font-medium',
      badge: 'bg-emerald-200 text-emerald-900 font-bold',
      iconColor: 'text-emerald-600',
      label: 'Presupuesto al Día - En Curso',
    };
  }
  return {
    container: 'bg-sky-50 border-sky-300 text-sky-950 font-medium',
    badge: 'bg-sky-200 text-sky-900 font-bold',
    iconColor: 'text-sky-600',
    label: 'Nota Informativa',
  };
};

export default function Escrituras({ openNewModal = false }) {
  const navigate = useNavigate();
  const location = useLocation();

  const [deeds, setDeeds] = useState([]);
  const [loading, setLoading] = useState(true);
  const [viewMode, setViewMode] = useState('kanban'); // 'kanban' | 'table'

  // Perfil activo
  const [userRole, setUserRole] = useState(() => localStorage.getItem('user_role') || 'Super Admin');
  const isSuperAdmin = userRole === 'Super Admin' || userRole === 'CEO / Gerente';

  // Filtros
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedProject, setSelectedProject] = useState('all');
  const [selectedAdmin, setSelectedAdmin] = useState('all');
  const [selectedStageFilter, setSelectedStageFilter] = useState('all');

  // Catálogos auxiliares
  const [projectsList, setProjectsList] = useState([]);
  const [adminsList, setAdminsList] = useState([]);
  const [customersList, setCustomersList] = useState([]);

  // Lotes vendidos y clientes del proyecto seleccionado en el modal
  const [projectLots, setProjectLots] = useState([]);
  const [availableProjectCustomers, setAvailableProjectCustomers] = useState([]);
  const [loadingLots, setLoadingLots] = useState(false);

  // Modales
  const [createModalOpen, setCreateModalOpen] = useState(false);
  const [paymentModalOpen, setPaymentModalOpen] = useState(false);
  const [selectedDeedForPayment, setSelectedDeedForPayment] = useState(null);
  const [paymentSuccessModal, setPaymentSuccessModal] = useState(null);
  // Modal para edición rápida de nota de situación / bloqueo
  const [editNoteModalOpen, setEditNoteModalOpen] = useState(false);
  const [selectedDeedForNote, setSelectedDeedForNote] = useState(null);
  const [noteEditText, setNoteEditText] = useState('');
  const [updatingNote, setUpdatingNote] = useState(false);

  const [submitting, setSubmitting] = useState(false);
  const [toastMessage, setToastMessage] = useState(null);

  // Formulario nuevo trámite
  const [newDeed, setNewDeed] = useState({
    customer_id: '',
    project_id: '',
    lot_id: '',
    assigned_admin_id: '',
    stage: 'Informe',
    total_budget: '1500.00',
    notes: '',
  });

  // Formulario pago ADM
  const [paymentForm, setPaymentForm] = useState({
    amount_paid: '',
    payment_method: 'Transferencia Bancaria',
    bank_reference: '',
    concept_detail: 'Abono para Municipio / Alcabalas y Plusvalía',
  });
  const sigCanvasRef = useRef(null);

  // Obtener el administrador correspondiente a la sesión activa
  const getActiveAdmin = () => {
    try {
      const userStr = localStorage.getItem('user');
      const u = userStr ? JSON.parse(userStr) : null;
      if (u) {
        const found = adminsList.find((a) => a.id === u.id || a.email === u.email);
        if (found) return found;
        if (u.name) return u;
      }
    } catch (e) {
      // Ignorar error de parsing
    }
    // Fallback al administrador predeterminado si el rol simulado es Administrador
    return (
      adminsList.find((a) => a.email === 'administrador1@vendeymas.com') ||
      adminsList.find((a) => a.name?.toLowerCase().includes('valeria')) ||
      adminsList[0] || { id: 2, name: 'Lic. Valeria Gómez - Administradora' }
    );
  };

  // Cargar lotes vendidos del proyecto y clientes asociados con sincronización estricta
  const handleProjectChangeInForm = async (projectId) => {
    let defaultAdminId = '';
    if (userRole === 'Administrador') {
      defaultAdminId = String(getActiveAdmin()?.id || '');
    } else {
      const assigned = adminsList.find((adm) =>
        adm.assigned_projects?.some((p) => String(p.id) === String(projectId)) ||
        adm.assignedProjects?.some((p) => String(p.id) === String(projectId))
      ) || adminsList[0];
      defaultAdminId = assigned ? String(assigned.id) : '';
    }

    setNewDeed((prev) => ({
      ...prev,
      project_id: projectId,
      lot_id: '',
      customer_id: '',
      assigned_admin_id: defaultAdminId || prev.assigned_admin_id,
    }));

    if (!projectId) {
      setProjectLots([]);
      setAvailableProjectCustomers([]);
      return;
    }

    setLoadingLots(true);
    try {
      const res = await axios.get(`/api/projects/${projectId}/lots`);
      const lots = res.data?.data || res.data || [];
      // Filtro estricto: Solo lotes vendidos (status === 'Vendido' o con customer_id != null)
      const sold = lots.filter((l) => (l.status === 'Vendido' || l.customer_id) && l.customer_id);
      setProjectLots(sold);

      // Extraer clientes únicos dueños de estos lotes en el proyecto
      const custMap = new Map();
      sold.forEach((l) => {
        if (l.customer) {
          custMap.set(String(l.customer.id), l.customer);
        } else if (l.customer_id) {
          const found = customersList.find((c) => String(c.id) === String(l.customer_id));
          if (found) custMap.set(String(l.customer_id), found);
        }
      });
      setAvailableProjectCustomers(Array.from(custMap.values()));
    } catch (err) {
      console.error('Error al cargar lotes del proyecto:', err);
      setProjectLots([]);
      setAvailableProjectCustomers([]);
    } finally {
      setLoadingLots(false);
    }
  };

  // Sincronización Lote -> Cliente: Al seleccionar un lote, busca su cliente dueño
  const handleLotChangeInForm = (lotId) => {
    if (!lotId) {
      setNewDeed((prev) => ({ ...prev, lot_id: '', customer_id: '' }));
      return;
    }
    const chosenLot = projectLots.find((l) => String(l.id) === String(lotId));
    if (chosenLot && chosenLot.customer_id) {
      setNewDeed((prev) => ({
        ...prev,
        lot_id: lotId,
        customer_id: String(chosenLot.customer_id),
      }));
    } else {
      setNewDeed((prev) => ({
        ...prev,
        lot_id: lotId,
      }));
    }
  };

  // Sincronización Cliente -> Lote: Al seleccionar un cliente, busca su lote comprado en el proyecto
  const handleCustomerChangeInForm = (customerId) => {
    if (!customerId) {
      setNewDeed((prev) => ({ ...prev, customer_id: '', lot_id: '' }));
      return;
    }
    const matchingLot = projectLots.find((l) => String(l.customer_id) === String(customerId));
    setNewDeed((prev) => ({
      ...prev,
      customer_id: customerId,
      lot_id: matchingLot ? String(matchingLot.id) : '',
    }));
  };

  // Inicializar y abrir formulario de nuevo trámite
  const handleOpenCreateModal = (projectOverride = null) => {
    if (location.pathname !== '/escrituras/iniciartramite') {
      navigate('/escrituras/iniciartramite');
    }

    const targetProjectId = projectOverride || (selectedProject !== 'all' ? selectedProject : (projectsList[0]?.id || ''));

    let defaultAdminId = '';
    if (userRole === 'Administrador') {
      defaultAdminId = String(getActiveAdmin()?.id || '');
    } else if (targetProjectId) {
      const assigned = adminsList.find((adm) =>
        adm.assigned_projects?.some((p) => String(p.id) === String(targetProjectId)) ||
        adm.assignedProjects?.some((p) => String(p.id) === String(targetProjectId))
      ) || adminsList[0];
      defaultAdminId = assigned ? String(assigned.id) : '';
    }

    setNewDeed({
      customer_id: '',
      project_id: targetProjectId,
      lot_id: '',
      assigned_admin_id: defaultAdminId,
      stage: 'Informe',
      total_budget: '1500.00',
      notes: '',
    });

    if (targetProjectId) {
      handleProjectChangeInForm(targetProjectId);
    } else {
      setProjectLots([]);
      setAvailableProjectCustomers([]);
    }
    setCreateModalOpen(true);
  };

  // Cerrar modal de nuevo trámite y regresar limpiamente a /escrituras
  const handleCloseCreateModal = () => {
    setCreateModalOpen(false);
    if (location.pathname.includes('/iniciartramite')) {
      navigate('/escrituras');
    }
  };

  // Sincronización con la ruta directa /escrituras/iniciartramite
  useEffect(() => {
    const isDirectInitiateRoute = openNewModal || location.pathname.includes('/iniciartramite');
    if (isDirectInitiateRoute) {
      if (!createModalOpen) {
        handleOpenCreateModal();
      }
    } else {
      if (createModalOpen) {
        setCreateModalOpen(false);
      }
    }
  }, [location.pathname, openNewModal]);

  // Cargar datos principales
  const fetchDeeds = async () => {
    setLoading(true);
    try {
      const params = {};
      if (selectedProject !== 'all') params.project_id = selectedProject;
      if (selectedAdmin !== 'all') params.assigned_admin_id = selectedAdmin;
      if (selectedStageFilter !== 'all') params.stage = selectedStageFilter;
      if (searchTerm.trim()) params.search = searchTerm.trim();

      const res = await axios.get('/api/deeds', { params });
      setDeeds(res.data?.data || []);
    } catch (err) {
      console.error('Error al cargar escrituras:', err);
    } finally {
      setLoading(false);
    }
  };

  const fetchCatalogs = async () => {
    try {
      const [projRes, usersRes, custRes] = await Promise.all([
        axios.get('/api/projects'),
        axios.get('/api/users'),
        axios.get('/api/customers'),
      ]);
      setProjectsList(Array.isArray(projRes.data) ? projRes.data : (projRes.data?.data || []));

      const allUsers = usersRes.data?.data || [];
      const admins = allUsers.filter(
        (u) => u.roles?.some((r) => r.name === 'Administrador' || r.name === 'Super Admin')
      );
      setAdminsList(admins);
      setCustomersList(custRes.data?.data || []);
    } catch (err) {
      console.error('Error al cargar catálogos:', err);
    }
  };

  useEffect(() => {
    fetchCatalogs();
  }, []);

  useEffect(() => {
    fetchDeeds();
  }, [selectedProject, selectedAdmin, selectedStageFilter, searchTerm]);

  useEffect(() => {
    const handleAuthChange = () => {
      setUserRole(localStorage.getItem('user_role') || 'Super Admin');
      fetchCatalogs();
      fetchDeeds();
    };
    window.addEventListener('storage', handleAuthChange);
    window.addEventListener('auth-change', handleAuthChange);
    return () => {
      window.removeEventListener('storage', handleAuthChange);
      window.removeEventListener('auth-change', handleAuthChange);
    };
  }, []);

  const showToast = (msg) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 4000);
  };

  // Registrar nuevo expediente
  const handleCreateDeed = async (e) => {
    e.preventDefault();
    if (!newDeed.customer_id || !newDeed.project_id) {
      alert('Por favor selecciona cliente y proyecto.');
      return;
    }

    // Validación estricta: asegurar que el lote corresponda al cliente seleccionado
    if (newDeed.lot_id && newDeed.customer_id) {
      const chosenLot = projectLots.find((l) => String(l.id) === String(newDeed.lot_id));
      if (chosenLot && String(chosenLot.customer_id) !== String(newDeed.customer_id)) {
        alert('Error de consistencia: El lote seleccionado no pertenece a este cliente.');
        return;
      }
    }

    setSubmitting(true);
    try {
      await axios.post('/api/deeds', {
        ...newDeed,
        total_budget: parseFloat(newDeed.total_budget) || 0,
      });
      showToast('Trámite de escritura registrado exitosamente.');
      handleCloseCreateModal();
      fetchDeeds();
    } catch (err) {
      console.error('Error al registrar escritura:', err);
      alert(err.response?.data?.message || 'Error al crear el trámite.');
    } finally {
      setSubmitting(false);
    }
  };

  // Abrir modal de edición rápida de nota de situación
  const handleOpenEditNote = (deed) => {
    setSelectedDeedForNote(deed);
    setNoteEditText(deed.notes || '');
    setEditNoteModalOpen(true);
  };

  // Guardar nota de situación vía PUT /api/deeds/{id}
  const handleSaveNote = async (e) => {
    e.preventDefault();
    if (!selectedDeedForNote) return;
    setUpdatingNote(true);
    try {
      await axios.put(`/api/deeds/${selectedDeedForNote.id}`, {
        notes: noteEditText,
      });
      showToast(`Nota de situación actualizada para Expediente #${selectedDeedForNote.id}.`);
      setDeeds((prev) =>
        prev.map((d) => (d.id === selectedDeedForNote.id ? { ...d, notes: noteEditText } : d))
      );
      setEditNoteModalOpen(false);
      setSelectedDeedForNote(null);
    } catch (err) {
      console.error('Error al actualizar nota de situación:', err);
      alert(err.response?.data?.message || 'Error al guardar la nota.');
    } finally {
      setUpdatingNote(false);
    }
  };

  // Cambiar etapa directamente
  const handleUpdateStage = async (deedId, newStage) => {
    try {
      await axios.put(`/api/deeds/${deedId}/stage`, { stage: newStage });
      showToast(`Escritura avanzada a etapa "${newStage}".`);
      setDeeds((prev) =>
        prev.map((d) => (d.id === deedId ? { ...d, stage: newStage } : d))
      );
      fetchDeeds();
    } catch (err) {
      console.error('Error al cambiar etapa:', err);
      alert('No se pudo actualizar la etapa.');
    }
  };

  // Registrar cobro municipal / administrativo
  const handleProcessAdmPayment = async (e) => {
    e.preventDefault();
    if (!selectedDeedForPayment) return;
    const amount = parseFloat(paymentForm.amount_paid);
    if (!amount || amount <= 0) {
      alert('Ingresa un monto válido mayor a 0.');
      return;
    }

    const isBankMethod = paymentForm.payment_method === 'Transferencia Bancaria' || paymentForm.payment_method === 'Depósito' || paymentForm.payment_method?.toLowerCase().includes('transferencia') || paymentForm.payment_method?.toLowerCase().includes('depósito') || paymentForm.payment_method?.toLowerCase().includes('deposito');

    if (isBankMethod && (!paymentForm.bank_reference || paymentForm.bank_reference.trim().length < 3)) {
      alert('Debe ingresar el número de comprobante o referencia bancaria (mínimo 3 caracteres).');
      return;
    }

    let firmaBase64 = null;
    if (sigCanvasRef.current && !sigCanvasRef.current.isEmpty()) {
      firmaBase64 = sigCanvasRef.current.toDataURL('image/png');
    }

    setSubmitting(true);
    try {
      const res = await axios.post('/api/payments', {
        deed_id: selectedDeedForPayment.id,
        lot_id: selectedDeedForPayment.lot_id || null,
        amount_paid: amount,
        payment_method: paymentForm.payment_method,
        bank_reference: isBankMethod ? paymentForm.bank_reference.trim() : null,
        concept_detail: paymentForm.concept_detail,
        receipt_book: 'ADMINISTRACION',
        signature_base64: firmaBase64,
      });

      const payment = res.data?.payment || res.data?.data;
      const receiptCode = payment?.receipt_code || ('ADM-' + String(payment?.id || '').padStart(5, '0'));
      const customer = selectedDeedForPayment?.customer || payment?.deed?.customer;
      const project = selectedDeedForPayment?.project || payment?.deed?.project;

      let currentUserName = 'Administrador Responsable';
      try {
        const u = JSON.parse(localStorage.getItem('user'));
        if (u?.name) currentUserName = u.name;
      } catch (e) {}

      const successData = {
        paymentId: payment?.id,
        receiptCode: receiptCode,
        receiptBook: 'ADMINISTRACION',
        customerName: customer?.name || 'Cliente',
        customerPhone: customer?.phone || '',
        projectName: project?.name || 'Trámite Notarial',
        lotNumber: selectedDeedForPayment?.lot?.lot_number ? `Lote ${selectedDeedForPayment.lot.lot_number}` : `Trámite Escritura #${selectedDeedForPayment?.id}`,
        concept: paymentForm.concept_detail || 'Abono para Municipio / Alcabalas y Plusvalía',
        amountPaid: amount,
        paymentMethod: paymentForm.payment_method,
        bankReference: payment?.bank_reference || (isBankMethod ? paymentForm.bank_reference.trim() : null),
        debtBalance: payment?.debt_balance ?? 0,
        cashierName: currentUserName,
        dateTime: new Date().toLocaleString('es-EC', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' }),
        receiptUrl: `/api/payments/${payment?.id}/pdf`,
      };

      setPaymentSuccessModal(successData);
      showToast(`Cobro registrado con éxito en Recibera ADM (Recibo: ${receiptCode}).`);
      setPaymentModalOpen(false);
      setSelectedDeedForPayment(null);
      setPaymentForm({
        amount_paid: '',
        payment_method: 'Transferencia Bancaria',
        bank_reference: '',
        concept_detail: 'Abono para Municipio / Alcabalas y Plusvalía',
      });

      // Abrir PDF automáticamente
      if (payment?.id) {
        window.open(`/api/payments/${payment.id}/pdf`, '_blank');
      }
      fetchDeeds();
      window.dispatchEvent(new Event('notifications-updated'));
    } catch (err) {
      console.error('Error al registrar pago ADM:', err);
      alert(err.response?.data?.message || 'Error al emitir el recibo de administración.');
    } finally {
      setSubmitting(false);
    }
  };

  // Conteo por etapa
  const stageCounts = STAGES.reduce((acc, st) => {
    acc[st] = deeds.filter((d) => d.stage === st).length;
    return acc;
  }, {});

  const activeAdminObj = getActiveAdmin();

  return (
    <div className="space-y-6 font-sans animate-fade-in">
      {/* Toast */}
      {toastMessage && (
        <div className="bg-emerald-50 border border-emerald-200 text-emerald-800 p-3.5 rounded-lg flex items-center justify-between shadow-xs">
          <div className="flex items-center gap-2 text-xs font-semibold">
            <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
            <span>{toastMessage}</span>
          </div>
          <button type="button" onClick={() => setToastMessage(null)} className="text-emerald-600 hover:text-emerald-900">
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Cabecera */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-2 border-b border-slate-200">
        <div>
          <div className="flex items-center gap-2 text-xs font-bold text-slate-500 uppercase tracking-wider mb-1">
            <Scale className="w-4 h-4 text-slate-700" />
            <span>Departamento Jurídico y Administrativo</span>
          </div>
          <h1 className="text-2xl font-black text-slate-900 tracking-tight flex items-center gap-2">
            <span>Pipeline Legal y Trámites de Escrituras</span>
            <span className="text-xs font-bold px-2.5 py-0.5 rounded-full bg-slate-900 text-white">
              12 Etapas
            </span>
          </h1>
          <p className="text-xs text-slate-500 mt-0.5">
            Seguimiento riguroso de expedientes notariales, judiciales, pagos municipales y notas de situación de presupuesto.
          </p>
        </div>

        <div className="flex items-center gap-2.5">
          {/* Switcher Vista Kanban vs Tabla */}
          <div className="bg-slate-100 p-1 rounded-lg border border-slate-200 flex items-center text-xs font-bold">
            <button
              type="button"
              onClick={() => setViewMode('kanban')}
              className={`px-3 py-1.5 rounded-md transition cursor-pointer ${
                viewMode === 'kanban' ? 'bg-white text-slate-900 shadow-xs' : 'text-slate-500 hover:text-slate-900'
              }`}
            >
              Tablero Kanban
            </button>
            <button
              type="button"
              onClick={() => setViewMode('table')}
              className={`px-3 py-1.5 rounded-md transition cursor-pointer ${
                viewMode === 'table' ? 'bg-white text-slate-900 shadow-xs' : 'text-slate-500 hover:text-slate-900'
              }`}
            >
              Tabla Ejecutiva
            </button>
          </div>

          <button
            type="button"
            onClick={() => handleOpenCreateModal()}
            className="px-4 py-2 rounded-md bg-slate-900 hover:bg-slate-800 text-white text-xs font-bold flex items-center gap-1.5 shadow-xs cursor-pointer transition"
          >
            <Plus className="w-4 h-4" />
            <span>+ Iniciar Trámite de Escritura</span>
          </button>
        </div>
      </div>

      {/* Selector Superior de Proyecto Asignado (Flujo del Administrador y CEO) */}
      <div className="bg-white p-3.5 rounded-lg border border-slate-200 shadow-xs space-y-2">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-100 pb-2">
          <div className="flex items-center gap-2">
            <div className="w-6 h-6 rounded bg-indigo-50 text-indigo-700 flex items-center justify-center">
              <Building2 className="w-3.5 h-3.5" />
            </div>
            <div>
              <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block">
                {isSuperAdmin ? 'Selector de Proyectos (Vista CEO / Gerente General)' : 'Selector Superior de Proyectos Asignados por el CEO'}
              </span>
              <span className="text-xs font-bold text-slate-800">
                {isSuperAdmin ? 'Supervisión global de todos los proyectos' : 'Gestión legal exclusiva de los proyectos que el CEO te asignó'}
              </span>
            </div>
          </div>
          {isSuperAdmin && (
            <span className="text-[11px] font-semibold text-slate-500 bg-slate-100 px-2 py-0.5 rounded">
              Vista CEO: Acceso Total
            </span>
          )}
        </div>

        {/* Pestañas / Botones de Proyectos Asignados */}
        <div className="flex items-center gap-2 overflow-x-auto pt-1 pb-0.5">
          <button
            type="button"
            onClick={() => setSelectedProject('all')}
            className={`px-3 py-1.5 rounded-md text-xs font-bold transition cursor-pointer border shrink-0 ${
              selectedProject === 'all'
                ? 'bg-slate-900 text-white border-slate-900 shadow-xs'
                : 'bg-slate-50 text-slate-700 border-slate-200 hover:bg-slate-100'
            }`}
          >
            {isSuperAdmin ? 'Todos los Proyectos' : 'Todos mis Proyectos Asignados'}
          </button>
          {projectsList.map((p) => {
            const isSelected = String(selectedProject) === String(p.id);
            return (
              <button
                key={p.id}
                type="button"
                onClick={() => setSelectedProject(p.id)}
                className={`px-3 py-1.5 rounded-md text-xs font-bold transition cursor-pointer border shrink-0 flex items-center gap-1.5 ${
                  isSelected
                    ? 'bg-indigo-600 text-white border-indigo-600 shadow-xs'
                    : 'bg-white text-slate-700 border-slate-200 hover:bg-indigo-50 hover:text-indigo-900'
                }`}
              >
                <span>{p.name || p.nombre}</span>
                {p.sold_lots_count !== undefined && (
                  <span className={`text-[10px] px-1.5 py-0.2 rounded-full font-semibold ${isSelected ? 'bg-indigo-800 text-white' : 'bg-slate-100 text-slate-600'}`}>
                    {p.sold_lots_count} vendidos
                  </span>
                )}
              </button>
            );
          })}
        </div>
      </div>

      {/* Barra de Filtros Superiores */}
      <div className="bg-white p-3.5 rounded-lg border border-slate-200 shadow-xs grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 text-xs">
        {/* Buscador */}
        <div className="relative">
          <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="Buscar por cliente, cédula o lote..."
            className="w-full pl-8 pr-3 py-2 rounded-md border border-slate-200 bg-slate-50 focus:bg-white text-slate-900 focus:outline-none focus:ring-1 focus:ring-slate-900 transition"
          />
        </div>

        {/* Proyecto */}
        <div>
          <select
            value={selectedProject}
            onChange={(e) => setSelectedProject(e.target.value)}
            className="w-full px-3 py-2 rounded-md border border-slate-200 bg-slate-50 text-slate-800 font-medium focus:outline-none focus:ring-1 focus:ring-slate-900"
          >
            <option value="all">Todos los Proyectos</option>
            {projectsList.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
          </select>
        </div>

        {/* Administrador a Cargo (CEO vs Admin) */}
        {isSuperAdmin ? (
          <div>
            <select
              value={selectedAdmin}
              onChange={(e) => setSelectedAdmin(e.target.value)}
              className="w-full px-3 py-2 rounded-md border border-slate-200 bg-slate-50 text-slate-800 font-medium focus:outline-none focus:ring-1 focus:ring-slate-900"
            >
              <option value="all">Todos los Administradores</option>
              {adminsList.map((adm) => (
                <option key={adm.id} value={adm.id}>
                  {adm.name} ({adm.roles?.[0]?.name || 'Admin'})
                </option>
              ))}
            </select>
          </div>
        ) : (
          <div className="px-3 py-2 rounded-md border border-slate-200 bg-slate-50 text-slate-500 flex items-center gap-1.5 font-medium">
            <User className="w-3.5 h-3.5 text-slate-400" />
            <span>Mis Proyectos Asignados</span>
          </div>
        )}

        {/* Etapa */}
        <div>
          <select
            value={selectedStageFilter}
            onChange={(e) => setSelectedStageFilter(e.target.value)}
            className="w-full px-3 py-2 rounded-md border border-slate-200 bg-slate-50 text-slate-800 font-medium focus:outline-none focus:ring-1 focus:ring-slate-900"
          >
            <option value="all">Todas las 12 Etapas</option>
            {STAGES.map((s, idx) => (
              <option key={s} value={s}>
                {idx + 1}. {s}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Barra Horizontal de las 12 Etapas con Contadores */}
      <div className="bg-white p-3 rounded-lg border border-slate-200 shadow-xs overflow-x-auto">
        <div className="flex items-center gap-1.5 min-w-[980px]">
          {STAGES.map((st, i) => {
            const count = stageCounts[st] || 0;
            const isSelected = selectedStageFilter === st;
            return (
              <button
                key={st}
                type="button"
                onClick={() => setSelectedStageFilter(isSelected ? 'all' : st)}
                className={`flex-1 py-1.5 px-2 rounded-md text-[11px] font-bold border transition flex flex-col items-center justify-center cursor-pointer ${
                  isSelected
                    ? 'bg-slate-900 text-white border-slate-900 shadow-xs'
                    : count > 0
                    ? 'bg-slate-50 text-slate-800 border-slate-200 hover:bg-slate-100'
                    : 'bg-white text-slate-400 border-slate-100 hover:bg-slate-50'
                }`}
              >
                <span className="text-[9px] opacity-70">#{i + 1}</span>
                <span className="truncate max-w-[85px]">{st}</span>
                <span className={`text-[10px] mt-0.5 px-1.5 rounded-full ${isSelected ? 'bg-white/20 text-white' : 'bg-slate-200 text-slate-700'}`}>
                  {count}
                </span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Contenido: Kanban vs Tabla */}
      {loading ? (
        <div className="py-20 flex flex-col items-center justify-center text-slate-400">
          <Loader2 className="w-8 h-8 animate-spin text-slate-600 mb-2" />
          <p className="text-xs font-semibold">Cargando expedientes jurídicos...</p>
        </div>
      ) : deeds.length === 0 ? (
        <div className="bg-white p-12 rounded-lg border border-slate-200 text-center">
          <Scale className="w-10 h-10 text-slate-300 mx-auto mb-2" />
          <h3 className="text-sm font-bold text-slate-800">No se encontraron expedientes</h3>
          <p className="text-xs text-slate-400 mt-1">
            No hay trámites de escrituras que coincidan con los filtros seleccionados.
          </p>
        </div>
      ) : viewMode === 'kanban' ? (
        /* ================= VISTA KANBAN HORIZONTAL (12 COLUMNAS) ================= */
        <div className="overflow-x-auto pb-4">
          <div className="flex gap-3 min-w-[3200px]">
            {STAGES.map((stage, stageIdx) => {
              const deedsInStage = deeds.filter((d) => d.stage === stage);
              return (
                <div
                  key={stage}
                  className="w-72 bg-slate-100/70 rounded-lg border border-slate-200 p-2.5 flex flex-col shrink-0 max-h-[750px]"
                >
                  {/* Cabecera Columna */}
                  <div className="flex items-center justify-between pb-2 mb-2 border-b border-slate-200">
                    <div className="flex items-center gap-1.5 min-w-0">
                      <span className="w-5 h-5 rounded-full bg-slate-900 text-white text-[10px] font-bold flex items-center justify-center shrink-0">
                        {stageIdx + 1}
                      </span>
                      <h4 className="text-xs font-extrabold text-slate-800 truncate" title={stage}>
                        {stage}
                      </h4>
                    </div>
                    <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-white border border-slate-200 text-slate-700">
                      {deedsInStage.length}
                    </span>
                  </div>

                  {/* Lista de Tarjetas */}
                  <div className="flex-1 overflow-y-auto space-y-2.5 pr-0.5">
                    {deedsInStage.map((deed) => {
                      const totalBudget = Number(deed.total_budget || 0);
                      const totalPaid = Number(deed.payments_sum_amount_paid || 0);
                      const pendingBalance = Math.max(0, totalBudget - totalPaid);
                      const noteStyle = getNoteCardStyle(deed.notes);

                      return (
                        <div
                          key={deed.id}
                          className="bg-white p-3 rounded-lg border border-slate-200 shadow-xs hover:shadow-md transition text-xs space-y-2"
                        >
                          {/* Cliente & Expediente + Badge de Lote Limpio */}
                          <div className="flex items-start justify-between gap-1">
                            <div>
                              <span className="text-[10px] font-bold text-slate-400">EXP #{deed.id}</span>
                              <div className="font-bold text-slate-900 text-xs">
                                {deed.customer?.name || 'Cliente sin nombre'}
                              </div>
                              <div className="text-[10px] text-slate-400">
                                C.I: {deed.customer?.id_card || 'S/N'}
                              </div>
                            </div>
                            <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-slate-100 text-slate-800 border border-slate-200 shrink-0">
                              {formatLotBadge(deed.lot?.lot_number)}
                            </span>
                          </div>

                          {/* Proyecto y Admin Responsable */}
                          <div className="bg-slate-50 p-2 rounded border border-slate-100 text-[11px] space-y-0.5">
                            <div className="flex items-center gap-1 text-slate-700 font-semibold truncate">
                              <Building2 className="w-3 h-3 text-slate-400 shrink-0" />
                              <span className="truncate">{deed.project?.name || 'Proyecto general'}</span>
                            </div>
                            <div className="flex items-center gap-1 text-slate-500 text-[10px] truncate">
                              <User className="w-3 h-3 text-slate-400 shrink-0" />
                              <span className="truncate">
                                Resp: {deed.assigned_admin?.name || deed.assignedAdmin?.name || 'Área Administrativa'}
                              </span>
                            </div>
                          </div>

                          {/* Recuadro Destacado de Nota de Situación / Bloqueo de Presupuesto */}
                          <div className={`p-2.5 rounded-md border text-[11px] space-y-1 shadow-2xs ${noteStyle.container}`}>
                            <div className="flex items-center justify-between gap-1">
                              <span className="flex items-center gap-1 font-bold text-[10px] uppercase tracking-wide">
                                <MessageSquareWarning className={`w-3.5 h-3.5 shrink-0 ${noteStyle.iconColor}`} />
                                <span>{noteStyle.label}</span>
                              </span>
                              <button
                                type="button"
                                onClick={() => handleOpenEditNote(deed)}
                                title="Editar Nota / Situación"
                                className="px-2 py-0.5 rounded bg-white/90 hover:bg-white text-slate-800 border border-slate-300 hover:border-slate-400 font-bold text-[10px] flex items-center gap-1 cursor-pointer transition shadow-2xs"
                              >
                                <Edit3 className="w-3 h-3 text-slate-700" />
                                <span>Editar</span>
                              </button>
                            </div>
                            <p className="text-[11px] leading-snug font-medium line-clamp-3">
                              {deed.notes ? deed.notes : 'Sin observaciones registradas. Trámite en curso normal.'}
                            </p>
                          </div>

                          {/* Presupuesto y Cobro */}
                          <div className="pt-1 border-t border-slate-100 space-y-1">
                            <div className="flex justify-between text-[11px]">
                              <span className="text-slate-500">Costo Trámite:</span>
                              <span className="font-bold text-slate-900">${totalBudget.toFixed(2)}</span>
                            </div>
                            <div className="flex justify-between text-[11px]">
                              <span className="text-slate-500">Abonado (ADM):</span>
                              <span className="font-bold text-emerald-600">${totalPaid.toFixed(2)}</span>
                            </div>
                            <div className="flex justify-between text-[11px] font-bold">
                              <span className="text-slate-700">Saldo:</span>
                              <span className={pendingBalance > 0 ? 'text-amber-700' : 'text-slate-400'}>
                                ${pendingBalance.toFixed(2)}
                              </span>
                            </div>
                          </div>

                          {/* Selector rápido de Etapa (Avanzar / Retroceder) */}
                          <div className="flex items-center gap-1 pt-1 border-t border-slate-100">
                            <button
                              type="button"
                              disabled={stageIdx === 0}
                              onClick={() => handleUpdateStage(deed.id, STAGES[stageIdx - 1])}
                              title="Retroceder etapa"
                              className="p-1 rounded hover:bg-slate-100 text-slate-400 hover:text-slate-700 disabled:opacity-20 cursor-pointer"
                            >
                              <ArrowLeft className="w-3.5 h-3.5" />
                            </button>

                            <select
                              value={deed.stage}
                              onChange={(e) => handleUpdateStage(deed.id, e.target.value)}
                              className="flex-1 text-[10px] font-bold py-1 px-1.5 rounded border border-slate-200 bg-slate-50 text-slate-800 focus:outline-none cursor-pointer"
                            >
                              {STAGES.map((s, idx) => (
                                <option key={s} value={s}>
                                  {idx + 1}. {s}
                                </option>
                              ))}
                            </select>

                            <button
                              type="button"
                              disabled={stageIdx === STAGES.length - 1}
                              onClick={() => handleUpdateStage(deed.id, STAGES[stageIdx + 1])}
                              title="Avanzar etapa"
                              className="p-1 rounded hover:bg-slate-100 text-slate-400 hover:text-slate-700 disabled:opacity-20 cursor-pointer"
                            >
                              <ArrowRight className="w-3.5 h-3.5" />
                            </button>
                          </div>

                          {/* Botón Cobro Administrativo */}
                          <button
                            type="button"
                            onClick={() => {
                              setSelectedDeedForPayment(deed);
                              setPaymentForm({
                                amount_paid: '',
                                payment_method: 'Transferencia Bancaria',
                                concept_detail: `Abono de Escrituración - Etapa ${deed.stage}`,
                              });
                              setPaymentModalOpen(true);
                            }}
                            className="w-full py-1.5 px-2 rounded-md bg-indigo-50 hover:bg-indigo-100 text-indigo-900 border border-indigo-200 font-bold text-[11px] flex items-center justify-center gap-1 cursor-pointer transition shadow-xs"
                          >
                            <CreditCard className="w-3.5 h-3.5 text-indigo-700" />
                            <span>Emitir Recibo Administrativo (ADM)</span>
                          </button>
                        </div>
                      );
                    })}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      ) : (
        /* ================= VISTA TABLA EJECUTIVA ================= */
        <div className="bg-white rounded-lg border border-slate-200 shadow-xs overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-200 text-slate-500 font-bold uppercase text-[10px] tracking-wider">
                  <th className="py-3 px-4">Exp. / Cliente</th>
                  <th className="py-3 px-4">Proyecto & Lote</th>
                  <th className="py-3 px-4">Administrador</th>
                  <th className="py-3 px-4">Etapa Actual (1 al 12)</th>
                  <th className="py-3 px-4">Situación / Nota Legal</th>
                  <th className="py-3 px-4 text-right">Presupuesto</th>
                  <th className="py-3 px-4 text-right">Abonado</th>
                  <th className="py-3 px-4 text-right">Saldo</th>
                  <th className="py-3 px-4 text-center">Acciones</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {deeds.map((deed) => {
                  const stageIndex = STAGES.indexOf(deed.stage);
                  const stageNumber = stageIndex >= 0 ? stageIndex + 1 : 1;
                  const progressPercent = Math.round((stageNumber / 12) * 100);

                  const totalBudget = Number(deed.total_budget || 0);
                  const totalPaid = Number(deed.payments_sum_amount_paid || 0);
                  const pendingBalance = Math.max(0, totalBudget - totalPaid);
                  const noteStyle = getNoteCardStyle(deed.notes);

                  return (
                    <tr key={deed.id} className="hover:bg-slate-50/70 transition">
                      {/* Cliente */}
                      <td className="py-3 px-4">
                        <div className="font-bold text-slate-900">
                          {deed.customer?.name || 'Cliente sin nombre'}
                        </div>
                        <div className="text-[10px] text-slate-400">
                          EXP #{deed.id} &bull; C.I: {deed.customer?.id_card || 'S/N'}
                        </div>
                      </td>

                      {/* Proyecto & Lote Limpio */}
                      <td className="py-3 px-4">
                        <div className="font-semibold text-slate-800">
                          {deed.project?.name || 'Proyecto general'}
                        </div>
                        <div className="text-[10px] text-slate-500 font-bold">
                          {formatLotBadge(deed.lot?.lot_number)}
                        </div>
                      </td>

                      {/* Administrador */}
                      <td className="py-3 px-4">
                        <span className="font-medium text-slate-700">
                          {deed.assigned_admin?.name || deed.assignedAdmin?.name || 'Área Administrativa'}
                        </span>
                      </td>

                      {/* Etapa y Barra de Progreso */}
                      <td className="py-3 px-4 min-w-[200px]">
                        <div className="flex items-center justify-between text-[11px] mb-1 font-bold">
                          <span className="text-slate-800">
                            Etapa {stageNumber}/12: {deed.stage}
                          </span>
                          <span className="text-slate-500">{progressPercent}%</span>
                        </div>
                        <div className="w-full bg-slate-200 h-2 rounded-full overflow-hidden">
                          <div
                            className="bg-slate-900 h-2 rounded-full transition-all duration-300"
                            style={{ width: `${progressPercent}%` }}
                          />
                        </div>
                      </td>

                      {/* Situación / Nota Legal */}
                      <td className="py-3 px-4 min-w-[210px]">
                        <div className={`p-2 rounded-md border text-[11px] space-y-0.5 ${noteStyle.container}`}>
                          <div className="flex items-center justify-between">
                            <span className="font-bold text-[9px] uppercase tracking-wider flex items-center gap-1">
                              <MessageSquareWarning className={`w-3 h-3 shrink-0 ${noteStyle.iconColor}`} />
                              <span>{noteStyle.label}</span>
                            </span>
                            <button
                              type="button"
                              onClick={() => handleOpenEditNote(deed)}
                              className="text-[10px] font-bold text-slate-700 hover:text-slate-900 flex items-center gap-0.5 underline cursor-pointer"
                            >
                              <Edit3 className="w-2.5 h-2.5" /> Editar
                            </button>
                          </div>
                          <div className="line-clamp-2 text-[10px] font-medium leading-tight">
                            {deed.notes || 'Normal'}
                          </div>
                        </div>
                      </td>

                      {/* Presupuesto */}
                      <td className="py-3 px-4 text-right font-bold text-slate-900">
                        ${totalBudget.toFixed(2)}
                      </td>

                      {/* Abonado */}
                      <td className="py-3 px-4 text-right font-bold text-emerald-600">
                        ${totalPaid.toFixed(2)}
                      </td>

                      {/* Saldo */}
                      <td className="py-3 px-4 text-right font-bold text-amber-700">
                        ${pendingBalance.toFixed(2)}
                      </td>

                      {/* Acciones */}
                      <td className="py-3 px-4 text-center">
                        <button
                          type="button"
                          onClick={() => {
                            setSelectedDeedForPayment(deed);
                            setPaymentForm({
                              amount_paid: '',
                              payment_method: 'Transferencia Bancaria',
                              concept_detail: `Abono de Escrituración - Etapa ${deed.stage}`,
                            });
                            setPaymentModalOpen(true);
                          }}
                          className="px-2.5 py-1 rounded bg-indigo-50 hover:bg-indigo-100 text-indigo-900 border border-indigo-200 font-bold text-[11px] cursor-pointer transition inline-flex items-center gap-1 shadow-xs"
                        >
                          <CreditCard className="w-3 h-3 text-indigo-700" />
                          <span>Recibo ADM</span>
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ================= MODAL 1: INICIAR EXPEDIENTE DE ESCRITURA (/escrituras/iniciartramite) ================= */}
      {createModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-fade-in">
          <div className="bg-white rounded-lg shadow-xl border border-slate-200 w-full max-w-lg overflow-hidden">
            <div className="p-4 border-b border-slate-100 bg-slate-50 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Scale className="w-5 h-5 text-slate-800" />
                <div>
                  <h3 className="font-bold text-sm text-slate-900">Iniciar Trámite de Escritura</h3>
                  <span className="text-[10px] text-slate-500 font-mono">Ruta: /escrituras/iniciartramite</span>
                </div>
              </div>
              <button
                type="button"
                onClick={handleCloseCreateModal}
                className="text-slate-400 hover:text-slate-600 cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleCreateDeed} className="p-5 space-y-3.5 text-xs">
              {/* Selección de Proyecto y Lote (Sincronización Bidireccional Automática) */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-bold text-slate-700 mb-1">Proyecto Asignado *</label>
                  <select
                    required
                    value={newDeed.project_id}
                    onChange={(e) => handleProjectChangeInForm(e.target.value)}
                    className="w-full px-3 py-2 rounded-md border border-slate-200 bg-slate-50 text-slate-800 font-bold focus:ring-1 focus:ring-slate-900"
                  >
                    <option value="">-- Seleccionar Proyecto --</option>
                    {projectsList.map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.name}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block font-bold text-slate-700 mb-1">Lote del Proyecto *</label>
                  <select
                    required
                    value={newDeed.lot_id}
                    onChange={(e) => handleLotChangeInForm(e.target.value)}
                    disabled={loadingLots || !newDeed.project_id}
                    className="w-full px-3 py-2 rounded-md border border-slate-200 bg-slate-50 text-slate-800 font-medium focus:ring-1 focus:ring-slate-900 disabled:opacity-50"
                  >
                    <option value="">
                      {loadingLots
                        ? 'Cargando lotes vendidos...'
                        : projectLots.length > 0
                        ? '-- Seleccionar Lote Vendido --'
                        : '-- No hay lotes vendidos en este proyecto --'}
                    </option>
                    {projectLots.map((l) => (
                      <option key={l.id} value={l.id}>
                        {formatLotBadge(l.lot_number)} {l.customer?.name ? `(Titular: ${l.customer.name})` : ''}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Cliente Solicitante / Titular con Sincronización Automática con Lote */}
              <div>
                <label className="block font-bold text-slate-700 mb-1">Cliente Solicitante / Titular *</label>
                <select
                  required
                  value={newDeed.customer_id}
                  onChange={(e) => handleCustomerChangeInForm(e.target.value)}
                  disabled={loadingLots || !newDeed.project_id}
                  className="w-full px-3 py-2 rounded-md border border-slate-200 bg-slate-50 text-slate-800 font-medium focus:ring-1 focus:ring-slate-900 disabled:opacity-50"
                >
                  <option value="">
                    {loadingLots
                      ? 'Cargando clientes...'
                      : availableProjectCustomers.length > 0
                      ? '-- Seleccionar Cliente Titular --'
                      : '-- Sin clientes con lotes en este proyecto --'}
                  </option>
                  {availableProjectCustomers.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name} {c.id_card ? `(C.I: ${c.id_card})` : ''}
                    </option>
                  ))}
                </select>
                {newDeed.lot_id && newDeed.customer_id && (
                  <p className="text-[10px] text-emerald-700 font-semibold mt-1 flex items-center gap-1">
                    <CheckCircle2 className="w-3 h-3 text-emerald-600" />
                    <span>Lote y Cliente sincronizados bidireccionalmente.</span>
                  </p>
                )}
              </div>

              {/* Administrador Responsable (Fijo si es Admin activo, Seleccionable por CEO) */}
              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="block font-bold text-slate-700">Administrador Responsable *</label>
                  {isSuperAdmin && (
                    <span className="text-[10px] text-indigo-700 font-semibold">Preseleccionado según proyecto</span>
                  )}
                </div>
                {userRole === 'Administrador' ? (
                  <div className="relative">
                    <div className="w-full px-3 py-2 rounded-md border border-slate-200 bg-slate-100 text-slate-800 font-bold flex items-center justify-between shadow-2xs">
                      <div className="flex items-center gap-2 truncate">
                        <User className="w-3.5 h-3.5 text-slate-500 shrink-0" />
                        <span className="truncate">
                          {activeAdminObj?.name
                            ? (activeAdminObj.name.includes('(Sesión Activa)')
                                ? activeAdminObj.name
                                : `${activeAdminObj.name} (Sesión Activa)`)
                            : 'Lic. Valeria Gómez - Administradora (Sesión Activa)'}
                        </span>
                      </div>
                      <span className="text-[10px] bg-emerald-100 text-emerald-800 px-2 py-0.5 rounded-full font-bold shrink-0">
                        Sesión Activa
                      </span>
                    </div>
                  </div>
                ) : (
                  <select
                    required
                    value={newDeed.assigned_admin_id}
                    onChange={(e) => setNewDeed({ ...newDeed, assigned_admin_id: e.target.value })}
                    className="w-full px-3 py-2 rounded-md border border-slate-200 bg-slate-50 text-slate-800 font-medium focus:ring-1 focus:ring-slate-900"
                  >
                    {adminsList.map((a) => {
                      const isAssigned =
                        a.assigned_projects?.some((p) => String(p.id) === String(newDeed.project_id)) ||
                        a.assignedProjects?.some((p) => String(p.id) === String(newDeed.project_id));
                      return (
                        <option key={a.id} value={a.id}>
                          {a.name} {isAssigned ? '(Asignado al proyecto)' : ''}
                        </option>
                      );
                    })}
                  </select>
                )}
              </div>

              {/* Etapa Inicial y Presupuesto */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-bold text-slate-700 mb-1">Etapa Inicial</label>
                  <select
                    value={newDeed.stage}
                    onChange={(e) => setNewDeed({ ...newDeed, stage: e.target.value })}
                    className="w-full px-3 py-2 rounded-md border border-slate-200 bg-slate-50 text-slate-800 font-bold focus:ring-1 focus:ring-slate-900"
                  >
                    {STAGES.map((s, idx) => (
                      <option key={s} value={s}>
                        {idx + 1}. {s}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block font-bold text-slate-700 mb-1">Presupuesto Trámite ($ USD)</label>
                  <input
                    type="number"
                    step="0.01"
                    value={newDeed.total_budget}
                    onChange={(e) => setNewDeed({ ...newDeed, total_budget: e.target.value })}
                    placeholder="1500.00"
                    className="w-full px-3 py-2 rounded-md border border-slate-200 font-bold text-slate-900"
                  />
                </div>
              </div>

              {/* Notas Legales / Referencias con Botones Rápidos (Chips Clicables) */}
              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="block font-bold text-slate-700">Notas Legales / Referencias</label>
                  <span className="text-[10px] text-slate-400">Clic en un motivo para autocompletar</span>
                </div>
                <textarea
                  rows="2"
                  value={newDeed.notes}
                  onChange={(e) => setNewDeed({ ...newDeed, notes: e.target.value })}
                  placeholder="Detalles sobre minutas, estado en notaría o juzgado, presupuesto, etc..."
                  className="w-full px-3 py-2 rounded-md border border-slate-200 text-xs focus:ring-1 focus:ring-slate-900 mb-2 font-medium"
                />

                {/* Chips Rápidos de Motivos Frecuentes */}
                <div className="flex flex-wrap gap-1.5">
                  {QUICK_NOTE_CHIPS.map((chip) => (
                    <button
                      key={chip}
                      type="button"
                      onClick={() => setNewDeed({ ...newDeed, notes: chip })}
                      className={`text-[10px] px-2.5 py-1 rounded-md border transition cursor-pointer text-left font-semibold ${
                        newDeed.notes === chip
                          ? 'bg-slate-900 text-white border-slate-900 shadow-2xs'
                          : 'bg-slate-100 hover:bg-slate-200 text-slate-700 border-slate-200'
                      }`}
                    >
                      {chip}
                    </button>
                  ))}
                </div>
              </div>

              <div className="pt-3 border-t border-slate-100 flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={handleCloseCreateModal}
                  className="px-4 py-2 text-slate-600 hover:bg-slate-100 rounded-md font-medium cursor-pointer"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="px-4 py-2 bg-slate-900 hover:bg-slate-800 text-white font-bold rounded-md flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
                >
                  {submitting && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                  <span>Registrar Trámite</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ================= MODAL 2: EDITAR RÁPIDAMENTE NOTA DE SITUACIÓN / BLOQUEO (PUT /api/deeds/{id}) ================= */}
      {editNoteModalOpen && selectedDeedForNote && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-fade-in">
          <div className="bg-white rounded-lg shadow-xl border border-slate-200 w-full max-w-lg overflow-hidden">
            <div className="p-4 border-b border-slate-100 bg-slate-900 text-white flex items-center justify-between">
              <div className="flex items-center gap-2">
                <MessageSquareWarning className="w-5 h-5 text-amber-400" />
                <div>
                  <h3 className="font-bold text-sm">Actualizar Nota de Situación / Bloqueo</h3>
                  <p className="text-[10px] text-slate-300">
                    EXP #{selectedDeedForNote.id} &bull; {selectedDeedForNote.customer?.name} &bull; Etapa: {selectedDeedForNote.stage}
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setEditNoteModalOpen(false)}
                className="text-slate-400 hover:text-white cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSaveNote} className="p-5 space-y-3.5 text-xs">
              <div className="bg-slate-50 p-3 rounded-md border border-slate-200 space-y-1">
                <div className="flex justify-between text-[11px] font-bold text-slate-800">
                  <span>Proyecto: {selectedDeedForNote.project?.name}</span>
                  <span>{formatLotBadge(selectedDeedForNote.lot?.lot_number)}</span>
                </div>
                <div className="text-[10px] text-slate-500">
                  Presupuesto Total: ${Number(selectedDeedForNote.total_budget || 0).toFixed(2)} | Abonado: ${Number(selectedDeedForNote.payments_sum_amount_paid || 0).toFixed(2)}
                </div>
              </div>

              <div>
                <label className="block font-bold text-slate-700 mb-1">
                  Nota de Situación Legal / Presupuestaria *
                </label>
                <textarea
                  rows="3"
                  required
                  value={noteEditText}
                  onChange={(e) => setNoteEditText(e.target.value)}
                  placeholder="Escribe la situación actual, motivo de bloqueo o avance del trámite..."
                  className="w-full px-3 py-2 rounded-md border border-slate-200 text-xs focus:ring-1 focus:ring-slate-900 font-medium"
                />
              </div>

              {/* Chips Rápidos en el Modal de Edición */}
              <div className="space-y-1">
                <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block">
                  Motivos Frecuentes (Clic para autocompletar en 1 clic):
                </span>
                <div className="flex flex-col gap-1.5">
                  {QUICK_NOTE_CHIPS.map((chip) => (
                    <button
                      key={chip}
                      type="button"
                      onClick={() => setNoteEditText(chip)}
                      className={`text-[11px] p-2 rounded border text-left transition cursor-pointer flex items-center justify-between font-semibold ${
                        noteEditText === chip
                          ? 'bg-slate-900 text-white border-slate-900'
                          : 'bg-slate-50 hover:bg-slate-100 text-slate-700 border-slate-200'
                      }`}
                    >
                      <span>{chip}</span>
                      {noteEditText === chip && <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 shrink-0" />}
                    </button>
                  ))}
                </div>
              </div>

              <div className="pt-3 border-t border-slate-100 flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setEditNoteModalOpen(false)}
                  className="px-4 py-2 text-slate-600 hover:bg-slate-100 rounded-md font-medium cursor-pointer"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={updatingNote}
                  className="px-4 py-2 bg-slate-900 hover:bg-slate-800 text-white font-bold rounded-md flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
                >
                  {updatingNote && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                  <span>Guardar Nota</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ================= MODAL 3: REGISTRAR COBRO MUNICIPAL / NOTARIAL (RECIBERA ADM) ================= */}
      {paymentModalOpen && selectedDeedForPayment && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-fade-in">
          <div className="bg-white rounded-lg shadow-xl border border-slate-200 w-full max-w-md overflow-hidden">
            <div className="p-4 border-b border-slate-100 bg-slate-900 text-white flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Building2 className="w-4 h-4 text-teal-400" />
                <div>
                  <h3 className="font-bold text-sm">Recibo de Área Administrativa (ADM)</h3>
                  <p className="text-[10px] text-slate-300">Cobro de Escrituras, Notaría y Municipio</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setPaymentModalOpen(false)}
                className="text-slate-400 hover:text-white cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleProcessAdmPayment} className="p-5 space-y-3.5 text-xs">
              {/* Resumen Expediente */}
              <div className="bg-slate-50 p-2.5 rounded-md border border-slate-200 text-slate-700 space-y-0.5">
                <div className="font-bold text-slate-900">
                  {selectedDeedForPayment.customer?.name}
                </div>
                <div className="text-[11px] text-slate-500">
                  {selectedDeedForPayment.project?.name} &bull; {formatLotBadge(selectedDeedForPayment.lot?.lot_number)} &bull; Etapa: {selectedDeedForPayment.stage}
                </div>
                <div className="flex justify-between pt-1 border-t border-slate-200 font-bold text-[11px]">
                  <span>Presupuesto: ${Number(selectedDeedForPayment.total_budget || 0).toFixed(2)}</span>
                  <span className="text-amber-700">
                    Saldo: ${(Number(selectedDeedForPayment.total_budget || 0) - Number(selectedDeedForPayment.payments_sum_amount_paid || 0)).toFixed(2)}
                  </span>
                </div>
              </div>

              {/* Monto */}
              <div>
                <label className="block font-bold text-slate-700 mb-1">Monto del Cobro ($ USD) *</label>
                <input
                  type="number"
                  step="0.01"
                  required
                  autoFocus
                  value={paymentForm.amount_paid}
                  onChange={(e) => setPaymentForm({ ...paymentForm, amount_paid: e.target.value })}
                  placeholder="Ej. 250.00"
                  className="w-full px-3 py-2 rounded-md border border-slate-200 font-bold text-sm text-slate-900 focus:outline-none focus:ring-1 focus:ring-slate-900"
                />
              </div>

              {/* Concepto Detallado */}
              <div>
                <label className="block font-bold text-slate-700 mb-1">Concepto Detallado *</label>
                <input
                  type="text"
                  required
                  value={paymentForm.concept_detail}
                  onChange={(e) => setPaymentForm({ ...paymentForm, concept_detail: e.target.value })}
                  placeholder="Ej. Pago de Hipoteca / Alcabalas Municipio"
                  className="w-full px-3 py-2 rounded-md border border-slate-200 text-xs text-slate-800"
                />
              </div>

              {/* Método de Pago */}
              <div>
                <label className="block font-bold text-slate-700 mb-1">Método de Pago *</label>
                <select
                  value={paymentForm.payment_method}
                  onChange={(e) => setPaymentForm({ ...paymentForm, payment_method: e.target.value })}
                  className="w-full px-3 py-2 rounded-md border border-slate-200 bg-slate-50 font-medium text-slate-800"
                >
                  <option value="Transferencia Bancaria">Transferencia Bancaria</option>
                  <option value="Efectivo">Efectivo en Caja</option>
                  <option value="Depósito">Depósito Bancario</option>
                </select>
              </div>

              {/* N° de Comprobante / Referencia Bancaria (Obligatorio para Transferencia y Depósito) */}
              {(paymentForm.payment_method === 'Transferencia Bancaria' || paymentForm.payment_method === 'Depósito' || paymentForm.payment_method?.toLowerCase().includes('transferencia') || paymentForm.payment_method?.toLowerCase().includes('depósito') || paymentForm.payment_method?.toLowerCase().includes('deposito')) && (
                <div className="p-2.5 bg-amber-50/70 border border-amber-300 rounded-md space-y-1 animate-fade-in">
                  <label className="block font-bold text-amber-950 text-xs">
                    N° de Comprobante / Referencia Bancaria <span className="text-rose-600">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    value={paymentForm.bank_reference}
                    onChange={(e) => setPaymentForm({ ...paymentForm, bank_reference: e.target.value })}
                    placeholder="Ej. Comp. 0048291"
                    className="w-full px-3 py-2 rounded-md border border-amber-300 bg-white font-bold text-xs text-slate-900 focus:outline-none focus:ring-1 focus:ring-amber-500 shadow-inner"
                  />
                  {(!paymentForm.bank_reference || !paymentForm.bank_reference.trim()) ? (
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

              {/* Pad de Firma Digital del Cliente / Solicitante */}
              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="font-bold text-slate-700 text-xs">Firma del Cliente / Solicitante (Pad Táctil / Ratón)</label>
                  <button
                    type="button"
                    onClick={() => sigCanvasRef.current?.clear()}
                    className="text-[10px] text-slate-400 hover:text-slate-700 flex items-center gap-1 cursor-pointer"
                  >
                    <RotateCcw className="w-3 h-3" /> Limpiar
                  </button>
                </div>
                <div className="border border-slate-200 rounded-md bg-slate-50 overflow-hidden relative">
                  <SignatureCanvas
                    ref={sigCanvasRef}
                    penColor="#0f172a"
                    canvasProps={{
                      className: 'w-full h-24 cursor-crosshair',
                    }}
                  />
                  <div className="absolute bottom-1 right-2 pointer-events-none text-[9px] text-slate-400 font-mono select-none">
                    PAD CLIENTE &bull; VENDE & MÁS
                  </div>
                </div>
                <p className="text-[10px] text-slate-500 mt-1">
                  Firma del cliente / solicitante que abona al trámite. La firma del administrador responsable se estampa automáticamente desde su propio perfil de usuario.
                </p>
              </div>

              {(() => {
                const isFormBankMethod = paymentForm.payment_method === 'Transferencia Bancaria' || paymentForm.payment_method === 'Depósito' || paymentForm.payment_method?.toLowerCase().includes('transferencia') || paymentForm.payment_method?.toLowerCase().includes('depósito') || paymentForm.payment_method?.toLowerCase().includes('deposito');
                const isMissingRef = isFormBankMethod && (!paymentForm.bank_reference || paymentForm.bank_reference.trim().length < 3);

                return (
                  <>
                    {isMissingRef && (
                      <div className="p-2 rounded-md bg-rose-50 border border-rose-200 text-rose-700 text-xs font-bold text-center">
                        ⚠️ Debe ingresar el número de comprobante o referencia bancaria
                      </div>
                    )}

                    <div className="pt-2 border-t border-slate-100 flex items-center justify-end gap-2">
                      <button
                        type="button"
                        onClick={() => setPaymentModalOpen(false)}
                        className="px-3 py-1.5 text-slate-600 hover:bg-slate-100 rounded-md font-medium cursor-pointer"
                      >
                        Cancelar
                      </button>
                      <button
                        type="submit"
                        disabled={submitting || isMissingRef}
                        className="px-4 py-2 bg-slate-900 hover:bg-slate-800 text-white font-bold rounded-md flex items-center gap-1.5 cursor-pointer shadow-xs disabled:opacity-50 disabled:cursor-not-allowed"
                      >
                        {submitting && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                        <span>Emitir Recibo ADM &bull; PDF</span>
                      </button>
                    </div>
                  </>
                );
              })()}
            </form>
          </div>
        </div>
      )}

      {/* ================= MODAL DE NOTIFICACIÓN WHATSAPP Y CONFIRMACIÓN DE COBRO ADM ================= */}
      {paymentSuccessModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-fade-in">
          <div className="bg-white rounded-xl shadow-2xl border border-slate-200 w-full max-w-lg overflow-hidden animate-scale-in">
            <div className="p-4 border-b border-slate-100 bg-emerald-50/90 flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-full bg-emerald-600 text-white flex items-center justify-center shadow-xs">
                  <CheckCircle2 className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="font-extrabold text-sm text-emerald-950">¡Cobro Registrado con Éxito!</h3>
                  <p className="text-[11px] text-emerald-800 font-medium">
                    Recibo Oficial emitido: <b>{paymentSuccessModal.receiptCode}</b> (Recibera ADM)
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setPaymentSuccessModal(null)}
                className="text-slate-400 hover:text-slate-600 p-1 rounded-md cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-5 space-y-4 text-xs">
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
                    <span className="text-slate-400 block text-[10px]">Proyecto / Lote:</span>
                    <strong className="text-slate-800">{paymentSuccessModal.projectName}</strong>
                  </div>
                </div>
                <div className="text-[11px] text-slate-600 pt-1 border-t border-slate-200/60">
                  <span className="text-slate-400 block text-[10px]">Concepto:</span>
                  <span className="text-slate-800">{paymentSuccessModal.concept}</span>
                </div>
              </div>

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
                className="w-full py-2.5 px-4 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs flex items-center justify-center gap-2 shadow-xs transition cursor-pointer"
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
                className="w-full py-2.5 px-4 rounded-lg bg-emerald-50 hover:bg-emerald-100 text-emerald-900 border border-emerald-300 font-bold text-xs flex items-center justify-center gap-2 shadow-xs transition cursor-pointer"
              >
                <MessageCircle className="w-4 h-4 text-emerald-700" />
                <span>📲 Reportar Cobro al CEO (WhatsApp)</span>
              </button>

              <div className="flex items-center gap-2 pt-1">
                {/* Botón Abrir PDF */}
                <a
                  href={paymentSuccessModal.receiptUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="flex-1 py-2 px-3 rounded-md bg-slate-900 hover:bg-slate-800 text-white font-semibold text-xs flex items-center justify-center gap-1.5 transition shadow-xs cursor-pointer"
                >
                  <Download className="w-3.5 h-3.5" />
                  <span>Abrir Recibo (PDF)</span>
                </a>

              </div>

              <button
                type="button"
                onClick={() => setPaymentSuccessModal(null)}
                className="w-full py-1 text-center text-xs font-semibold text-slate-400 hover:text-slate-700 transition cursor-pointer"
              >
                Cerrar Ventana
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
