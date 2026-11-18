import useSingleSubmit from '../hooks/useSingleSubmit';
import ActionButton from '../components/ActionButton';
import React, { useState, useEffect, useMemo, useRef } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import axios from 'axios';
import { useAuth } from '../context/AuthContext';
import { getAuthenticatedRole } from '../utils/roleRoutes';
import { isUserInactive } from '../components/InactiveUserBadge';
import {
  CheckSquare,
  Plus,
  Search,
  Filter,
  Calendar,
  User,
  Building2,
  Clock,
  AlertTriangle,
  CheckCircle2,
  Trash2,
  Loader2,
  X,
  Sparkles,
  ChevronRight,
  ChevronLeft,
  ShieldCheck,
  Flame,
  Zap,
  Pin,
  Archive,
  RotateCcw,
  Inbox,
  CalendarClock,
  MessageCircle,
  Mail,
  Send,
} from 'lucide-react';
import {
  DEFAULT_CEO_PHONE,
  openWhatsApp,
  buildTaskCompletedWhatsAppMessage,
} from '../utils/whatsapp';

const PRIORITIES = [
  { value: 'Alta', label: 'Alta Prioridad', badge: 'bg-rose-100 text-rose-800 border-rose-200' },
  { value: 'Media', label: 'Media Prioridad', badge: 'bg-amber-100 text-amber-800 border-amber-200' },
  { value: 'Baja', label: 'Baja Prioridad', badge: 'bg-slate-100 text-slate-700 border-slate-200' },
];

const ITEMS_PER_PAGE = 10;

const getAssignee = (task) => task.assignee ||
  (typeof task.assigned_to === 'object' ? task.assigned_to : null) || task.assignedTo;

const getAssigneeRole = (user) => user?.roles?.find((role) =>
  ['Administrador', 'Asesor Comercial'].includes(role.name)
)?.name || user?.role || 'Responsable';

const isAssignableUser = (user) => !isUserInactive(user) &&
  !user.roles?.some((role) => role.name === 'Super Admin') &&
  user.roles?.some((role) => ['Administrador', 'Asesor Comercial'].includes(role.name));

// Formateador de fecha y hora exacta de envío o finalización (ej: martes, 27 oct 2026 a las 15:40)
export const formatSentDateTime = (dateStr) => {
  if (!dateStr) return 'Fecha no registrada';
  const d = new Date(dateStr);
  if (isNaN(d.getTime())) return dateStr;
  const dateFormatted = d.toLocaleDateString('es-EC', {
    weekday: 'long',
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  });
  const timeFormatted = d.toLocaleTimeString('es-EC', {
    hour: '2-digit',
    minute: '2-digit',
  });
  return `${dateFormatted} a las ${timeFormatted}`;
};

// Formateador limpio de fecha límite (elimina T00:00:00.000000Z y produce ej: 30 oct 2026)
export const formatDueDate = (dateStr) => {
  if (!dateStr) return null;
  const cleanDate = dateStr.includes('T') ? dateStr.split('T')[0] : dateStr;
  const d = new Date(cleanDate + 'T12:00:00');
  if (isNaN(d.getTime())) return dateStr;
  return d.toLocaleDateString('es-EC', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  });
};

export default function TareasAdmin({ openNewModal = false }) {
  const navigate = useNavigate();
  const location = useLocation();

  const [tasks, setTasks] = useState([]);
  const [loading, setLoading] = useState(true);

  // Pestañas Principales: 'activas' (Bandeja Activa) | 'completadas' (Archivo)
  const [activeTab, setActiveTab] = useState('activas');

  // Paginación para pestaña Completadas
  const [completedPage, setCompletedPage] = useState(1);

  const { user: currentUser } = useAuth();
  const userRole = getAuthenticatedRole(currentUser);
  const isSuperAdmin = userRole === 'Super Admin' || userRole === 'CEO / Gerente';
  const canDeleteTasks = isSuperAdmin || userRole === 'Administrador';
  const listRequest = useRef(0);

  // Filtros
  const [searchTerm, setSearchTerm] = useState('');
  const [priorityFilter, setPriorityFilter] = useState('all');
  const [adminFilter, setAdminFilter] = useState('all');
  const [roleFilter, setRoleFilter] = useState('all');
  const [projectFilter, setProjectFilter] = useState('all');

  // Catálogos
  const [adminsList, setAdminsList] = useState([]);
  const [projectsList, setProjectsList] = useState([]);

  // Modales y estados de envío
  const [createModalOpen, setCreateModalOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [toastMessage, setToastMessage] = useState(null);
  const [taskCompletedModal, setTaskCompletedModal] = useState(null);
  const [sendingEmailId, setSendingEmailId] = useState(null);

  const [handleNotifyEmail, handleNotifyEmailPending] = useSingleSubmit(async (taskId) => {
    setSendingEmailId(taskId);
    try {
      const res = await axios.post(`/api/admin-tasks/${taskId}/notify-email`);
      showToast(res.data?.message || 'Notificación enviada por correo al CEO.');
    } catch (err) {
      if (err?.isDuplicateBlocked) return;
      console.error('Error enviando notificación por correo:', err);
      alert(err.response?.data?.message || 'No se pudo enviar el correo.');
    } finally {
      setSendingEmailId(null);
    }
  });

  // Formulario nueva tarea
  const [newTask, setNewTask] = useState({
    title: '',
    description: '',
    project_id: '',
    assigned_to: '',
    priority: 'Alta',
    due_date: '',
    status: 'Pendiente',
  });

  // Detección y soporte de la ruta directa /tareas/asignarnuevatarea
  useEffect(() => {
    const isDirectModalRoute = openNewModal || location.pathname.includes('/asignarnuevatarea');
    if (isSuperAdmin && isDirectModalRoute) {
      setCreateModalOpen(true);
    } else if (createModalOpen && !location.pathname.includes('/asignarnuevatarea')) {
      setCreateModalOpen(false);
    }
  }, [location.pathname, openNewModal, isSuperAdmin]);

  const handleOpenCreateModal = () => {
    if (!isSuperAdmin) return;
    if (location.pathname !== '/tareas/asignarnuevatarea') {
      navigate('/tareas/asignarnuevatarea');
    }
    setCreateModalOpen(true);
  };

  const handleCloseCreateModal = () => {
    setCreateModalOpen(false);
    if (location.pathname.includes('/asignarnuevatarea')) {
      navigate('/tareas');
    }
  };

  const fetchTasks = async () => {
    const requestId = ++listRequest.current;
    setLoading(true);
    try {
      const params = {};
      if (isSuperAdmin && adminFilter !== 'all') params.assigned_to = adminFilter;
      if (projectFilter !== 'all') params.project_id = projectFilter;
      if (isSuperAdmin && roleFilter !== 'all') params.role = roleFilter;
      if (priorityFilter !== 'all') params.priority = priorityFilter;

      const res = await axios.get('/api/admin-tasks', { params });
      if (requestId !== listRequest.current) return;
      setTasks(res.data?.data || []);
    } catch (err) {
      if (requestId !== listRequest.current) return;
      setTasks([]);
      console.error('Error al cargar tareas:', err);
    } finally {
      if (requestId === listRequest.current) setLoading(false);
    }
  };

  const fetchCatalogs = async () => {
    try {
      const [usersRes, projRes] = await Promise.all([
        isSuperAdmin ? axios.get('/api/users/options') : Promise.resolve({ data: { data: [] } }),
        axios.get('/api/projects'),
      ]);
      const allUsers = usersRes.data?.data || [];
      const admins = allUsers.filter(isAssignableUser);
      setAdminsList(admins);
      setProjectsList(Array.isArray(projRes.data) ? projRes.data : (projRes.data?.data || []));

      // Si no hay admin preseleccionado en newTask, preseleccionar el primero
      if (admins.length > 0 && !newTask.assigned_to) {
        const firstAdmin = admins[0];
        const initialProjects = firstAdmin.assigned_projects || firstAdmin.assignedProjects || [];
        setNewTask((prev) => ({
          ...prev,
          assigned_to: String(firstAdmin.id),
          project_id: initialProjects[0]?.id ? String(initialProjects[0].id) : '',
        }));
      }
    } catch (err) {
      console.error('Error al cargar catálogos de tareas:', err);
    }
  };

  useEffect(() => {
    fetchCatalogs();
  }, [isSuperAdmin, currentUser?.id]);

  useEffect(() => {
    fetchTasks();
    return () => { listRequest.current++; };
  }, [adminFilter, projectFilter, roleFilter, priorityFilter, userRole, currentUser?.id]);

  const showToast = (msg) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 4000);
  };

  // Crear tarea (CEO)
  const [handleCreateTask, handleCreateTaskPending] = useSingleSubmit(async (e) => {
    if (!isSuperAdmin) return;
    if (!newTask.title.trim() || !newTask.assigned_to) {
      alert('Por favor ingresa un título y selecciona un Administrador o Asesor Comercial activo.');
      return;
    }

    setSubmitting(true);
    try {
      await axios.post('/api/admin-tasks', newTask);
      showToast('Tarea asignada exitosamente.');
      window.dispatchEvent(new Event('notifications-updated'));
      handleCloseCreateModal();
      setNewTask({
        title: '',
        description: '',
        project_id: '',
        assigned_to: adminsList[0]?.id ? String(adminsList[0].id) : '',
        priority: 'Alta',
        due_date: '',
        status: 'Pendiente',
      });
      fetchTasks();
    } catch (err) {
      if (err?.isDuplicateBlocked) return;
      console.error('Error al crear tarea:', err);
      alert(err.response?.data?.message || 'Error al guardar la tarea.');
    } finally {
      setSubmitting(false);
    }
  }, { form: true });

  // Actualizar el estado de una tarea propia.
  const [handleStatusChange, handleStatusChangePending] = useSingleSubmit(async (taskId, newStatus) => {
    // Si es CEO, bloquear intento de completar
    if (isSuperAdmin && newStatus === 'Completada') {
      alert('Solo el responsable asignado puede certificar y marcar esta tarea como Completada.');
      return;
    }

    try {
      const res = await axios.put(`/api/admin-tasks/${taskId}`, { status: newStatus });
      const updatedTask = res.data?.data;

      setTasks((prev) =>
        prev.map((t) => (t.id === taskId ? (updatedTask || { ...t, status: newStatus, completed_at: newStatus === 'Completada' ? new Date().toISOString() : null }) : t))
      );
      window.dispatchEvent(new Event('notifications-updated'));

      if (newStatus === 'Completada') {
        showToast('Tarea completada y archivada exitosamente.');
        const completedTaskData = updatedTask || {
          ...tasks.find((t) => t.id === taskId),
          status: 'Completada',
          completed_at: new Date().toISOString(),
        };
        setTaskCompletedModal(completedTaskData);
      } else {
        showToast(`Tarea actualizada a "${newStatus}".`);
      }
    } catch (err) {
      if (err?.isDuplicateBlocked) return;
      console.error('Error al actualizar estado:', err);
      alert(err.response?.data?.message || 'Error al actualizar la tarea.');
    }
  });

  // Eliminar tarea individual
  const [handleDeleteTask, handleDeleteTaskPending] = useSingleSubmit(async (taskId) => {
    if (!window.confirm('¿Eliminar este registro de tarea? Esta acción no se puede deshacer.')) return;
    try {
      await axios.delete(`/api/admin-tasks/${taskId}`);
      showToast('Tarea eliminada del sistema.');
      window.dispatchEvent(new Event('notifications-updated'));
      setTasks((prev) => prev.filter((t) => t.id !== taskId));
    } catch (err) {
      if (err?.isDuplicateBlocked) return;
      console.error('Error al eliminar tarea:', err);
      alert(err.response?.data?.message || 'No se pudo eliminar la tarea.');
    }
  });

  // Vaciar todas las tareas completadas del archivo
  const [handleClearCompleted, handleClearCompletedPending] = useSingleSubmit(async () => {
    if (
      !window.confirm(
        '¿Estás seguro de que deseas vaciar todas las tareas completadas del archivo? Esta acción liberará espacio de forma definitiva.'
      )
    ) {
      return;
    }

    try {
      const params = {};
      if (isSuperAdmin && adminFilter !== 'all') params.assigned_to = adminFilter;
      if (isSuperAdmin && roleFilter !== 'all') params.role = roleFilter;
      if (projectFilter !== 'all') params.project_id = projectFilter;
      if (priorityFilter !== 'all') params.priority = priorityFilter;
      const res = await axios.delete('/api/admin-tasks/completed/clear', { params });
      showToast(res.data?.message || 'Tareas completadas eliminadas del archivo.');
      window.dispatchEvent(new Event('notifications-updated'));
      setTasks((prev) => prev.filter((t) => t.status !== 'Completada'));
      setCompletedPage(1);
    } catch (err) {
      if (err?.isDuplicateBlocked) return;
      console.error('Error al vaciar tareas completadas:', err);
      alert(err.response?.data?.message || 'No se pudieron vaciar las tareas completadas.');
    }
  });

  // Manejador del cambio de Administrador en el modal para filtrar proyectos en tiempo real
  const handleAdminChangeInModal = (adminId) => {
    const chosenAdmin = adminsList.find((a) => String(a.id) === String(adminId));
    const projectsOfAdmin = chosenAdmin?.assigned_projects || chosenAdmin?.assignedProjects || [];
    const isStillValid = projectsOfAdmin.some((p) => String(p.id) === String(newTask.project_id));

    setNewTask((prev) => ({
      ...prev,
      assigned_to: adminId,
      project_id: isStillValid ? prev.project_id : (projectsOfAdmin[0]?.id ? String(projectsOfAdmin[0].id) : ''),
    }));
  };

  // Proyectos asignados al administrador seleccionado en el modal
  const selectedModalAdminUser = useMemo(() => {
    return adminsList.find((a) => String(a.id) === String(newTask.assigned_to));
  }, [adminsList, newTask.assigned_to]);

  const modalAdminProjects = useMemo(() => {
    if (!selectedModalAdminUser) return [];
    return selectedModalAdminUser.assigned_projects || selectedModalAdminUser.assignedProjects || [];
  }, [selectedModalAdminUser]);

  // ================= FILTRADO Y SEPARACIÓN DE TAREAS =================
  const rawActiveTasks = useMemo(
    () => tasks.filter((t) => t.status === 'Pendiente' || t.status === 'En Curso'),
    [tasks]
  );

  const rawCompletedTasks = useMemo(
    () => tasks.filter((t) => t.status === 'Completada'),
    [tasks]
  );

  // Filtrado de Activas
  const filteredActiveTasks = useMemo(() => {
    return rawActiveTasks.filter((t) => {
      if (priorityFilter !== 'all' && t.priority !== priorityFilter) return false;
      if (searchTerm.trim()) {
        const term = searchTerm.toLowerCase();
        const titleMatch = t.title?.toLowerCase().includes(term);
        const descMatch = t.description?.toLowerCase().includes(term);
        const projMatch = t.project?.name?.toLowerCase().includes(term);
        if (!titleMatch && !descMatch && !projMatch) return false;
      }
      return true;
    });
  }, [rawActiveTasks, priorityFilter, searchTerm]);

  // Agrupamiento por Prioridad de las Activas (Alta -> Media -> Baja)
  const highPriorityActive = useMemo(
    () => filteredActiveTasks.filter((t) => t.priority === 'Alta'),
    [filteredActiveTasks]
  );
  const mediumPriorityActive = useMemo(
    () => filteredActiveTasks.filter((t) => t.priority === 'Media'),
    [filteredActiveTasks]
  );
  const lowPriorityActive = useMemo(
    () => filteredActiveTasks.filter((t) => t.priority === 'Baja' || !['Alta', 'Media'].includes(t.priority)),
    [filteredActiveTasks]
  );

  // Filtrado de Completadas
  const filteredCompletedTasks = useMemo(() => {
    return rawCompletedTasks.filter((t) => {
      if (priorityFilter !== 'all' && t.priority !== priorityFilter) return false;
      if (searchTerm.trim()) {
        const term = searchTerm.toLowerCase();
        const titleMatch = t.title?.toLowerCase().includes(term);
        const descMatch = t.description?.toLowerCase().includes(term);
        const projMatch = t.project?.name?.toLowerCase().includes(term);
        if (!titleMatch && !descMatch && !projMatch) return false;
      }
      return true;
    });
  }, [rawCompletedTasks, priorityFilter, searchTerm]);

  // Paginación de Completadas
  const totalCompletedPages = Math.max(1, Math.ceil(filteredCompletedTasks.length / ITEMS_PER_PAGE));
  const paginatedCompletedTasks = useMemo(() => {
    const start = (completedPage - 1) * ITEMS_PER_PAGE;
    return filteredCompletedTasks.slice(start, start + ITEMS_PER_PAGE);
  }, [filteredCompletedTasks, completedPage]);

  // El resumen de notificaciones mantiene el contador global, sin los filtros de esta vista.
  const getAdminName = (task) => getAssignee(task)?.name || 'Responsable no registrado';
  const getTaskRole = (task) => task.assignee_role || getAssigneeRole(getAssignee(task));

  // Cada empleado gestiona exclusivamente sus propias tareas.
  const isAssignedToCurrentAdmin = (task) => {
    if (isSuperAdmin) return false;
    const taskAdminId = getAssignee(task)?.id || task.assigned_to;
    if (currentUser?.id && taskAdminId) {
      return String(currentUser.id) === String(taskAdminId);
    }
    return false;
  };

  return (
    <div className="space-y-6 font-sans animate-fade-in">
      {/* Toast */}
      {toastMessage && (
        <div className="bg-emerald-50 border border-emerald-200 text-emerald-800 p-3.5 rounded-lg flex items-center justify-between text-xs font-semibold shadow-xs">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
            <span>{toastMessage}</span>
          </div>
          <button type="button" onClick={() => setToastMessage(null)} className="text-emerald-700 hover:text-emerald-900 cursor-pointer">
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Cabecera Principal */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-2 border-b border-slate-200">
        <div>
          <div className="flex items-center gap-2 text-xs font-bold text-slate-500 uppercase tracking-wider mb-1">
            <CheckSquare className="w-4 h-4 text-slate-700" />
            <span>{isSuperAdmin ? 'Panel de Delegación del CEO' : 'Tareas de Gerencia'}</span>
          </div>
          <h1 className="text-2xl font-black text-slate-900 tracking-tight flex items-center gap-2">
            <span>{isSuperAdmin ? 'Tareas del CEO para Administradores y Asesores' : 'Mis Tareas Asignadas por Gerencia'}</span>
          </h1>
          <p className="text-xs text-slate-500 mt-0.5">
            {isSuperAdmin
              ? 'Asigna responsabilidades a Administradores y Asesores Comerciales y consulta su avance.'
              : 'Gestión de diligencias asignadas por Gerencia con control de avance, fechas límite y archivo histórico.'}
          </p>
        </div>

        {isSuperAdmin && (
          <button
            type="button"
            onClick={handleOpenCreateModal}
            className="px-4 py-2 rounded-md bg-slate-900 hover:bg-slate-800 text-white text-xs font-bold flex items-center gap-1.5 shadow-xs cursor-pointer transition"
          >
            <Plus className="w-4 h-4" />
            <span>+ Asignar Nueva Tarea</span>
          </button>
        )}
      </div>

      {/* ================= SEPARACIÓN EN 2 PESTAÑAS PRINCIPALES ================= */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-200">
        <div className="flex items-center gap-2">
          {/* Pestaña 1: Bandeja Activa */}
          <button
            type="button"
            onClick={() => setActiveTab('activas')}
            className={`pb-3 px-3.5 text-xs font-bold transition cursor-pointer flex items-center gap-2 border-b-2 ${
              activeTab === 'activas'
                ? 'border-slate-900 text-slate-900'
                : 'border-transparent text-slate-500 hover:text-slate-800'
            }`}
          >
            <Inbox className="w-4 h-4" />
            <span>Bandeja Activa (Pendientes y En Curso)</span>
            <span
              className={`px-2 py-0.5 rounded-full text-[10px] font-extrabold ${
                activeTab === 'activas'
                  ? 'bg-slate-900 text-white'
                  : 'bg-slate-100 text-slate-600'
              }`}
            >
              {rawActiveTasks.length}
            </span>
          </button>

          {/* Pestaña 2: Completadas (Archivo) */}
          <button
            type="button"
            onClick={() => setActiveTab('completadas')}
            className={`pb-3 px-3.5 text-xs font-bold transition cursor-pointer flex items-center gap-2 border-b-2 ${
              activeTab === 'completadas'
                ? 'border-emerald-600 text-emerald-800'
                : 'border-transparent text-slate-500 hover:text-slate-800'
            }`}
          >
            <Archive className="w-4 h-4 text-emerald-600" />
            <span>Completadas (Archivo)</span>
            <span
              className={`px-2 py-0.5 rounded-full text-[10px] font-extrabold ${
                activeTab === 'completadas'
                  ? 'bg-emerald-600 text-white'
                  : 'bg-emerald-50 text-emerald-700'
              }`}
            >
              {rawCompletedTasks.length}
            </span>
          </button>
        </div>

        {/* Botón Vaciar Completadas en la esquina de la pestaña de completadas */}
        {canDeleteTasks && activeTab === 'completadas' && rawCompletedTasks.length > 0 && (
          <div className="pb-2 sm:pb-0">
            <ActionButton loading={handleClearCompletedPending}
              type="button"
              onClick={handleClearCompleted}
              className="px-3 py-1.5 rounded-md bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200 text-xs font-bold flex items-center gap-1.5 cursor-pointer transition shadow-2xs"
              title="Borrar todas las tareas finalizadas del archivo"
            >
              <Trash2 className="w-3.5 h-3.5 text-rose-600" />
              <span>Vaciar Completadas</span>
            </ActionButton>
          </div>
        )}
      </div>

      {/* Filtros Generales */}
      <div className={`bg-white p-3.5 rounded-lg border border-slate-200 shadow-xs grid grid-cols-1 sm:grid-cols-2 ${isSuperAdmin ? 'lg:grid-cols-5' : 'lg:grid-cols-4'} gap-3 text-xs`}>
        {/* Buscador */}
        <div className="relative">
          <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
          <input id="tareas-search" name="tareas_search"
            type="text"
            value={searchTerm}
            onChange={(e) => {
              setSearchTerm(e.target.value);
              setCompletedPage(1);
            }}
            placeholder="Buscar por título, detalle o proyecto..."
            className="w-full pl-8 pr-3 py-2 rounded-md border border-slate-200 bg-slate-50 focus:bg-white text-slate-900 focus:outline-none focus:ring-1 focus:ring-slate-900 transition"
          />
        </div>

        {/* Prioridad */}
        <div>
          <select id="tareas-filter-priority" name="tareas_filter_priority"
            value={priorityFilter}
            onChange={(e) => {
              setPriorityFilter(e.target.value);
              setCompletedPage(1);
            }}
            className="w-full px-3 py-2 rounded-md border border-slate-200 bg-slate-50 text-slate-800 font-medium focus:ring-1 focus:ring-slate-900"
          >
            <option value="all">Todas las Prioridades</option>
            <option value="Alta">🔥 Alta Prioridad</option>
            <option value="Media">⚡ Media Prioridad</option>
            <option value="Baja">📌 Baja Prioridad</option>
          </select>
        </div>

        {/* Proyecto */}
        <div>
          <select id="tareas-filter-project" name="tareas_filter_project"
            value={projectFilter}
            onChange={(e) => {
              setProjectFilter(e.target.value);
              setCompletedPage(1);
            }}
            className="w-full px-3 py-2 rounded-md border border-slate-200 bg-slate-50 text-slate-800 font-medium focus:ring-1 focus:ring-slate-900"
          >
            <option value="all">Todos los Proyectos</option>
            {projectsList.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
          </select>
        </div>

        {isSuperAdmin && (
          <div>
            <select id="tareas-filter-role" name="tareas_filter_role"
              aria-label="Filtrar por cargo del responsable"
              value={roleFilter}
              onChange={(e) => {
                setRoleFilter(e.target.value);
                setAdminFilter('all');
                setCompletedPage(1);
              }}
              className="w-full px-3 py-2 rounded-md border border-slate-200 bg-slate-50 text-slate-800 font-medium focus:ring-1 focus:ring-slate-900"
            >
              <option value="all">Todos los Roles</option>
              <option value="Administrador">Administradores</option>
              <option value="Asesor Comercial">Asesores Comerciales</option>
            </select>
          </div>
        )}

        {/* Responsable (Solo CEO) */}
        {isSuperAdmin ? (
          <div>
            <select id="tareas-filter-admin" name="tareas_filter_admin"
              value={adminFilter}
              onChange={(e) => {
                setAdminFilter(e.target.value);
                setCompletedPage(1);
              }}
              className="w-full px-3 py-2 rounded-md border border-slate-200 bg-slate-50 text-slate-800 font-medium focus:ring-1 focus:ring-slate-900"
            >
              <option value="all">Todos los Responsables</option>
              {adminsList.filter((assignee) => roleFilter === 'all' || getAssigneeRole(assignee) === roleFilter).map((adm) => (
                <option key={adm.id} value={adm.id}>
                  {adm.name} ({getAssigneeRole(adm)})
                </option>
              ))}
            </select>
          </div>
        ) : (
          <div className="px-3 py-2 rounded-md border border-slate-200 bg-slate-50 text-slate-600 font-medium flex items-center gap-1.5">
            <User className="w-3.5 h-3.5 text-slate-400" />
            <span>Mis Tareas Asignadas</span>
          </div>
        )}
      </div>

      {/* ================= CONTENIDO DE LAS PESTAÑAS ================= */}
      {loading ? (
        <div className="py-20 flex flex-col items-center justify-center text-slate-400">
          <Loader2 className="w-8 h-8 animate-spin text-slate-600 mb-2" />
          <p className="text-xs font-semibold">Cargando tareas asignadas...</p>
        </div>
      ) : activeTab === 'activas' ? (
        /* ================= VISTA BANDEJA ACTIVA (ALTA -> MEDIA -> BAJA) ================= */
        <div className="space-y-6">
          {filteredActiveTasks.length === 0 ? (
            <div className="bg-white p-12 rounded-lg border border-slate-200 text-center">
              <CheckSquare className="w-10 h-10 text-emerald-500 mx-auto mb-2 opacity-80" />
              <h3 className="text-sm font-bold text-slate-800">¡Bandeja Activa Despejada!</h3>
              <p className="text-xs text-slate-400 mt-1 max-w-md mx-auto">
                No tienes tareas pendientes o en curso con los filtros seleccionados.
              </p>
            </div>
          ) : (
            <>
              {/* BLOQUE 1: PRIORIDAD ALTA (Primordial - Al frente) */}
              {highPriorityActive.length > 0 && (
                <div className="space-y-3">
                  <div className="flex items-center gap-2 pb-1 border-b border-red-200">
                    <span className="flex items-center gap-1.5 text-xs font-black text-red-700 uppercase tracking-wider">
                      <Flame className="w-4 h-4 text-red-600 fill-red-600" />
                      <span>Prioridad Alta (Primordial &bull; Al Frente)</span>
                    </span>
                    <span className="px-2 py-0.5 rounded-full text-[10px] font-extrabold bg-red-100 text-red-800">
                      {highPriorityActive.length}
                    </span>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3.5">
                    {highPriorityActive.map((task) => (
                      <TaskCardActive
                        key={task.id}
                        task={task}
                        borderColor="border-l-4 border-red-600"
                        badgeClass="bg-red-100 text-red-900 border-red-200"
                        onStatusChange={handleStatusChange}
                        statusPending={handleStatusChangePending}
                        deletePending={handleDeleteTaskPending}
                        onDelete={handleDeleteTask}
                        isSuperAdmin={isSuperAdmin}
                        canManage={isAssignedToCurrentAdmin(task)}
                        adminName={getAdminName(task)}
                        assigneeRole={getTaskRole(task)}
                      />
                    ))}
                  </div>
                </div>
              )}

              {/* BLOQUE 2: PRIORIDAD MEDIA */}
              {mediumPriorityActive.length > 0 && (
                <div className="space-y-3">
                  <div className="flex items-center gap-2 pb-1 border-b border-amber-200">
                    <span className="flex items-center gap-1.5 text-xs font-black text-amber-700 uppercase tracking-wider">
                      <Zap className="w-4 h-4 text-amber-600 fill-amber-600" />
                      <span>Prioridad Media</span>
                    </span>
                    <span className="px-2 py-0.5 rounded-full text-[10px] font-extrabold bg-amber-100 text-amber-800">
                      {mediumPriorityActive.length}
                    </span>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3.5">
                    {mediumPriorityActive.map((task) => (
                      <TaskCardActive
                        key={task.id}
                        task={task}
                        borderColor="border-l-4 border-amber-500"
                        badgeClass="bg-amber-100 text-amber-900 border-amber-200"
                        onStatusChange={handleStatusChange}
                        statusPending={handleStatusChangePending}
                        deletePending={handleDeleteTaskPending}
                        onDelete={handleDeleteTask}
                        isSuperAdmin={isSuperAdmin}
                        canManage={isAssignedToCurrentAdmin(task)}
                        adminName={getAdminName(task)}
                        assigneeRole={getTaskRole(task)}
                      />
                    ))}
                  </div>
                </div>
              )}

              {/* BLOQUE 3: PRIORIDAD BAJA */}
              {lowPriorityActive.length > 0 && (
                <div className="space-y-3">
                  <div className="flex items-center gap-2 pb-1 border-b border-slate-200">
                    <span className="flex items-center gap-1.5 text-xs font-black text-slate-600 uppercase tracking-wider">
                      <Pin className="w-4 h-4 text-slate-500" />
                      <span>Prioridad Baja</span>
                    </span>
                    <span className="px-2 py-0.5 rounded-full text-[10px] font-extrabold bg-slate-100 text-slate-700">
                      {lowPriorityActive.length}
                    </span>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3.5">
                    {lowPriorityActive.map((task) => (
                      <TaskCardActive
                        key={task.id}
                        task={task}
                        borderColor="border-l-4 border-slate-400"
                        badgeClass="bg-slate-100 text-slate-700 border-slate-200"
                        onStatusChange={handleStatusChange}
                        statusPending={handleStatusChangePending}
                        deletePending={handleDeleteTaskPending}
                        onDelete={handleDeleteTask}
                        isSuperAdmin={isSuperAdmin}
                        canManage={isAssignedToCurrentAdmin(task)}
                        adminName={getAdminName(task)}
                        assigneeRole={getTaskRole(task)}
                      />
                    ))}
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      ) : (
        /* ================= VISTA COMPLETADAS (ARCHIVO CON PAGINACIÓN) ================= */
        <div className="space-y-4">
          {filteredCompletedTasks.length === 0 ? (
            <div className="bg-white p-12 rounded-lg border border-slate-200 text-center">
              <Archive className="w-10 h-10 text-slate-300 mx-auto mb-2" />
              <h3 className="text-sm font-bold text-slate-800">El archivo está vacío</h3>
              <p className="text-xs text-slate-400 mt-1 max-w-md mx-auto">
                No hay tareas completadas archivadas con los filtros seleccionados.
              </p>
            </div>
          ) : (
            <>
              <div className="flex items-center justify-between text-xs text-slate-500 pb-1">
                <span>
                  Mostrando <b>{paginatedCompletedTasks.length}</b> de <b>{filteredCompletedTasks.length}</b> tareas archivadas
                </span>
                <span>
                  Página <b>{completedPage}</b> de <b>{totalCompletedPages}</b>
                </span>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3.5">
                {paginatedCompletedTasks.map((task) => (
                  <div
                    key={task.id}
                    className="bg-white rounded-lg border border-slate-200 border-l-4 border-l-emerald-600 p-4 shadow-xs transition hover:shadow-md flex flex-col justify-between text-xs space-y-3"
                  >
                    {/* Cabecera Tarjeta Completada */}
                    <div className="space-y-1.5">
                      <div className="flex items-center justify-between gap-2">
                        <span className="text-[10px] font-extrabold px-2 py-0.5 rounded-full border bg-emerald-50 text-emerald-800 border-emerald-200 flex items-center gap-1">
                          <CheckCircle2 className="w-3 h-3 text-emerald-600" />
                          <span>Completada</span>
                        </span>

                        {/* Revertir estado si el Administrador asignado desea reactivarla */}
                        {!isSuperAdmin && isAssignedToCurrentAdmin(task) ? (
                          <select id={`tareas-table-status-${task.id}`} name={`tareas_table_status_${task.id}`}
                            value={task.status}
                            onChange={(e) => handleStatusChange(task.id, e.target.value)}
                            disabled={handleStatusChangePending}
                            className="text-[10px] font-bold px-2 py-0.5 rounded-md border border-slate-200 bg-slate-50 text-slate-700 focus:outline-none cursor-pointer"
                          >
                            <option value="Completada">Completada</option>
                            <option value="Pendiente">Reactivar &bull; Pendiente</option>
                            <option value="En Curso">Reactivar &bull; En Curso</option>
                          </select>
                        ) : (
                          <span className="text-[10px] font-bold text-slate-400 italic">Archivada</span>
                        )}
                      </div>

                      <h3 className="font-black text-sm text-slate-800 leading-snug line-through opacity-85">
                        {task.title}
                      </h3>

                      {task.description && (
                        <p className="text-[11px] text-slate-500 leading-relaxed whitespace-pre-line line-clamp-2">
                          {task.description}
                        </p>
                      )}
                    </div>

                    {/* Meta Información & Fechas Exactas */}
                    <div className="pt-2 border-t border-slate-100 text-[11px] space-y-1.5 text-slate-500">
                      {task.project && (
                        <div className="flex items-center gap-1.5 font-semibold text-slate-700">
                          <Building2 className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                          <span className="truncate">{task.project.name}</span>
                        </div>
                      )}

                      {/* Fecha de Envío */}
                      <div className="flex items-center gap-1.5 text-[10px] text-slate-600 bg-slate-50 p-1.5 rounded border border-slate-100">
                        <Clock className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                        <span className="truncate">
                          <b>Enviada:</b> {formatSentDateTime(task.created_at)}
                        </span>
                      </div>

                      {/* Fecha de Finalización */}
                      <div className="flex items-center gap-1.5 text-[10px] text-emerald-800 bg-emerald-50/70 p-1.5 rounded border border-emerald-100 font-semibold">
                        <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                        <span className="truncate">
                          <b>Completada el:</b> {formatSentDateTime(task.completed_at || task.updated_at)}
                        </span>
                      </div>

                      <div className="flex items-center justify-between pt-1">
                        <div className="flex items-center gap-1 truncate text-[10px]">
                          <User className="w-3 h-3 text-slate-400 shrink-0" />
                          <span className="truncate">
                            Resp: <b>{getAdminName(task)}</b>
                          </span>
                        </div>

                        {/* Botón Eliminar Registro */}
                        {canDeleteTasks && <ActionButton loading={handleDeleteTaskPending}
                          type="button"
                          onClick={() => handleDeleteTask(task.id)}
                          className="px-2 py-0.5 rounded text-rose-600 hover:text-rose-800 hover:bg-rose-50 text-[10px] font-bold border border-rose-200 transition flex items-center gap-1 cursor-pointer shrink-0"
                          title="Eliminar este registro completado"
                        >
                          <Trash2 className="w-3 h-3" />
                          <span>Eliminar</span>
                        </ActionButton>}
                      </div>
                      <span className="inline-flex rounded border border-slate-200 bg-slate-50 px-1.5 py-0.5 text-[10px] font-medium text-slate-500">
                        {getTaskRole(task)}
                      </span>

                      {/* Botón Compacto WhatsApp Reporte al CEO y Correo */}
                      <div className="pt-2 border-t border-slate-100 flex flex-col gap-1.5">
                        <button
                          type="button"
                          onClick={() => {
                            const msg = buildTaskCompletedWhatsAppMessage({
                              taskTitle: task.title,
                              projectName: task.project?.name || 'General',
                              priority: task.priority,
                              adminName: getAdminName(task),
                              closedAt: formatSentDateTime(task.completed_at || task.updated_at),
                            });
                            openWhatsApp(DEFAULT_CEO_PHONE, msg);
                          }}
                          className="w-full py-1.5 px-2 rounded-md bg-emerald-600 hover:bg-emerald-700 text-white text-[11px] font-bold flex items-center justify-center gap-1.5 cursor-pointer transition shadow-2xs"
                          title="Abrir WhatsApp para reenviar reporte oficial de tarea completada al CEO"
                        >
                          <MessageCircle className="w-3.5 h-3.5" />
                          <span>📲 Reenviar Reporte al CEO (WhatsApp)</span>
                        </button>

                        <ActionButton loading={handleNotifyEmailPending}
                          type="button"
                          onClick={() => handleNotifyEmail(task.id)}
                          disabled={sendingEmailId === task.id}
                          className="w-full py-1 px-2 rounded text-[10px] font-semibold text-slate-700 bg-slate-100 hover:bg-slate-200 border border-slate-200 flex items-center justify-center gap-1 transition cursor-pointer disabled:opacity-50"
                          title="Reenviar notificación oficial por correo SMTP al CEO"
                        >
                          {sendingEmailId === task.id ? (
                            <Loader2 className="w-3 h-3 animate-spin text-slate-500" />
                          ) : (
                            <Mail className="w-3 h-3 text-slate-500" />
                          )}
                          <span>Reenviar por Correo al CEO</span>
                        </ActionButton>
                      </div>
                    </div>
                  </div>
                ))}
              </div>

              {/* Barra de Paginación */}
              {totalCompletedPages > 1 && (
                <div className="pt-4 border-t border-slate-200 flex items-center justify-between">
                  <button
                    type="button"
                    disabled={completedPage === 1}
                    onClick={() => setCompletedPage((prev) => Math.max(1, prev - 1))}
                    className="px-3 py-1.5 rounded border border-slate-200 bg-white text-slate-700 text-xs font-bold disabled:opacity-40 disabled:cursor-not-allowed hover:bg-slate-50 transition flex items-center gap-1 cursor-pointer"
                  >
                    <ChevronLeft className="w-4 h-4" />
                    <span>Anterior</span>
                  </button>

                  <div className="flex items-center gap-1">
                    {Array.from({ length: totalCompletedPages }, (_, i) => i + 1).map((pg) => (
                      <button
                        key={pg}
                        type="button"
                        onClick={() => setCompletedPage(pg)}
                        className={`w-7 h-7 rounded text-xs font-bold transition cursor-pointer ${
                          completedPage === pg
                            ? 'bg-slate-900 text-white shadow-xs'
                            : 'bg-white border border-slate-200 text-slate-700 hover:bg-slate-50'
                        }`}
                      >
                        {pg}
                      </button>
                    ))}
                  </div>

                  <button
                    type="button"
                    disabled={completedPage === totalCompletedPages}
                    onClick={() => setCompletedPage((prev) => Math.min(totalCompletedPages, prev + 1))}
                    className="px-3 py-1.5 rounded border border-slate-200 bg-white text-slate-700 text-xs font-bold disabled:opacity-40 disabled:cursor-not-allowed hover:bg-slate-50 transition flex items-center gap-1 cursor-pointer"
                  >
                    <span>Siguiente</span>
                    <ChevronRight className="w-4 h-4" />
                  </button>
                </div>
              )}
            </>
          )}
        </div>
      )}

      {/* ================= MODAL: ASIGNAR NUEVA TAREA (CEO / RUTA DIRECTA) ================= */}
      {isSuperAdmin && createModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-fade-in">
          <div className="bg-white rounded-lg shadow-xl border border-slate-200 w-full max-w-md overflow-hidden">
            <div className="p-4 border-b border-slate-100 bg-slate-50 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <CheckSquare className="w-4 h-4 text-slate-900" />
                <div>
                  <h3 className="font-bold text-sm text-slate-900">Asignar Nueva Tarea</h3>
                  <span className="text-[10px] text-slate-500">Para Administradores y Asesores Comerciales</span>
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

            <form onSubmit={handleCreateTask} className="p-5 space-y-3.5 text-xs">
              <div>
                <label htmlFor="tareas-title" className="block font-bold text-slate-700 mb-1">Título de la Tarea *</label>
                <input id="tareas-title" name="tareas_title"
                  type="text"
                  required
                  value={newTask.title}
                  onChange={(e) => setNewTask({ ...newTask, title: e.target.value })}
                  placeholder="Ej. Llevar minutas de Guapuca a Notaría 1"
                  className="w-full px-3 py-2 rounded-md border border-slate-200 text-slate-900 font-medium focus:ring-1 focus:ring-slate-900"
                />
              </div>

              <div>
                <label htmlFor="tareas-description" className="block font-bold text-slate-700 mb-1">Descripción / Instrucciones</label>
                <textarea id="tareas-description" name="tareas_description"
                  rows="2"
                  value={newTask.description}
                  onChange={(e) => setNewTask({ ...newTask, description: e.target.value })}
                  placeholder="Indica números de protocolo, contacto del funcionario u observaciones..."
                  className="w-full px-3 py-2 rounded-md border border-slate-200 text-slate-800"
                />
              </div>

              {/* Selección del responsable y proyecto opcional. */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label htmlFor="tareas-assigned-admin" className="block font-bold text-slate-700 mb-1">Responsable Asignado *</label>
                  <select id="tareas-assigned-admin" name="tareas_assigned_admin"
                    required
                    value={newTask.assigned_to}
                    onChange={(e) => handleAdminChangeInModal(e.target.value)}
                    className="w-full px-3 py-2 rounded-md border border-slate-200 bg-slate-50 text-slate-800 font-medium"
                  >
                    <option value="">-- Seleccionar --</option>
                    {adminsList.map((a) => (
                      <option key={a.id} value={a.id}>
                        {a.name} ({getAssigneeRole(a)})
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <div className="flex items-center justify-between mb-1">
                    <label htmlFor="tareas-project" className="block font-bold text-slate-700">Proyecto (Opcional)</label>
                  </div>
                  <select id="tareas-project" name="tareas_project"
                    value={newTask.project_id}
                    onChange={(e) => setNewTask({ ...newTask, project_id: e.target.value })}
                    disabled={!newTask.assigned_to}
                    className="w-full px-3 py-2 rounded-md border border-slate-200 bg-slate-50 text-slate-800 font-medium disabled:opacity-50"
                  >
                    {!newTask.assigned_to ? (
                      <option value="">-- Selecciona Responsable --</option>
                    ) : modalAdminProjects.length > 0 ? (
                      <>
                        <option value="">-- Sin Proyecto Específico --</option>
                        {modalAdminProjects.map((p) => (
                          <option key={p.id} value={p.id}>
                            {p.name || p.nombre}
                          </option>
                        ))}
                      </>
                    ) : (
                      <>
                        <option value="">-- Sin proyectos asignados (General) --</option>
                        {projectsList.map((p) => (
                          <option key={p.id} value={p.id}>
                            {p.name || p.nombre}
                          </option>
                        ))}
                      </>
                    )}
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label htmlFor="tareas-priority" className="block font-bold text-slate-700 mb-1">Nivel de Prioridad *</label>
                  <select id="tareas-priority" name="tareas_priority"
                    value={newTask.priority}
                    onChange={(e) => setNewTask({ ...newTask, priority: e.target.value })}
                    className="w-full px-3 py-2 rounded-md border border-slate-200 bg-slate-50 font-bold text-slate-800"
                  >
                    <option value="Alta">🔥 Alta (Primordial)</option>
                    <option value="Media">⚡ Media</option>
                    <option value="Baja">📌 Baja</option>
                  </select>
                </div>

                <div>
                  <label htmlFor="tareas-due-date" className="block font-bold text-slate-700 mb-1">Fecha Límite</label>
                  <input id="tareas-due-date" name="tareas_due_date"
                    type="date"
                    value={newTask.due_date}
                    onChange={(e) => setNewTask({ ...newTask, due_date: e.target.value })}
                    className="w-full px-3 py-2 rounded-md border border-slate-200 font-medium text-slate-800"
                  />
                </div>
              </div>

              <div className="pt-3 border-t border-slate-100 flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={handleCloseCreateModal}
                  className="px-3 py-1.5 text-slate-600 hover:bg-slate-100 rounded-md font-medium cursor-pointer"
                >
                  Cancelar
                </button>
                <ActionButton loading={handleCreateTaskPending}
                  type="submit"
                  disabled={submitting}
                  className="px-4 py-2 bg-slate-900 hover:bg-slate-800 text-white font-bold rounded-md flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
                >
                  {submitting && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                  <span>Asignar Tarea</span>
                </ActionButton>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ================= MODAL DE NOTIFICACIÓN WHATSAPP AL COMPLETAR TAREA ================= */}
      {taskCompletedModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-fade-in">
          <div className="bg-white rounded-xl shadow-2xl border border-slate-200 w-full max-w-md overflow-hidden animate-scale-in">
            <div className="p-4 border-b border-slate-100 bg-emerald-50/90 flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-full bg-emerald-600 text-white flex items-center justify-center shadow-xs">
                  <CheckCircle2 className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="font-extrabold text-sm text-emerald-950">¡Tarea Marcada como Completada!</h3>
                  <p className="text-[11px] text-emerald-800 font-medium">Estado guardado y archivado correctamente</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setTaskCompletedModal(null)}
                className="text-slate-400 hover:text-slate-600 p-1 rounded-md cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-5 space-y-4 text-xs">
              {/* Resumen de la tarea completada */}
              <div className="p-3.5 rounded-lg bg-slate-50 border border-slate-200 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Detalles de la Tarea</span>
                  <span className="px-2 py-0.5 rounded-full text-[10px] font-extrabold bg-emerald-100 text-emerald-900 border border-emerald-200">
                    Prioridad {taskCompletedModal.priority || 'Media'}
                  </span>
                </div>
                <h4 className="font-black text-sm text-slate-900">{taskCompletedModal.title}</h4>
                <div className="grid grid-cols-2 gap-2 text-[11px] text-slate-600 pt-1 border-t border-slate-200/60">
                  <div>
                    <span className="text-slate-400 block text-[10px]">Proyecto:</span>
                    <strong className="text-slate-800">{taskCompletedModal.project?.name || 'General / Sin Proyecto'}</strong>
                  </div>
                  <div>
                    <span className="text-slate-400 block text-[10px]">Ejecutada por:</span>
                    <strong className="text-slate-800">{getAdminName(taskCompletedModal)}</strong>
                  </div>
                </div>
                <div className="text-[11px] text-slate-500 pt-1 border-t border-slate-200/60">
                  <span className="text-slate-400 block text-[10px]">Fecha y Hora de Cierre:</span>
                  <span className="font-semibold text-slate-800">
                    {formatSentDateTime(taskCompletedModal.completed_at || new Date())}
                  </span>
                </div>
              </div>

              {/* Vista previa del mensaje oficial de WhatsApp */}
              <div className="p-3 rounded-lg bg-emerald-50/50 border border-emerald-100 text-[11px] text-slate-700 space-y-1">
                <span className="font-bold text-emerald-900 block text-[10px] uppercase tracking-wider">
                  Reporte oficial listo para el CEO:
                </span>
                <p className="whitespace-pre-line font-mono text-[10px] bg-white p-2.5 rounded border border-emerald-200 text-slate-800 max-h-32 overflow-y-auto leading-relaxed">
                  {buildTaskCompletedWhatsAppMessage({
                    taskTitle: taskCompletedModal.title,
                    projectName: taskCompletedModal.project?.name || 'General',
                    priority: taskCompletedModal.priority,
                    adminName: getAdminName(taskCompletedModal),
                    closedAt: formatSentDateTime(taskCompletedModal.completed_at || new Date()),
                  })}
                </p>
              </div>

              {/* Botón Verde WhatsApp */}
              <button
                type="button"
                onClick={() => {
                  const msg = buildTaskCompletedWhatsAppMessage({
                    taskTitle: taskCompletedModal.title,
                    projectName: taskCompletedModal.project?.name || 'General',
                    priority: taskCompletedModal.priority,
                    adminName: getAdminName(taskCompletedModal),
                    closedAt: formatSentDateTime(taskCompletedModal.completed_at || new Date()),
                  });
                  openWhatsApp(DEFAULT_CEO_PHONE, msg);
                }}
                className="w-full py-3 px-4 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white font-black text-sm flex items-center justify-center gap-2 shadow-sm transition cursor-pointer"
              >
                <MessageCircle className="w-5 h-5" />
                <span>📲 Avisar al CEO por WhatsApp</span>
              </button>

              {/* Reenviar Correo SMTP */}
              <ActionButton loading={handleNotifyEmailPending}
                type="button"
                onClick={() => handleNotifyEmail(taskCompletedModal.id)}
                disabled={sendingEmailId === taskCompletedModal.id}
                className="w-full py-2 px-3 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs flex items-center justify-center gap-1.5 transition cursor-pointer disabled:opacity-50"
              >
                {sendingEmailId === taskCompletedModal.id ? (
                  <Loader2 className="w-3.5 h-3.5 animate-spin text-slate-500" />
                ) : (
                  <Mail className="w-3.5 h-3.5 text-slate-600" />
                )}
                <span>✉️ Reenviar Notificación por Correo al CEO</span>
              </ActionButton>

              <button
                type="button"
                onClick={() => setTaskCompletedModal(null)}
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

// Sub-componente de Tarjeta de Tarea en Bandeja Activa
function TaskCardActive({
  task,
  borderColor,
  badgeClass,
  onStatusChange,
  onDelete,
  statusPending,
  deletePending,
  isSuperAdmin,
  canManage,
  adminName,
  assigneeRole,
}) {
  return (
    <div
      className={`bg-white rounded-lg border border-slate-200 ${borderColor} p-4 shadow-xs transition hover:shadow-md flex flex-col justify-between text-xs space-y-3`}
    >
      {/* Cabecera Tarjeta */}
      <div className="space-y-1.5">
        <div className="flex items-center justify-between gap-2">
          <span className={`text-[10px] font-extrabold px-2 py-0.5 rounded-full border ${badgeClass}`}>
            Prioridad {task.priority}
          </span>

          {/* Selector de Estado o Badge de Solo Lectura para el CEO */}
          {isSuperAdmin ? (
            <span
              className={`text-[10px] font-extrabold px-2 py-0.5 rounded-md border flex items-center gap-1 ${
                task.status === 'Pendiente'
                  ? 'bg-amber-50 text-amber-800 border-amber-300'
                  : 'bg-blue-50 text-blue-800 border-blue-300'
              }`}
              title="Estado actual gestionado por el responsable asignado"
            >
              <span className="w-1.5 h-1.5 rounded-full bg-current" />
              <span>{task.status}</span>
            </span>
          ) : canManage ? (
            <select id={`tareas-card-status-${task.id}`} name={`tareas_card_status_${task.id}`}
              value={task.status}
              onChange={(e) => onStatusChange(task.id, e.target.value)}
                disabled={statusPending}
              className={`text-[10px] font-bold px-2 py-0.5 rounded-md border focus:outline-none cursor-pointer ${
                task.status === 'Pendiente'
                  ? 'bg-amber-50 text-amber-800 border-amber-300'
                  : 'bg-blue-50 text-blue-800 border-blue-300'
              }`}
            >
              <option value="Pendiente">Pendiente</option>
              <option value="En Curso">En Curso</option>
              <option value="Completada">✓ Completada (Archivar)</option>
            </select>
          ) : (
            <span className="text-[10px] font-bold px-2 py-0.5 rounded-md border border-slate-200 bg-slate-50 text-slate-600">
              {task.status}
            </span>
          )}
        </div>
        <span className="inline-flex rounded border border-slate-200 bg-slate-50 px-1.5 py-0.5 text-[10px] font-medium text-slate-500">
          {assigneeRole}
        </span>

        <h3 className="font-black text-sm text-slate-900 leading-snug">{task.title}</h3>

        {task.description && (
          <p className="text-[11px] text-slate-600 leading-relaxed whitespace-pre-line line-clamp-3">
            {task.description}
          </p>
        )}
      </div>

      {/* Meta Información & Fechas */}
      <div className="pt-2 border-t border-slate-100 text-[11px] space-y-1.5 text-slate-500">
        {task.project && (
          <div className="flex items-center gap-1.5 font-semibold text-slate-700">
            <Building2 className="w-3.5 h-3.5 text-slate-400 shrink-0" />
            <span className="truncate">{task.project.name}</span>
          </div>
        )}

        {/* Día y Hora Exacta de Envío */}
        <div className="flex items-center gap-1.5 text-[10px] text-slate-700 bg-slate-50 p-1.5 rounded border border-slate-100 font-medium">
          <Clock className="w-3.5 h-3.5 text-slate-400 shrink-0" />
          <span className="truncate">
            <b>Enviada:</b> {formatSentDateTime(task.created_at)}
          </span>
        </div>

        <div className="flex items-center justify-between pt-0.5">
          <div className="flex items-center gap-1 truncate text-[10px]">
            <User className="w-3.5 h-3.5 text-slate-400 shrink-0" />
            <span className="truncate">
              Resp: <b>{adminName}</b>
            </span>
          </div>

          {/* Fecha Límite Formateada */}
          {task.due_date && (
            <div className="flex items-center gap-1 text-[10px] text-slate-600 shrink-0 font-medium">
              <Calendar className="w-3 h-3 text-slate-400" />
              <span>Límite: {formatDueDate(task.due_date)}</span>
            </div>
          )}
        </div>

        {/* Acciones y Monitoreo del CEO vs Administrador */}
        <div className="pt-2 border-t border-slate-100 flex items-center justify-between gap-2">
          {isSuperAdmin ? (
            /* Indicador Sobrio de Monitoreo para el CEO */
            <>
              <div className="flex-1 py-1.5 px-2.5 rounded bg-slate-50 text-slate-700 border border-slate-200 text-[10px] font-semibold flex items-center gap-1.5 truncate">
                <Clock className="w-3.5 h-3.5 text-amber-600 shrink-0" />
                <span className="truncate">
                  En ejecución por: <b className="text-slate-900">{adminName}</b>
                </span>
              </div>

              {/* Únicamente el ícono del basurero para cancelar/eliminar la orden */}
              <ActionButton loading={deletePending}
                type="button"
                onClick={() => onDelete(task.id)}
                title="Cancelar / Eliminar orden"
                className="p-1.5 rounded text-slate-400 hover:text-rose-600 hover:bg-rose-50 border border-transparent hover:border-rose-200 transition cursor-pointer shrink-0"
              >
                <Trash2 className="w-3.5 h-3.5" />
              </ActionButton>
            </>
          ) : canManage ? (
            /* Botón Exclusivo para el Administrador Asignado */
            <ActionButton loading={statusPending}
              type="button"
              onClick={() => onStatusChange(task.id, 'Completada')}
              className="w-full py-1.5 px-2 rounded bg-emerald-50 hover:bg-emerald-100 text-emerald-800 border border-emerald-200 text-[10px] font-bold flex items-center justify-center gap-1 cursor-pointer transition shadow-2xs"
            >
              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
              <span>Marcar como Completada</span>
            </ActionButton>
          ) : (
            <span className="text-[10px] text-slate-400 italic">Asignada a otro responsable</span>
          )}
        </div>
      </div>
    </div>
  );
}
