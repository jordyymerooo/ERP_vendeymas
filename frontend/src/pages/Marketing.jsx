import useSingleSubmit from '../hooks/useSingleSubmit';
import ActionButton from '../components/ActionButton';
import Pagination from '../components/Pagination';
import InactiveUserBadge, { isUserInactive } from '../components/InactiveUserBadge';
import React, { useRef, useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import {
  Megaphone,
  Plus,
  Search,
  Filter,
  Phone,
  Mail,
  Building2,
  Calendar,
  CheckCircle,
  AlertCircle,
  Loader2,
  UserCheck,
  ArrowRight,
  ArrowLeft,
  X,
  TrendingUp,
  UserPlus,
  Clock,
  Sparkles,
  FileText,
  Trash2,
  Users,
  Briefcase,
  UserX,
  Archive,
  RotateCcw,
  Edit3,
  HelpCircle,
  CheckCircle2,
} from 'lucide-react';

const STAGES = [
  {
    key: 'Nuevo Prospecto',
    label: 'Nuevo Prospecto',
    color: 'sky',
    borderClass: 'border-t-sky-500',
    badgeClass: 'bg-sky-50 text-sky-700 border-sky-200',
    headerBg: 'bg-sky-50/70',
    counterClass: 'bg-sky-100 text-sky-800',
  },
  {
    key: 'Visita Agendada',
    label: 'Visita Agendada',
    color: 'amber',
    borderClass: 'border-t-amber-500',
    badgeClass: 'bg-amber-50 text-amber-700 border-amber-200',
    headerBg: 'bg-amber-50/70',
    counterClass: 'bg-amber-100 text-amber-800',
  },
  {
    key: 'En Negociación',
    label: 'En Negociación',
    color: 'indigo',
    borderClass: 'border-t-indigo-500',
    badgeClass: 'bg-indigo-50 text-indigo-700 border-indigo-200',
    headerBg: 'bg-indigo-50/70',
    counterClass: 'bg-indigo-100 text-indigo-800',
  },
  {
    key: 'Cierre Ganado',
    label: 'Cierre Ganado',
    color: 'emerald',
    borderClass: 'border-t-emerald-500',
    badgeClass: 'bg-emerald-50 text-emerald-800 border-emerald-200',
    headerBg: 'bg-emerald-50/70',
    counterClass: 'bg-emerald-100 text-emerald-800',
  },
];

const DISCARD_SUGGESTIONS = [
  'Fuera de presupuesto',
  'No contestó llamadas / Número inválido',
  'Compró en otro proyecto / sector',
  'No califica para financiamiento directo',
  'Decidió postergar la inversión para el próximo año',
];

export default function Marketing() {
  const navigate = useNavigate();

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

  // Estados de datos
  const [leads, setLeads] = useState([]);
  const [stats, setStats] = useState({
    total: 0,
    nuevo: 0,
    visita: 0,
    negociacion: 0,
    ganado: 0,
    descartado: 0,
    activos: 0,
  });
  const [projects, setProjects] = useState([]);
  const [advisorsSummary, setAdvisorsSummary] = useState([]);
  const [advisorsList, setAdvisorsList] = useState([]);
  const [loading, setLoading] = useState(true);

  // Filtro estricto de seguridad: excluir Administradores y Topógrafos en tarjetas y filtros
  const filteredAdvisorsSummary = React.useMemo(() => {
    return (advisorsSummary || []).filter((adv) => {
      const role = (adv.role || '').toLowerCase();
      const name = (adv.name || '').toLowerCase();
      if (role.includes('admin') || role.includes('topóg') || role.includes('topog')) return false;
      if (name.includes('administrador') || name.includes('administradora') || name.includes('topógrafo') || name.includes('topografo')) return false;
      if (name.includes('mateo silva') || name.includes('valeria gómez') || name.includes('valeria gomez') || name.includes('fernando castro')) return false;
      return true;
    });
  }, [advisorsSummary]);

  const filteredAdvisorsList = React.useMemo(() => {
    return (advisorsList || []).filter((adv) => {
      if (isUserInactive(adv)) return false;
      const role = (adv.role || '').toLowerCase();
      const name = (adv.name || '').toLowerCase();
      if (role.includes('admin') || role.includes('topóg') || role.includes('topog')) return false;
      if (name.includes('administrador') || name.includes('administradora') || name.includes('topógrafo') || name.includes('topografo')) return false;
      if (name.includes('mateo silva') || name.includes('valeria gómez') || name.includes('valeria gomez') || name.includes('fernando castro')) return false;
      return true;
    });
  }, [advisorsList]);

  // Modo de vista: 'kanban' (4 etapas activas) o 'discarded' (Archivo de descartados)
  const [viewMode, setViewMode] = useState('kanban');
  const [pagination, setPagination] = useState({});
  const listRequest = useRef(0);
  const [perPage, setPerPage] = useState(15);

  // Filtros
  const [selectedProjectId, setSelectedProjectId] = useState('');
  const [selectedAdvisorId, setSelectedAdvisorId] = useState('');
  const [searchTerm, setSearchTerm] = useState('');

  // Notificaciones Toast
  const [toastMessage, setToastMessage] = useState(null);

  // Modal de Nuevo Prospecto
  const [isAddLeadModalOpen, setIsAddLeadModalOpen] = useState(false);
  const [isSubmittingLead, setIsSubmittingLead] = useState(false);
  const [newLeadForm, setNewLeadForm] = useState({
    name: '',
    phone: '',
    email: '',
    project_id: '',
    user_id: '',
    stage: 'Nuevo Prospecto',
    notes: '',
  });

  // Modal para Descartar Prospecto (motivo obligatorio/documentado)
  const [isDiscardModalOpen, setIsDiscardModalOpen] = useState(false);
  const [leadToDiscard, setLeadToDiscard] = useState(null);
  const [discardReason, setDiscardReason] = useState('');
  const [isSubmittingDiscard, setIsSubmittingDiscard] = useState(false);

  // Modal para Editar / Reasignar Prospecto (Super Admin)
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [editingLead, setEditingLead] = useState(null);
  const [isSubmittingEdit, setIsSubmittingEdit] = useState(false);

  // Estado de conversión en proceso
  const [convertingLeadId, setConvertingLeadId] = useState(null);

  // Estado para drag and drop
  const [draggedLeadId, setDraggedLeadId] = useState(null);

  // 1. Cargar proyectos
  const fetchProjects = async () => {
    try {
      const res = await axios.get('/api/projects');
      const projs = res.data.data || [];
      setProjects(projs);
      if (projs.length > 0 && !newLeadForm.project_id) {
        setNewLeadForm((prev) => ({ ...prev, project_id: String(projs[0].id) }));
      }
    } catch (err) {
      console.error('Error al cargar proyectos:', err);
    }
  };

  // 2. Cargar prospectos desde backend aplicando aislamiento por asesor
  const fetchLeads = async (page = 1) => {
    const requestId = ++listRequest.current;
    setLoading(true);
    try {
      const params = { page, per_page: perPage, view: viewMode };
      if (selectedProjectId) params.project_id = selectedProjectId;
      if (selectedAdvisorId && selectedAdvisorId !== 'TODOS') params.advisor_id = selectedAdvisorId;
      if (searchTerm) params.search = searchTerm;

      const res = await axios.get('/api/leads', { params });
      if (requestId !== listRequest.current) return;
      if (page > res.data.last_page) {
        await fetchLeads(res.data.last_page);
        return;
      }
      setLeads(res.data.data || []);
      setPagination(res.data);
      if (res.data.stats) {
        setStats(res.data.stats);
      }
      if (res.data.advisors_summary) {
        setAdvisorsSummary(res.data.advisors_summary);
      }
      if (res.data.advisors_list) {
        setAdvisorsList(res.data.advisors_list);
      }
    } catch (err) {
      if (requestId !== listRequest.current) return;
      console.error('Error al cargar prospectos:', err);
    } finally {
      if (requestId === listRequest.current) setLoading(false);
    }
  };

  useEffect(() => {
    fetchProjects();
  }, []);

  useEffect(() => {
    listRequest.current++;
    const timer = setTimeout(() => fetchLeads(), 250);
    return () => clearTimeout(timer);
  }, [selectedProjectId, selectedAdvisorId, searchTerm, viewMode, perPage]);

  // Manejar creación de nuevo prospecto
  const [handleCreateLead, handleCreateLeadPending] = useSingleSubmit(async (e) => {
    if (!newLeadForm.name.trim()) return;

    setIsSubmittingLead(true);
    try {
      const payload = {
        name: newLeadForm.name.trim(),
        phone: newLeadForm.phone || null,
        email: newLeadForm.email || null,
        project_id: newLeadForm.project_id || null,
        stage: newLeadForm.stage || 'Nuevo Prospecto',
        notes: newLeadForm.notes || null,
      };

      if (isSuperAdmin && newLeadForm.user_id) {
        payload.user_id = Number(newLeadForm.user_id);
      }

      const res = await axios.post('/api/leads', payload);

      setToastMessage(`Prospecto "${newLeadForm.name}" registrado exitosamente en el Pipeline.`);
      setIsAddLeadModalOpen(false);
      setNewLeadForm({
        name: '',
        phone: '',
        email: '',
        project_id: projects.length > 0 ? String(projects[0].id) : '',
        user_id: '',
        stage: 'Nuevo Prospecto',
        notes: '',
      });
      fetchLeads();
    } catch (err) {
      if (err?.isDuplicateBlocked) return;
      console.error('Error al registrar prospecto:', err);
      alert('Error al registrar el prospecto.');
    } finally {
      setIsSubmittingLead(false);
      setTimeout(() => setToastMessage(null), 4500);
    }
  }, { form: true });

  // Abrir modal de descarte
  const handleOpenDiscardModal = (lead) => {
    setLeadToDiscard(lead);
    setDiscardReason('');
    setIsDiscardModalOpen(true);
  };

  // Confirmar descarte con motivo documentado
  const [handleConfirmDiscard, handleConfirmDiscardPending] = useSingleSubmit(async (e) => {
    if (!leadToDiscard) return;

    const reasonToSave = discardReason.trim() || 'Descartado por decisión del cliente / asesor';

    setIsSubmittingDiscard(true);
    try {
      await axios.put(`/api/leads/${leadToDiscard.id}/stage`, {
        stage: 'Descartado',
        discard_reason: reasonToSave,
      });

      setToastMessage(`Prospecto "${leadToDiscard.name}" movido al Archivo de Descartados.`);
      setIsDiscardModalOpen(false);
      setLeadToDiscard(null);
      setDiscardReason('');
      fetchLeads();
    } catch (err) {
      if (err?.isDuplicateBlocked) return;
      console.error('Error al descartar prospecto:', err);
      alert(err.response?.data?.message || 'Error al descartar el prospecto.');
    } finally {
      setIsSubmittingDiscard(false);
      setTimeout(() => setToastMessage(null), 4500);
    }
  }, { form: true });

  // Reactivar un prospecto descartado
  const [handleReactivateLead, handleReactivateLeadPending] = useSingleSubmit(async (lead) => {
    try {
      await axios.put(`/api/leads/${lead.id}/stage`, {
        stage: 'Nuevo Prospecto',
      });
      setToastMessage(`Prospecto "${lead.name}" reactivado en etapa "Nuevo Prospecto".`);
      fetchLeads();
    } catch (err) {
      if (err?.isDuplicateBlocked) return;
      console.error('Error al reactivar prospecto:', err);
      alert(err.response?.data?.message || 'Error al reactivar el prospecto.');
    } finally {
      setTimeout(() => setToastMessage(null), 4000);
    }
  });

  // Abrir modal de edición / reasignación
  const handleOpenEditModal = (lead) => {
    setEditingLead({
      id: lead.id,
      name: lead.name,
      phone: lead.phone || '',
      email: lead.email || '',
      project_id: lead.project_id ? String(lead.project_id) : '',
      user_id: lead.user_id ? String(lead.user_id) : '',
      stage: lead.stage,
      notes: lead.notes || '',
      advisor_name: lead.advisor?.name || 'General',
    });
    setIsEditModalOpen(true);
  };

  // Guardar edición / reasignación
  const [handleSaveEdit, handleSaveEditPending] = useSingleSubmit(async (e) => {
    if (!editingLead) return;

    setIsSubmittingEdit(true);
    try {
      const payload = {
        name: editingLead.name.trim(),
        phone: editingLead.phone || null,
        email: editingLead.email || null,
        project_id: editingLead.project_id || null,
        stage: editingLead.stage,
        notes: editingLead.notes || null,
      };

      if (isSuperAdmin && editingLead.user_id) {
        payload.user_id = Number(editingLead.user_id);
      }

      await axios.put(`/api/leads/${editingLead.id}`, payload);

      setToastMessage(`Prospecto "${editingLead.name}" actualizado con éxito.`);
      setIsEditModalOpen(false);
      setEditingLead(null);
      fetchLeads();
    } catch (err) {
      if (err?.isDuplicateBlocked) return;
      console.error('Error al actualizar prospecto:', err);
      alert(err.response?.data?.message || 'Error al actualizar el prospecto.');
    } finally {
      setIsSubmittingEdit(false);
      setTimeout(() => setToastMessage(null), 4000);
    }
  }, { form: true });

  // Cambiar etapa del prospecto
  const [handleUpdateStage, handleUpdateStagePending] = useSingleSubmit(async (leadId, newStage) => {
    if (newStage === 'Descartado') {
      const targetLead = leads.find((l) => l.id === leadId);
      if (targetLead) {
        handleOpenDiscardModal(targetLead);
        return;
      }
    }

    try {
      // Optimistic update
      setLeads((prev) =>
        prev.map((l) => (l.id === leadId ? { ...l, stage: newStage } : l))
      );

      const res = await axios.put(`/api/leads/${leadId}/stage`, {
        stage: newStage,
      });

      setToastMessage(res.data.message || `Prospecto movido a ${newStage}`);
      fetchLeads();
    } catch (err) {
      if (err?.isDuplicateBlocked) return;
      console.error('Error al cambiar etapa:', err);
      alert(err.response?.data?.message || 'No se pudo actualizar la etapa en el servidor.');
      fetchLeads();
    } finally {
      setTimeout(() => setToastMessage(null), 3500);
    }
  });

  // Mover prospecto a la etapa previa o siguiente
  const handleMoveStep = (lead, direction) => {
    const currentIndex = STAGES.findIndex((s) => s.key === lead.stage);
    if (currentIndex === -1) return;

    const nextIndex = currentIndex + direction;
    if (nextIndex >= 0 && nextIndex < STAGES.length) {
      handleUpdateStage(lead.id, STAGES[nextIndex].key);
    }
  };

  // Drag and Drop nativo HTML5
  const handleDragStart = (e, leadId) => {
    setDraggedLeadId(leadId);
    e.dataTransfer.setData('text/plain', String(leadId));
  };

  const handleDragOver = (e) => {
    e.preventDefault();
  };

  const [handleDrop] = useSingleSubmit(async (e, targetStage) => {
    e.preventDefault();
    const leadId = Number(e.dataTransfer.getData('text/plain') || draggedLeadId);
    if (leadId) {
      await handleUpdateStage(leadId, targetStage);
    }
    setDraggedLeadId(null);
  });

  // Acción Principal: Convertir en Cliente y Asignar Lote
  const [handleConvertLead, handleConvertLeadPending] = useSingleSubmit(async (lead) => {
    setConvertingLeadId(lead.id);
    try {
      const res = await axios.post(`/api/leads/${lead.id}/convert`);
      const { message, redirect_url } = res.data;

      setToastMessage(message || '¡Prospecto convertido en cliente con éxito!');

      setTimeout(() => {
        if (redirect_url) {
          navigate(redirect_url);
        } else {
          navigate('/proyectos');
        }
      }, 1000);
    } catch (err) {
      if (err?.isDuplicateBlocked) return;
      console.error('Error al convertir prospecto en cliente:', err);
      alert(err.response?.data?.message || 'Error al convertir prospecto.');
      setConvertingLeadId(null);
    }
  });

  const activeLeads = leads.filter((l) => l.stage !== 'Descartado');
  const discardedLeads = leads.filter((l) => l.stage === 'Descartado');

  return (
    <div className="space-y-5 animate-fade-in w-full pb-8">
      {/* Toast Notification */}
      {toastMessage && (
        <div className="bg-emerald-50 border border-emerald-200 text-emerald-800 p-4 rounded-xl flex items-center justify-between shadow-xs animate-fade-in">
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

      {/* ========================================================================= */}
      {/* 1. BARRA DE SUPERVISIÓN EXCLUSIVA PARA EL SUPER ADMIN */}
      {/* ========================================================================= */}
      {isSuperAdmin && (
        <div className="bg-slate-900 text-white rounded-xl p-5 shadow-sm space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-800 pb-3">
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-lg bg-indigo-500/20 text-indigo-400 flex items-center justify-center border border-indigo-500/30">
                <Briefcase className="w-4 h-4" />
              </div>
              <div>
                <h2 className="text-sm font-bold text-white tracking-wide">
                  Panel de Supervisión Comercial y Rendimiento por Asesor
                </h2>
                <p className="text-xs text-slate-400">
                  Monitoreo de cartera asignada, prospectos activos y cierres ganados por cada miembro del equipo.
                </p>
              </div>
            </div>

            {/* Selector Destacado de Asesor */}
            <div className="flex items-center gap-2 bg-slate-800/80 px-3 py-1.5 rounded-lg border border-slate-700">
              <span className="text-xs font-medium text-slate-300">Filtrar por Asesor:</span>
              <select id="crm-filter-advisor" name="crm_filter_advisor"
                value={selectedAdvisorId}
                onChange={(e) => setSelectedAdvisorId(e.target.value)}
                className="bg-slate-900 text-white text-xs font-bold px-2.5 py-1.5 rounded-md border border-slate-600 focus:outline-none focus:ring-1 focus:ring-indigo-400 cursor-pointer"
              >
                <option value="">Todos los Asesores ({filteredAdvisorsSummary.length})</option>
                {filteredAdvisorsSummary.map((adv) => (
                  <option key={adv.id} value={adv.id}>
                    {adv.name}{isUserInactive(adv) ? ' · Inactivo' : ''} ({adv.active_count} activos, {adv.won_count} ganados)
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Tarjetas Compactas de Resumen de Asesores */}
          {filteredAdvisorsSummary.length > 0 && (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 pt-1">
              {filteredAdvisorsSummary.map((adv) => {
                const isSelected = String(selectedAdvisorId) === String(adv.id);

                return (
                  <button
                    key={adv.id}
                    type="button"
                    onClick={() => setSelectedAdvisorId(isSelected ? '' : String(adv.id))}
                    className={`text-left p-3 rounded-lg border transition-all cursor-pointer ${
                      isSelected
                        ? 'bg-slate-800 border-indigo-400 ring-1 ring-indigo-400 shadow-md'
                        : 'bg-slate-800/50 border-slate-700/80 hover:bg-slate-800 hover:border-slate-600'
                    }`}
                  >
                    <div className="flex items-center justify-between gap-1 mb-1.5">
                      <div className="flex items-center gap-1.5 min-w-0">
                        <div className="w-5 h-5 rounded-full bg-indigo-500/30 text-indigo-300 text-[10px] font-bold flex items-center justify-center shrink-0">
                          {adv.name.charAt(0)}
                        </div>
                        <span className="text-xs font-bold text-white truncate">{adv.name}</span>
                        <InactiveUserBadge user={adv} />
                      </div>
                      <span className="text-[10px] px-1.5 py-0.5 rounded bg-slate-700 text-slate-300 font-medium">
                        {adv.role}
                      </span>
                    </div>

                    <div className="grid grid-cols-3 gap-1 text-center pt-1 border-t border-slate-700/60 text-[10px]">
                      <div>
                        <span className="text-slate-400 block text-[9px]">Activos</span>
                        <span className="font-bold text-cyan-400">{adv.active_count}</span>
                      </div>
                      <div>
                        <span className="text-slate-400 block text-[9px]">Ganados</span>
                        <span className="font-bold text-emerald-400">{adv.won_count}</span>
                      </div>
                      <div>
                        <span className="text-slate-400 block text-[9px]">Descartados</span>
                        <span className="font-bold text-rose-400">{adv.discarded_count}</span>
                      </div>
                    </div>
                  </button>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* ========================================================================= */}
      {/* 2. ENCABEZADO PRINCIPAL Y MÉTRICAS DEL PIPELINE */}
      {/* ========================================================================= */}
      <div className="bg-white rounded-lg border border-slate-200 p-5 sm:p-6 shadow-xs space-y-5">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="w-11 h-11 rounded-xl bg-violet-50 flex items-center justify-center text-violet-600 shrink-0">
              <Megaphone className="w-6 h-6" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-xl font-bold text-slate-900 tracking-tight">
                  {isSuperAdmin
                    ? selectedAdvisorId
                      ? `Pipeline de: ${filteredAdvisorsSummary.find((a) => String(a.id) === String(selectedAdvisorId))?.name || 'Asesor'}`
                      : 'Pipeline Comercial Global & CRM de Ventas'
                    : 'Mi Pipeline Comercial & Gestión de Clientes'}
                </h1>
                {!isSuperAdmin && (
                  <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-indigo-50 text-indigo-700 border border-indigo-200">
                    Mis Prospectos Asignados
                  </span>
                )}
              </div>
              <p className="text-xs text-slate-500 mt-0.5">
                {isSuperAdmin
                  ? 'Supervisión integral de prospectos calificados, embudo por etapas y conversiones.'
                  : 'Administra tus prospectos, registra visitas agendadas, negocia y convierte a clientes.'}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-3 flex-wrap">
            {/* Pestañas de Vista: Tablero Activo vs Archivo Descartados */}
            <div className="inline-flex rounded-lg border border-slate-200 bg-slate-50 p-0.5">
              <button
                type="button"
                onClick={() => setViewMode('kanban')}
                className={`px-3 py-1.5 text-xs font-bold rounded-md transition cursor-pointer flex items-center gap-1.5 ${
                  viewMode === 'kanban'
                    ? 'bg-white text-slate-900 shadow-2xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                <TrendingUp className="w-3.5 h-3.5 text-indigo-600" />
                <span>Tablero Activo ({stats.activos + stats.ganado})</span>
              </button>
              <button
                type="button"
                onClick={() => setViewMode('discarded')}
                className={`px-3 py-1.5 text-xs font-bold rounded-md transition cursor-pointer flex items-center gap-1.5 ${
                  viewMode === 'discarded'
                    ? 'bg-white text-rose-700 shadow-2xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                <Archive className="w-3.5 h-3.5 text-rose-500" />
                <span>Descartados ({stats.descartado})</span>
              </button>
            </div>

            <button
              type="button"
              onClick={() => setIsAddLeadModalOpen(true)}
              className="px-4 py-2 rounded-md text-xs sm:text-sm font-semibold text-white bg-slate-900 hover:bg-slate-800 transition flex items-center gap-2 cursor-pointer shadow-xs"
            >
              <UserPlus className="w-4 h-4" />
              <span>+ Registrar Prospecto</span>
            </button>
          </div>
        </div>

        {/* Métricas Resumidas del Pipeline */}
        <div className="grid grid-cols-2 sm:grid-cols-5 gap-3 pt-2 border-t border-slate-100">
          <div className="bg-slate-50 p-3 rounded-md border border-slate-200">
            <span className="text-[11px] font-semibold text-slate-500 block uppercase">
              {isSuperAdmin ? 'Total Prospectos' : 'Mis Prospectos'}
            </span>
            <span className="text-xl font-bold text-slate-800">
              {stats.total}
            </span>
          </div>

          <div className="bg-amber-50/60 p-3 rounded-md border border-amber-200">
            <span className="text-[11px] font-semibold text-amber-800 block uppercase">
              Visitas Agendadas
            </span>
            <span className="text-xl font-bold text-amber-950">
              {stats.visita}
            </span>
          </div>

          <div className="bg-indigo-50/60 p-3 rounded-md border border-indigo-200">
            <span className="text-[11px] font-semibold text-indigo-700 block uppercase">
              En Negociación
            </span>
            <span className="text-xl font-bold text-indigo-950">
              {stats.negociacion}
            </span>
          </div>

          <div className="bg-emerald-50/60 p-3 rounded-md border border-emerald-200">
            <span className="text-[11px] font-semibold text-emerald-800 block uppercase">
              Cierres Ganados
            </span>
            <span className="text-xl font-bold text-emerald-950">
              {stats.ganado}
            </span>
          </div>

          <div className="bg-rose-50/60 p-3 rounded-md border border-rose-200 col-span-2 sm:col-span-1">
            <span className="text-[11px] font-semibold text-rose-800 block uppercase">
              Descartados
            </span>
            <span className="text-xl font-bold text-rose-950">
              {stats.descartado}
            </span>
          </div>
        </div>

        {/* Barra de Filtros por Proyecto y Búsqueda */}
        <div className="flex flex-col sm:flex-row items-center justify-between gap-3 pt-1">
          <div className="relative w-full sm:w-80">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input id="crm-search" name="crm_search"
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Buscar prospecto, teléfono o email..."
              className="w-full pl-9 pr-3 py-2 text-xs rounded-md border border-slate-300 bg-white focus:outline-none focus:ring-1 focus:ring-slate-900 focus:border-slate-900 transition"
            />
          </div>

          <div className="flex items-center gap-2 w-full sm:w-auto">
            <Filter className="w-4 h-4 text-slate-400 shrink-0" />
            <select id="crm-filter-project" name="crm_filter_project"
              value={selectedProjectId}
              onChange={(e) => setSelectedProjectId(e.target.value)}
              className="px-3 py-2 text-xs font-semibold rounded-md border border-slate-300 bg-white text-slate-800 focus:outline-none focus:ring-1 focus:ring-slate-900 focus:border-slate-900 cursor-pointer w-full sm:w-auto transition"
            >
              <option value="">Todos los Proyectos</option>
              {projects.map((proj) => (
                <option key={proj.id} value={proj.id}>
                  {proj.name}
                </option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {/* ========================================================================= */}
      {/* 3. VISTA 1: TABLERO KANBAN DE 4 ETAPAS ACTIVAS */}
      {/* ========================================================================= */}
      {viewMode === 'kanban' && (
        <>
          {loading ? (
            <div className="py-24 flex flex-col items-center justify-center gap-2 text-slate-400 bg-white rounded-lg border border-slate-200">
              <Loader2 className="w-7 h-7 animate-spin text-slate-600" />
              <span className="text-xs font-medium text-slate-500">Cargando tablero comercial...</span>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4">
              {STAGES.map((stage) => {
                const stageLeads = activeLeads.filter((l) => l.stage === stage.key);

                return (
                  <div
                    key={stage.key}
                    onDragOver={handleDragOver}
                    onDrop={(e) => handleDrop(e, stage.key)}
                    className={`bg-slate-100/70 rounded-lg p-3 border border-slate-200 border-t-4 ${stage.borderClass} flex flex-col min-h-[580px]`}
                  >
                    {/* Cabecera de Columna */}
                    <div className="flex items-center justify-between mb-3 px-1 pt-1">
                      <div className="flex items-center gap-2">
                        <h3 className="text-xs font-bold uppercase tracking-wider text-slate-800">
                          {stage.label}
                        </h3>
                        <span className={`px-2 py-0.5 rounded-md text-[11px] font-semibold ${stage.counterClass}`}>
                          {stageLeads.length}
                        </span>
                      </div>
                    </div>

                    {/* Lista de Tarjetas de Prospectos */}
                    <div className="flex-1 space-y-3 overflow-y-auto pr-0.5">
                      {stageLeads.length === 0 ? (
                        <div className="h-36 rounded-md border border-dashed border-slate-300 flex flex-col items-center justify-center text-slate-400 text-xs p-4 text-center">
                          <span>Arrastra o registra prospectos aquí</span>
                        </div>
                      ) : (
                        stageLeads.map((lead) => {
                          const isConverting = convertingLeadId === lead.id;

                          return (
                            <div
                              key={lead.id}
                              draggable
                              onDragStart={(e) => handleDragStart(e, lead.id)}
                              className="bg-white rounded-lg p-3.5 border border-slate-200 shadow-xs hover:border-slate-300 transition-all space-y-2.5 cursor-grab active:cursor-grabbing"
                            >
                              {/* Cabecera de Tarjeta */}
                              <div className="flex items-start justify-between gap-2">
                                <div className="flex items-center gap-2 min-w-0">
                                  <div className="w-7 h-7 rounded-md bg-slate-100 text-slate-700 font-bold text-xs flex items-center justify-center shrink-0">
                                    {lead.name.charAt(0)}
                                  </div>
                                  <h4 className="text-xs font-bold text-slate-900 leading-tight truncate">
                                    {lead.name}
                                  </h4>
                                </div>

                                <div className="flex items-center gap-1 shrink-0">
                                  {isSuperAdmin && (
                                    <button
                                      type="button"
                                      onClick={() => handleOpenEditModal(lead)}
                                      className="p-1 rounded text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition cursor-pointer"
                                      title="Editar o reasignar asesor"
                                    >
                                      <Edit3 className="w-3 h-3" />
                                    </button>
                                  )}
                                  {lead.created_at && (
                                    <span className="text-[10px] font-medium text-slate-400">
                                      {new Date(lead.created_at).toLocaleDateString('es-EC', { day: '2-digit', month: 'short' })}
                                    </span>
                                  )}
                                </div>
                              </div>

                              {/* Badge de Identificación de Asesor Responsable */}
                              <div className="flex items-center justify-between gap-1 text-[10px] text-slate-600 bg-slate-50 px-2 py-1 rounded border border-slate-100">
                                <div className="flex items-center gap-1 truncate">
                                  <UserCheck className="w-3 h-3 text-indigo-600 shrink-0" />
                                  <span className="font-semibold text-slate-700 truncate">
                                    Asesor: {lead.advisor?.name || 'General'}
                                  </span>
                                  <InactiveUserBadge user={lead.advisor} />
                                </div>
                              </div>

                              {/* Proyecto de Interés */}
                              {lead.project && (
                                <div className="flex items-center gap-1.5 text-[11px] font-medium text-slate-700 bg-slate-50 px-2.5 py-1 rounded-md border border-slate-200">
                                  <Building2 className="w-3.5 h-3.5 text-slate-500 shrink-0" />
                                  <span className="truncate">{lead.project.name}</span>
                                </div>
                              )}

                              {/* Contacto */}
                              <div className="space-y-1 text-[11px] text-slate-500">
                                {lead.phone && (
                                  <div className="flex items-center gap-1.5">
                                    <Phone className="w-3 h-3 text-slate-400 shrink-0" />
                                    <a href={`tel:${lead.phone}`} className="hover:text-slate-900 hover:underline">
                                      {lead.phone}
                                    </a>
                                  </div>
                                )}
                                {lead.email && (
                                  <div className="flex items-center gap-1.5">
                                    <Mail className="w-3 h-3 text-slate-400 shrink-0" />
                                    <a href={`mailto:${lead.email}`} className="truncate hover:text-slate-900 hover:underline">
                                      {lead.email}
                                    </a>
                                  </div>
                                )}
                              </div>

                              {/* Notas */}
                              {lead.notes && (
                                <p className="text-[11px] text-slate-600 bg-slate-50 p-2 rounded-md border border-slate-100 line-clamp-2">
                                  {lead.notes}
                                </p>
                              )}

                              {/* Botón Destacado: Convertir en Cliente si está en Cierre Ganado */}
                              {stage.key === 'Cierre Ganado' && (
                                <div className="pt-1">
                                  <ActionButton loading={handleConvertLeadPending}
                                    type="button"
                                    disabled={isConverting}
                                    onClick={() => handleConvertLead(lead)}
                                    className="w-full py-2 px-2.5 rounded-md text-xs font-semibold text-white bg-slate-900 hover:bg-slate-800 shadow-xs transition flex items-center justify-center gap-1.5 cursor-pointer disabled:opacity-50"
                                  >
                                    {isConverting ? (
                                      <>
                                        <Loader2 className="w-3.5 h-3.5 animate-spin" />
                                        <span>Creando cliente...</span>
                                      </>
                                    ) : (
                                      <>
                                        <UserCheck className="w-3.5 h-3.5 text-teal-300" />
                                        <span>Convertir en Cliente</span>
                                        <ArrowRight className="w-3 h-3 text-teal-300" />
                                      </>
                                    )}
                                  </ActionButton>
                                </div>
                              )}

                              {/* Controles de Avance de Etapa y Descarte */}
                              <div className="flex items-center justify-between pt-1 border-t border-slate-100 text-[10px]">
                                <button
                                  type="button"
                                  onClick={() => handleMoveStep(lead, -1)}
                                  disabled={handleUpdateStagePending || stage.key === STAGES[0].key}
                                  className="px-2 py-1 rounded-md hover:bg-slate-100 text-slate-600 disabled:opacity-30 disabled:hover:bg-transparent flex items-center gap-0.5 cursor-pointer"
                                  title="Mover a etapa anterior"
                                >
                                  <ArrowLeft className="w-3 h-3" />
                                  <span>Atrás</span>
                                </button>

                                <div className="flex items-center gap-1">
                                  <select id={`crm-row-stage-${lead.id}`} name={`crm_row_stage_${lead.id}`}
                                    value={lead.stage}
                                    onChange={(e) => handleUpdateStage(lead.id, e.target.value)}
                                    disabled={handleUpdateStagePending}
                                    className="text-[10px] py-0.5 px-1.5 rounded-md border border-slate-300 bg-white text-slate-700 cursor-pointer focus:outline-none"
                                  >
                                    {STAGES.map((s) => (
                                      <option key={s.key} value={s.key}>
                                        {s.label}
                                      </option>
                                    ))}
                                    <option value="Descartado">Descartar...</option>
                                  </select>

                                  <button
                                    type="button"
                                    onClick={() => handleOpenDiscardModal(lead)}
                                    className="p-1 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded transition cursor-pointer"
                                    title="Descartar prospecto (con motivo documentado)"
                                  >
                                    <UserX className="w-3 h-3" />
                                  </button>
                                </div>

                                <button
                                  type="button"
                                  onClick={() => handleMoveStep(lead, 1)}
                                  disabled={handleUpdateStagePending || stage.key === STAGES[STAGES.length - 1].key}
                                  className="px-2 py-1 rounded hover:bg-slate-100 text-slate-500 disabled:opacity-30 disabled:hover:bg-transparent flex items-center gap-0.5 cursor-pointer"
                                  title="Mover a etapa siguiente"
                                >
                                  <span>Avanzar</span>
                                  <ArrowRight className="w-3 h-3" />
                                </button>
                              </div>
                            </div>
                          );
                        })
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </>
      )}

      {/* ========================================================================= */}
      {/* 4. VISTA 2: ARCHIVO DE DESCARTADOS (Para auditoría del Super Admin y Asesor) */}
      {/* ========================================================================= */}
      {viewMode === 'discarded' && (
        <div className="bg-white rounded-lg border border-slate-200 shadow-xs overflow-hidden">
          <div className="p-4 border-b border-slate-100 flex items-center justify-between gap-3 bg-slate-50/70">
            <div className="flex items-center gap-2">
              <Archive className="w-4 h-4 text-rose-600" />
              <h3 className="text-sm font-bold text-slate-900">
                Archivo de Prospectos Descartados ({pagination.total ?? 0})
              </h3>
            </div>
            <p className="text-xs text-slate-500">
              Historial de prospectos no concretados para auditoría comercial y análisis de objeciones.
            </p>
          </div>

          {discardedLeads.length === 0 ? (
            <div className="py-16 text-center text-slate-400 space-y-2">
              <CheckCircle2 className="w-10 h-10 text-slate-300 mx-auto" />
              <p className="text-sm font-medium text-slate-600">No hay prospectos descartados en este filtro</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="bg-slate-50 text-slate-600 font-bold border-b border-slate-200">
                    <th className="py-3 px-4">Prospecto</th>
                    <th className="py-3 px-4">Proyecto</th>
                    <th className="py-3 px-4">Asesor Responsable</th>
                    <th className="py-3 px-4">Motivo de Descarte</th>
                    <th className="py-3 px-4">Fecha Descarte</th>
                    <th className="py-3 px-4 text-center">Acciones</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {discardedLeads.map((lead) => (
                    <tr key={lead.id} className="hover:bg-slate-50/60 transition">
                      <td className="py-3 px-4 font-semibold text-slate-900">
                        <div>{lead.name}</div>
                        <div className="text-[11px] text-slate-400 font-normal">
                          {lead.phone} {lead.email ? `• ${lead.email}` : ''}
                        </div>
                      </td>
                      <td className="py-3 px-4 text-slate-700 font-medium">
                        {lead.project?.name || 'General'}
                      </td>
                      <td className="py-3 px-4 text-slate-700">
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-slate-100 text-slate-800 font-medium text-[11px]">
                          <UserCheck className="w-3 h-3 text-indigo-600" />
                          {lead.advisor?.name || 'General'}
                          <InactiveUserBadge user={lead.advisor} />
                        </span>
                      </td>
                      <td className="py-3 px-4">
                        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-[11px] font-semibold bg-rose-50 text-rose-800 border border-rose-200">
                          {lead.discard_reason || 'Sin motivo especificado'}
                        </span>
                      </td>
                      <td className="py-3 px-4 text-slate-400">
                        {lead.updated_at ? new Date(lead.updated_at).toLocaleDateString('es-EC', { day: '2-digit', month: 'short', year: 'numeric' }) : 'N/A'}
                      </td>
                      <td className="py-3 px-4 text-center">
                        <ActionButton loading={handleReactivateLeadPending}
                          type="button"
                          onClick={() => handleReactivateLead(lead)}
                          className="inline-flex items-center gap-1 px-3 py-1.5 rounded-md text-xs font-bold text-indigo-700 bg-indigo-50 hover:bg-indigo-100 border border-indigo-200 transition cursor-pointer"
                          title="Reactivar en el pipeline activo"
                        >
                          <RotateCcw className="w-3 h-3 text-indigo-600" />
                          <span>Reactivar</span>
                        </ActionButton>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      <Pagination pagination={pagination} perPage={perPage} onPageChange={fetchLeads} onPerPageChange={setPerPage} loading={loading} />

      {/* ========================================================================= */}
      {/* 5. MODAL: REGISTRAR NUEVO PROSPECTO */}
      {/* ========================================================================= */}
      {isAddLeadModalOpen && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-xs flex items-center justify-center z-50 p-4 animate-fade-in">
          <div className="bg-white rounded-lg w-full max-w-md p-6 shadow-xl border border-slate-200 transition-all">
            <div className="flex items-center justify-between border-b border-slate-100 pb-4 mb-5">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-lg bg-violet-50 flex items-center justify-center text-violet-600">
                  <UserPlus className="w-4 h-4" />
                </div>
                <h3 className="text-base font-bold text-slate-900">
                  Registrar Nuevo Prospecto
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setIsAddLeadModalOpen(false)}
                className="p-1 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleCreateLead} className="space-y-4">
              <div>
                <label htmlFor="crm-new-name" className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1.5">
                  Nombre Completo del Prospecto *
                </label>
                <input id="crm-new-name" name="crm_new_name"
                  type="text"
                  required
                  placeholder="Ej: Ing. Pedro Alarcón"
                  value={newLeadForm.name}
                  onChange={(e) => setNewLeadForm({ ...newLeadForm, name: e.target.value })}
                  className="w-full px-3.5 py-2.5 rounded-md border border-slate-300 bg-white text-sm text-slate-900 focus:outline-none focus:ring-1 focus:ring-slate-900 focus:border-slate-900 transition"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label htmlFor="crm-new-phone" className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1.5">
                    Teléfono / WhatsApp *
                  </label>
                  <input id="crm-new-phone" name="crm_new_phone"
                    type="text"
                    required
                    placeholder="0991234567"
                    value={newLeadForm.phone}
                    onChange={(e) => setNewLeadForm({ ...newLeadForm, phone: e.target.value })}
                    className="w-full px-3.5 py-2.5 rounded-md border border-slate-300 bg-white text-sm text-slate-900 focus:outline-none focus:ring-1 focus:ring-slate-900 focus:border-slate-900 transition"
                  />
                </div>

                <div>
                  <label htmlFor="crm-new-email" className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1.5">
                    Correo Electrónico (Opcional)
                  </label>
                  <input id="crm-new-email" name="crm_new_email"
                    type="email"
                    placeholder="correo@ejemplo.com"
                    value={newLeadForm.email}
                    onChange={(e) => setNewLeadForm({ ...newLeadForm, email: e.target.value })}
                    className="w-full px-3.5 py-2.5 rounded-md border border-slate-300 bg-white text-sm text-slate-900 focus:outline-none focus:ring-1 focus:ring-slate-900 focus:border-slate-900 transition"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label htmlFor="crm-new-project" className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1.5">
                    Proyecto de Interés
                  </label>
                  <select id="crm-new-project" name="crm_new_project"
                    value={newLeadForm.project_id}
                    onChange={(e) => setNewLeadForm({ ...newLeadForm, project_id: e.target.value })}
                    className="w-full px-3.5 py-2.5 rounded-md border border-slate-300 bg-white text-xs font-semibold text-slate-900 focus:outline-none focus:ring-1 focus:ring-slate-900 focus:border-slate-900 transition cursor-pointer"
                  >
                    {projects.map((proj) => (
                      <option key={proj.id} value={proj.id}>
                        {proj.name}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label htmlFor="crm-new-stage" className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1.5">
                    Etapa Inicial
                  </label>
                  <select id="crm-new-stage" name="crm_new_stage"
                    value={newLeadForm.stage}
                    onChange={(e) => setNewLeadForm({ ...newLeadForm, stage: e.target.value })}
                    className="w-full px-3.5 py-2.5 rounded-md border border-slate-300 bg-white text-xs font-semibold text-slate-900 focus:outline-none focus:ring-1 focus:ring-slate-900 focus:border-slate-900 transition cursor-pointer"
                  >
                    {STAGES.map((s) => (
                      <option key={s.key} value={s.key}>
                        {s.label}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Asignación de Asesor: Visible si es Super Admin */}
              {isSuperAdmin && filteredAdvisorsList.length > 0 && (
                <div>
                  <label htmlFor="crm-new-advisor" className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1.5">
                    Asesor Comercial Responsable
                  </label>
                  <select id="crm-new-advisor" name="crm_new_advisor"
                    value={newLeadForm.user_id}
                    onChange={(e) => setNewLeadForm({ ...newLeadForm, user_id: e.target.value })}
                    className="w-full px-3.5 py-2.5 rounded-md border border-slate-300 bg-white text-xs font-semibold text-slate-900 focus:outline-none focus:ring-1 focus:ring-slate-900 focus:border-slate-900 transition cursor-pointer"
                  >
                    <option value="">Asignar a mí mismo por defecto</option>
                    {filteredAdvisorsList.map((adv) => (
                      <option key={adv.id} value={adv.id}>
                        {adv.name} ({adv.role})
                      </option>
                    ))}
                  </select>
                </div>
              )}

              <div>
                <label htmlFor="crm-new-notes" className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1.5">
                  Notas / Detalles de la Visita
                </label>
                <textarea id="crm-new-notes" name="crm_new_notes"
                  rows={3}
                  placeholder="Detalles sobre preferencias de lote, observaciones, presupuesto aproximado..."
                  value={newLeadForm.notes}
                  onChange={(e) => setNewLeadForm({ ...newLeadForm, notes: e.target.value })}
                  className="w-full px-3.5 py-2 rounded-md border border-slate-300 bg-white text-xs sm:text-sm text-slate-900 focus:outline-none focus:ring-1 focus:ring-slate-900 focus:border-slate-900 transition"
                />
              </div>

              <div className="flex items-center justify-end gap-2.5 pt-4 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setIsAddLeadModalOpen(false)}
                  className="px-4 py-2 text-xs font-medium text-slate-700 bg-white hover:bg-slate-50 border border-slate-300 rounded-md transition cursor-pointer"
                >
                  Cancelar
                </button>
                <ActionButton loading={handleCreateLeadPending}
                  type="submit"
                  disabled={isSubmittingLead}
                  className="inline-flex items-center gap-2 px-5 py-2 text-xs font-semibold text-white bg-slate-900 hover:bg-slate-800 rounded-md shadow-xs transition cursor-pointer disabled:opacity-50"
                >
                  {isSubmittingLead && <Loader2 className="w-3.5 h-3.5 animate-spin text-slate-300" />}
                  <span>{isSubmittingLead ? 'Guardando...' : 'Crear Prospecto'}</span>
                </ActionButton>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* 6. MODAL: DESCARTAR PROSPECTO CON MOTIVO DOCUMENTADO */}
      {/* ========================================================================= */}
      {isDiscardModalOpen && leadToDiscard && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-xs flex items-center justify-center z-50 p-4 animate-fade-in">
          <div className="bg-white rounded-lg w-full max-w-md p-6 shadow-xl border border-slate-200 transition-all">
            <div className="flex items-center justify-between border-b border-slate-100 pb-4 mb-4">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-lg bg-rose-50 flex items-center justify-center text-rose-600">
                  <UserX className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-slate-900">
                    Descartar Prospecto
                  </h3>
                  <p className="text-xs text-slate-500">
                    {leadToDiscard.name} ({leadToDiscard.project?.name || 'General'})
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setIsDiscardModalOpen(false)}
                className="p-1 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleConfirmDiscard} className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                  Motivo de Descarte *
                </label>
                <div className="space-y-1.5 mb-2.5">
                  <span className="text-[11px] text-slate-500 font-medium block">
                    Sugerencias frecuentes (haz clic para seleccionar):
                  </span>
                  <div className="flex flex-wrap gap-1.5">
                    {DISCARD_SUGGESTIONS.map((sug, i) => (
                      <button
                        key={i}
                        type="button"
                        onClick={() => setDiscardReason(sug)}
                        className={`text-[10px] px-2.5 py-1 rounded-md border transition cursor-pointer ${
                          discardReason === sug
                            ? 'bg-rose-100 text-rose-800 border-rose-300 font-bold'
                            : 'bg-slate-50 text-slate-600 border-slate-200 hover:bg-slate-100'
                        }`}
                      >
                        {sug}
                      </button>
                    ))}
                  </div>
                </div>

                <textarea id="crm-discard-reason" name="crm_discard_reason"
                  required
                  rows={3}
                  placeholder="Detalla la razón por la que no se concretó la venta..."
                  value={discardReason}
                  onChange={(e) => setDiscardReason(e.target.value)}
                  className="w-full px-3.5 py-2.5 rounded-md border border-slate-300 bg-white text-xs sm:text-sm text-slate-900 focus:outline-none focus:ring-1 focus:ring-rose-500 focus:border-rose-500 transition"
                />
              </div>

              <div className="flex items-center justify-end gap-2.5 pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setIsDiscardModalOpen(false)}
                  className="px-4 py-2 text-xs font-medium text-slate-700 bg-white hover:bg-slate-50 border border-slate-300 rounded-md transition cursor-pointer"
                >
                  Cancelar
                </button>
                <ActionButton loading={handleConfirmDiscardPending}
                  type="submit"
                  disabled={isSubmittingDiscard || !discardReason.trim()}
                  className="inline-flex items-center gap-2 px-5 py-2 text-xs font-bold text-white bg-rose-600 hover:bg-rose-700 rounded-md shadow-xs transition cursor-pointer disabled:opacity-50"
                >
                  {isSubmittingDiscard && <Loader2 className="w-3.5 h-3.5 animate-spin text-white" />}
                  <span>{isSubmittingDiscard ? 'Descartando...' : 'Confirmar Descarte'}</span>
                </ActionButton>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* 7. MODAL: EDITAR / REASIGNAR PROSPECTO (Super Admin) */}
      {/* ========================================================================= */}
      {isEditModalOpen && editingLead && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-xs flex items-center justify-center z-50 p-4 animate-fade-in">
          <div className="bg-white rounded-lg w-full max-w-md p-6 shadow-xl border border-slate-200 transition-all">
            <div className="flex items-center justify-between border-b border-slate-100 pb-4 mb-5">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-lg bg-indigo-50 flex items-center justify-center text-indigo-600">
                  <Edit3 className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-slate-900">
                    Editar y Reasignar Prospecto
                  </h3>
                  <p className="text-xs text-slate-500">
                    Modificación de datos y transferencia de propietario comercial.
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setIsEditModalOpen(false)}
                className="p-1 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSaveEdit} className="space-y-4">
              <div>
                <label htmlFor="crm-edit-name" className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1.5">
                  Nombre del Prospecto *
                </label>
                <input id="crm-edit-name" name="crm_edit_name"
                  type="text"
                  required
                  value={editingLead.name}
                  onChange={(e) => setEditingLead({ ...editingLead, name: e.target.value })}
                  className="w-full px-3.5 py-2.5 rounded-md border border-slate-300 bg-white text-sm text-slate-900 focus:outline-none focus:ring-1 focus:ring-slate-900 focus:border-slate-900 transition"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label htmlFor="crm-edit-phone" className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1.5">
                    Teléfono
                  </label>
                  <input id="crm-edit-phone" name="crm_edit_phone"
                    type="text"
                    value={editingLead.phone}
                    onChange={(e) => setEditingLead({ ...editingLead, phone: e.target.value })}
                    className="w-full px-3.5 py-2.5 rounded-md border border-slate-300 bg-white text-sm text-slate-900 focus:outline-none focus:ring-1 focus:ring-slate-900 focus:border-slate-900 transition"
                  />
                </div>

                <div>
                  <label htmlFor="crm-edit-email" className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1.5">
                    Correo
                  </label>
                  <input id="crm-edit-email" name="crm_edit_email"
                    type="email"
                    value={editingLead.email}
                    onChange={(e) => setEditingLead({ ...editingLead, email: e.target.value })}
                    className="w-full px-3.5 py-2.5 rounded-md border border-slate-300 bg-white text-sm text-slate-900 focus:outline-none focus:ring-1 focus:ring-slate-900 focus:border-slate-900 transition"
                  />
                </div>
              </div>

              {/* Reasignar Asesor Responsable (Exclusivo Super Admin) */}
              {isSuperAdmin && (
                <div className="bg-indigo-50/70 p-3.5 rounded-lg border border-indigo-200 space-y-1.5">
                  <label htmlFor="crm-edit-advisor" className="block text-xs font-bold text-indigo-900 uppercase tracking-wider">
                    Reasignar Asesor Responsable
                  </label>
                  <select id="crm-edit-advisor" name="crm_edit_advisor"
                    value={editingLead.user_id}
                    onChange={(e) => setEditingLead({ ...editingLead, user_id: e.target.value })}
                    className="w-full px-3 py-2 rounded-md border border-indigo-300 bg-white text-xs font-bold text-indigo-950 focus:outline-none focus:ring-2 focus:ring-indigo-500 cursor-pointer"
                  >
                    {filteredAdvisorsList.map((adv) => (
                      <option key={adv.id} value={adv.id}>
                        {adv.name} ({adv.role})
                      </option>
                    ))}
                  </select>
                  <p className="text-[11px] text-indigo-700">
                    Al reasignar, el nuevo asesor verá este prospecto de inmediato en su pipeline personal.
                  </p>
                </div>
              )}

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label htmlFor="crm-edit-project" className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1.5">
                    Proyecto
                  </label>
                  <select id="crm-edit-project" name="crm_edit_project"
                    value={editingLead.project_id}
                    onChange={(e) => setEditingLead({ ...editingLead, project_id: e.target.value })}
                    className="w-full px-3.5 py-2.5 rounded-md border border-slate-300 bg-white text-xs font-semibold text-slate-900 focus:outline-none focus:ring-1 focus:ring-slate-900 focus:border-slate-900 transition cursor-pointer"
                  >
                    <option value="">Sin Proyecto</option>
                    {projects.map((proj) => (
                      <option key={proj.id} value={proj.id}>
                        {proj.name}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label htmlFor="crm-edit-stage" className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1.5">
                    Etapa Actual
                  </label>
                  <select id="crm-edit-stage" name="crm_edit_stage"
                    value={editingLead.stage}
                    onChange={(e) => setEditingLead({ ...editingLead, stage: e.target.value })}
                    className="w-full px-3.5 py-2.5 rounded-md border border-slate-300 bg-white text-xs font-semibold text-slate-900 focus:outline-none focus:ring-1 focus:ring-slate-900 focus:border-slate-900 transition cursor-pointer"
                  >
                    {STAGES.map((s) => (
                      <option key={s.key} value={s.key}>
                        {s.label}
                      </option>
                    ))}
                    <option value="Descartado">Descartado</option>
                  </select>
                </div>
              </div>

              <div>
                <label htmlFor="crm-edit-notes" className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1.5">
                  Notas
                </label>
                <textarea id="crm-edit-notes" name="crm_edit_notes"
                  rows={2}
                  value={editingLead.notes}
                  onChange={(e) => setEditingLead({ ...editingLead, notes: e.target.value })}
                  className="w-full px-3.5 py-2 rounded-md border border-slate-300 bg-white text-xs sm:text-sm text-slate-900 focus:outline-none focus:ring-1 focus:ring-slate-900 focus:border-slate-900 transition"
                />
              </div>

              <div className="flex items-center justify-end gap-2.5 pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setIsEditModalOpen(false)}
                  className="px-4 py-2 text-xs font-medium text-slate-700 bg-white hover:bg-slate-50 border border-slate-300 rounded-md transition cursor-pointer"
                >
                  Cancelar
                </button>
                <ActionButton loading={handleSaveEditPending}
                  type="submit"
                  disabled={isSubmittingEdit}
                  className="inline-flex items-center gap-2 px-5 py-2 text-xs font-bold text-white bg-slate-900 hover:bg-slate-800 rounded-md shadow-xs transition cursor-pointer disabled:opacity-50"
                >
                  {isSubmittingEdit && <Loader2 className="w-3.5 h-3.5 animate-spin text-white" />}
                  <span>{isSubmittingEdit ? 'Guardando...' : 'Guardar Cambios'}</span>
                </ActionButton>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
