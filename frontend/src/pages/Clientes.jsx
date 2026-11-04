import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import {
  Users,
  Search,
  Plus,
  Pencil,
  Trash2,
  X,
  Mail,
  Phone,
  Building2,
  ChevronLeft,
  ChevronRight,
  CheckCircle,
  User,
  UserCheck,
  Filter,
  Loader2,
  AlertCircle,
  CreditCard,
  Receipt,
} from 'lucide-react';

export default function Clientes() {
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

  // Hooks de Estado Requeridos
  const [clientes, setClientes] = useState([]);
  const [pagination, setPagination] = useState({});
  const [loading, setLoading] = useState(true);
  const [advisorsList, setAdvisorsList] = useState([]);
  const [selectedAdvisorId, setSelectedAdvisorId] = useState('');

  // Estados de interfaz y modal
  const [searchTerm, setSearchTerm] = useState('');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingClient, setEditingClient] = useState(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [toastMessage, setToastMessage] = useState(null);

  // Formulario de cliente (nuevo o editar)
  const [clienteForm, setClienteForm] = useState({
    name: '',
    id_card: '',
    phone: '',
    email: '',
    direccion: '',
    assigned_user_id: '',
  });

  // Cargar asesores comerciales para filtro y asignación
  const fetchAdvisors = async () => {
    try {
      const res = await axios.get('/api/leads');
      if (res.data?.advisors_list) {
        setAdvisorsList(res.data.advisors_list);
      }
    } catch (err) {
      console.error('Error al cargar lista de asesores:', err);
    }
  };

  // Petición a la API con paginación y filtros
  const fetchClientes = async (page = 1) => {
    setLoading(true);
    try {
      const params = { page };
      if (selectedAdvisorId && selectedAdvisorId !== 'all') {
        params.advisor_id = selectedAdvisorId;
      }
      if (searchTerm && searchTerm.trim()) {
        params.search = searchTerm.trim();
      }
      const res = await axios.get('/api/customers', { params });
      setClientes(res.data.data || []);
      setPagination({
        current_page: res.data.current_page,
        last_page: res.data.last_page,
        total: res.data.total,
        to: res.data.to,
        from: res.data.from,
      });
    } catch (error) {
      console.error('Error al consultar clientes:', error);
      setToastMessage({
        type: 'error',
        text: 'Error al conectar con la API de clientes.',
      });
    } finally {
      setLoading(false);
    }
  };

  // Cargar clientes y asesores al montar el componente con debounce en búsqueda
  useEffect(() => {
    const timer = setTimeout(() => {
      fetchClientes(1);
    }, 250);
    return () => clearTimeout(timer);
  }, [selectedAdvisorId, searchTerm]);

  useEffect(() => {
    fetchAdvisors();
  }, []);

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setClienteForm((prev) => ({
      ...prev,
      [name]: value,
    }));
  };

  // Abrir modal para crear nuevo cliente
  const handleAbrirNuevo = () => {
    setEditingClient(null);
    setClienteForm({
      name: '',
      id_card: '',
      phone: '',
      email: '',
      direccion: '',
      assigned_user_id: '',
    });
    setIsModalOpen(true);
  };

  // Abrir modal para editar cliente existente
  const handleAbrirEditar = (cliente) => {
    setEditingClient(cliente);
    setClienteForm({
      name: cliente.name || '',
      id_card: cliente.id_card || '',
      phone: cliente.phone || '',
      email: cliente.email || '',
      direccion: cliente.direccion || '',
      assigned_user_id: cliente.assigned_user_id ? String(cliente.assigned_user_id) : '',
    });
    setIsModalOpen(true);
  };

  // Guardar (crear o actualizar) cliente
  const handleGuardarCliente = async (e) => {
    e.preventDefault();
    if (!clienteForm.name.trim() || !clienteForm.id_card.trim()) return;

    setIsSubmitting(true);
    try {
      const payload = {
        name: clienteForm.name.trim(),
        id_card: clienteForm.id_card.trim(),
        phone: clienteForm.phone.trim() || 'Sin teléfono',
        email: clienteForm.email.trim() || 'sin.correo@example.com',
      };

      if (isSuperAdmin && clienteForm.assigned_user_id) {
        payload.assigned_user_id = Number(clienteForm.assigned_user_id);
      }

      if (editingClient) {
        // Actualización PUT
        await axios.put(`/api/customers/${editingClient.id}`, payload);
        setToastMessage({
          type: 'success',
          text: `Cliente "${payload.name}" actualizado con éxito.`,
        });
      } else {
        // Creación POST
        await axios.post('/api/customers', payload);
        setToastMessage({
          type: 'success',
          text: `Cliente "${payload.name}" registrado con éxito.`,
        });
      }

      setIsModalOpen(false);
      setEditingClient(null);
      setClienteForm({
        name: '',
        id_card: '',
        phone: '',
        email: '',
        direccion: '',
      });

      // Refrescar lista de clientes en tiempo real
      fetchClientes(pagination.current_page || 1);
    } catch (err) {
      console.error('Error al guardar cliente:', err);
      const errMsg =
        err.response?.data?.message ||
        'Error al procesar la solicitud del cliente.';
      setToastMessage({
        type: 'error',
        text: errMsg,
      });
    } finally {
      setIsSubmitting(false);
      setTimeout(() => {
        setToastMessage(null);
      }, 5000);
    }
  };

  // Eliminar cliente con validación de seguridad (lotes activos)
  const handleEliminarCliente = async (cliente) => {
    const confirmar = window.confirm(
      `¿Estás seguro de eliminar al cliente "${cliente.name}" (Cédula: ${cliente.id_card})? Esta acción no se puede deshacer.`
    );
    if (!confirmar) return;

    try {
      const res = await axios.delete(`/api/customers/${cliente.id}`);
      setToastMessage({
        type: 'success',
        text: res.data?.message || `Cliente "${cliente.name}" eliminado con éxito.`,
      });
      // Refrescar lista
      fetchClientes(pagination.current_page || 1);
    } catch (err) {
      console.error('Error al eliminar cliente:', err);
      const errorMsg =
        err.response?.data?.message ||
        'No se pudo eliminar el cliente.';
      setToastMessage({
        type: 'warning',
        text: errorMsg,
      });
    } finally {
      setTimeout(() => {
        setToastMessage(null);
      }, 6000);
    }
  };

  // Registros ya filtrados y paginados directamente desde el servidor con índices de PostgreSQL
  const filteredClientes = clientes;

  return (
    <div className="space-y-6">
      {/* Toast Notification (Éxito o Advertencia/Error) */}
      {toastMessage && (
        <div
          className={`p-4 rounded-xl flex items-center justify-between shadow-sm animate-fade-in ${
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

      {/* ================= CABECERA PRINCIPAL ================= */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white p-5 rounded-lg border border-slate-200 shadow-xs">
        <div>
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-slate-100 flex items-center justify-center text-slate-700">
              <Users className="w-5 h-5" />
            </div>
            <div>
              <h1 className="text-xl sm:text-2xl font-bold text-slate-900">
                Directorio de Clientes
              </h1>
              <p className="text-xs sm:text-sm text-slate-500 mt-0.5">
                Padrón comercial de clientes y propietarios ({pagination.total || 0} registrados)
              </p>
            </div>
          </div>
        </div>

        {/* Buscador, Filtro de Asesor y Botón Nuevo Cliente */}
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
          {/* Filtro de Asesor exclusivo para Super Admin */}
          {isSuperAdmin && (
            <div className="flex items-center gap-2 bg-slate-50 px-3 py-1.5 rounded-md border border-slate-200">
              <Filter className="w-3.5 h-3.5 text-slate-500 shrink-0" />
              <span className="text-xs font-medium text-slate-600 hidden md:inline">Asesor:</span>
              <select
                value={selectedAdvisorId}
                onChange={(e) => setSelectedAdvisorId(e.target.value)}
                className="text-xs font-semibold bg-transparent text-slate-800 focus:outline-none cursor-pointer"
              >
                <option value="">Todos los Asesores</option>
                {advisorsList.map((adv) => (
                  <option key={adv.id} value={adv.id}>
                    {adv.name}
                  </option>
                ))}
              </select>
            </div>
          )}

          <div className="relative w-full sm:w-64">
            <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Buscar por nombre, cédula o email..."
              className="w-full pl-9 pr-3 py-2 text-xs sm:text-sm rounded-md border border-slate-200 bg-slate-50 focus:bg-white focus:outline-none focus:ring-1 focus:ring-slate-900 focus:border-slate-400 transition"
            />
          </div>

          <button
            type="button"
            onClick={handleAbrirNuevo}
            className="inline-flex items-center justify-center gap-2 px-4 py-2 rounded-md font-medium text-white bg-slate-900 hover:bg-slate-800 active:bg-black transition text-sm shrink-0 cursor-pointer shadow-xs"
          >
            <Plus className="w-4 h-4" />
            <span>Nuevo Cliente</span>
          </button>
        </div>
      </div>

      {/* ================= TABLA DATAGRID A ANCHO COMPLETO ================= */}
      <div className="bg-white rounded-lg border border-slate-200 shadow-xs overflow-hidden">
        <div className="overflow-x-auto w-full">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-slate-50/80 border-b border-slate-200 text-[11px] uppercase tracking-wider font-semibold text-slate-500">
                <th className="py-3.5 px-5">Cliente</th>
                <th className="py-3.5 px-5">Identificación (Cédula)</th>
                <th className="py-3.5 px-5">Celular</th>
                <th className="py-3.5 px-5">Correo Electrónico</th>
                <th className="py-3.5 px-5">Asesor Responsable</th>
                <th className="py-3.5 px-5">Proyectos / Lotes</th>
                <th className="py-3.5 px-5 text-center">Acciones</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-sm">
              {loading ? (
                <tr>
                  <td colSpan="7" className="py-16 text-center text-slate-400">
                    <div className="flex flex-col items-center justify-center gap-2">
                      <Loader2 className="w-6 h-6 animate-spin text-slate-600" />
                      <span className="text-xs font-medium text-slate-500">
                        Cargando directorio de clientes...
                      </span>
                    </div>
                  </td>
                </tr>
              ) : filteredClientes.length === 0 ? (
                <tr>
                  <td colSpan="7" className="py-12 text-center text-slate-400 text-sm">
                    No se encontraron clientes registrados con el criterio "{searchTerm}".
                  </td>
                </tr>
              ) : (
                filteredClientes.map((cliente) => (
                  <tr
                    key={cliente.id}
                    className="hover:bg-slate-50/80 transition-colors duration-150"
                  >
                    {/* Cliente (Avatar + Nombre Real) */}
                    <td className="py-3 px-4">
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-md bg-slate-100 text-slate-700 font-bold flex items-center justify-center text-xs shrink-0 border border-slate-200">
                          {cliente.name ? cliente.name.charAt(0).toUpperCase() : 'C'}
                        </div>
                        <div>
                          <div className="font-semibold text-slate-900 text-sm">
                            {cliente.name}
                          </div>
                          <div className="text-[11px] text-slate-400 font-mono">
                            ID: #{cliente.id}
                          </div>
                        </div>
                      </div>
                    </td>

                    {/* Identificación (Cédula Real) */}
                    <td className="py-3 px-4">
                      <span className="font-mono text-xs font-semibold text-slate-700 bg-slate-100 px-2 py-0.5 rounded-md border border-slate-200">
                        {cliente.id_card}
                      </span>
                    </td>

                    {/* Celular Real */}
                    <td className="py-3 px-4 text-slate-600 font-medium text-xs">
                      <div className="flex items-center gap-1.5">
                        <Phone className="w-3.5 h-3.5 text-slate-400" />
                        <span>{cliente.phone}</span>
                      </div>
                    </td>

                    {/* Correo Electrónico Real */}
                    <td className="py-3 px-4 text-slate-600 text-xs">
                      <div className="flex items-center gap-1.5">
                        <Mail className="w-3.5 h-3.5 text-slate-400" />
                        <span className="truncate max-w-[200px]">{cliente.email}</span>
                      </div>
                    </td>

                    {/* Asesor Responsable */}
                    <td className="py-3 px-4">
                      <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-medium bg-slate-100 text-slate-800 border border-slate-200">
                        <UserCheck className="w-3.5 h-3.5 text-indigo-600 shrink-0" />
                        <span className="truncate max-w-[150px]">
                          {cliente.advisor ? cliente.advisor.name : 'Administración'}
                        </span>
                      </span>
                    </td>

                    {/* Proyectos / Lotes Relacionados */}
                    <td className="py-3 px-4">
                      {cliente.lots && cliente.lots.length > 0 ? (
                        <div className="flex flex-wrap gap-1.5">
                          {cliente.lots.map((lote) => (
                            <span
                              key={lote.id}
                              className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-xs font-medium bg-slate-100 text-slate-800 border border-slate-200"
                            >
                              <Building2 className="w-3 h-3 text-slate-600" />
                              {lote.project?.nombre || lote.project?.name || `Lote ${lote.lot_number}`}
                            </span>
                          ))}
                        </div>
                      ) : (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-xs font-medium bg-slate-50 text-slate-400 border border-slate-200">
                          Sin lotes asignados
                        </span>
                      )}
                    </td>

                    {/* Acciones: Cobrar + Editar (Lápiz) + Eliminar (Basurero) */}
                    <td className="py-3 px-4 text-center">
                      <div className="flex items-center justify-center gap-1.5">
                        {cliente.lots && cliente.lots.length > 0 && (
                          <button
                            type="button"
                            title="Ir a Cobrar"
                            onClick={() => {
                              const primerLote = cliente.lots[0];
                              const projectSlug =
                                primerLote.project?.slug ||
                                primerLote.project?.name?.toLowerCase().replace(/\s+/g, '-') ||
                                'general';
                              navigate(
                                `/proyectos/${projectSlug}/clientes/pagar?customer_id=${cliente.id}&lot_id=${primerLote.id}`
                              );
                            }}
                            className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-md font-medium text-xs text-white bg-slate-900 hover:bg-slate-800 active:bg-black transition cursor-pointer mr-0.5 shadow-xs"
                          >
                            <CreditCard className="w-3.5 h-3.5" />
                            <span>Cobrar</span>
                          </button>
                        )}

                        {/* Botón Editar (Lápiz) */}
                        <button
                          type="button"
                          title="Editar Cliente"
                          onClick={() => handleAbrirEditar(cliente)}
                          className="inline-flex items-center justify-center w-8 h-8 rounded-md text-slate-600 hover:text-slate-900 hover:bg-slate-100 transition cursor-pointer border border-slate-200"
                        >
                          <Pencil className="w-3.5 h-3.5" />
                        </button>

                        {/* Botón Eliminar (Basurero) */}
                        <button
                          type="button"
                          title="Eliminar Cliente"
                          onClick={() => handleEliminarCliente(cliente)}
                          className="inline-flex items-center justify-center w-8 h-8 rounded-md text-slate-400 hover:text-rose-600 hover:bg-rose-50 transition cursor-pointer border border-slate-200"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* ================= PIE DE TABLA (PAGINACIÓN DINÁMICA) ================= */}
        <div className="p-4 border-t border-slate-200 bg-slate-50/50 flex flex-col sm:flex-row items-center justify-between gap-3 text-xs text-slate-500">
          <div>
            Mostrando {pagination.from || 0} a {pagination.to || 0} de {pagination.total || 0} clientes
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              disabled={!pagination.current_page || pagination.current_page <= 1 || loading}
              onClick={() => fetchClientes(pagination.current_page - 1)}
              className={`inline-flex items-center gap-1 px-3 py-1.5 rounded-lg border text-xs font-semibold transition ${
                !pagination.current_page || pagination.current_page <= 1 || loading
                  ? 'border-slate-200 bg-slate-100 text-slate-400 cursor-not-allowed shadow-none'
                  : 'border-slate-200 bg-white text-slate-700 hover:bg-slate-100 hover:text-slate-900 cursor-pointer shadow-sm active:scale-95'
              }`}
            >
              <ChevronLeft className="w-3.5 h-3.5" />
              <span>Anterior</span>
            </button>
            <span className="px-2 font-medium text-slate-600">
              Página {pagination.current_page || 1} de {pagination.last_page || 1}
            </span>
            <button
              type="button"
              disabled={!pagination.current_page || pagination.current_page >= pagination.last_page || loading}
              onClick={() => fetchClientes(pagination.current_page + 1)}
              className={`inline-flex items-center gap-1 px-3 py-1.5 rounded-lg border text-xs font-semibold transition ${
                !pagination.current_page || pagination.current_page >= pagination.last_page || loading
                  ? 'border-slate-200 bg-slate-100 text-slate-400 cursor-not-allowed shadow-none'
                  : 'border-slate-200 bg-white text-slate-700 hover:bg-slate-100 hover:text-slate-900 cursor-pointer shadow-sm active:scale-95'
              }`}
            >
              <span>Siguiente</span>
              <ChevronRight className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      </div>

      {/* ================= MODAL DE REGISTRAR / EDITAR CLIENTE ================= */}
      {isModalOpen && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center z-50 p-4 animate-fade-in">
          <div className="bg-white rounded-lg w-full max-w-lg p-6 shadow-xl border border-slate-200 transition-all">
            {/* Cabecera del Modal */}
            <div className="flex items-center justify-between border-b border-slate-100 pb-4 mb-5">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-md bg-slate-100 flex items-center justify-center text-slate-700 border border-slate-200">
                  {editingClient ? <Pencil className="w-4 h-4" /> : <User className="w-4 h-4" />}
                </div>
                <h3 className="text-lg font-bold text-slate-900">
                  {editingClient ? 'Editar Cliente' : 'Registrar Nuevo Cliente'}
                </h3>
              </div>
              <button
                type="button"
                onClick={() => {
                  setIsModalOpen(false);
                  setEditingClient(null);
                }}
                className="p-1 rounded-md text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Formulario */}
            <form onSubmit={handleGuardarCliente} className="space-y-4">
              {/* Nombre Completo */}
              <div>
                <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1.5">
                  Nombre Completo *
                </label>
                <input
                  type="text"
                  name="name"
                  required
                  value={clienteForm.name}
                  onChange={handleInputChange}
                  placeholder="Ej: Laura Palacios"
                  className="w-full px-3 py-2 rounded-md border border-slate-200 bg-slate-50 focus:bg-white text-sm text-slate-900 focus:outline-none focus:ring-1 focus:ring-slate-900 focus:border-slate-400 transition"
                />
              </div>

              {/* Cédula y Celular */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1.5">
                    Identificación (Cédula) *
                  </label>
                  <input
                    type="text"
                    name="id_card"
                    required
                    value={clienteForm.id_card}
                    onChange={handleInputChange}
                    placeholder="Ej: 1309876543"
                    className="w-full px-3 py-2 rounded-md border border-slate-200 bg-slate-50 focus:bg-white text-sm text-slate-900 focus:outline-none focus:ring-1 focus:ring-slate-900 focus:border-slate-400 transition"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1.5">
                    Celular *
                  </label>
                  <input
                    type="tel"
                    name="phone"
                    required
                    value={clienteForm.phone}
                    onChange={handleInputChange}
                    placeholder="Ej: 0991234567"
                    className="w-full px-3 py-2 rounded-md border border-slate-200 bg-slate-50 focus:bg-white text-sm text-slate-900 focus:outline-none focus:ring-1 focus:ring-slate-900 focus:border-slate-400 transition"
                  />
                </div>
              </div>

              {/* Correo Electrónico */}
              <div>
                <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1.5">
                  Correo Electrónico *
                </label>
                <input
                  type="email"
                  name="email"
                  required
                  value={clienteForm.email}
                  onChange={handleInputChange}
                  placeholder="Ej: laura.palacios@email.com"
                  className="w-full px-3 py-2 rounded-md border border-slate-200 bg-slate-50 focus:bg-white text-sm text-slate-900 focus:outline-none focus:ring-1 focus:ring-slate-900 focus:border-slate-400 transition"
                />
              </div>

              {/* Dirección Domiciliaria */}
              <div>
                <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1.5">
                  Dirección
                </label>
                <input
                  type="text"
                  name="direccion"
                  value={clienteForm.direccion}
                  onChange={handleInputChange}
                  placeholder="Ej: Barrio Los Esteros, Calle 102"
                  className="w-full px-3 py-2 rounded-md border border-slate-200 bg-slate-50 focus:bg-white text-sm text-slate-900 focus:outline-none focus:ring-1 focus:ring-slate-900 focus:border-slate-400 transition"
                />
              </div>

              {/* Asesor Asignado (Visible si es Super Admin) */}
              {isSuperAdmin && advisorsList.length > 0 && (
                <div>
                  <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1.5">
                    Asesor Comercial Responsable
                  </label>
                  <select
                    name="assigned_user_id"
                    value={clienteForm.assigned_user_id}
                    onChange={handleInputChange}
                    className="w-full px-3 py-2 rounded-md border border-slate-200 bg-slate-50 focus:bg-white text-xs font-semibold text-slate-900 focus:outline-none focus:ring-1 focus:ring-slate-900 focus:border-slate-400 transition cursor-pointer"
                  >
                    <option value="">-- Asignación por Defecto (Mi Usuario) --</option>
                    {advisorsList.map((adv) => (
                      <option key={adv.id} value={adv.id}>
                        {adv.name} ({adv.email})
                      </option>
                    ))}
                  </select>
                </div>
              )}

              {/* Botones de Acción */}
              <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => {
                    setIsModalOpen(false);
                    setEditingClient(null);
                  }}
                  className="px-4 py-2 text-xs font-medium text-slate-600 hover:text-slate-800 hover:bg-slate-100 rounded-md transition cursor-pointer"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="inline-flex items-center gap-2 px-5 py-2 text-xs font-medium text-white bg-slate-900 hover:bg-slate-800 active:bg-black rounded-md shadow-xs transition cursor-pointer disabled:opacity-50"
                >
                  {isSubmitting && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                  <span>
                    {isSubmitting
                      ? 'Guardando...'
                      : editingClient
                      ? 'Actualizar Cliente'
                      : 'Guardar Cliente'}
                  </span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
