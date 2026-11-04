import React, { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import {
  Landmark,
  Plus,
  Search,
  Filter,
  Calendar,
  CheckCircle2,
  XCircle,
  Clock,
  Trash2,
  Edit2,
  Loader2,
  X,
  AlertTriangle,
  RotateCcw,
  Check,
  Ban,
  DollarSign,
  Building2,
  FileText,
  User,
  ArrowUpDown,
  Download,
} from 'lucide-react';

const COMMON_BANKS = [
  'Cooperativa JEP',
  'Banco Pichincha',
  'Cooperativa Jardín Azuayo',
  'Banco Guayaquil',
  'Banco del Pacífico',
  'Produbanco',
  'Banco Internacional',
  'Cooperativa Policía Nacional',
  'Cooperativa 29 de Octubre',
];

export default function Cheques() {
  const navigate = useNavigate();

  // Estados de carga y datos
  const [loading, setLoading] = useState(true);
  const [cheques, setCheques] = useState([]);
  const [summary, setSummary] = useState({
    total_emitido: 0,
    count_emitido: 0,
    total_cobrado: 0,
    count_cobrado: 0,
    total_anulado: 0,
    count_anulado: 0,
    total_general: 0,
  });
  const [availableBanks, setAvailableBanks] = useState([]);
  const [pagination, setPagination] = useState({
    current_page: 1,
    last_page: 1,
    total: 0,
  });

  // Filtros
  const [searchTerm, setSearchTerm] = useState('');
  const [bankFilter, setBankFilter] = useState('TODOS');
  const [statusFilter, setStatusFilter] = useState('TODOS');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');

  // Modales
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingCheque, setEditingCheque] = useState(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [formError, setFormError] = useState(null);
  const [actionSuccessMsg, setActionSuccessMsg] = useState(null);

  // Formulario
  const [formData, setFormData] = useState({
    bank_name: 'Cooperativa JEP',
    cheque_number: '',
    issue_date: new Date().toISOString().split('T')[0],
    payee: '',
    amount: '',
    concept: '',
    status: 'Emitido',
  });

  // Verificar rol de acceso exclusivo para CEO / Super Admin
  const currentRole = localStorage.getItem('user_role') || 'Super Admin';
  const isSuperAdmin = currentRole === 'Super Admin' || currentRole === 'CEO / Gerente';

  useEffect(() => {
    if (!isSuperAdmin) {
      navigate('/dashboard', { replace: true });
    }
  }, [isSuperAdmin, navigate]);

  // Cargar lista de cheques y métricas
  const fetchCheques = async (page = 1) => {
    setLoading(true);
    try {
      const res = await axios.get('/api/cheques', {
        params: {
          page,
          search: searchTerm || undefined,
          bank_name: bankFilter !== 'TODOS' ? bankFilter : undefined,
          status: statusFilter !== 'TODOS' ? statusFilter : undefined,
          start_date: startDate || undefined,
          end_date: endDate || undefined,
        },
      });

      if (res.data?.success) {
        setCheques(res.data.data.data || []);
        setSummary(
          res.data.summary || {
            total_emitido: 0,
            count_emitido: 0,
            total_cobrado: 0,
            count_cobrado: 0,
            total_anulado: 0,
            count_anulado: 0,
            total_general: 0,
          }
        );
        setAvailableBanks(res.data.available_banks || []);
        setPagination({
          current_page: res.data.data.current_page || 1,
          last_page: res.data.data.last_page || 1,
          total: res.data.data.total || 0,
        });
      }
    } catch (err) {
      console.error('Error al cargar cheques:', err);
      if (err.response?.status === 403) {
        navigate('/dashboard', { replace: true });
      }
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    const timeout = setTimeout(() => {
      fetchCheques(1);
    }, 250);
    return () => clearTimeout(timeout);
  }, [searchTerm, bankFilter, statusFilter, startDate, endDate]);

  const handleOpenCreateModal = () => {
    setEditingCheque(null);
    setFormData({
      bank_name: 'Cooperativa JEP',
      cheque_number: '',
      issue_date: new Date().toISOString().split('T')[0],
      payee: '',
      amount: '',
      concept: '',
      status: 'Emitido',
    });
    setFormError(null);
    setIsModalOpen(true);
  };

  const handleOpenEditModal = (cheque) => {
    setEditingCheque(cheque);
    setFormData({
      bank_name: cheque.bank_name,
      cheque_number: cheque.cheque_number,
      issue_date: cheque.issue_date ? cheque.issue_date.split('T')[0] : '',
      payee: cheque.payee,
      amount: cheque.amount,
      concept: cheque.concept,
      status: cheque.status,
    });
    setFormError(null);
    setIsModalOpen(true);
  };

  const handleSaveCheque = async (e) => {
    e.preventDefault();
    setFormError(null);

    if (!formData.bank_name.trim()) {
      setFormError('Por favor seleccione o escriba el banco o cooperativa.');
      return;
    }
    if (!formData.cheque_number.trim()) {
      setFormError('El número de cheque es obligatorio.');
      return;
    }
    if (!formData.payee.trim()) {
      setFormError('El nombre del beneficiario (A favor de) es obligatorio.');
      return;
    }
    if (!formData.amount || Number(formData.amount) <= 0) {
      setFormError('El monto debe ser mayor a 0 USD.');
      return;
    }
    if (!formData.concept.trim()) {
      setFormError('El concepto o justificación del cheque es obligatorio.');
      return;
    }

    setIsSubmitting(true);
    try {
      if (editingCheque) {
        await axios.put(`/api/cheques/${editingCheque.id}`, formData);
        showSuccessMessage(`Cheque N° ${formData.cheque_number} actualizado exitosamente.`);
      } else {
        await axios.post('/api/cheques', formData);
        showSuccessMessage(`Cheque N° ${formData.cheque_number} emitido exitosamente.`);
      }
      setIsModalOpen(false);
      fetchCheques(pagination.current_page);
    } catch (err) {
      console.error('Error al guardar cheque:', err);
      setFormError(
        err.response?.data?.message || 'Error al procesar el registro del cheque. Verifique los datos.'
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleChangeStatus = async (cheque, nextStatus) => {
    const actionWord = nextStatus === 'Cobrado' ? 'marcar como COBRADO' : 'ANULAR';
    if (!confirm(`¿Confirma que desea ${actionWord} el cheque N° ${cheque.cheque_number} por $${Number(cheque.amount).toLocaleString('en-US', { minimumFractionDigits: 2 })} USD?`)) {
      return;
    }

    try {
      await axios.patch(`/api/cheques/${cheque.id}/status`, {
        status: nextStatus,
      });
      showSuccessMessage(`Cheque N° ${cheque.cheque_number} actualizado a estado '${nextStatus}'.`);
      fetchCheques(pagination.current_page);
    } catch (err) {
      console.error('Error al actualizar estado:', err);
      alert(err.response?.data?.message || 'Error al actualizar el estado del cheque.');
    }
  };

  const handleDeleteCheque = async (cheque) => {
    if (!confirm(`¿Está completamente seguro de ELIMINAR el cheque N° ${cheque.cheque_number} a favor de ${cheque.payee}? Esta acción quedará registrada en auditoría.`)) {
      return;
    }

    try {
      await axios.delete(`/api/cheques/${cheque.id}`);
      showSuccessMessage(`Cheque N° ${cheque.cheque_number} eliminado del sistema.`);
      fetchCheques(pagination.current_page);
    } catch (err) {
      console.error('Error al eliminar cheque:', err);
      alert(err.response?.data?.message || 'Error al eliminar el cheque.');
    }
  };

  const showSuccessMessage = (msg) => {
    setActionSuccessMsg(msg);
    setTimeout(() => {
      setActionSuccessMsg(null);
    }, 3500);
  };

  const handleClearFilters = () => {
    setSearchTerm('');
    setBankFilter('TODOS');
    setStatusFilter('TODOS');
    setStartDate('');
    setEndDate('');
  };

  const formatCurrency = (val) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 2,
    }).format(Number(val) || 0);
  };

  const formatDate = (dateStr) => {
    if (!dateStr) return 'N/A';
    const d = new Date(dateStr + 'T00:00:00');
    return d.toLocaleDateString('es-EC', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
    });
  };

  const allBankOptions = useMemo(() => {
    const set = new Set([...COMMON_BANKS, ...availableBanks]);
    return Array.from(set);
  }, [availableBanks]);

  return (
    <div className="p-4 sm:p-6 lg:p-8 max-w-7xl mx-auto space-y-6">
      {/* ================= ENCABEZADO EJECUTIVO DEL MÓDULO ================= */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 border-b border-slate-200 pb-5">
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 rounded-xl bg-slate-900 text-white flex items-center justify-center shadow-md shadow-slate-900/20 shrink-0">
            <Landmark className="w-6 h-6 text-teal-400" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-xl sm:text-2xl font-black text-slate-900 tracking-tight">
                Control y Emisión de Cheques
              </h1>
              <span className="px-2 py-0.5 text-[10px] font-black uppercase tracking-wider rounded-md bg-amber-100 text-amber-900 border border-amber-200">
                Exclusivo CEO
              </span>
            </div>
            <p className="text-xs sm:text-sm text-slate-500 mt-0.5">
              Gestión centralizada de cheques emitidos, control de cobros bancarios y conciliación de cheques anulados.
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          <button
            type="button"
            onClick={() => fetchCheques(pagination.current_page)}
            disabled={loading}
            className="p-2.5 rounded-lg border border-slate-200 bg-white hover:bg-slate-50 text-slate-600 transition shadow-xs cursor-pointer disabled:opacity-50"
            title="Recargar listado"
          >
            <RotateCcw className={`w-4 h-4 ${loading ? 'animate-spin text-teal-600' : ''}`} />
          </button>

          <button
            type="button"
            onClick={handleOpenCreateModal}
            className="inline-flex items-center gap-2 px-4 py-2.5 rounded-lg font-bold text-xs sm:text-sm text-white bg-slate-900 hover:bg-slate-800 active:bg-black transition shadow-sm shadow-slate-900/20 cursor-pointer"
          >
            <Plus className="w-4 h-4 text-teal-400" />
            <span>+ Emitir Cheque</span>
          </button>
        </div>
      </div>

      {/* ================= MENSAJE TOAST DE ÉXITO ================= */}
      {actionSuccessMsg && (
        <div className="p-3.5 bg-emerald-50 border border-emerald-200 rounded-xl flex items-center gap-2.5 text-emerald-800 text-xs sm:text-sm font-semibold animate-in fade-in">
          <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0" />
          <span>{actionSuccessMsg}</span>
        </div>
      )}

      {/* ================= TARJETAS DE RESUMEN FINANCIERO ================= */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Total Emitido */}
        <div className="bg-white rounded-xl border border-slate-200 p-4 shadow-xs flex items-center justify-between">
          <div className="space-y-1">
            <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider block">
              Total Emitido
            </span>
            <div className="text-xl sm:text-2xl font-black text-blue-900">
              {formatCurrency(summary.total_emitido)}
            </div>
            <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-blue-700 bg-blue-50 px-2 py-0.5 rounded-full border border-blue-100">
              <Clock className="w-3 h-3" />
              <span>{summary.count_emitido} cheques en tránsito</span>
            </span>
          </div>
          <div className="w-12 h-12 rounded-xl bg-blue-50 border border-blue-100 flex items-center justify-center text-blue-600 shrink-0">
            <Clock className="w-6 h-6" />
          </div>
        </div>

        {/* Total Cobrado */}
        <div className="bg-white rounded-xl border border-slate-200 p-4 shadow-xs flex items-center justify-between">
          <div className="space-y-1">
            <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider block">
              Total Cobrado
            </span>
            <div className="text-xl sm:text-2xl font-black text-emerald-900">
              {formatCurrency(summary.total_cobrado)}
            </div>
            <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-100">
              <CheckCircle2 className="w-3 h-3" />
              <span>{summary.count_cobrado} efectivizados</span>
            </span>
          </div>
          <div className="w-12 h-12 rounded-xl bg-emerald-50 border border-emerald-100 flex items-center justify-center text-emerald-600 shrink-0">
            <CheckCircle2 className="w-6 h-6" />
          </div>
        </div>

        {/* Total Anulado */}
        <div className="bg-white rounded-xl border border-slate-200 p-4 shadow-xs flex items-center justify-between">
          <div className="space-y-1">
            <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider block">
              Total Anulado
            </span>
            <div className="text-xl sm:text-2xl font-black text-rose-900">
              {formatCurrency(summary.total_anulado)}
            </div>
            <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-rose-700 bg-rose-50 px-2 py-0.5 rounded-full border border-rose-100">
              <Ban className="w-3 h-3" />
              <span>{summary.count_anulado} anulados</span>
            </span>
          </div>
          <div className="w-12 h-12 rounded-xl bg-rose-50 border border-rose-100 flex items-center justify-center text-rose-600 shrink-0">
            <Ban className="w-6 h-6" />
          </div>
        </div>

        {/* Volumen General */}
        <div className="bg-white rounded-xl border border-slate-200 p-4 shadow-xs flex items-center justify-between">
          <div className="space-y-1">
            <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider block">
              Volumen Emitido + Cobrado
            </span>
            <div className="text-xl sm:text-2xl font-black text-slate-900">
              {formatCurrency(summary.total_general)}
            </div>
            <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-slate-600 bg-slate-100 px-2 py-0.5 rounded-full border border-slate-200">
              <Landmark className="w-3 h-3" />
              <span>{pagination.total} registros</span>
            </span>
          </div>
          <div className="w-12 h-12 rounded-xl bg-slate-100 border border-slate-200 flex items-center justify-center text-slate-700 shrink-0">
            <DollarSign className="w-6 h-6" />
          </div>
        </div>
      </div>

      {/* ================= BARRA DE BÚSQUEDA Y FILTROS ================= */}
      <div className="bg-white rounded-xl border border-slate-200 p-4 shadow-xs space-y-3">
        <div className="grid grid-cols-1 md:grid-cols-12 gap-3">
          {/* Input de Búsqueda */}
          <div className="md:col-span-4 relative">
            <Search className="w-4 h-4 absolute left-3 top-3 text-slate-400" />
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Buscar por N° cheque, beneficiario o concepto..."
              className="w-full pl-9 pr-3.5 py-2 text-xs sm:text-sm rounded-lg border border-slate-200 bg-slate-50/50 focus:bg-white focus:outline-none focus:ring-2 focus:ring-slate-900 focus:border-transparent transition"
            />
          </div>

          {/* Filtro Banco / Cooperativa */}
          <div className="md:col-span-3">
            <select
              value={bankFilter}
              onChange={(e) => setBankFilter(e.target.value)}
              className="w-full px-3 py-2 text-xs sm:text-sm rounded-lg border border-slate-200 bg-slate-50/50 focus:bg-white focus:outline-none focus:ring-2 focus:ring-slate-900 transition cursor-pointer"
            >
              <option value="TODOS">Todos los Bancos / Cooperativas</option>
              {allBankOptions.map((bank) => (
                <option key={bank} value={bank}>
                  {bank}
                </option>
              ))}
            </select>
          </div>

          {/* Filtro Estado */}
          <div className="md:col-span-2">
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="w-full px-3 py-2 text-xs sm:text-sm rounded-lg border border-slate-200 bg-slate-50/50 focus:bg-white focus:outline-none focus:ring-2 focus:ring-slate-900 transition cursor-pointer"
            >
              <option value="TODOS">Todos los Estados</option>
              <option value="Emitido">Emitido</option>
              <option value="Cobrado">Cobrado</option>
              <option value="Anulado">Anulado</option>
            </select>
          </div>

          {/* Rango de Fechas */}
          <div className="md:col-span-3 flex items-center gap-2">
            <input
              type="date"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
              title="Fecha inicial"
              className="w-full px-2 py-2 text-xs rounded-lg border border-slate-200 bg-slate-50/50 focus:bg-white text-slate-700"
            />
            <span className="text-slate-400 text-xs">a</span>
            <input
              type="date"
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
              title="Fecha final"
              className="w-full px-2 py-2 text-xs rounded-lg border border-slate-200 bg-slate-50/50 focus:bg-white text-slate-700"
            />
          </div>
        </div>

        {(searchTerm || bankFilter !== 'TODOS' || statusFilter !== 'TODOS' || startDate || endDate) && (
          <div className="flex items-center justify-between pt-2 border-t border-slate-100 text-xs text-slate-500">
            <span>Filtros activos aplicados</span>
            <button
              type="button"
              onClick={handleClearFilters}
              className="text-teal-700 hover:text-teal-900 font-semibold cursor-pointer flex items-center gap-1"
            >
              <X className="w-3.5 h-3.5" /> Limpiar filtros
            </button>
          </div>
        )}
      </div>

      {/* ================= TABLA DE CHEQUES ================= */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-xs overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-slate-50/90 border-b border-slate-200 text-[11px] font-bold text-slate-600 uppercase tracking-wider">
                <th className="py-3 px-4">N° Cheque</th>
                <th className="py-3 px-4">Banco / Cooperativa</th>
                <th className="py-3 px-4">Fecha Emisión</th>
                <th className="py-3 px-4">A favor de (Beneficiario)</th>
                <th className="py-3 px-4">Concepto</th>
                <th className="py-3 px-4 text-right">Monto</th>
                <th className="py-3 px-4 text-center">Estado</th>
                <th className="py-3 px-4 text-center">Acciones</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-xs">
              {loading ? (
                <tr>
                  <td colSpan="8" className="py-12 text-center text-slate-400">
                    <Loader2 className="w-6 h-6 animate-spin mx-auto mb-2 text-teal-600" />
                    <span>Cargando libro de cheques...</span>
                  </td>
                </tr>
              ) : cheques.length === 0 ? (
                <tr>
                  <td colSpan="8" className="py-12 text-center text-slate-400">
                    <Landmark className="w-8 h-8 mx-auto mb-2 text-slate-300" />
                    <p className="font-semibold text-slate-600">No se encontraron cheques registrados</p>
                    <p className="text-[11px] text-slate-400 mt-1">
                      {searchTerm || bankFilter !== 'TODOS' || statusFilter !== 'TODOS'
                        ? 'Prueba modificando los filtros de búsqueda.'
                        : 'Haz clic en "+ Emitir Cheque" para registrar el primero.'}
                    </p>
                  </td>
                </tr>
              ) : (
                cheques.map((c) => {
                  const isEmitido = c.status === 'Emitido';
                  const isCobrado = c.status === 'Cobrado';
                  const isAnulado = c.status === 'Anulado';

                  return (
                    <tr
                      key={c.id}
                      className={`hover:bg-slate-50/80 transition ${
                        isAnulado ? 'bg-rose-50/20 text-slate-400' : ''
                      }`}
                    >
                      {/* N° Cheque */}
                      <td className="py-3.5 px-4 font-mono font-bold text-slate-900">
                        <span className="bg-slate-100 text-slate-800 px-2 py-0.5 rounded border border-slate-200">
                          {c.cheque_number}
                        </span>
                      </td>

                      {/* Banco */}
                      <td className="py-3.5 px-4 font-semibold text-slate-800 whitespace-nowrap">
                        <div className="flex items-center gap-1.5">
                          <Building2 className="w-3.5 h-3.5 text-slate-400" />
                          <span>{c.bank_name}</span>
                        </div>
                      </td>

                      {/* Fecha Emisión */}
                      <td className="py-3.5 px-4 text-slate-600 whitespace-nowrap">
                        {formatDate(c.issue_date)}
                      </td>

                      {/* Beneficiario */}
                      <td className="py-3.5 px-4 font-bold text-slate-900">
                        {c.payee}
                      </td>

                      {/* Concepto */}
                      <td className="py-3.5 px-4 text-slate-600 max-w-xs truncate" title={c.concept}>
                        {c.concept}
                      </td>

                      {/* Monto */}
                      <td className="py-3.5 px-4 text-right font-black text-slate-900 whitespace-nowrap">
                        <span className={isAnulado ? 'line-through text-rose-600' : 'text-slate-900'}>
                          {formatCurrency(c.amount)}
                        </span>
                      </td>

                      {/* Estado */}
                      <td className="py-3.5 px-4 text-center whitespace-nowrap">
                        {isEmitido && (
                          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-blue-50 text-blue-700 border border-blue-200">
                            <Clock className="w-3 h-3 text-blue-600" />
                            <span>Emitido</span>
                          </span>
                        )}
                        {isCobrado && (
                          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
                            <CheckCircle2 className="w-3 h-3 text-emerald-600" />
                            <span>Cobrado</span>
                          </span>
                        )}
                        {isAnulado && (
                          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-rose-50 text-rose-700 border border-rose-200">
                            <Ban className="w-3 h-3 text-rose-600" />
                            <span>Anulado</span>
                          </span>
                        )}
                      </td>

                      {/* Acciones */}
                      <td className="py-3.5 px-4 text-center whitespace-nowrap">
                        <div className="flex items-center justify-center gap-1.5">
                          {/* Cambiar Estado a Cobrado */}
                          {isEmitido && (
                            <button
                              type="button"
                              onClick={() => handleChangeStatus(c, 'Cobrado')}
                              className="p-1.5 rounded-md hover:bg-emerald-100 text-emerald-700 transition cursor-pointer"
                              title="Marcar como Cobrado"
                            >
                              <Check className="w-4 h-4" />
                            </button>
                          )}

                          {/* Cambiar Estado a Anulado */}
                          {!isAnulado && (
                            <button
                              type="button"
                              onClick={() => handleChangeStatus(c, 'Anulado')}
                              className="p-1.5 rounded-md hover:bg-rose-100 text-rose-600 transition cursor-pointer"
                              title="Anular Cheque"
                            >
                              <Ban className="w-4 h-4" />
                            </button>
                          )}

                          {/* Revertir Anulado a Emitido si aplica */}
                          {isAnulado && (
                            <button
                              type="button"
                              onClick={() => handleChangeStatus(c, 'Emitido')}
                              className="p-1.5 rounded-md hover:bg-blue-100 text-blue-600 transition cursor-pointer"
                              title="Revertir a Emitido"
                            >
                              <RotateCcw className="w-4 h-4" />
                            </button>
                          )}

                          {/* Editar */}
                          <button
                            type="button"
                            onClick={() => handleOpenEditModal(c)}
                            className="p-1.5 rounded-md hover:bg-slate-200 text-slate-700 transition cursor-pointer"
                            title="Editar datos del cheque"
                          >
                            <Edit2 className="w-3.5 h-3.5" />
                          </button>

                          {/* Eliminar */}
                          <button
                            type="button"
                            onClick={() => handleDeleteCheque(c)}
                            className="p-1.5 rounded-md hover:bg-rose-100 text-rose-600 transition cursor-pointer"
                            title="Eliminar cheque permanentemente"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        {/* Paginación */}
        {pagination.last_page > 1 && (
          <div className="flex items-center justify-between px-4 py-3 border-t border-slate-200 bg-slate-50 text-xs">
            <span className="text-slate-500">
              Página <strong className="text-slate-800">{pagination.current_page}</strong> de{' '}
              <strong className="text-slate-800">{pagination.last_page}</strong> ({pagination.total} cheques)
            </span>
            <div className="flex items-center gap-1">
              <button
                type="button"
                onClick={() => fetchCheques(pagination.current_page - 1)}
                disabled={pagination.current_page <= 1 || loading}
                className="px-3 py-1 rounded-md border border-slate-200 bg-white hover:bg-slate-100 disabled:opacity-50 cursor-pointer font-medium"
              >
                Anterior
              </button>
              <button
                type="button"
                onClick={() => fetchCheques(pagination.current_page + 1)}
                disabled={pagination.current_page >= pagination.last_page || loading}
                className="px-3 py-1 rounded-md border border-slate-200 bg-white hover:bg-slate-100 disabled:opacity-50 cursor-pointer font-medium"
              >
                Siguiente
              </button>
            </div>
          </div>
        )}
      </div>

      {/* ================= MODAL: EMITIR O EDITAR CHEQUE ================= */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-2xl max-w-lg w-full border border-slate-200 overflow-hidden animate-in fade-in zoom-in-95 duration-150">
            {/* Cabecera del modal */}
            <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 bg-slate-50/70">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-lg bg-teal-50 border border-teal-200 flex items-center justify-center text-teal-700">
                  <Landmark className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-slate-900 leading-tight">
                    {editingCheque ? `Editar Cheque N° ${editingCheque.cheque_number}` : 'Emitir Nuevo Cheque'}
                  </h3>
                  <p className="text-[11px] text-slate-500">
                    Registro formal en libro contable de gerencia
                  </p>
                </div>
              </div>

              <button
                type="button"
                onClick={() => setIsModalOpen(false)}
                disabled={isSubmitting}
                className="p-1.5 text-slate-400 hover:text-slate-700 rounded-lg hover:bg-slate-200 transition cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Formulario */}
            <form onSubmit={handleSaveCheque} className="p-6 space-y-4">
              {formError && (
                <div className="p-3 bg-rose-50 border border-rose-200 rounded-lg text-rose-800 text-xs font-semibold flex items-center gap-2">
                  <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0" />
                  <span>{formError}</span>
                </div>
              )}

              {/* Banco / Cooperativa */}
              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                  Banco / Cooperativa <span className="text-rose-600">*</span>
                </label>
                <input
                  type="text"
                  list="bank-suggestions"
                  value={formData.bank_name}
                  onChange={(e) => setFormData({ ...formData, bank_name: e.target.value })}
                  placeholder="Ej: Cooperativa JEP, Banco Pichincha"
                  required
                  className="w-full px-3 py-2 text-xs sm:text-sm rounded-lg border border-slate-200 bg-slate-50 focus:bg-white focus:outline-none focus:ring-2 focus:ring-slate-900"
                />
                <datalist id="bank-suggestions">
                  {allBankOptions.map((b) => (
                    <option key={b} value={b} />
                  ))}
                </datalist>
              </div>

              {/* N° de Cheque y Fecha de Emisión */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                    N° de Cheque <span className="text-rose-600">*</span>
                  </label>
                  <input
                    type="text"
                    value={formData.cheque_number}
                    onChange={(e) => setFormData({ ...formData, cheque_number: e.target.value })}
                    placeholder="Ej: 000542"
                    required
                    className="w-full px-3 py-2 text-xs sm:text-sm font-mono font-bold rounded-lg border border-slate-200 bg-slate-50 focus:bg-white focus:outline-none focus:ring-2 focus:ring-slate-900"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                    Fecha de Emisión <span className="text-rose-600">*</span>
                  </label>
                  <input
                    type="date"
                    value={formData.issue_date}
                    onChange={(e) => setFormData({ ...formData, issue_date: e.target.value })}
                    required
                    className="w-full px-3 py-2 text-xs sm:text-sm rounded-lg border border-slate-200 bg-slate-50 focus:bg-white focus:outline-none focus:ring-2 focus:ring-slate-900"
                  />
                </div>
              </div>

              {/* A favor de (Beneficiario) y Monto */}
              <div className="grid grid-cols-1 sm:grid-cols-12 gap-3">
                <div className="sm:col-span-7">
                  <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                    A favor de (Beneficiario) <span className="text-rose-600">*</span>
                  </label>
                  <input
                    type="text"
                    value={formData.payee}
                    onChange={(e) => setFormData({ ...formData, payee: e.target.value })}
                    placeholder="Nombre completo o institución"
                    required
                    className="w-full px-3 py-2 text-xs sm:text-sm rounded-lg border border-slate-200 bg-slate-50 focus:bg-white focus:outline-none focus:ring-2 focus:ring-slate-900"
                  />
                </div>

                <div className="sm:col-span-5">
                  <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                    Monto ($ USD) <span className="text-rose-600">*</span>
                  </label>
                  <div className="relative">
                    <span className="absolute left-3 top-2.5 text-xs text-slate-400 font-bold">$</span>
                    <input
                      type="number"
                      step="0.01"
                      min="0.01"
                      value={formData.amount}
                      onChange={(e) => setFormData({ ...formData, amount: e.target.value })}
                      placeholder="0.00"
                      required
                      className="w-full pl-7 pr-3 py-2 text-xs sm:text-sm font-black text-slate-900 rounded-lg border border-slate-200 bg-slate-50 focus:bg-white focus:outline-none focus:ring-2 focus:ring-slate-900"
                    />
                  </div>
                </div>
              </div>

              {/* Concepto del Cheque */}
              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                  Concepto del Cheque <span className="text-rose-600">*</span>
                </label>
                <textarea
                  rows="3"
                  value={formData.concept}
                  onChange={(e) => setFormData({ ...formData, concept: e.target.value })}
                  placeholder="Detalle o justificación del pago (ej: Pago de alcabalas y plusvalía lote 15 Proyecto Las Palmas)..."
                  required
                  className="w-full px-3 py-2 text-xs sm:text-sm rounded-lg border border-slate-200 bg-slate-50 focus:bg-white focus:outline-none focus:ring-2 focus:ring-slate-900 resize-none"
                />
              </div>

              {/* Estado (solo en edición o selección opcional) */}
              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                  Estado del Cheque
                </label>
                <select
                  value={formData.status}
                  onChange={(e) => setFormData({ ...formData, status: e.target.value })}
                  className="w-full px-3 py-2 text-xs sm:text-sm rounded-lg border border-slate-200 bg-slate-50 focus:bg-white focus:outline-none focus:ring-2 focus:ring-slate-900 cursor-pointer"
                >
                  <option value="Emitido">Emitido (En tránsito / No cobrado aún)</option>
                  <option value="Cobrado">Cobrado (Efectivizado en cuenta)</option>
                  <option value="Anulado">Anulado (Sin validez financiera)</option>
                </select>
              </div>

              {/* Botones de acción */}
              <div className="pt-3 border-t border-slate-100 flex items-center justify-end gap-2.5">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  disabled={isSubmitting}
                  className="px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-100 rounded-lg transition cursor-pointer"
                >
                  Cancelar
                </button>

                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="inline-flex items-center gap-1.5 px-5 py-2 text-xs font-bold text-white bg-slate-900 hover:bg-slate-800 rounded-lg shadow-sm transition cursor-pointer disabled:opacity-50"
                >
                  {isSubmitting && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                  <span>{editingCheque ? 'Actualizar Cheque' : 'Emitir Cheque'}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

