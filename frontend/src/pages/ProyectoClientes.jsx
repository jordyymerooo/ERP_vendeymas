import React, { useState, useRef, useEffect } from 'react';
import { useParams, useNavigate, useLocation } from 'react-router-dom';
import axios from 'axios';
import SignatureCanvas from 'react-signature-canvas';
import {
  ArrowLeft,
  LayoutGrid,
  Receipt,
  Search,
  User,
  MapPin,
  DollarSign,
  CheckCircle,
  RotateCcw,
  CreditCard,
  Building2,
  Loader2,
  Plus,
  UserCheck,
  UserPlus,
  X,
  AlertCircle,
  Download,
  Layers,
  ArrowRight,
  Filter,
  AlertTriangle,
  Calendar,
  ShieldCheck,
  FileText,
  UploadCloud,
  Paperclip,
  Trash2,
  ExternalLink,
  FileCheck2,
  FolderArchive,
  Image as ImageIcon,
  Compass,
  Map as MapIcon,
  Maximize2,
  Ban,
  ShieldAlert,
  FileSpreadsheet,
} from 'lucide-react';
import AmortizationModal from '../components/AmortizationModal';

export default function ProyectoClientes({ defaultTab = 'lotes' }) {
  const { id } = useParams();
  const navigate = useNavigate();
  const location = useLocation();

  // Sincronización real de pestaña con la URL (/lotes vs /clientes)
  const getTabFromPath = () => {
    if (location.pathname.endsWith('/clientes')) return 'cobros';
    if (location.pathname.endsWith('/lotes')) return 'lotes';
    return defaultTab || 'lotes';
  };

  const [activeTab, setActiveTab] = useState(getTabFromPath);

  // Estados generales del proyecto
  const [projectInfo, setProjectInfo] = useState(null);
  const [toastMessage, setToastMessage] = useState(null);

  // ==========================================================
  // ESTADOS PESTAÑA 1: INVENTARIO DE LOTES (CUADRÍCULA O MAPA)
  // ==========================================================
  const [lotes, setLotes] = useState([]);
  const [lotesSummary, setLotesSummary] = useState({ total_lots: 0, available_lots: 0, sold_lots: 0 });
  const [loadingLotes, setLoadingLotes] = useState(true);

  // Interruptor de Vista: 'grid' (Cuadrícula) o 'map' (Mapa en Tiempo Real)

  // Filtros interactivos para Lotes
  const [lotFilter, setLotFilter] = useState('TODOS'); // 'TODOS' | 'DISPONIBLE' | 'VENDIDO'
  const [lotSearchTerm, setLotSearchTerm] = useState('');

  // Modales de lotes
  const [isAddLotModalOpen, setIsAddLotModalOpen] = useState(false);
  const [isSubmittingLot, setIsSubmittingLot] = useState(false);
  const [newLotForm, setNewLotForm] = useState({ lot_number: '', area_m2: '200', total_price: '25000' });

  // Modal para Asignar Cliente con Cuotas y Día de Pago
  const [isAssignModalOpen, setIsAssignModalOpen] = useState(false);
  const [isSubmittingAssign, setIsSubmittingAssign] = useState(false);
  const [selectedLotForAssign, setSelectedLotForAssign] = useState(null);
  const [selectedCustomerForAssign, setSelectedCustomerForAssign] = useState('');
  const [installmentsCount, setInstallmentsCount] = useState('12');
  const [paymentDay, setPaymentDay] = useState('15');
  const [allCustomers, setAllCustomers] = useState([]);

  // Estados para Registro Rápido de Nuevo Cliente en el Modal de Venta
  const [showNewCustomerForm, setShowNewCustomerForm] = useState(false);
  const [isSavingNewCustomer, setIsSavingNewCustomer] = useState(false);
  const [newCustomerData, setNewCustomerData] = useState({
    name: '',
    id_card: '',
    phone: '',
    email: '',
  });

  // ==========================================================
  // ESTADOS PESTAÑA 2: COBROS, RECIBOS Y DOCUMENTOS
  // ==========================================================
  const [clientes, setClientes] = useState([]);
  const [selectedCliente, setSelectedCliente] = useState(null);
  const [loadingClientes, setLoadingClientes] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [customerMoraFilter, setCustomerMoraFilter] = useState('TODOS'); // 'TODOS' | 'AL DÍA' | 'EN MORA'

  // Documentos y Contratos Vinculados
  const [clientDocuments, setClientDocuments] = useState([]);
  const [loadingDocs, setLoadingDocs] = useState(false);
  const [isUploadDocModalOpen, setIsUploadDocModalOpen] = useState(false);
  const [isSubmittingDoc, setIsSubmittingDoc] = useState(false);
  const [docLotId, setDocLotId] = useState('');
  const [docType, setDocType] = useState('Promesa de Compraventa');
  const [docFile, setDocFile] = useState(null);

  // Formulario de emisión de recibo
  const [selectedLotId, setSelectedLotId] = useState('');
  const [monto, setMonto] = useState('');
  const [metodoPago, setMetodoPago] = useState('Transferencia');
  const [isSubmittingPayment, setIsSubmittingPayment] = useState(false);
  const [mensajeExito, setMensajeExito] = useState(null);

  // Rol del usuario activo
  const [userRole, setUserRole] = useState(() => localStorage.getItem('user_role') || 'Super Admin');
  const isSuperAdmin = userRole === 'Super Admin';

  useEffect(() => {
    const handleAuthChange = () => {
      setUserRole(localStorage.getItem('user_role') || 'Super Admin');
    };
    window.addEventListener('storage', handleAuthChange);
    window.addEventListener('auth-change', handleAuthChange);
    return () => {
      window.removeEventListener('storage', handleAuthChange);
      window.removeEventListener('auth-change', handleAuthChange);
    };
  }, []);

  // Modal para Anulación de Comprobante Contable
  const [isVoidModalOpen, setIsVoidModalOpen] = useState(false);
  const [selectedPaymentForVoid, setSelectedPaymentForVoid] = useState(null);
  const [voidReason, setVoidReason] = useState('');
  const [isSubmittingVoid, setIsSubmittingVoid] = useState(false);
  const [voidError, setVoidError] = useState(null);

  // Modal para Cronograma de Pagos y Amortización
  const [amortizationModalOpen, setAmortizationModalOpen] = useState(false);
  const [amortizationLotId, setAmortizationLotId] = useState(null);

  const sigCanvasRef = useRef(null);
  const fileInputRef = useRef(null);

  // Sincronizar activeTab cuando cambie la URL del navegador
  useEffect(() => {
    setActiveTab(getTabFromPath());
  }, [location.pathname]);

  const handleTabChange = (newTab) => {
    setActiveTab(newTab);
    if (newTab === 'lotes') {
      navigate(`/proyectos/${id}/lotes`);
    } else {
      navigate(`/proyectos/${id}/clientes`);
    }
  };

  // ==========================================================
  // CARGAS DE DATOS DEL PROYECTO
  // ==========================================================
  const fetchLotes = async () => {
    setLoadingLotes(true);
    try {
      const res = await axios.get(`/api/projects/${id}/lots`);
      const lotsData = res.data.data || [];
      setLotes(lotsData);
      if (res.data.summary) {
        setLotesSummary(res.data.summary);
      }
      if (res.data.project) {
        setProjectInfo(res.data.project);
      }
      if (lotsData.length > 0 && !selectedMapLot) {
        setSelectedMapLot(lotsData[0]);
      }
    } catch (err) {
      console.error('Error al cargar lotes:', err);
    } finally {
      setLoadingLotes(false);
    }
  };

  const fetchProyectoClientes = async () => {
    setLoadingClientes(true);
    try {
      const res = await axios.get(`/api/projects/${id}/customers`);
      const clientesData = res.data.data || [];
      setClientes(clientesData);
      if (res.data.project) {
        setProjectInfo(res.data.project);
      }

      if (clientesData.length > 0) {
        setSelectedCliente((prev) => {
          if (!prev) return clientesData[0];
          const found = clientesData.find((c) => c.id === prev.id);
          return found || clientesData[0];
        });

        const primer = clientesData[0];
        if (primer.lots && primer.lots.length > 0) {
          setSelectedLotId(primer.lots[0].id);
          setDocLotId(primer.lots[0].id);
        }
        setMonto(primer.cuotaSugerida || primer.cuotaMensual || 1000);
      } else {
        setSelectedCliente(null);
      }
    } catch (err) {
      console.error('Error al cargar clientes del proyecto:', err);
    } finally {
      setLoadingClientes(false);
    }
  };

  const fetchAllCustomers = async () => {
    try {
      const res = await axios.get('/api/customers?page=1');
      setAllCustomers(res.data.data || []);
      if (res.data.data && res.data.data.length > 0) {
        setSelectedCustomerForAssign(String(res.data.data[0].id));
      }
    } catch (err) {
      console.error('Error al cargar lista global de clientes:', err);
    }
  };

  const fetchCustomerDocuments = async (customerId) => {
    if (!customerId) return;
    setLoadingDocs(true);
    try {
      const res = await axios.get(`/api/customers/${customerId}/documents`);
      setClientDocuments(res.data.data || []);
    } catch (err) {
      console.error('Error al cargar documentos del cliente:', err);
    } finally {
      setLoadingDocs(false);
    }
  };

  useEffect(() => {
    fetchLotes();
    fetchProyectoClientes();
    fetchAllCustomers();
  }, [id]);

  useEffect(() => {
    if (selectedCliente) {
      fetchCustomerDocuments(selectedCliente.id);
      if (selectedCliente.lots && selectedCliente.lots.length > 0) {
        setDocLotId(selectedCliente.lots[0].id);
      }
    } else {
      setClientDocuments([]);
    }
  }, [selectedCliente?.id]);

  // ==========================================================
  // ACCIONES DE LOTES
  // ==========================================================
  const handleGuardarNuevoLote = async (e) => {
    e.preventDefault();
    if (!newLotForm.lot_number.trim()) return;

    setIsSubmittingLot(true);
    try {
      await axios.post(`/api/projects/${id}/lots`, {
        lot_number: newLotForm.lot_number.trim(),
        area_m2: Number(newLotForm.area_m2) || 200,
        total_price: Number(newLotForm.total_price) || 25000,
        status: 'Disponible',
      });

      setToastMessage(`Lote ${newLotForm.lot_number} registrado con éxito.`);
      setIsAddLotModalOpen(false);
      setNewLotForm({ lot_number: '', area_m2: '200', total_price: '25000' });
      fetchLotes();
    } catch (err) {
      console.error('Error al registrar lote:', err);
      setToastMessage('Error al registrar el lote en el sistema.');
    } finally {
      setIsSubmittingLot(false);
      setTimeout(() => setToastMessage(null), 4500);
    }
  };

  const handleOpenAssignModal = (lote) => {
    setSelectedLotForAssign(lote);
    setInstallmentsCount('12');
    setPaymentDay('15');
    setShowNewCustomerForm(false);
    setNewCustomerData({ name: '', id_card: '', phone: '', email: '' });
    if (allCustomers.length > 0) {
      setSelectedCustomerForAssign(String(allCustomers[0].id));
    } else {
      setSelectedCustomerForAssign('NEW');
      setShowNewCustomerForm(true);
    }
    setIsAssignModalOpen(true);
  };

  const handleCloseAssignModal = () => {
    setIsAssignModalOpen(false);
    setShowNewCustomerForm(false);
    setNewCustomerData({ name: '', id_card: '', phone: '', email: '' });
  };

  const handleSaveNewCustomer = async () => {
    if (!newCustomerData.name.trim()) {
      alert('Por favor ingrese el nombre completo del cliente.');
      return null;
    }
    if (!newCustomerData.id_card.trim()) {
      alert('Por favor ingrese el número de cédula o identificación.');
      return null;
    }

    setIsSavingNewCustomer(true);
    try {
      const res = await axios.post('/api/customers', {
        name: newCustomerData.name.trim(),
        id_card: newCustomerData.id_card.trim(),
        phone: newCustomerData.phone.trim() || 'S/N',
        email: newCustomerData.email.trim() || `${newCustomerData.id_card.trim().replace(/[^a-zA-Z0-9]/g, '')}@cliente.com`,
      });

      const created = res.data?.data;
      if (created) {
        setAllCustomers((prev) => [created, ...prev]);
        setSelectedCustomerForAssign(String(created.id));
        setShowNewCustomerForm(false);
        setNewCustomerData({ name: '', id_card: '', phone: '', email: '' });
        setToastMessage(`Cliente ${created.name} registrado con éxito.`);
        setTimeout(() => setToastMessage(null), 3000);
        return created;
      }
    } catch (err) {
      console.error('Error al registrar nuevo cliente:', err);
      const msg = err.response?.data?.message || 'Error al registrar el nuevo cliente.';
      alert(msg);
      return null;
    } finally {
      setIsSavingNewCustomer(false);
    }
  };

  const handleAssignSubmit = async (e) => {
    e.preventDefault();
    if (!selectedLotForAssign) return;

    let targetCustomerId = selectedCustomerForAssign;

    // Si tiene el formulario de nuevo cliente abierto, guardarlo primero
    if (showNewCustomerForm || targetCustomerId === 'NEW') {
      if (!newCustomerData.name.trim() || !newCustomerData.id_card.trim()) {
        alert('Por favor complete el nombre y la cédula del nuevo cliente, o cancele para elegir un cliente existente.');
        return;
      }
      const created = await handleSaveNewCustomer();
      if (!created) return;
      targetCustomerId = String(created.id);
    }

    const customerId = parseInt(targetCustomerId, 10);
    if (!customerId || isNaN(customerId)) {
      alert('Por favor seleccione un cliente comprador de la lista.');
      return;
    }

    const numCuotas = parseInt(installmentsCount, 10);
    if (!numCuotas || isNaN(numCuotas) || numCuotas < 1 || numCuotas > 120) {
      alert('Por favor ingrese un número de cuotas válido (entero entre 1 y 120).');
      return;
    }

    const diaPago = parseInt(paymentDay, 10);
    if (!diaPago || isNaN(diaPago) || diaPago < 1 || diaPago > 31) {
      alert('Por favor ingrese un día de pago mensual válido (entero entre 1 y 31).');
      return;
    }

    setIsSubmittingAssign(true);
    try {
      const res = await axios.put(`/api/lots/${selectedLotForAssign.id}/assign`, {
        customer_id: customerId,
        installments_count: numCuotas,
        payment_day: diaPago,
      });

      setToastMessage(res.data.message || 'Lote asignado y plan de cuotas pactado con éxito.');
      handleCloseAssignModal();
      fetchLotes();
      fetchProyectoClientes();
      fetchAllCustomers();
    } catch (err) {
      console.error('Error al asignar cliente a lote:', err);
      const msg = err.response?.data?.message || 'Error al asignar el cliente al lote.';
      setToastMessage(msg);
    } finally {
      setIsSubmittingAssign(false);
      setTimeout(() => setToastMessage(null), 4500);
    }
  };

  const handleIrACobrar = (lote) => {
    navigate(`/proyectos/${id}/clientes/pagar?lot_id=${lote.id}&customer_id=${lote.customer?.id || ''}`);
  };

  // ==========================================================
  // ACCIONES DE DOCUMENTOS Y CONTRATOS
  // ==========================================================
  const handleOpenUploadDocModal = () => {
    setDocType('Promesa de Compraventa');
    setDocFile(null);
    if (selectedCliente && selectedCliente.lots && selectedCliente.lots.length > 0) {
      setDocLotId(selectedCliente.lots[0].id);
    }
    setIsUploadDocModalOpen(true);
  };

  const handleUploadDocumentSubmit = async (e) => {
    e.preventDefault();
    if (!docFile || !docLotId || !selectedCliente) {
      alert('Por favor selecciona un lote y adjunta un archivo PDF o imagen.');
      return;
    }

    setIsSubmittingDoc(true);
    try {
      const formData = new FormData();
      formData.append('file', docFile);
      formData.append('document_type', docType);
      formData.append('customer_id', selectedCliente.id);

      await axios.post(
        `/api/lots/${docLotId}/documents`,
        formData,
        {
          headers: { 'Content-Type': 'multipart/form-data' },
        }
      );

      setToastMessage(`Documento "${docFile.name}" subido y vinculado con éxito.`);
      setIsUploadDocModalOpen(false);
      setDocFile(null);
      if (fileInputRef.current) fileInputRef.current.value = '';
      fetchCustomerDocuments(selectedCliente.id);
    } catch (err) {
      console.error('Error al subir documento:', err);
      alert('Error al subir el archivo al servidor. Verifica el formato y tamaño (máx 10MB).');
    } finally {
      setIsSubmittingDoc(false);
      setTimeout(() => setToastMessage(null), 4500);
    }
  };

  const handleDeleteDocument = async (docId, fileName) => {
    if (!window.confirm(`¿Estás seguro de eliminar el documento "${fileName}"? Esta acción no se puede deshacer.`)) {
      return;
    }

    try {
      await axios.delete(`/api/documents/${docId}`);
      setToastMessage(`Documento "${fileName}" eliminado.`);
      if (selectedCliente) {
        fetchCustomerDocuments(selectedCliente.id);
      }
    } catch (err) {
      console.error('Error al eliminar documento:', err);
      alert('Error al eliminar el documento en el backend.');
    } finally {
      setTimeout(() => setToastMessage(null), 4500);
    }
  };

  // ==========================================================
  // ACCIONES DE COBROS Y RECIBOS
  // ==========================================================
  const handleSelectCliente = (cliente) => {
    setSelectedCliente(cliente);
    if (cliente.lots && cliente.lots.length > 0) {
      setSelectedLotId(cliente.lots[0].id);
      setDocLotId(cliente.lots[0].id);
    }
    setMonto(cliente.cuotaSugerida || cliente.cuotaMensual || (cliente.saldoDeudor > 0 ? Math.min(cliente.saldoDeudor, 2000) : ''));
    setMensajeExito(null);
    if (sigCanvasRef.current) {
      sigCanvasRef.current.clear();
    }
  };

  const handleEmitirRecibo = async (e) => {
    e.preventDefault();
    if (!selectedCliente || !selectedLotId || !monto) return;

    let firmaData = null;
    if (sigCanvasRef.current && !sigCanvasRef.current.isEmpty()) {
      firmaData = sigCanvasRef.current.toDataURL('image/png');
    }

    setIsSubmittingPayment(true);
    try {
      const res = await axios.post('/api/payments', {
        lot_id: selectedLotId,
        amount_paid: Number(monto),
        payment_method: metodoPago,
        signature_base64: firmaData,
      });

      const paymentData = res.data.data;
      const receiptUrl = res.data.receipt_url;

      setMensajeExito({
        monto: Number(monto).toLocaleString('en-US', { minimumFractionDigits: 2 }),
        cliente: selectedCliente.nombre,
        metodo: metodoPago,
        reciboNum: 'REC-' + String(paymentData.id).padStart(5, '0'),
        receiptUrl: receiptUrl ? receiptUrl.replace(/https?:\/\/[^\/]+/, `http://${window.location.hostname}:8000`) : receiptUrl,
      });

      if (sigCanvasRef.current) {
        sigCanvasRef.current.clear();
      }

      await fetchProyectoClientes();
      await fetchLotes();
      window.dispatchEvent(new Event('notifications-updated'));
    } catch (err) {
      console.error('Error al registrar pago en backend:', err);
      alert('Error al procesar el pago.');
    } finally {
      setIsSubmittingPayment(false);
    }
  };

  // ==========================================================
  // ANULACIÓN CONTROLADA DE RECIBOS (SUPER ADMIN)
  // ==========================================================
  const handleOpenVoidModal = (payment) => {
    setSelectedPaymentForVoid(payment);
    setVoidReason('');
    setVoidError(null);
    setIsVoidModalOpen(true);
  };

  const handleConfirmVoidPayment = async (e) => {
    e.preventDefault();
    if (!voidReason.trim() || voidReason.trim().length < 5) {
      setVoidError('El motivo de anulación es obligatorio y debe tener al menos 5 caracteres.');
      return;
    }

    setIsSubmittingVoid(true);
    setVoidError(null);
    try {
      const paymentId =
        selectedPaymentForVoid.payment_id ||
        String(selectedPaymentForVoid.id).replace('REC-', '');

      const res = await axios.post(`/api/payments/${paymentId}/void`, {
        reason: voidReason.trim(),
      });

      setToastMessage(res.data.message || 'Comprobante contable anulado con éxito.');
      setIsVoidModalOpen(false);
      setSelectedPaymentForVoid(null);
      setVoidReason('');

      await fetchProyectoClientes();
      await fetchLotes();
      window.dispatchEvent(new Event('notifications-updated'));
    } catch (err) {
      console.error('Error al anular comprobante:', err);
      const msg = err.response?.data?.message || 'Error al procesar la anulación del comprobante.';
      setVoidError(msg);
      setToastMessage(msg);
    } finally {
      setIsSubmittingVoid(false);
      setTimeout(() => setToastMessage(null), 5000);
    }
  };

  // Filtrado de lotes en tiempo real
  const filteredLotes = lotes.filter((lote) => {
    const isSoldWithCustomer = lote.status === 'Vendido' && Boolean(lote.customer);
    const isDisponible = !isSoldWithCustomer;

    if (lotFilter === 'DISPONIBLE' && !isDisponible) return false;
    if (lotFilter === 'VENDIDO' && !isSoldWithCustomer) return false;

    if (!lotSearchTerm.trim()) return true;
    const term = lotSearchTerm.toLowerCase();
    const matchNumber = lote.lot_number?.toLowerCase().includes(term);
    const matchCustomer = lote.customer?.name?.toLowerCase().includes(term);
    return matchNumber || matchCustomer;
  });

  // Filtrado de clientes en la pestaña de cobros (incluyendo filtro de Mora)
  const filteredClientes = clientes.filter((c) => {
    if (customerMoraFilter === 'AL DÍA' && c.moraStatus !== 'AL DÍA') return false;
    if (customerMoraFilter === 'EN MORA' && c.moraStatus !== 'EN MORA') return false;

    if (!searchTerm.trim()) return true;
    const term = searchTerm.toLowerCase();
    return c.nombre.toLowerCase().includes(term) || c.documento.includes(term);
  });

  const displayProjectName = projectInfo?.nombre || projectInfo?.name || id?.replace(/-/g, ' ').toUpperCase();
  const mapCenter = [
    Number(projectInfo?.center_lat) || -0.9538,
    Number(projectInfo?.center_lng) || -80.7456,
  ];

  return (
    <div className="h-full flex flex-col space-y-4">
      {/* Toast Notification */}
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

      {/* ================= CABECERA SUPERIOR CON SELECTOR DE PESTAÑAS ================= */}
      <div className="bg-white rounded-lg border border-slate-200 p-4 sm:p-5 shadow-xs flex flex-col lg:flex-row lg:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={() => navigate('/proyectos')}
            className="inline-flex items-center gap-2 px-3 py-2 text-sm font-semibold text-slate-600 hover:text-slate-900 hover:bg-slate-100 rounded-xl transition duration-150 active:scale-95 cursor-pointer"
          >
            <ArrowLeft className="w-4 h-4" />
            <span>Volver a Proyectos</span>
          </button>
          <div className="h-6 w-px bg-slate-200 hidden sm:block" />
          <h1 className="text-lg sm:text-xl font-bold text-slate-900 truncate">
            {displayProjectName}
          </h1>
        </div>

        {/* Selector de Pestañas con actualización de URL */}
        <div className="flex flex-wrap items-center gap-3">
          <div className="inline-flex bg-slate-100 p-1 rounded-xl border border-slate-200/80">
            <button
              type="button"
              onClick={() => handleTabChange('lotes')}
              className={`inline-flex items-center gap-2 px-3.5 py-2 rounded-md text-xs font-semibold transition cursor-pointer ${activeTab === 'lotes'
                  ? 'bg-white text-slate-900 shadow-xs border border-slate-200'
                  : 'text-slate-600 hover:text-slate-900'
                }`}
            >
              <LayoutGrid className="w-4 h-4" />
              <span>Inventario de Lotes</span>
              <span className="px-1.5 py-0.5 rounded-md text-[10px] bg-slate-200 text-slate-700 font-semibold">
                {lotesSummary.total_lots}
              </span>
            </button>

            <button
              type="button"
              onClick={() => handleTabChange('cobros')}
              className={`inline-flex items-center gap-2 px-3.5 py-2 rounded-md text-xs font-semibold transition cursor-pointer ${activeTab === 'cobros'
                  ? 'bg-white text-slate-900 shadow-xs border border-slate-200'
                  : 'text-slate-600 hover:text-slate-900'
                }`}
            >
              <Receipt className="w-4 h-4" />
              <span>Clientes y Contratos</span>
              <span className="px-1.5 py-0.5 rounded-md text-[10px] bg-slate-200 text-slate-800 font-semibold">
                {clientes.length}
              </span>
            </button>

            <button
              type="button"
              onClick={() => navigate(`/proyectos/${id}/clientes/pagar`)}
              className="inline-flex items-center gap-1.5 px-3 py-2 rounded-md text-xs font-semibold text-white bg-slate-900 hover:bg-slate-800 transition cursor-pointer shadow-xs ml-1"
            >
              <CreditCard className="w-3.5 h-3.5" />
              <span>Ir a Cobrar</span>
            </button>
          </div>

          <div className="flex items-center gap-1.5 text-xs font-semibold text-cyan-800 bg-cyan-50 px-3 py-2 rounded-xl border border-cyan-100">
            <Building2 className="w-3.5 h-3.5 text-cyan-600" />
            <span>{projectInfo?.location || 'Ubicación Principal'}</span>
          </div>
        </div>
      </div>

      {/* ========================================================================= */}
      {/* VISTA PESTAÑA 1: INVENTARIO DE LOTES (CUADRÍCULA O MAPA EN TIEMPO REAL) */}
      {/* ========================================================================= */}
      {activeTab === 'lotes' && (
        <div className="space-y-5 animate-fade-in">
          {/* Contadores Estadísticos Interactivos en 3 Columnas */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 sm:gap-4">
            <button
              type="button"
              onClick={() => setLotFilter('TODOS')}
              className={`bg-white p-3.5 sm:p-4 rounded-lg border transition-all text-left flex items-center justify-between cursor-pointer ${
                lotFilter === 'TODOS'
                  ? 'border-slate-800 ring-1 ring-slate-800/10 shadow-xs bg-slate-50/50'
                  : 'border-slate-200 hover:border-slate-300'
              }`}
            >
              <div>
                <span className="text-xs font-medium text-slate-500 block mb-0.5">
                  Total Lotes
                </span>
                <span className="text-2xl font-bold text-slate-900">
                  {lotesSummary.total_lots}
                </span>
                <span className="text-[10px] font-semibold text-slate-500 block mt-0.5">
                  {lotFilter === 'TODOS' ? '• Filtro Activo' : 'Ver todos'}
                </span>
              </div>
              <div className={`w-9 h-9 rounded-md flex items-center justify-center ${lotFilter === 'TODOS' ? 'bg-slate-900 text-white' : 'bg-slate-100 text-slate-600'}`}>
                <Layers className="w-4 h-4" />
              </div>
            </button>

            <button
              type="button"
              onClick={() => setLotFilter('DISPONIBLE')}
              className={`bg-white p-3.5 sm:p-4 rounded-lg border transition-all text-left flex items-center justify-between cursor-pointer ${
                lotFilter === 'DISPONIBLE'
                  ? 'border-emerald-600 ring-1 ring-emerald-600/10 shadow-xs bg-emerald-50/30'
                  : 'border-slate-200 hover:border-slate-300'
              }`}
            >
              <div>
                <span className="text-xs font-semibold text-emerald-800 block mb-0.5">
                  Lotes Disponibles
                </span>
                <span className="text-2xl font-bold text-emerald-700">
                  {lotesSummary.available_lots}
                </span>
                <span className="text-[10px] font-semibold text-emerald-600 block mt-0.5">
                  {lotFilter === 'DISPONIBLE' ? '• Filtro Activo' : 'Filtrar disponibles'}
                </span>
              </div>
              <div className={`w-9 h-9 rounded-md flex items-center justify-center ${lotFilter === 'DISPONIBLE' ? 'bg-emerald-700 text-white' : 'bg-emerald-50 text-emerald-700'}`}>
                <CheckCircle className="w-4 h-4" />
              </div>
            </button>

            <button
              type="button"
              onClick={() => setLotFilter('VENDIDO')}
              className={`bg-white p-3.5 sm:p-4 rounded-lg border transition-all text-left flex items-center justify-between cursor-pointer ${
                lotFilter === 'VENDIDO'
                  ? 'border-slate-600 ring-1 ring-slate-600/10 shadow-xs bg-slate-100/50'
                  : 'border-slate-200 hover:border-slate-300'
              }`}
            >
              <div>
                <span className="text-xs font-semibold text-slate-700 block mb-0.5">
                  Lotes Vendidos
                </span>
                <span className="text-2xl font-bold text-slate-800">
                  {lotesSummary.sold_lots}
                </span>
                <span className="text-[10px] font-semibold text-slate-600 block mt-0.5">
                  {lotFilter === 'VENDIDO' ? '• Filtro Activo' : 'Filtrar vendidos'}
                </span>
              </div>
              <div className={`w-9 h-9 rounded-md flex items-center justify-center ${lotFilter === 'VENDIDO' ? 'bg-slate-700 text-white' : 'bg-slate-100 text-slate-700'}`}>
                <UserCheck className="w-4 h-4" />
              </div>
            </button>
          </div>

          {/* Barra de Búsqueda y Acción */}
          <div className="bg-white p-3 sm:p-3.5 rounded-lg border border-slate-200 shadow-xs flex flex-col sm:flex-row items-center justify-between gap-3">
            <div className="relative w-full sm:w-80">
              <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={lotSearchTerm}
                onChange={(e) => setLotSearchTerm(e.target.value)}
                placeholder="Buscar por lote o cliente..."
                className="w-full pl-9 pr-3 py-1.5 text-xs rounded-md border border-slate-200 bg-slate-50/50 focus:bg-white focus:outline-none focus:ring-1 focus:ring-slate-900 focus:border-slate-900 transition"
              />
            </div>

            <div className="flex items-center justify-between w-full sm:w-auto gap-3">
              <span className="text-xs text-slate-500 font-medium">
                {filteredLotes.length} lotes encontrados
              </span>

              <button
                type="button"
                onClick={() => setIsAddLotModalOpen(true)}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-semibold text-white bg-slate-900 hover:bg-slate-800 transition cursor-pointer shadow-xs"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>Agregar Lote</span>
              </button>
            </div>
          </div>

          {/* Cuadrícula de Lotes Responsiva */}
          {loadingLotes ? (
            <div className="py-20 flex flex-col items-center justify-center gap-2 text-slate-400 bg-white rounded-lg border border-slate-200">
              <Loader2 className="w-7 h-7 animate-spin text-slate-600" />
              <span className="text-xs font-medium text-slate-500">Cargando inventario de lotes...</span>
            </div>
          ) : lotes.length === 0 ? (
            <div className="py-16 text-center bg-white rounded-lg border border-slate-200 p-8 space-y-3">
              <AlertCircle className="w-10 h-10 text-slate-300 mx-auto" />
              <div className="space-y-1">
                <h3 className="text-sm font-bold text-slate-800">
                  No existen lotes registrados en este proyecto
                </h3>
                <p className="text-xs text-slate-500 max-w-md mx-auto">
                  Registra el primer lote comercial del proyecto para comenzar la gestión.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setIsAddLotModalOpen(true)}
                className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-md text-xs font-semibold text-white bg-slate-900 hover:bg-slate-800 transition cursor-pointer"
              >
                <Plus className="w-4 h-4" />
                <span>Agregar Primer Lote</span>
              </button>
            </div>
          ) : filteredLotes.length === 0 ? (
            <div className="py-14 text-center bg-white rounded-lg border border-slate-200 p-6 space-y-2">
              <Search className="w-7 h-7 text-slate-300 mx-auto" />
              <h3 className="text-xs font-bold text-slate-700">
                No se encontraron lotes con los filtros seleccionados
              </h3>
              <p className="text-xs text-slate-400">
                Prueba buscando otro número de lote o restableciendo el filtro activo.
              </p>
              <button
                type="button"
                onClick={() => {
                  setLotSearchTerm('');
                  setLotFilter('TODOS');
                }}
                className="text-xs text-slate-800 font-bold hover:underline pt-1 cursor-pointer"
              >
                Restablecer filtros
              </button>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 xl:grid-cols-5 gap-3">
              {filteredLotes.map((lote) => {
                const isVendidoConCliente = lote.status === 'Vendido' && Boolean(lote.customer);
                const isDisponible = !isVendidoConCliente;

                return (
                  <div
                    key={lote.id}
                    className={`rounded-lg p-3.5 flex flex-col justify-between border transition-all ${isDisponible
                        ? 'bg-white border-slate-200 hover:border-slate-300'
                        : 'bg-slate-50/50 border-slate-200 hover:border-slate-300'
                      }`}
                  >
                    <div>
                      {/* Cabecera */}
                      <div className="flex items-center justify-between mb-2">
                        <span className="text-sm font-bold text-slate-900">
                          {lote.lot_number}
                        </span>
                        <span
                          className={`px-2 py-0.5 rounded-md text-[10px] font-semibold uppercase tracking-wider ${isDisponible
                              ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                              : 'bg-slate-100 text-slate-700 border border-slate-200'
                            }`}
                        >
                          {isDisponible ? 'Disponible' : 'Vendido'}
                        </span>
                      </div>

                      {/* Detalles */}
                      <div className="space-y-1 my-2.5 text-xs">
                        <div className="flex items-center justify-between text-slate-500">
                          <span>Área:</span>
                          <span className="font-medium text-slate-700">
                            {Number(lote.area_m2)} m²
                          </span>
                        </div>
                        <div className="flex items-center justify-between text-slate-500">
                          <span>Precio:</span>
                          <span className="font-bold text-slate-900">
                            ${Number(lote.total_price).toLocaleString()}
                          </span>
                        </div>
                      </div>

                      {/* Comprador */}
                      {isVendidoConCliente && (
                        <div className="bg-white p-2 rounded-md border border-slate-200 my-2">
                          <span className="text-[10px] font-medium text-slate-400 block uppercase tracking-wider">
                            Comprador:
                          </span>
                          <span className="text-xs font-semibold text-slate-900 truncate block mt-0.5">
                            {lote.customer.name}
                          </span>
                        </div>
                      )}
                    </div>

                    {/* Botón según Estado */}
                    <div className="pt-2">
                      {isDisponible ? (
                        <button
                          type="button"
                          onClick={() => handleOpenAssignModal(lote)}
                          className="w-full py-1.5 px-3 rounded-md text-xs font-medium text-slate-700 bg-white hover:bg-slate-50 border border-slate-300 transition flex items-center justify-center gap-1.5 cursor-pointer shadow-xs"
                        >
                          <UserCheck className="w-3.5 h-3.5 text-slate-600" />
                          <span>Asignar Cliente</span>
                        </button>
                      ) : (
                        <button
                          type="button"
                          onClick={() => handleIrACobrar(lote)}
                          className="w-full py-1.5 px-3 rounded-md text-xs font-medium text-white bg-slate-900 hover:bg-slate-800 transition flex items-center justify-center gap-1.5 cursor-pointer shadow-xs"
                        >
                          <span>Ir a Cobrar</span>
                          <ArrowRight className="w-3.5 h-3.5" />
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* ========================================================================= */}
      {/* VISTA PESTAÑA 2: COBROS, RECIBOS Y CONTRATOS */}
      {/* ========================================================================= */}
      {activeTab === 'cobros' && (
        <div className="flex-1 flex flex-col space-y-4 animate-fade-in">
          {mensajeExito && (
            <div className="bg-emerald-50 border border-emerald-200 text-emerald-800 p-4 rounded-xl flex items-center justify-between shadow-sm animate-fade-in">
              <div className="flex items-center gap-3">
                <CheckCircle className="w-5 h-5 text-emerald-600 shrink-0" />
                <div>
                  <p className="text-sm font-bold">
                    ¡Recibo {mensajeExito.reciboNum} emitido con éxito!
                  </p>
                  <p className="text-xs text-emerald-700">
                    Se registró el abono de ${mensajeExito.monto} ({mensajeExito.metodo}) para {mensajeExito.cliente}.
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                {mensajeExito.receiptUrl && (
                  <a
                    href={mensajeExito.receiptUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex items-center gap-1 px-2.5 py-1 text-xs font-semibold bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 transition"
                  >
                    <Download className="w-3.5 h-3.5" />
                    <span>Ver PDF</span>
                  </a>
                )}
                <button
                  type="button"
                  onClick={() => setMensajeExito(null)}
                  className="text-xs font-semibold text-emerald-700 hover:text-emerald-900 underline ml-2 cursor-pointer"
                >
                  Cerrar
                </button>
              </div>
            </div>
          )}

          {/* Cuerpo Split-View: Columnas Alineadas en la Parte Superior (items-start) */}
          <div className="flex-1 flex flex-col lg:flex-row items-start gap-5">
            {/* COLUMNA IZQUIERDA: Clientes con Filtro de Mora y Altura Máxima Controlada */}
            <div className="w-full lg:w-84 xl:w-96 flex flex-col bg-white border border-slate-200 rounded-lg shadow-xs overflow-hidden shrink-0 lg:max-h-[calc(100vh-210px)] xl:lg:max-h-[760px] lg:sticky lg:top-4">
              {/* Parte Superior (Fija - shrink-0) */}
              <div className="p-4 border-b border-slate-100 space-y-3 shrink-0 bg-white">
                <div className="flex items-center justify-between">
                  <h3 className="text-base font-bold text-slate-900">
                    Clientes del Proyecto
                  </h3>
                  <span className="text-xs font-semibold px-2 py-0.5 bg-slate-100 text-slate-600 rounded-md">
                    {clientes.length}
                  </span>
                </div>

                {/* Filtro de Mora Rápido: TODOS | AL DÍA | EN MORA */}
                <div className="grid grid-cols-3 gap-1 bg-slate-100 p-1 rounded-xl text-xs font-semibold">
                  <button
                    type="button"
                    onClick={() => setCustomerMoraFilter('TODOS')}
                    className={`py-1.5 rounded-lg transition cursor-pointer text-center ${customerMoraFilter === 'TODOS'
                        ? 'bg-white text-slate-900 shadow-sm'
                        : 'text-slate-500 hover:text-slate-900'
                      }`}
                  >
                    Todos
                  </button>
                  <button
                    type="button"
                    onClick={() => setCustomerMoraFilter('AL DÍA')}
                    className={`py-1.5 rounded-lg transition cursor-pointer text-center ${customerMoraFilter === 'AL DÍA'
                        ? 'bg-emerald-600 text-white shadow-sm'
                        : 'text-slate-500 hover:text-emerald-700'
                      }`}
                  >
                    Al Día
                  </button>
                  <button
                    type="button"
                    onClick={() => setCustomerMoraFilter('EN MORA')}
                    className={`py-1.5 rounded-lg transition cursor-pointer text-center ${customerMoraFilter === 'EN MORA'
                        ? 'bg-rose-600 text-white shadow-sm'
                        : 'text-slate-500 hover:text-rose-700'
                      }`}
                  >
                    En Mora
                  </button>
                </div>

                <div className="relative">
                  <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                  <input
                    type="text"
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    placeholder="Buscar cliente o cédula..."
                    className="w-full pl-9 pr-3 py-2 text-xs rounded-xl border border-slate-200 bg-slate-50 focus:bg-white focus:outline-none focus:ring-2 focus:ring-cyan-500 focus:border-transparent transition"
                  />
                </div>
              </div>

              {/* Parte Inferior (Lista Desplazable - flex-1 overflow-y-auto divide-y divide-slate-100 pr-1) */}
              <div className="flex-1 overflow-y-auto divide-y divide-slate-100 max-h-[360px] lg:max-h-none pr-1">
                {loadingClientes ? (
                  <div className="py-20 flex flex-col items-center justify-center gap-2 text-slate-400">
                    <Loader2 className="w-6 h-6 animate-spin text-slate-600" />
                    <span className="text-xs">Cargando lista de clientes...</span>
                  </div>
                ) : clientes.length === 0 ? (
                  <div className="p-8 text-center text-slate-400 text-xs leading-relaxed">
                    <AlertCircle className="w-8 h-8 text-slate-300 mx-auto mb-2" />
                    No existen clientes con lotes en este proyecto.
                  </div>
                ) : filteredClientes.length === 0 ? (
                  <div className="p-8 text-center text-slate-400 text-xs">
                    No se encontraron clientes con el filtro "{customerMoraFilter}".
                  </div>
                ) : (
                  filteredClientes.map((cliente) => {
                    const isSelected = selectedCliente?.id === cliente.id;
                    const isMora = cliente.moraStatus === 'EN MORA';
                    const isPorVencer = cliente.moraStatus === 'POR VENCER';

                    return (
                      <button
                        key={cliente.id}
                        type="button"
                        onClick={() => handleSelectCliente(cliente)}
                        className={`w-full text-left p-4 transition-all flex items-start gap-3 border-l-4 cursor-pointer ${isSelected
                            ? 'bg-cyan-50 border-cyan-500 text-slate-900'
                            : 'border-transparent hover:bg-slate-50 text-slate-700'
                          }`}
                      >
                        <div
                          className={`w-10 h-10 rounded-xl flex items-center justify-center font-bold text-sm shrink-0 ${isMora
                              ? 'bg-rose-100 text-rose-800 border border-rose-200'
                              : isSelected
                                ? 'bg-cyan-500 text-white shadow-sm shadow-cyan-500/30'
                                : 'bg-slate-100 text-slate-600'
                            }`}
                        >
                          {cliente.nombre.charAt(0)}
                        </div>

                        <div className="flex-1 min-w-0">
                          <div className="flex items-center justify-between gap-1">
                            <span className="text-sm font-bold text-slate-900 truncate">
                              {cliente.nombre}
                            </span>
                            <span className="text-[11px] font-medium text-slate-400 shrink-0">
                              {cliente.lotes.join(', ')}
                            </span>
                          </div>

                          {/* Badge de Alerta de Mora / Al Día */}
                          <div className="mt-1">
                            {isMora ? (
                              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-extrabold bg-rose-100 text-rose-800 border border-rose-200">
                                <AlertTriangle className="w-3 h-3 text-rose-600" />
                                <span>EN MORA: ${cliente.totalOverdue.toLocaleString()}</span>
                              </span>
                            ) : isPorVencer ? (
                              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-extrabold bg-amber-100 text-amber-800 border border-amber-200">
                                <span>POR VENCER</span>
                              </span>
                            ) : (
                              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-extrabold bg-emerald-100 text-emerald-800 border border-emerald-200">
                                <ShieldCheck className="w-3 h-3 text-emerald-600" />
                                <span>AL DÍA</span>
                              </span>
                            )}
                          </div>

                          <div className="flex items-center justify-between mt-2 text-[11px] text-slate-400">
                            <span>Saldo: ${cliente.saldoDeudor.toLocaleString()}</span>
                            <span className="font-semibold text-cyan-700">
                              {cliente.cuotasPagadas} pagos reg.
                            </span>
                          </div>
                        </div>
                      </button>
                    );
                  })
                )}
              </div>
            </div>

            {/* COLUMNA DERECHA: Perfil Financiero, Contratos y Recibos */}
            <div className="flex-1 w-full min-w-0 flex flex-col space-y-6">
              {!selectedCliente ? (
                <div className="bg-white rounded-lg border border-slate-200 shadow-xs flex-1 flex flex-col items-center justify-center text-center p-12 min-h-[420px]">
                  <div className="w-16 h-16 rounded-lg bg-slate-100 flex items-center justify-center text-slate-400 mb-4">
                    <User className="w-8 h-8" />
                  </div>
                  <h4 className="text-base font-semibold text-slate-700">
                    Selecciona un cliente para ver su estado de cuenta y contratos
                  </h4>
                  <p className="text-xs text-slate-400 mt-1">
                    Haz clic en cualquiera de los clientes del panel izquierdo para consultar y gestionar su cartera
                  </p>
                </div>
              ) : (
                <>
                  {/* Banner de Estado de Mora del Cliente */}
                  {selectedCliente.moraStatus === 'EN MORA' ? (
                    <div className="bg-rose-50 border border-rose-200 rounded-lg p-4 text-rose-900 flex items-center justify-between gap-3 shadow-xs animate-fade-in">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-md bg-rose-200 flex items-center justify-center text-rose-800 shrink-0">
                          <AlertTriangle className="w-5 h-5" />
                        </div>
                        <div>
                          <h4 className="text-sm font-extrabold">
                            ¡Cliente en Estado de Mora!
                          </h4>
                          <p className="text-xs text-rose-700 mt-0.5">
                            Tiene {selectedCliente.totalOverdueInstallments} cuota(s) vencida(s) acumulando un atraso de ${selectedCliente.totalOverdue.toLocaleString('en-US', { minimumFractionDigits: 2 })} USD.
                          </p>
                        </div>
                      </div>
                      <div className="text-right">
                        <span className="text-xs font-bold text-rose-800 block">
                          Cuota sugerida a pagar:
                        </span>
                        <span className="text-base font-extrabold text-rose-900">
                          ${selectedCliente.cuotaSugerida.toLocaleString('en-US', { minimumFractionDigits: 2 })}
                        </span>
                      </div>
                    </div>
                  ) : (
                    <div className="bg-emerald-50 border border-emerald-200 rounded-lg p-4 text-emerald-900 flex items-center gap-3 shadow-xs animate-fade-in">
                      <div className="w-10 h-10 rounded-md bg-emerald-200 flex items-center justify-center text-emerald-800 shrink-0">
                        <ShieldCheck className="w-5 h-5" />
                      </div>
                      <div>
                        <h4 className="text-sm font-extrabold">
                          Cliente al Día con sus Cuotas
                        </h4>
                        <p className="text-xs text-emerald-700 mt-0.5">
                          Todos sus vencimientos están cubiertos. Próxima cuota de ${selectedCliente.cuotaMensual.toLocaleString()} vence en su fecha pactada.
                        </p>
                      </div>
                    </div>
                  )}

                  {/* Estado de Cuenta Detallado */}
                  <div className="bg-white rounded-lg border border-slate-200 p-5 sm:p-6 shadow-xs space-y-5">
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-100 pb-4">
                      <div>
                        <div className="flex items-center gap-2">
                          <h2 className="text-xl font-bold text-slate-900">
                            {selectedCliente.nombre}
                          </h2>
                          <span className="px-2.5 py-0.5 rounded-md text-xs font-medium bg-slate-100 text-slate-800 border border-slate-200">
                            {selectedCliente.proyecto}
                          </span>
                        </div>
                        <p className="text-xs text-slate-500 mt-1">
                          Identificación: {selectedCliente.documento} • Teléfono: {selectedCliente.telefono}
                        </p>
                      </div>

                      <div className="flex items-center gap-2 flex-wrap">
                        {selectedCliente.lotes.map((lote, i) => (
                          <span
                            key={i}
                            className="inline-flex items-center gap-1 px-3 py-1 bg-slate-100 text-slate-700 text-xs font-semibold rounded-lg border border-slate-200"
                          >
                            <MapPin className="w-3 h-3 text-cyan-600" />
                            {lote}
                          </span>
                        ))}

                        {/* Botón Cronograma de Cuotas (PDF) */}
                        <div className="inline-flex items-center rounded-lg border border-indigo-200 bg-indigo-50 overflow-hidden shadow-2xs">
                          <button
                            type="button"
                            onClick={() => {
                              const targetLotId = selectedCliente.lots?.[0]?.id || selectedLotId;
                              if (targetLotId) {
                                setAmortizationLotId(targetLotId);
                                setAmortizationModalOpen(true);
                              } else {
                                alert('Este cliente no posee lotes asociados.');
                              }
                            }}
                            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold text-indigo-700 hover:bg-indigo-100 transition cursor-pointer"
                            title="Previsualizar tabla de cuotas y cronograma en pantalla"
                          >
                            <FileSpreadsheet className="w-4 h-4 text-indigo-600" />
                            <span>Cronograma de Cuotas</span>
                          </button>
                          <a
                            href={`http://${window.location.hostname}:8000/api/lots/${selectedCliente.lots?.[0]?.id || selectedLotId}/amortization-pdf?token=${encodeURIComponent(localStorage.getItem('auth_token') || '')}`}
                            target="_blank"
                            rel="noreferrer"
                            className="px-2.5 py-1.5 text-xs font-bold text-indigo-700 hover:bg-indigo-200/70 border-l border-indigo-200 transition cursor-pointer flex items-center gap-1"
                            title="Abrir Cronograma en PDF en una nueva pestaña"
                          >
                            <span>PDF</span>
                            <ExternalLink className="w-3 h-3 text-indigo-600" />
                          </a>
                        </div>
                      </div>
                    </div>

                    {/* Métricas Financieras y de Cuotas */}
                    <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
                      <div className="bg-slate-50/80 rounded-xl p-4 border border-slate-100">
                        <span className="text-xs font-medium text-slate-400 block mb-1">
                          Valor Contratado
                        </span>
                        <span className="text-xl sm:text-2xl font-extrabold text-slate-900">
                          ${selectedCliente.valorTotal.toLocaleString()}
                        </span>
                        <span className="text-[11px] text-slate-400 block mt-1">
                          {selectedCliente.cuotasTotales} cuotas pactadas
                        </span>
                      </div>

                      <div className="bg-emerald-50/60 rounded-xl p-4 border border-emerald-100">
                        <span className="text-xs font-semibold text-emerald-700 block mb-1">
                          Saldo Pagado
                        </span>
                        <span className="text-xl sm:text-2xl font-extrabold text-emerald-800">
                          ${selectedCliente.saldoPagado.toLocaleString()}
                        </span>
                        <span className="text-[11px] font-medium text-emerald-600 block mt-1">
                          {selectedCliente.cuotasPagadas} pagos registrados
                        </span>
                      </div>

                      <div className="bg-amber-50/60 rounded-xl p-4 border border-amber-100">
                        <span className="text-xs font-semibold text-amber-700 block mb-1">
                          Saldo Deudor
                        </span>
                        <span className="text-xl sm:text-2xl font-extrabold text-amber-900">
                          ${selectedCliente.saldoDeudor.toLocaleString()}
                        </span>
                        <span className="text-[11px] font-medium text-amber-700 block mt-1">
                          Por amortizar en total
                        </span>
                      </div>

                      <div className="bg-cyan-50/60 rounded-xl p-4 border border-cyan-100">
                        <span className="text-xs font-semibold text-cyan-800 block mb-1">
                          Cuota Mensual
                        </span>
                        <span className="text-xl sm:text-2xl font-extrabold text-cyan-900">
                          ${selectedCliente.cuotaMensual.toLocaleString()}
                        </span>
                        <span className="text-[11px] font-medium text-cyan-700 block mt-1">
                          Día de cobro habitual
                        </span>
                      </div>
                    </div>

                    {/* Comprobantes Reales */}
                    <div className="border-t border-slate-100 pt-3">
                      <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider block mb-2">
                        Historial de Comprobantes Emitidos ({selectedCliente.historialPagos.length})
                      </span>
                      {selectedCliente.historialPagos.length === 0 ? (
                        <p className="text-xs text-slate-400 italic">
                          Aún no hay pagos registrados para este cliente. Emita el primer recibo abajo.
                        </p>
                      ) : (
                        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2.5">
                          {selectedCliente.historialPagos.map((pago) => {
                            const isVoided = pago.status === 'Anulado';
                            const paymentId = pago.payment_id || String(pago.id).replace('REC-', '');
                            const pdfUrl = `http://${window.location.hostname}:8000/api/payments/${paymentId}/pdf?token=${encodeURIComponent(localStorage.getItem('auth_token') || '')}`;

                            return (
                              <div
                                key={pago.id}
                                className={`p-3 rounded-xl border text-xs flex flex-col justify-between transition ${
                                  isVoided
                                    ? 'bg-rose-50/40 border-rose-200'
                                    : 'bg-slate-50 border-slate-200/80 hover:bg-slate-100/50'
                                }`}
                              >
                                <div className="flex items-start justify-between gap-2">
                                  <div>
                                    <div className="flex items-center gap-1.5 flex-wrap">
                                      <span
                                        className={`font-mono font-bold px-2 py-0.5 rounded text-[11px] border ${
                                          isVoided
                                            ? 'bg-rose-100 text-rose-800 border-rose-200'
                                            : 'bg-cyan-50 text-cyan-800 border-cyan-100'
                                        }`}
                                      >
                                        {pago.id}
                                      </span>
                                      {isVoided ? (
                                        <span className="inline-flex items-center gap-1 px-2 py-0.2 rounded-full text-[10px] font-bold bg-rose-100 text-rose-800 border border-rose-200">
                                          <span className="w-1.5 h-1.5 rounded-full bg-rose-600"></span>
                                          Anulado
                                        </span>
                                      ) : (
                                        <span className="inline-flex items-center gap-1 px-2 py-0.2 rounded-full text-[10px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
                                          <span className="w-1.5 h-1.5 rounded-full bg-emerald-500"></span>
                                          Válido
                                        </span>
                                      )}
                                    </div>
                                    <p className="text-[10px] text-slate-400 mt-1">
                                      {pago.fecha} {pago.hora && `(${pago.hora})`} • {pago.metodo}
                                    </p>
                                  </div>

                                  <div className="text-right">
                                    {isVoided ? (
                                      <div>
                                        <span className="font-extrabold text-rose-500 line-through text-xs block">
                                          ${Number(pago.monto).toLocaleString('en-US', { minimumFractionDigits: 2 })}
                                        </span>
                                        <span
                                          className="text-[10px] text-rose-700 font-semibold block mt-0.5 max-w-[150px] truncate"
                                          title={pago.void_reason}
                                        >
                                          {pago.void_reason ? `Motivo: ${pago.void_reason}` : 'Anulado contablemente'}
                                        </span>
                                      </div>
                                    ) : (
                                      <span className="font-extrabold text-emerald-700 text-sm block">
                                        ${Number(pago.monto).toLocaleString('en-US', { minimumFractionDigits: 2 })}
                                      </span>
                                    )}
                                  </div>
                                </div>

                                <div className="flex items-center justify-end gap-1.5 mt-2.5 pt-2 border-t border-slate-200/60">
                                  <a
                                    href={pdfUrl}
                                    target="_blank"
                                    rel="noreferrer"
                                    className="inline-flex items-center gap-1 px-2.5 py-1 text-[11px] font-bold text-white bg-slate-900 hover:bg-slate-800 rounded-md transition shadow-2xs"
                                    title="Descargar comprobante PDF"
                                  >
                                    <Download className="w-3 h-3" />
                                    <span>PDF</span>
                                  </a>

                                  {isSuperAdmin && !isVoided && (
                                    <button
                                      type="button"
                                      onClick={() => handleOpenVoidModal(pago)}
                                      className="inline-flex items-center gap-1 px-2 py-1 text-[11px] font-bold text-rose-700 bg-rose-50 hover:bg-rose-100 border border-rose-200 rounded-md transition shadow-2xs cursor-pointer"
                                      title="Anular formalmente comprobante"
                                    >
                                      <Ban className="w-3 h-3 text-rose-600" />
                                      <span>Anular</span>
                                    </button>
                                  )}
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      )}
                    </div>
                  </div>

                  {/* ============================================================== */}
                  {/* TARJETA: CONTRATOS Y DOCUMENTOS VINCULADOS */}
                  {/* ============================================================== */}
                  <div className="bg-white rounded-lg border border-slate-200 p-5 sm:p-6 shadow-xs space-y-4">
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-100 pb-3">
                      <div className="flex items-center gap-2.5">
                        <div className="w-8 h-8 rounded-lg bg-indigo-50 flex items-center justify-center text-indigo-600">
                          <FolderArchive className="w-4 h-4" />
                        </div>
                        <div>
                          <h3 className="text-base font-bold text-slate-900">
                            Contratos y Documentos Vinculados
                          </h3>
                          <p className="text-xs text-slate-400">
                            Archivos notariales, promesas de compraventa y escrituras de {selectedCliente.nombre}
                          </p>
                        </div>
                      </div>

                      <button
                        type="button"
                        onClick={handleOpenUploadDocModal}
                        className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-bold text-white bg-indigo-600 hover:bg-indigo-700 active:bg-indigo-800 rounded-xl shadow-sm shadow-indigo-600/20 transition cursor-pointer self-start sm:self-auto"
                      >
                        <UploadCloud className="w-4 h-4" />
                        <span>+ Adjuntar Contrato / Documento</span>
                      </button>
                    </div>

                    {loadingDocs ? (
                      <div className="py-8 flex flex-col items-center justify-center gap-2 text-slate-400">
                        <Loader2 className="w-5 h-5 animate-spin text-indigo-500" />
                        <span className="text-xs">Consultando contratos vinculados...</span>
                      </div>
                    ) : clientDocuments.length === 0 ? (
                      <div className="p-6 text-center bg-slate-50/60 rounded-xl border border-dashed border-slate-200">
                        <Paperclip className="w-8 h-8 text-slate-300 mx-auto mb-1.5" />
                        <p className="text-xs font-semibold text-slate-600">
                          No hay contratos o documentos adjuntos para este cliente aún
                        </p>
                        <p className="text-[11px] text-slate-400 mt-0.5">
                          Haz clic en "+ Adjuntar Contrato / Documento" para subir promesas de compraventa o escrituras.
                        </p>
                      </div>
                    ) : (
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        {clientDocuments.map((doc) => (
                          <div
                            key={doc.id}
                            className="p-3 rounded-xl border border-slate-200/80 bg-slate-50/50 hover:bg-slate-50 transition flex items-start justify-between gap-3 group"
                          >
                            <div className="flex items-start gap-2.5 min-w-0">
                              <div className="w-9 h-9 rounded-lg bg-indigo-100 flex items-center justify-center text-indigo-700 shrink-0 mt-0.5">
                                {doc.is_pdf ? (
                                  <FileText className="w-5 h-5" />
                                ) : (
                                  <ImageIcon className="w-5 h-5" />
                                )}
                              </div>
                              <div className="min-w-0">
                                <span className="inline-block px-2 py-0.5 rounded text-[10px] font-extrabold bg-indigo-50 text-indigo-700 border border-indigo-100 mb-1">
                                  {doc.document_type}
                                </span>
                                <h5 className="text-xs font-bold text-slate-800 truncate" title={doc.file_name}>
                                  {doc.file_name}
                                </h5>
                                <p className="text-[10px] text-slate-400 mt-0.5">
                                  {doc.lot_number} • {doc.uploaded_at} ({doc.file_size})
                                </p>
                              </div>
                            </div>

                            <div className="flex items-center gap-1 shrink-0">
                              <a
                                href={doc.file_url ? doc.file_url.replace(/https?:\/\/[^\/]+/, `http://${window.location.hostname}:8000`) : '#'}
                                target="_blank"
                                rel="noreferrer"
                                className="p-1.5 rounded-lg text-slate-600 hover:text-indigo-600 hover:bg-white transition border border-transparent hover:border-slate-200 shadow-sm"
                                title="Ver / Descargar archivo"
                              >
                                <ExternalLink className="w-3.5 h-3.5" />
                              </a>
                              <button
                                type="button"
                                onClick={() => handleDeleteDocument(doc.id, doc.file_name)}
                                className="p-1.5 rounded-lg text-slate-400 hover:text-rose-600 hover:bg-rose-50 transition"
                                title="Eliminar documento"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>

                  {/* Tarjeta de Acción Rápida: Cobro y Emisión Oficial en Módulo Dedicado */}
                  <div className="bg-slate-50 rounded-lg border border-slate-200 p-5 sm:p-6 shadow-xs flex flex-col sm:flex-row items-center justify-between gap-4">
                    <div className="flex items-center gap-3">
                      <div className="w-12 h-12 rounded-xl bg-cyan-500 text-white flex items-center justify-center shadow-md shadow-cyan-500/30 shrink-0">
                        <Receipt className="w-6 h-6" />
                      </div>
                      <div>
                        <h3 className="text-base font-bold text-slate-900">
                          Módulo Exclusivo de Cobros y Recibos
                        </h3>
                        <p className="text-xs text-slate-500 mt-0.5">
                          Registra abonos oficiales con firma del cliente. La firma del emisor se estampa automáticamente desde su propio perfil.
                        </p>
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() =>
                        navigate(
                          `/proyectos/${id}/clientes/pagar?customer_id=${selectedCliente.id}&lot_id=${selectedLotId}`
                        )
                      }
                      className="inline-flex items-center gap-2 px-5 py-2.5 rounded-md font-medium text-white bg-slate-900 hover:bg-slate-800 active:bg-black transition cursor-pointer text-sm shrink-0 shadow-xs"
                    >
                      <CreditCard className="w-4 h-4" />
                      <span>Ir a Cobrar / Emitir Recibo</span>
                      <ArrowRight className="w-4 h-4" />
                    </button>
                  </div>
                </>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ================= MODAL 1: AGREGAR LOTE REAL ================= */}
      {isAddLotModalOpen && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center z-50 p-4 animate-fade-in">
          <div className="bg-white rounded-lg w-full max-w-md p-6 shadow-xl border border-slate-200 transition-all">
            <div className="flex items-center justify-between border-b border-slate-100 pb-4 mb-5">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-md bg-slate-100 border border-slate-200 flex items-center justify-center text-slate-700">
                  <LayoutGrid className="w-4 h-4" />
                </div>
                <h3 className="text-lg font-bold text-slate-900">
                  Registrar Lote en {displayProjectName}
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setIsAddLotModalOpen(false)}
                className="p-1 rounded-md text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleGuardarNuevoLote} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1.5">
                  Identificador / Número de Lote
                </label>
                <input
                  type="text"
                  required
                  placeholder="Ej: Lote 25 o Manzana B - Lote 4"
                  value={newLotForm.lot_number}
                  onChange={(e) => setNewLotForm({ ...newLotForm, lot_number: e.target.value })}
                  className="w-full px-3 py-2 rounded-md border border-slate-200 bg-slate-50 focus:bg-white text-sm text-slate-900 focus:outline-none focus:ring-1 focus:ring-slate-900 focus:border-slate-400 transition"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1.5">
                    Área (m²)
                  </label>
                  <input
                    type="number"
                    step="any"
                    required
                    value={newLotForm.area_m2}
                    onChange={(e) => setNewLotForm({ ...newLotForm, area_m2: e.target.value })}
                    className="w-full px-3 py-2 rounded-md border border-slate-200 bg-slate-50 focus:bg-white text-sm text-slate-900 focus:outline-none focus:ring-1 focus:ring-slate-900 focus:border-slate-400 transition"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1.5">
                    Precio Total ($ USD)
                  </label>
                  <input
                    type="number"
                    step="any"
                    required
                    value={newLotForm.total_price}
                    onChange={(e) => setNewLotForm({ ...newLotForm, total_price: e.target.value })}
                    className="w-full px-3 py-2 rounded-md border border-slate-200 bg-slate-50 focus:bg-white text-sm text-slate-900 focus:outline-none focus:ring-1 focus:ring-slate-900 focus:border-slate-400 transition"
                  />
                </div>
              </div>

              <div className="flex items-center justify-end gap-3 pt-4 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setIsAddLotModalOpen(false)}
                  className="px-4 py-2 text-xs font-medium text-slate-600 hover:text-slate-800 hover:bg-slate-100 rounded-md transition cursor-pointer"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={isSubmittingLot}
                  className="inline-flex items-center gap-2 px-5 py-2 text-xs font-medium text-white bg-slate-900 hover:bg-slate-800 active:bg-black rounded-md shadow-xs transition cursor-pointer disabled:opacity-50"
                >
                  {isSubmittingLot && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                  <span>{isSubmittingLot ? 'Guardando...' : 'Crear Lote'}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ================= MODAL 2: ASIGNAR Y PACTAR PLAN DE CUOTAS ================= */}
      {isAssignModalOpen && selectedLotForAssign && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center z-50 p-4 animate-fade-in">
          <div className="bg-white rounded-lg w-full max-w-lg p-6 shadow-xl border border-slate-200 transition-all max-h-[92vh] overflow-y-auto">
            <div className="flex items-center justify-between border-b border-slate-100 pb-4 mb-4">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-md bg-slate-100 border border-slate-200 flex items-center justify-center text-slate-700">
                  <UserCheck className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-slate-900">
                    Pactar Venta de {selectedLotForAssign.lot_number}
                  </h3>
                  <span className="text-xs text-slate-500 font-medium">
                    ${Number(selectedLotForAssign.total_price).toLocaleString()} USD • {Number(selectedLotForAssign.area_m2)} m²
                  </span>
                </div>
              </div>
              <button
                type="button"
                onClick={handleCloseAssignModal}
                className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleAssignSubmit} className="space-y-4">
              {/* Sección Selección / Registro de Cliente */}
              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider">
                    Cliente Comprador
                  </label>
                  {!showNewCustomerForm && (
                    <button
                      type="button"
                      onClick={() => setShowNewCustomerForm(true)}
                      className="inline-flex items-center gap-1 text-xs font-bold text-cyan-600 hover:text-cyan-800 transition cursor-pointer"
                    >
                      <UserPlus className="w-3.5 h-3.5" />
                      <span>+ Nuevo Cliente</span>
                    </button>
                  )}
                </div>

                {!showNewCustomerForm ? (
                  <select
                    value={selectedCustomerForAssign}
                    onChange={(e) => {
                      if (e.target.value === 'NEW') {
                        setShowNewCustomerForm(true);
                      } else {
                        setSelectedCustomerForAssign(e.target.value);
                      }
                    }}
                    required
                    className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 bg-slate-50 focus:bg-white text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-cyan-500 focus:border-transparent transition cursor-pointer font-medium"
                  >
                    {allCustomers.length === 0 && (
                      <option value="" disabled>-- No existen clientes registrados aún --</option>
                    )}
                    {allCustomers.map((cust) => (
                      <option key={cust.id} value={cust.id}>
                        {cust.name} ({cust.id_card}) - {cust.phone}
                      </option>
                    ))}
                    <option value="NEW" className="font-bold text-cyan-700 bg-cyan-50 py-1">
                      ➕ Registrar Nuevo Cliente...
                    </option>
                  </select>
                ) : (
                  /* Mini-Formulario Integrado de Nuevo Cliente */
                  <div className="bg-slate-50 p-4 rounded-lg border border-slate-200 space-y-3 animate-fade-in shadow-xs">
                    <div className="flex items-center justify-between pb-2 border-b border-cyan-200/80">
                      <div className="flex items-center gap-2">
                        <div className="w-6 h-6 rounded-lg bg-cyan-600 text-white flex items-center justify-center">
                          <UserPlus className="w-3.5 h-3.5" />
                        </div>
                        <span className="text-xs font-bold text-slate-800">
                          Registrar Nuevo Cliente
                        </span>
                      </div>
                      <button
                        type="button"
                        onClick={() => {
                          setShowNewCustomerForm(false);
                          if (allCustomers.length > 0) {
                            setSelectedCustomerForAssign(String(allCustomers[0].id));
                          }
                        }}
                        className="text-[11px] text-slate-500 hover:text-slate-800 font-bold underline cursor-pointer"
                      >
                        Cancelar y elegir existente
                      </button>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                      <div>
                        <label className="block text-[10px] font-bold text-slate-600 uppercase mb-1">
                          Nombre Completo *
                        </label>
                        <input
                          type="text"
                          value={newCustomerData.name}
                          onChange={(e) => setNewCustomerData((prev) => ({ ...prev, name: e.target.value }))}
                          placeholder="Ej: Carlos Zambrano"
                          className="w-full px-3 py-2 text-xs rounded-xl border border-cyan-200 bg-white focus:outline-none focus:ring-2 focus:ring-cyan-500 font-medium"
                          required={showNewCustomerForm}
                        />
                      </div>

                      <div>
                        <label className="block text-[10px] font-bold text-slate-600 uppercase mb-1">
                          Cédula / Identificación *
                        </label>
                        <input
                          type="text"
                          value={newCustomerData.id_card}
                          onChange={(e) => setNewCustomerData((prev) => ({ ...prev, id_card: e.target.value }))}
                          placeholder="Ej: 1312345678"
                          className="w-full px-3 py-2 text-xs rounded-xl border border-cyan-200 bg-white focus:outline-none focus:ring-2 focus:ring-cyan-500 font-medium"
                          required={showNewCustomerForm}
                        />
                      </div>

                      <div>
                        <label className="block text-[10px] font-bold text-slate-600 uppercase mb-1">
                          Celular
                        </label>
                        <input
                          type="text"
                          value={newCustomerData.phone}
                          onChange={(e) => setNewCustomerData((prev) => ({ ...prev, phone: e.target.value }))}
                          placeholder="Ej: 0991234567"
                          className="w-full px-3 py-2 text-xs rounded-xl border border-cyan-200 bg-white focus:outline-none focus:ring-2 focus:ring-cyan-500 font-medium"
                        />
                      </div>

                      <div>
                        <label className="block text-[10px] font-bold text-slate-600 uppercase mb-1">
                          Correo Electrónico
                        </label>
                        <input
                          type="email"
                          value={newCustomerData.email}
                          onChange={(e) => setNewCustomerData((prev) => ({ ...prev, email: e.target.value }))}
                          placeholder="cliente@correo.com"
                          className="w-full px-3 py-2 text-xs rounded-xl border border-cyan-200 bg-white focus:outline-none focus:ring-2 focus:ring-cyan-500 font-medium"
                        />
                      </div>
                    </div>

                    <div className="flex justify-end pt-1">
                      <button
                        type="button"
                        disabled={isSavingNewCustomer}
                        onClick={handleSaveNewCustomer}
                        className="inline-flex items-center gap-1.5 px-3.5 py-1.5 text-xs font-bold text-white bg-cyan-600 hover:bg-cyan-700 active:bg-cyan-800 rounded-xl shadow-sm transition cursor-pointer disabled:opacity-50"
                      >
                        {isSavingNewCustomer ? (
                          <>
                            <Loader2 className="w-3.5 h-3.5 animate-spin" />
                            <span>Guardando en BD...</span>
                          </>
                        ) : (
                          <>
                            <CheckCircle className="w-3.5 h-3.5" />
                            <span>Guardar y Seleccionar Cliente</span>
                          </>
                        )}
                      </button>
                    </div>
                  </div>
                )}
              </div>

              {/* Campos Numéricos Libres: Número de Cuotas y Día de Pago */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <div className="flex items-center justify-between mb-1.5">
                    <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider">
                      Número de Cuotas
                    </label>
                    <span className="text-[10px] text-slate-400 font-semibold">1 a 120</span>
                  </div>
                  <input
                    type="number"
                    min="1"
                    max="120"
                    step="1"
                    value={installmentsCount}
                    onChange={(e) => {
                      const val = e.target.value.replace(/[^0-9]/g, '');
                      setInstallmentsCount(val);
                    }}
                    placeholder="Ej: 12, 15, 24"
                    required
                    className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 bg-slate-50 focus:bg-white text-sm font-semibold text-slate-900 focus:outline-none focus:ring-2 focus:ring-cyan-500 focus:border-transparent transition"
                  />
                  {/* Sugerencias rápidas de cuotas comunes */}
                  <div className="flex items-center gap-1.5 mt-2 flex-wrap">
                    <span className="text-[10px] text-slate-400 font-semibold">Rápidas:</span>
                    {[6, 12, 18, 24, 36, 48].map((q) => (
                      <button
                        key={q}
                        type="button"
                        onClick={() => setInstallmentsCount(String(q))}
                        className={`px-1.5 py-0.5 rounded-md text-[10px] font-bold transition cursor-pointer ${
                          Number(installmentsCount) === q
                            ? 'bg-cyan-100 text-cyan-800 border border-cyan-300'
                            : 'bg-slate-100 text-slate-500 hover:bg-slate-200'
                        }`}
                      >
                        {q}m
                      </button>
                    ))}
                  </div>
                </div>

                <div>
                  <div className="flex items-center justify-between mb-1.5">
                    <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider">
                      Día de Pago Mensual
                    </label>
                    <span className="text-[10px] text-slate-400 font-semibold">Día 1 al 31</span>
                  </div>
                  <input
                    type="number"
                    min="1"
                    max="31"
                    step="1"
                    value={paymentDay}
                    onChange={(e) => {
                      const val = e.target.value.replace(/[^0-9]/g, '');
                      if (val === '' || (Number(val) >= 1 && Number(val) <= 31)) {
                        setPaymentDay(val);
                      }
                    }}
                    placeholder="Ej: 15"
                    required
                    className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 bg-slate-50 focus:bg-white text-sm font-semibold text-slate-900 focus:outline-none focus:ring-2 focus:ring-cyan-500 focus:border-transparent transition"
                  />
                  {/* Sugerencias rápidas de días comunes */}
                  <div className="flex items-center gap-1.5 mt-2 flex-wrap">
                    <span className="text-[10px] text-slate-400 font-semibold">Rápidos:</span>
                    {[5, 10, 15, 20, 25, 28].map((d) => (
                      <button
                        key={d}
                        type="button"
                        onClick={() => setPaymentDay(String(d))}
                        className={`px-1.5 py-0.5 rounded-md text-[10px] font-bold transition cursor-pointer ${
                          Number(paymentDay) === d
                            ? 'bg-cyan-100 text-cyan-800 border border-cyan-300'
                            : 'bg-slate-100 text-slate-500 hover:bg-slate-200'
                        }`}
                      >
                        {d}
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              {/* Cálculo Reactivo de Cuota Mensual Estimada */}
              {(() => {
                const cuotasNum = parseInt(installmentsCount, 10);
                const precioTotal = Number(selectedLotForAssign.total_price) || 0;
                const tieneCuotasValidas = cuotasNum && cuotasNum > 0;
                const cuotaEstimada = tieneCuotasValidas ? Math.round(precioTotal / cuotasNum) : 0;

                return (
                  <div className="bg-slate-50 p-3.5 rounded-lg border border-slate-200 text-xs flex justify-between items-center shadow-xs">
                    <div className="space-y-0.5">
                      <span className="text-slate-700 font-bold block">
                        Cuota mensual estimada:
                      </span>
                      <span className="text-[11px] text-slate-500 font-medium">
                        {tieneCuotasValidas
                          ? `Plan pactado a ${cuotasNum} cuotas (${(cuotasNum / 12).toFixed(1)} años)`
                          : 'Digita las cuotas para calcular'}
                      </span>
                    </div>
                    <div className="text-right">
                      <span className="font-extrabold text-cyan-900 text-base block">
                        {tieneCuotasValidas ? `$${cuotaEstimada.toLocaleString()} USD` : '--- USD'}
                      </span>
                      <span className="text-[10px] text-slate-500 font-semibold">/ mes</span>
                    </div>
                  </div>
                );
              })()}

              {/* Botones de Acción */}
              <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={handleCloseAssignModal}
                  className="px-4 py-2 text-xs font-medium text-slate-600 hover:text-slate-800 hover:bg-slate-100 rounded-md transition cursor-pointer"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={isSubmittingAssign || isSavingNewCustomer}
                  className="inline-flex items-center gap-2 px-5 py-2 text-xs font-medium text-white bg-slate-900 hover:bg-slate-800 active:bg-black rounded-md shadow-xs transition cursor-pointer disabled:opacity-50"
                >
                  {isSubmittingAssign && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                  <span>{isSubmittingAssign ? 'Pactando Venta...' : 'Pactar Plan y Venta'}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ================= MODAL 3: SUBIR CONTRATO / DOCUMENTO REAL ================= */}
      {isUploadDocModalOpen && selectedCliente && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center z-50 p-4 animate-fade-in">
          <div className="bg-white rounded-lg w-full max-w-lg p-6 shadow-xl border border-slate-200 transition-all">
            <div className="flex items-center justify-between border-b border-slate-100 pb-4 mb-5">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-md bg-slate-100 border border-slate-200 flex items-center justify-center text-slate-700">
                  <UploadCloud className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-slate-900">
                    Adjuntar Contrato o Documento
                  </h3>
                  <span className="text-xs text-slate-500">
                    Cliente: {selectedCliente.nombre}
                  </span>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setIsUploadDocModalOpen(false)}
                className="p-1 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleUploadDocumentSubmit} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1.5">
                  Lote Asociado
                </label>
                <select
                  value={docLotId}
                  onChange={(e) => setDocLotId(e.target.value)}
                  required
                  className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 bg-slate-50 focus:bg-white text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition cursor-pointer"
                >
                  {selectedCliente.lots.map((lot) => (
                    <option key={lot.id} value={lot.id}>
                      {lot.lot_number} ({selectedCliente.proyecto})
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1.5">
                  Tipo de Documento
                </label>
                <select
                  value={docType}
                  onChange={(e) => setDocType(e.target.value)}
                  required
                  className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 bg-slate-50 focus:bg-white text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition cursor-pointer"
                >
                  <option value="Promesa de Compraventa">Promesa de Compraventa</option>
                  <option value="Escritura Pública">Escritura Pública</option>
                  <option value="Cédula / Documento de Identidad">Cédula / Documento de Identidad</option>
                  <option value="Comprobante de Depósito">Comprobante de Depósito</option>
                  <option value="Certificado de Gravamen">Certificado de Gravamen</option>
                  <option value="Otro">Otro</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1.5">
                  Seleccionar Archivo (PDF o Imagen - Máx 10MB)
                </label>
                <div className="border-2 border-dashed border-indigo-200 rounded-xl p-4 bg-indigo-50/20 hover:bg-indigo-50/40 transition text-center cursor-pointer relative">
                  <input
                    type="file"
                    ref={fileInputRef}
                    required
                    accept=".pdf,image/*"
                    onChange={(e) => setDocFile(e.target.files[0] || null)}
                    className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                  />
                  <UploadCloud className="w-8 h-8 text-indigo-500 mx-auto mb-2" />
                  {docFile ? (
                    <div className="text-xs">
                      <span className="font-bold text-slate-900 block truncate">
                        {docFile.name}
                      </span>
                      <span className="text-indigo-600 font-semibold">
                        {(docFile.size / 1024 / 1024).toFixed(2)} MB • Listo para subir
                      </span>
                    </div>
                  ) : (
                    <div className="text-xs text-slate-500">
                      <span className="font-semibold text-indigo-600">Haz clic aquí</span> para explorar archivos desde tu computadora
                      <p className="text-[10px] text-slate-400 mt-0.5">Soporta PDF, PNG, JPG o WEBP</p>
                    </div>
                  )}
                </div>
              </div>

              <div className="flex items-center justify-end gap-3 pt-4 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setIsUploadDocModalOpen(false)}
                  className="px-4 py-2 text-xs font-medium text-slate-600 hover:text-slate-800 hover:bg-slate-100 rounded-md transition cursor-pointer"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={isSubmittingDoc || !docFile}
                  className="inline-flex items-center gap-2 px-5 py-2 text-xs font-medium text-white bg-slate-900 hover:bg-slate-800 active:bg-black rounded-md shadow-xs transition cursor-pointer disabled:opacity-50"
                >
                  {isSubmittingDoc && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                  <span>{isSubmittingDoc ? 'Subiendo archivo...' : 'Subir y Vincular Documento'}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ================= MODAL 4: ANULACIÓN FORMAL DE COMPROBANTE CONTABLE ================= */}
      {isVoidModalOpen && selectedPaymentForVoid && (
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
                    Facultad exclusiva del Super Administrador
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setIsVoidModalOpen(false)}
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
                Esta anulación mantendrá el correlativo contable en la base de datos, pero revertirá el abono en caja y restaurará el saldo deudor del lote de {selectedCliente?.nombre || 'este cliente'}.
              </div>
            </div>

            {/* Ficha Resumen del Recibo */}
            <div className="bg-slate-50 rounded-lg p-3.5 border border-slate-200 mb-4 text-xs space-y-1.5">
              <div className="flex justify-between items-center">
                <span className="text-slate-500 font-medium">N° Comprobante:</span>
                <span className="font-mono font-bold text-slate-900 bg-white px-2 py-0.5 rounded border border-slate-200">
                  {selectedPaymentForVoid.id}
                </span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-slate-500 font-medium">Cliente:</span>
                <span className="font-bold text-slate-900">{selectedCliente?.nombre}</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-slate-500 font-medium">Fecha de Emisión:</span>
                <span className="text-slate-700 font-medium">{selectedPaymentForVoid.fecha}</span>
              </div>
              <div className="flex justify-between items-center pt-1 border-t border-slate-200">
                <span className="text-slate-600 font-bold">Monto a revertir:</span>
                <span className="text-rose-600 font-extrabold text-sm">
                  ${Number(selectedPaymentForVoid.monto).toLocaleString('en-US', { minimumFractionDigits: 2 })} USD
                </span>
              </div>
            </div>

            {/* Formulario con Motivo Obligatorio */}
            <form onSubmit={handleConfirmVoidPayment} className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                  Motivo formal de anulación <span className="text-rose-600">*</span>
                </label>
                <textarea
                  rows="3"
                  value={voidReason}
                  onChange={(e) => setVoidReason(e.target.value)}
                  placeholder="Escriba la justificación contable (ej. Error en digitación del valor pagado, cheque devuelto, etc.)..."
                  required
                  className="w-full px-3.5 py-2.5 rounded-lg border border-slate-200 bg-slate-50 focus:bg-white text-xs sm:text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-rose-500 focus:border-transparent transition"
                />
                <p className="text-[11px] text-slate-400 mt-1">
                  Mínimo 5 caracteres. Este motivo quedará registrado en Auditoría y en el PDF sellado como anulado.
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
                  onClick={() => setIsVoidModalOpen(false)}
                  disabled={isSubmittingVoid}
                  className="px-4 py-2 text-xs font-medium text-slate-600 hover:text-slate-800 hover:bg-slate-100 rounded-md transition cursor-pointer"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={isSubmittingVoid || voidReason.trim().length < 5}
                  className="inline-flex items-center gap-2 px-5 py-2 text-xs font-medium text-white bg-rose-600 hover:bg-rose-700 active:bg-rose-800 rounded-md shadow-xs transition cursor-pointer disabled:opacity-50"
                >
                  {isSubmittingVoid && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                  <Ban className="w-3.5 h-3.5" />
                  <span>{isSubmittingVoid ? 'Anulando...' : 'Confirmar Anulación Contable'}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ================= MODAL 5: CRONOGRAMA DE CUOTAS Y AMORTIZACIÓN EN PANTALLA ================= */}
      <AmortizationModal
        isOpen={amortizationModalOpen}
        onClose={() => setAmortizationModalOpen(false)}
        lotId={amortizationLotId}
        customerName={selectedCliente?.nombre}
      />
    </div>
  );
}
