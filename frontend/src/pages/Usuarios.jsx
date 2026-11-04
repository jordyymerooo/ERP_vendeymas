import React, { useState, useEffect } from 'react';
import axios from 'axios';
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
  const [users, setUsers] = useState([]);
  const [projectsList, setProjectsList] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [roleFilter, setRoleFilter] = useState('TODOS');

  // Estados del modal
  const [isModalOpen, setIsModalOpen] = useState(false);
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
  const fetchUsers = async () => {
    setLoading(true);
    try {
      const [usersRes, projRes] = await Promise.all([
        axios.get('/api/users'),
        axios.get('/api/projects'),
      ]);
      setUsers(usersRes.data?.data || []);
      setProjectsList(Array.isArray(projRes.data) ? projRes.data : (projRes.data?.data || []));
    } catch (err) {
      console.error('Error al cargar datos:', err);
      setToastMessage({
        type: 'error',
        text: 'Error al conectar con el servicio de usuarios.',
      });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchUsers();
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
      phone: user.phone || '0989996421',
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

  const handleSaveUserProjects = async (e) => {
    e.preventDefault();
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
      fetchUsers();
    } catch (err) {
      console.error('Error al asignar proyectos:', err);
      setToastMessage({
        type: 'error',
        text: 'No se pudieron asignar los proyectos al usuario.',
      });
    } finally {
      setIsSavingUserProjects(false);
      setTimeout(() => setToastMessage(null), 5000);
    }
  };

  // Guardar (crear o actualizar)
  const handleGuardarUsuario = async (e) => {
    e.preventDefault();
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
        phone: formData.phone?.trim() || '0989996421',
        role: formData.role,
        project_ids: formData.role === 'Administrador' ? formData.project_ids : [],
      };

      if (editingUser) {
        if (formData.password.trim()) {
          payload.password = formData.password.trim();
        }
        await axios.put(`/api/users/${editingUser.id}`, payload);
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
      fetchUsers();
    } catch (err) {
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
  };

  // Eliminar usuario
  const handleEliminarUsuario = async (user) => {
    if (user.id === 1) {
      alert('Por seguridad no es posible eliminar al Administrador Principal del sistema.');
      return;
    }

    const confirmar = window.confirm(
      `¿Estás seguro de eliminar al usuario "${user.name}" (${user.email})? Esta acción revocará todos sus accesos al sistema.`
    );
    if (!confirmar) return;

    try {
      const res = await axios.delete(`/api/users/${user.id}`);
      setToastMessage({
        type: 'success',
        text: res.data?.message || `Usuario "${user.name}" eliminado con éxito.`,
      });
      fetchUsers();
    } catch (err) {
      console.error('Error al eliminar usuario:', err);
      const msg = err.response?.data?.message || 'Error al eliminar el usuario.';
      setToastMessage({
        type: 'warning',
        text: msg,
      });
    } finally {
      setTimeout(() => setToastMessage(null), 5000);
    }
  };

  // Filtrado de usuarios
  const filteredUsers = users.filter((u) => {
    const roleName = u.roles && u.roles.length > 0 ? u.roles[0].name : 'Sin Rol';
    if (roleFilter !== 'TODOS' && roleName !== roleFilter) return false;

    if (!searchTerm.trim()) return true;
    const term = searchTerm.toLowerCase();
    return u.name.toLowerCase().includes(term) || u.email.toLowerCase().includes(term);
  });

  const superAdminsCount = users.filter((u) => u.roles?.some((r) => r.name === 'Super Admin')).length;
  const administradoresCount = users.filter((u) => u.roles?.some((r) => r.name === 'Administrador')).length;
  const asesoresCount = users.filter((u) => u.roles?.some((r) => r.name === 'Asesor Comercial')).length;
  const topografosCount = users.filter((u) => u.roles?.some((r) => r.name === 'Topógrafo')).length;

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

      {/* Barra de Búsqueda y Filtros Rápidos */}
      <div className="bg-white p-3.5 rounded-lg border border-slate-200 shadow-xs flex flex-col sm:flex-row items-center justify-between gap-3 text-xs">
        <div className="relative w-full sm:w-80">
          <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
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
              ) : filteredUsers.length === 0 ? (
                <tr>
                  <td colSpan={7} className="py-12 text-center text-slate-400">
                    <Users className="w-8 h-8 mx-auto text-slate-300 mb-2" />
                    <p className="text-xs font-semibold">No se encontraron usuarios con ese filtro.</p>
                  </td>
                </tr>
              ) : (
                filteredUsers.map((user) => {
                  const roleName = user.roles?.[0]?.name || 'Asesor Comercial';
                  const isUserSuperAdmin = roleName === 'Super Admin';
                  const isUserAdmin = roleName === 'Administrador';
                  const isUserTopo = roleName === 'Topógrafo';
                  const assignedProjects = user.assigned_projects || [];

                  return (
                    <tr key={user.id} className="hover:bg-slate-50/70 transition">
                      <td className="py-3 px-4">
                        <div className="font-bold text-slate-900 flex items-center gap-1.5">
                          <span>{user.name}</span>
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
                          <span>{user.phone || '0989996421'}</span>
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

                            <button
                              type="button"
                              onClick={() => handleOpenAssignProjectsModal(user)}
                              className="inline-flex items-center gap-1 text-[10px] font-bold text-indigo-700 hover:text-indigo-900 bg-indigo-50 hover:bg-indigo-100 border border-indigo-200 px-2 py-0.5 rounded transition cursor-pointer mt-0.5"
                              title="Asignar o modificar proyectos para este Administrador"
                            >
                              <Plus className="w-3 h-3" />
                              <span>+ Asignar / Cambiar Proyectos</span>
                            </button>
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
                            onClick={() => handleAbrirEditar(user)}
                            className="p-1.5 rounded-md text-slate-500 hover:text-slate-900 hover:bg-slate-100 transition cursor-pointer"
                          >
                            <Pencil className="w-3.5 h-3.5" />
                          </button>

                          {user.id !== 1 && (
                            <button
                              type="button"
                              title="Eliminar Usuario"
                              onClick={() => handleEliminarUsuario(user)}
                              className="p-1.5 rounded-md text-slate-400 hover:text-rose-600 hover:bg-rose-50 transition cursor-pointer"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
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
      </div>

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
                <label className="block font-bold text-slate-700 mb-1">Nombre Completo *</label>
                <input
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
                <label className="block font-bold text-slate-700 mb-1">Correo Electrónico *</label>
                <input
                  type="email"
                  name="email"
                  required
                  value={formData.email}
                  onChange={handleInputChange}
                  placeholder="Ej. admin_area1@vendeymas.com"
                  className="w-full px-3 py-2 rounded-md border border-slate-200 text-slate-900 focus:ring-1 focus:ring-slate-900"
                />
              </div>

              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="block font-bold text-slate-700">Celular / WhatsApp Oficial (Ecuador) *</label>
                  <span className="text-[10px] text-slate-400 font-mono">10 dígitos (Ej: 0989996421)</span>
                </div>
                <input
                  type="tel"
                  name="phone"
                  required
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
                <label className="block font-bold text-slate-700 mb-1">
                  {editingUser ? 'Nueva Contraseña (Opcional)' : 'Contraseña de Acceso *'}
                </label>
                <input
                  type="password"
                  name="password"
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
                <label className="block font-bold text-slate-700 mb-1">Rol y Nivel de Acceso *</label>
                <select
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
                          <input
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
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="px-4 py-2 bg-slate-900 hover:bg-slate-800 text-white font-bold rounded-md flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
                >
                  {isSubmitting && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                  <span>{editingUser ? 'Actualizar Usuario' : 'Crear Usuario'}</span>
                </button>
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
                        <input
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
                  <button
                    type="submit"
                    disabled={isSavingUserProjects}
                    className="inline-flex items-center gap-1.5 px-4 py-1.5 text-xs font-semibold text-white bg-indigo-600 hover:bg-indigo-700 rounded-md transition cursor-pointer disabled:opacity-50"
                  >
                    {isSavingUserProjects && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                    <span>{isSavingUserProjects ? 'Guardando...' : 'Guardar Asignación'}</span>
                  </button>
                </div>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
