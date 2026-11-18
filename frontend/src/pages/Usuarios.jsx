import useSingleSubmit from '../hooks/useSingleSubmit';
import ActionButton from '../components/ActionButton';
import ResetUserPasswordDialog from '../components/ResetUserPasswordDialog';
import InactiveUserBadge, { isUserInactive } from '../components/InactiveUserBadge';
import Pagination from '../components/Pagination';
import React, { useRef, useState, useEffect } from 'react';
import axios from 'axios';
import { useAuth } from '../context/AuthContext';
import {
  ShieldCheck,
  Users,
  Search,
  Plus,
  Pencil,
  Trash2,
  X,
  Mail,
  Lock,
  UserCheck,
  RotateCcw,
  Building2,
  Mountain,
  Loader2,
  CheckCircle,
  AlertCircle,
  KeyRound,
  Sparkles,
  Check,
  Phone,
  MessageCircle,
} from 'lucide-react';

const ROLES = [
  { value: 'Super Admin', label: 'Super Admin (CEO / Gerente General - Acceso Total)' },
  { value: 'Administrador', label: 'Administrador (Área Administrativa - Escrituras y Proyectos Asignados)' },
  { value: 'Asesor Comercial', label: 'Asesor Comercial (Ventas, Clientes y Lotes)' },
  { value: 'Topógrafo', label: 'Topógrafo (Área Técnica, Levantamientos y Planos)' },
];

export default function Usuarios() {
  const { user: currentUser, updateUser } = useAuth();
  const [users, setUsers] = useState([]);
  const [pagination, setPagination] = useState({});
  const listRequest = useRef(0);
  const [perPage, setPerPage] = useState(15);
  const [roleCounts, setRoleCounts] = useState({});
  const [projectsList, setProjectsList] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [roleFilter, setRoleFilter] = useState('TODOS');
  const [statusFilter, setStatusFilter] = useState('active');

  // Estados del modal
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [resetUser, setResetUser] = useState(null);
  const [editingUser, setEditingUser] = useState(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [toastMessage, setToastMessage] = useState(null);

  // Formulario
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    phone: '0989996421',
    password: '',
    role: 'Asesor Comercial',
    project_ids: [],
  });

  // Modal rápido del CEO para asignar proyectos a un Administrador
  const [assignProjectsModalUser, setAssignProjectsModalUser] = useState(null);
  const [assignProjectsSelectedIds, setAssignProjectsSelectedIds] = useState([]);
  const [isSavingUserProjects, setIsSavingUserProjects] = useState(false);

  // Cargar usuarios y proyectos
  const fetchUsers = async (page = 1) => {
    const requestId = ++listRequest.current;
    setLoading(true);
    try {
      const { data } = await axios.get('/api/users', {
        params: { page, per_page: perPage, search: searchTerm.trim(), role: roleFilter, status: statusFilter },
      });
      if (requestId !== listRequest.current) return;
      if (page > data.last_page) {
        await fetchUsers(data.last_page);
        return;
      }
      setUsers(data.data);
      setPagination(data);
      setRoleCounts(data.role_counts);
    } catch (err) {
      if (requestId !== listRequest.current) return;
      console.error('Error al cargar datos:', err);
      setToastMessage({
        type: 'error',
        text: 'Error al conectar con el servicio de usuarios.',
      });
    } finally {
      if (requestId === listRequest.current) setLoading(false);
    }
  };

  useEffect(() => {
    listRequest.current++;
    const timer = setTimeout(() => fetchUsers(), 250);
    return () => clearTimeout(timer);
  }, [searchTerm, roleFilter, statusFilter, perPage]);

  useEffect(() => {
    axios.get('/api/projects')
      .then(({ data }) => setProjectsList(Array.isArray(data) ? data : data.data || []))
      .catch((error) => console.error('Error al cargar proyectos:', error));
  }, []);

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setFormData((prev) => ({
      ...prev,
      [name]: value,
    }));
  };

  const handleToggleProject = (projectId) => {
    setFormData((prev) => {
      const current = prev.project_ids || [];
      const exists = current.includes(projectId);
      const next = exists ? current.filter((id) => id !== projectId) : [...current, projectId];
      return { ...prev, project_ids: next };
    });
  };

  // Abrir modal para crear
  const handleAbrirNuevo = () => {
    setEditingUser(null);
    setFormData({
      name: '',
      email: '',
      phone: '0989996421',
      password: '',
      role: 'Asesor Comercial',
      project_ids: [],
    });
    setIsModalOpen(true);
  };

  // Abrir modal para editar
  const handleAbrirEditar = (user) => {
    setEditingUser(user);
    const userRole = user.roles && user.roles.length > 0 ? user.roles[0].name : 'Asesor Comercial';
    const assignedIds = user.assigned_projects ? user.assigned_projects.map((p) => p.id) : [];

    setFormData({
      name: user.name || '',
      email: user.email || '',
      phone: user.phone ?? '',
      password: '',
      role: userRole,
      project_ids: assignedIds,
    });
    setIsModalOpen(true);
  };

  const handleOpenAssignProjectsModal = (user) => {
    setAssignProjectsModalUser(user);
    const ids = user.assigned_projects ? user.assigned_projects.map((p) => p.id) : [];
    setAssignProjectsSelectedIds(ids);
  };

  const handleToggleUserProjectCheck = (projId) => {
    setAssignProjectsSelectedIds((prev) =>
      prev.includes(projId) ? prev.filter((id) => id !== projId) : [...prev, projId]
    );
  };

  const [handleSaveUserProjects, handleSaveUserProjectsPending] = useSingleSubmit(async (e) => {
    if (!assignProjectsModalUser) return;
    setIsSavingUserProjects(true);
    try {
      await axios.post(`/api/users/${assignProjectsModalUser.id}/assign-projects`, {
        project_ids: assignProjectsSelectedIds,
      });
      setToastMessage({
        type: 'success',
        text: `Proyectos asignados exitosamente al administrador "${assignProjectsModalUser.name}".`,
      });
      setAssignProjectsModalUser(null);
      fetchUsers(pagination.current_page);
    } catch (err) {
      if (err?.isDuplicateBlocked) return;
      console.error('Error al asignar proyectos:', err);
      setToastMessage({
        type: 'error',
        text: 'No se pudieron asignar los proyectos al usuario.',
      });
    } finally {
      setIsSavingUserProjects(false);
      setTimeout(() => setToastMessage(null), 5000);
    }
  }, { form: true });

  // Guardar (crear o actualizar)
  const [handleGuardarUsuario, handleGuardarUsuarioPending] = useSingleSubmit(async (e) => {
    if (!formData.name.trim() || !formData.email.trim() || !formData.role) return;

    if (!editingUser && (!formData.password || formData.password.length < 6)) {
      alert('La contraseña debe tener al menos 6 caracteres.');
      return;
    }

    setIsSubmitting(true);
    try {
      const payload = {
        name: formData.name.trim(),
        email: formData.email.trim(),
        phone: formData.phone.trim() || (editingUser ? null : '0989996421'),
        role: formData.role,
        project_ids: formData.role === 'Administrador' ? formData.project_ids : [],
      };

      if (editingUser) {
        if (formData.password) {
          payload.password = formData.password;
        }
        const { data } = await axios.put(`/api/users/${editingUser.id}`, payload);
        if (editingUser.id === currentUser?.id) {
          localStorage.setItem('user_role', data.data.roles[0].name);
          updateUser(data.data);
        }
        setToastMessage({
          type: 'success',
          text: `Usuario "${formData.name}" actualizado con éxito.`,
        });
      } else {
        payload.password = formData.password;
        await axios.post('/api/users', payload);
        setToastMessage({
          type: 'success',
          text: `Nuevo usuario "${formData.name}" creado con rol "${formData.role}".`,
        });
      }

      setIsModalOpen(false);
      setEditingUser(null);
      setFormData({ name: '', email: '', phone: '0989996421', password: '', role: 'Asesor Comercial', project_ids: [] });
      fetchUsers(pagination.current_page);
    } catch (err) {
      if (err?.isDuplicateBlocked) return;
      console.error('Error al guardar usuario:', err);
      const msg = err.response?.data?.message || 'Error al procesar la solicitud de usuario.';
      setToastMessage({
        type: 'error',
        text: msg,
      });
    } finally {
      setIsSubmitting(false);
      setTimeout(() => setToastMessage(null), 5000);
    }
  }, { form: true });

  // Dar de baja el acceso manteniendo el historial operativo.
  const [handleEliminarUsuario, handleEliminarUsuarioPending] = useSingleSubmit(async (user) => {
    if (user.roles?.some((role) => role.name === 'Super Admin')) {
      alert('No es posible dar de baja una cuenta de Super Admin.');
      return;
    }

    const confirmar = window.confirm(
      `Dar de baja a "${user.name}" (${user.email}). El usuario perderá el acceso al sistema inmediatamente, pero todos sus recibos, clientes y registros históricos se conservarán intactos.`
    );
    if (!confirmar) return;

    try {
      const res = await axios.delete(`/api/users/${user.id}`);
      setToastMessage({
        type: 'success',
        text: res.data?.message || `Usuario "${user.name}" dado de baja. Su historial se conserva.`,
      });
      await fetchUsers(pagination.current_page);
    } catch (err) {
      if (err?.isDuplicateBlocked) return;
      console.error('Error al dar de baja al usuario:', err);
      const msg = err.response?.data?.message || 'No se pudo dar de baja al usuario.';
      setToastMessage({
        type: 'warning',
        text: msg,
      });
    } finally {
      setTimeout(() => setToastMessage(null), 5000);
    }
  });

  const [handleReactivateUser, handleReactivateUserPending] = useSingleSubmit(async (user) => {
    try {
      const { data } = await axios.post(`/api/users/${user.id}/reactivate`);
      setToastMessage({ type: 'success', text: data.message || `Usuario "${user.name}" reactivado.` });
      await fetchUsers(pagination.current_page);
    } catch (err) {
      if (err?.isDuplicateBlocked) return;
      setToastMessage({
        type: 'error',
        text: err.response?.data?.message || 'No se pudo reactivar al usuario.',
      });
    } finally {
      setTimeout(() => setToastMessage(null), 5000);
    }
  });

  // Filtrado de usuarios
  const superAdminsCount = roleCounts['Super Admin'] || 0;
  const administradoresCount = roleCounts.Administrador || 0;
  const asesoresCount = roleCounts['Asesor Comercial'] || 0;
  const topografosCount = roleCounts['Topógrafo'] || 0;

  return (
    <div className="space-y-6 animate-fade-in w-full pb-8 font-sans">
      {/* Toast Notification */}
      {toastMessage && (
        <div
          className={`p-4 rounded-md flex items-center justify-between shadow-xs animate-fade-in ${
            toastMessage.type === 'warning' || toastMessage.type === 'error'
              ? 'bg-amber-50 border border-amber-300 text-amber-900'
              : 'bg-emerald-50 border border-emerald-200 text-emerald-800'
          }`}
        >
          <div className="flex items-center gap-3">
            {toastMessage.type === 'warning' || toastMessage.type === 'error' ? (
              <AlertCircle className="w-5 h-5 text-amber-600 shrink-0" />
            ) : (
              <CheckCircle className="w-5 h-5 text-emerald-600 shrink-0" />
            )}
            <p className="text-sm font-semibold">
              {typeof toastMessage === 'string' ? toastMessage : toastMessage.text}
            </p>
          </div>
          <button
            type="button"
            onClick={() => setToastMessage(null)}
            className="text-xs font-semibold underline cursor-pointer hover:opacity-80 ml-4"
          >
            Cerrar
          </button>
        </div>
      )}

      {/* Cabecera Principal */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white p-5 rounded-lg border border-slate-200 shadow-xs">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-lg bg-slate-100 border border-slate-200 flex items-center justify-center text-slate-700">
            <ShieldCheck className="w-5 h-5" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="text-[11px] font-semibold text-slate-600 uppercase tracking-wider bg-slate-100 px-2 py-0.5 rounded-md border border-slate-200">
                Seguridad y Roles
              </span>
            </div>
            <h1 className="text-xl sm:text-2xl font-bold text-slate-900 mt-0.5">
              Gestión de Usuarios y Roles (4 Perfiles)
            </h1>
            <p className="text-xs text-slate-500 mt-0.5">
              Administración de cuentas para CEO, Área Administrativa, Asesores Comerciales y Topografía.
            </p>
          </div>
        </div>

        <button
          type="button"
          onClick={handleAbrirNuevo}
          className="inline-flex items-center gap-2 px-4 py-2 rounded-md font-medium text-white bg-slate-900 hover:bg-slate-800 active:bg-black transition text-sm shrink-0 cursor-pointer shadow-xs"
        >
          <Plus className="w-4 h-4" />
          <span>+ Registrar Nuevo Usuario</span>
        </button>
      </div>

      {/* Tarjetas Métricas de Roles */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <div className="bg-white p-3.5 rounded-lg border border-slate-200 shadow-xs flex items-center justify-between">
          <div>
            <span className="text-[11px] font-bold text-slate-500 block">Super Admin (CEO)</span>
            <span className="text-2xl font-black text-slate-900">{superAdminsCount}</span>
            <span className="text-[10px] text-slate-400 block">Control Total</span>
          </div>
          <div className="w-8 h-8 rounded-md bg-slate-100 flex items-center justify-center text-slate-700 border border-slate-200">
            <ShieldCheck className="w-4 h-4" />
          </div>
        </div>

        <div className="bg-white p-3.5 rounded-lg border border-slate-200 shadow-xs flex items-center justify-between">
          <div>
            <span className="text-[11px] font-bold text-slate-500 block">Administradores</span>
            <span className="text-2xl font-black text-indigo-700">{administradoresCount}</span>
            <span className="text-[10px] text-slate-400 block">Escrituras & Proy.</span>
          </div>
          <div className="w-8 h-8 rounded-md bg-indigo-50 flex items-center justify-center text-indigo-700 border border-indigo-200">
            <Building2 className="w-4 h-4" />
          </div>
        </div>

        <div className="bg-white p-3.5 rounded-lg border border-slate-200 shadow-xs flex items-center justify-between">
          <div>
            <span className="text-[11px] font-bold text-slate-500 block">Asesores Ventas</span>
            <span className="text-2xl font-black text-teal-700">{asesoresCount}</span>
            <span className="text-[10px] text-slate-400 block">CRM & Clientes</span>
          </div>
          <div className="w-8 h-8 rounded-md bg-teal-50 flex items-center justify-center text-teal-700 border border-teal-200">
            <UserCheck className="w-4 h-4" />
          </div>
        </div>

        <div className="bg-white p-3.5 rounded-lg border border-slate-200 shadow-xs flex items-center justify-between">
          <div>
            <span className="text-[11px] font-bold text-slate-500 block">Topógrafos</span>
            <span className="text-2xl font-black text-cyan-700">{topografosCount}</span>
            <span className="text-[10px] text-slate-400 block">Planos & Terreno</span>
          </div>
          <div className="w-8 h-8 rounded-md bg-cyan-50 flex items-center justify-center text-cyan-700 border border-cyan-200">
            <Mountain className="w-4 h-4" />
          </div>
        </div>
      </div>

      <div className="flex flex-wrap gap-2" aria-label="Estado de las cuentas">
        {[
          { value: 'active', label: 'Activos' },
          { value: 'inactive', label: 'Dados de Baja' },
          { value: 'all', label: 'Todos' },
        ].map(({ value, label }) => (
          <button key={value} type="button" aria-pressed={statusFilter === value} onClick={() => setStatusFilter(value)}
            className={`min-h-[42px] rounded-md border px-3 text-xs font-semibold ${statusFilter === value ? 'border-slate-900 bg-slate-900 text-white' : 'border-slate-200 bg-white text-slate-600 hover:bg-slate-50'}`}>
            {label}
          </button>
        ))}
      </div>

      {/* Barra de Búsqueda y Filtros Rápidos */}
      <div className="bg-white p-3.5 rounded-lg border border-slate-200 shadow-xs flex flex-col sm:flex-row items-center justify-between gap-3 text-xs">
        <div className="relative w-full sm:w-80">
          <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
          <input id="usuarios-search" name="usuarios_search"
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="Buscar por nombre o correo..."
            className="w-full pl-8 pr-3 py-2 rounded-md border border-slate-200 bg-slate-50 focus:bg-white text-slate-900 focus:outline-none focus:ring-1 focus:ring-slate-900"
          />
        </div>

        {/* Botones de filtro de roles */}
        <div className="flex items-center gap-1.5 flex-wrap w-full sm:w-auto">
          {['TODOS', 'Super Admin', 'Administrador', 'Asesor Comercial', 'Topógrafo'].map((r) => (
            <button
              key={r}
              type="button"
              onClick={() => setRoleFilter(r)}
              className={`px-2.5 py-1.5 rounded-md text-[11px] font-bold transition cursor-pointer border ${
                roleFilter === r
                  ? 'bg-slate-900 text-white border-slate-900 shadow-xs'
                  : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50'
              }`}
            >
              {r}
            </button>
          ))}
        </div>
      </div>

      {/* Tabla de Usuarios */}
      <div className="bg-white rounded-lg border border-slate-200 shadow-xs overflow-hidden">
        <div className="overflow-x-auto w-full">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="bg-slate-50/80 border-b border-slate-200 text-[10px] uppercase tracking-wider font-bold text-slate-500">
                <th className="py-3 px-4">Usuario</th>
                <th className="py-3 px-4">Correo Electrónico</th>
                <th className="py-3 px-4">Celular WhatsApp</th>
                <th className="py-3 px-4">Rol Oficial</th>
                <th className="py-3 px-4">Proyectos Asignados</th>
                <th className="py-3 px-4">Fecha Registro</th>
                <th className="py-3 px-4 text-center">Acciones</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {loading ? (
                <tr>
                  <td colSpan={7} className="py-12 text-center text-slate-400">
                    <Loader2 className="w-6 h-6 animate-spin mx-auto text-slate-600 mb-2" />
                    <p className="text-xs font-semibold">Cargando colaboradores...</p>
                  </td>
                </tr>
              ) : users.length === 0 ? (
                <tr>
                  <td colSpan={7} className="py-12 text-center text-slate-400">
                    <Users className="w-8 h-8 mx-auto text-slate-300 mb-2" />
                    <p className="text-xs font-semibold">No se encontraron usuarios con ese filtro.</p>
                  </td>
                </tr>
              ) : (
                users.map((user) => {
                  const roleName = user.roles?.[0]?.name || 'Asesor Comercial';
                  const isUserSuperAdmin = roleName === 'Super Admin';
                  const isUserAdmin = roleName === 'Administrador';
                  const isUserTopo = roleName === 'Topógrafo';
                  const inactive = isUserInactive(user);
                  const canResetPassword = !inactive && user.id !== 1
                    && !user.roles?.some((role) => role.name === 'Super Admin')
                    && user.roles?.some((role) => ['Administrador', 'Asesor Comercial', 'Topógrafo'].includes(role.name));
                  const assignedProjects = user.assigned_projects || [];

                  return (
                    <tr key={user.id} className="hover:bg-slate-50/70 transition">
                      <td className="py-3 px-4">
                        <div className="font-bold text-slate-900 flex items-center gap-1.5">
                          <span>{user.name}</span>
                          <InactiveUserBadge user={user} />
                          {user.password_reset_requested && (
                            <span className="rounded border border-rose-200 bg-rose-100 px-1.5 py-0.5 text-[10px] font-bold text-rose-800">
                              Solicitó cambio de clave
                            </span>
                          )}
                          {user.id === 1 && (
                            <span className="text-[9px] bg-amber-100 text-amber-800 font-extrabold px-1.5 py-0.2 rounded border border-amber-200">
                              CEO
                            </span>
                          )}
                        </div>
                        <div className="text-[10px] text-slate-400">ID: #{user.id}</div>
                      </td>

                      <td className="py-3 px-4 text-slate-600">
                        <div className="flex items-center gap-1.5">
                          <Mail className="w-3.5 h-3.5 text-slate-400" />
                          <span>{user.email}</span>
                        </div>
                      </td>

                      {/* Celular / WhatsApp */}
                      <td className="py-3 px-4 text-slate-700 font-mono text-[11px]">
                        <div className="flex items-center gap-1.5">
                          <Phone className="w-3.5 h-3.5 text-emerald-600" />
                          <span>{user.phone || 'Sin teléfono'}</span>
                        </div>
                      </td>

                      {/* Rol */}
                      <td className="py-3 px-4">
                        {isUserSuperAdmin ? (
                          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-md text-[11px] font-bold bg-slate-900 text-white">
                            <ShieldCheck className="w-3 h-3 text-slate-300" />
                            <span>Super Admin</span>
                          </span>
                        ) : isUserAdmin ? (
                          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-md text-[11px] font-bold bg-indigo-50 text-indigo-800 border border-indigo-200">
                            <Building2 className="w-3 h-3 text-indigo-600" />
                            <span>Administrador</span>
                          </span>
                        ) : isUserTopo ? (
                          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-md text-[11px] font-bold bg-cyan-50 text-cyan-800 border border-cyan-200">
                            <Mountain className="w-3 h-3 text-cyan-600" />
                            <span>Topógrafo</span>
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-md text-[11px] font-bold bg-teal-50 text-teal-800 border border-teal-200">
                            <UserCheck className="w-3 h-3 text-teal-600" />
                            <span>Asesor Comercial</span>
                          </span>
                        )}
                      </td>

                      {/* Proyectos Asignados (Pivote project_user) */}
                      <td className="py-3 px-4">
                        {isUserSuperAdmin ? (
                          <span className="text-[11px] text-slate-400 italic">Acceso Global (Todos los Proyectos)</span>
                        ) : isUserAdmin ? (
                          <div className="flex flex-col gap-1.5 items-start">
                            {assignedProjects.length > 0 ? (
                              <div className="flex flex-wrap gap-1 max-w-xs">
                                {assignedProjects.map((p) => (
                                  <span
                                    key={p.id}
                                    className="text-[10px] font-bold px-2 py-0.5 rounded bg-indigo-50 text-indigo-700 border border-indigo-200"
                                  >
                                    {p.name}
                                  </span>
                                ))}
                              </div>
                            ) : (
                              <span className="text-[11px] text-amber-600 font-semibold">Sin proyectos asignados</span>
                            )}

                            {!inactive && <button
                              type="button"
                              onClick={() => handleOpenAssignProjectsModal(user)}
                              className="inline-flex items-center gap-1 text-[10px] font-bold text-indigo-700 hover:text-indigo-900 bg-indigo-50 hover:bg-indigo-100 border border-indigo-200 px-2 py-0.5 rounded transition cursor-pointer mt-0.5"
                              title="Asignar o modificar proyectos para este Administrador"
                            >
                              <Plus className="w-3 h-3" />
                              <span>+ Asignar / Cambiar Proyectos</span>
                            </button>}
                          </div>
                        ) : (
                          <span className="text-[11px] text-slate-400 italic">N/A</span>
                        )}
                      </td>

                      <td className="py-3 px-4 text-slate-500 text-[11px]">
                        {user.created_at ? new Date(user.created_at).toLocaleDateString('es-EC') : 'N/A'}
                      </td>

                      <td className="py-3 px-4 text-center">
                        <div className="flex items-center justify-center gap-1">
                          <button
                            type="button"
                            title="Editar Usuario"
                            disabled={inactive}
                            onClick={() => handleAbrirEditar(user)}
                            className="p-1.5 rounded-md text-slate-500 hover:text-slate-900 hover:bg-slate-100 transition cursor-pointer"
                          >
                            <Pencil className="w-3.5 h-3.5" />
                          </button>

                          {canResetPassword && (
                            <button
                              type="button"
                              title="Regenerar Clave"
                              aria-label={`Regenerar Clave de ${user.name}`}
                              onClick={() => setResetUser(user)}
                              className="rounded-md p-1.5 text-amber-700 transition hover:bg-amber-50"
                            >
                              <KeyRound className="h-3.5 w-3.5" />
                            </button>
                          )}
                          {inactive && (
                            <ActionButton loading={handleReactivateUserPending}
                              type="button"
                              title="Reactivar usuario"
                              onClick={() => handleReactivateUser(user)}
                              className="inline-flex min-h-[42px] items-center gap-1 rounded-md px-2 text-xs font-semibold text-emerald-700 hover:bg-emerald-50">
                              <RotateCcw className="h-3.5 w-3.5" /> Reactivar
                            </ActionButton>
                          )}
                          {!inactive && !isUserSuperAdmin && (
                            <ActionButton loading={handleEliminarUsuarioPending}
                              type="button"
                              title="Dar de baja al usuario"
                              onClick={() => handleEliminarUsuario(user)}
                              className="p-1.5 rounded-md text-slate-400 hover:text-rose-600 hover:bg-rose-50 transition cursor-pointer"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </ActionButton>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
        <Pagination pagination={pagination} perPage={perPage} onPageChange={fetchUsers} onPerPageChange={setPerPage} loading={loading} />
      </div>

      {resetUser && (
        <ResetUserPasswordDialog
          user={resetUser}
          onClose={() => setResetUser(null)}
          onSaved={() => fetchUsers(pagination.current_page)}
        />
      )}

      {/* ================= MODAL: REGISTRAR / EDITAR USUARIO ================= */}
      {isModalOpen && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center z-50 p-4 animate-fade-in">
          <div className="bg-white rounded-lg w-full max-w-lg p-5 shadow-xl border border-slate-200 transition-all max-h-[90vh] overflow-y-auto text-xs">
            {/* Cabecera del Modal */}
            <div className="flex items-center justify-between border-b border-slate-100 pb-3 mb-4">
              <div className="flex items-center gap-2">
                <KeyRound className="w-4 h-4 text-slate-700" />
                <h3 className="text-base font-bold text-slate-900">
                  {editingUser ? 'Editar Usuario y Permisos' : 'Registrar Nuevo Colaborador'}
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setIsModalOpen(false)}
                className="text-slate-400 hover:text-slate-600"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleGuardarUsuario} className="space-y-3.5">
              <div>
                <label htmlFor="usuarios-name" className="block font-bold text-slate-700 mb-1">Nombre Completo *</label>
                <input id="usuarios-name"
                  type="text"
                  name="name"
                  required
                  value={formData.name}
                  onChange={handleInputChange}
                  placeholder="Ej. Ing. Andrea Morales"
                  className="w-full px-3 py-2 rounded-md border border-slate-200 text-slate-900 font-medium focus:ring-1 focus:ring-slate-900"
                />
              </div>

              <div>
                <label htmlFor="usuarios-email" className="block font-bold text-slate-700 mb-1">Correo Electrónico *</label>
                <input id="usuarios-email"
                  type="email"
                  name="email"
                  required
                  maxLength={editingUser ? 150 : 255}
                  value={formData.email}
                  onChange={handleInputChange}
                  placeholder="Ej. admin_area1@vendeymas.com"
                  className="w-full px-3 py-2 rounded-md border border-slate-200 text-slate-900 focus:ring-1 focus:ring-slate-900"
                />
              </div>

              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="block font-bold text-slate-700">Celular / WhatsApp Oficial (Ecuador){editingUser ? '' : ' *'}</label>
                  <span className="text-[10px] text-slate-400 font-mono">10 dígitos (Ej: 0989996421)</span>
                </div>
                <input id="usuarios-phone"
                  type="tel"
                  name="phone"
                  required={!editingUser}
                  maxLength={editingUser ? 25 : 20}
                  value={formData.phone}
                  onChange={handleInputChange}
                  placeholder="0989996421"
                  className="w-full px-3 py-2 rounded-md border border-slate-200 text-slate-900 focus:ring-1 focus:ring-slate-900 font-mono"
                />
                <p className="text-[10px] text-slate-500 mt-1">
                  El sistema dirigirá automáticamente los reportes de tareas completadas y recibos a este WhatsApp.
                </p>
              </div>

              <div>
                <label htmlFor="usuarios-password" className="block font-bold text-slate-700 mb-1">
                  {editingUser ? 'Nueva Contraseña (Opcional)' : 'Contraseña de Acceso *'}
                </label>
                <input id="usuarios-password"
                  type="password"
                  name="password"
                  autoComplete="new-password"
                  required={!editingUser}
                  minLength={6}
                  value={formData.password}
                  onChange={handleInputChange}
                  placeholder={editingUser ? 'Dejar en blanco para mantener la actual' : 'Mínimo 6 caracteres'}
                  className="w-full px-3 py-2 rounded-md border border-slate-200 text-slate-900"
                />
              </div>

              {/* Selector de Rol Oficial */}
              <div>
                <label htmlFor="usuarios-official-role" className="block font-bold text-slate-700 mb-1">Rol y Nivel de Acceso *</label>
                <select id="usuarios-official-role"
                  name="role"
                  value={formData.role}
                  onChange={handleInputChange}
                  required
                  className="w-full px-3 py-2 rounded-md border border-slate-200 bg-slate-50 font-bold text-slate-900 focus:ring-1 focus:ring-slate-900 cursor-pointer"
                >
                  {ROLES.map((r) => (
                    <option key={r.value} value={r.value}>
                      {r.label}
                    </option>
                  ))}
                </select>
              </div>

              {/* Sección Condicional: Asignación de Proyectos cuando es Administrador */}
              {formData.role === 'Administrador' && (
                <div className="bg-slate-50 p-3.5 rounded-lg border border-slate-200 space-y-2">
                  <div className="flex items-center justify-between">
                    <label className="font-bold text-slate-900 flex items-center gap-1.5">
                      <Building2 className="w-3.5 h-3.5 text-indigo-600" />
                      <span>Proyectos Asignados al Administrador *</span>
                    </label>
                    <span className="text-[10px] text-slate-400">
                      {formData.project_ids.length} seleccionados
                    </span>
                  </div>
                  <p className="text-[11px] text-slate-500">
                    Marca las casillas de los proyectos a los que este Administrador tendrá acceso exclusivo:
                  </p>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 pt-1 max-h-48 overflow-y-auto">
                    {projectsList.map((p) => {
                      const isChecked = formData.project_ids.includes(p.id);
                      return (
                        <label
                          key={p.id}
                          className={`flex items-center gap-2 p-2 rounded-md border cursor-pointer transition ${
                            isChecked
                              ? 'bg-white border-slate-900 font-bold text-slate-900 shadow-xs'
                              : 'bg-white/70 border-slate-200 text-slate-600 hover:bg-white'
                          }`}
                        >
                          <input id={`usuarios-editor-project-${p.id}`} name={`usuarios_editor_project_${p.id}`}
                            type="checkbox"
                            checked={isChecked}
                            onChange={() => handleToggleProject(p.id)}
                            className="rounded border-slate-300 text-slate-900 focus:ring-slate-900"
                          />
                          <span className="truncate">{p.name}</span>
                        </label>
                      );
                    })}
                  </div>
                </div>
              )}

              <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="px-3.5 py-1.5 text-slate-600 hover:bg-slate-100 rounded-md font-medium cursor-pointer"
                >
                  Cancelar
                </button>
                <ActionButton loading={handleGuardarUsuarioPending}
                  type="submit"
                  disabled={isSubmitting}
                  className="px-4 py-2 bg-slate-900 hover:bg-slate-800 text-white font-bold rounded-md flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
                >
                  {isSubmitting && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                  <span>{editingUser ? 'Actualizar Usuario' : 'Crear Usuario'}</span>
                </ActionButton>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal Dedicado del CEO: Asignar Proyectos al Administrador con Casillas (Checkboxes) */}
      {assignProjectsModalUser && (
        <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-xs flex items-center justify-center z-50 p-4 animate-fade-in">
          <div className="bg-white rounded-lg w-full max-w-lg p-6 shadow-xl border border-slate-200">
            <div className="flex items-center justify-between border-b border-slate-200 pb-3 mb-4">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-md bg-indigo-50 border border-indigo-200 flex items-center justify-center text-indigo-700">
                  <Building2 className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-slate-900">
                    Asignación de Proyectos a Administrador
                  </h3>
                  <p className="text-xs text-slate-500">
                    Administrador: <strong className="text-slate-800">{assignProjectsModalUser.name}</strong> ({assignProjectsModalUser.email})
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setAssignProjectsModalUser(null)}
                className="p-1 rounded text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSaveUserProjects} className="space-y-4">
              <div>
                <p className="text-xs text-slate-600 mb-3">
                  Selecciona con casillas los proyectos que este Administrador tendrá a su cargo para tramitar las 12 etapas de escrituras, expedientes de clientes y recibos contables ADM:
                </p>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 max-h-60 overflow-y-auto p-1 border border-slate-200 rounded-md bg-slate-50">
                  {projectsList.map((proj) => {
                    const isChecked = assignProjectsSelectedIds.includes(proj.id);
                    return (
                      <label
                        key={proj.id}
                        className={`flex items-start gap-2.5 p-2.5 rounded-md border text-xs cursor-pointer transition select-none ${
                          isChecked
                            ? 'bg-indigo-50/80 border-indigo-300 text-indigo-950 font-semibold'
                            : 'bg-white border-slate-200 text-slate-700 hover:bg-slate-100/60'
                        }`}
                      >
                        <input id={`usuarios-assignment-project-${proj.id}`} name={`usuarios_assignment_project_${proj.id}`}
                          type="checkbox"
                          checked={isChecked}
                          onChange={() => handleToggleUserProjectCheck(proj.id)}
                          className="mt-0.5 rounded text-indigo-600 focus:ring-indigo-500"
                        />
                        <div className="min-w-0 flex-1">
                          <span className="block truncate">{proj.name || proj.nombre}</span>
                          <span className="text-[10px] text-slate-400 block truncate">{proj.location || proj.ubicacion}</span>
                        </div>
                      </label>
                    );
                  })}
                </div>
              </div>

              <div className="flex items-center justify-between pt-3 border-t border-slate-200 text-xs">
                <span className="text-slate-500 font-medium">
                  {assignProjectsSelectedIds.length} proyecto(s) seleccionado(s)
                </span>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setAssignProjectsModalUser(null)}
                    className="px-3 py-1.5 text-slate-600 hover:bg-slate-100 rounded-md font-medium cursor-pointer"
                  >
                    Cancelar
                  </button>
                  <ActionButton loading={handleSaveUserProjectsPending}
                    type="submit"
                    disabled={isSavingUserProjects}
                    className="inline-flex items-center gap-1.5 px-4 py-1.5 text-xs font-semibold text-white bg-indigo-600 hover:bg-indigo-700 rounded-md transition cursor-pointer disabled:opacity-50"
                  >
                    {isSavingUserProjects && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                    <span>{isSavingUserProjects ? 'Guardando...' : 'Guardar Asignación'}</span>
                  </ActionButton>
                </div>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
