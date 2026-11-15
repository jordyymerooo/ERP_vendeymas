import useSingleSubmit from '../hooks/useSingleSubmit';
import ActionButton from '../components/ActionButton';
import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import {
  Plus,
  MapPin,
  Building2,
  Loader2,
  CheckCircle,
  X,
  UserCheck,
} from 'lucide-react';

export default function Proyectos() {
  const navigate = useNavigate();

  const [proyectos, setProyectos] = useState([]);
  const initialProjectsRequested = useRef(false);
  const [loading, setLoading] = useState(true);
  const [toastMessage, setToastMessage] = useState(null);

  const [userRole, setUserRole] = useState(() => localStorage.getItem('user_role') || 'Super Admin');
  const isSuperAdmin = userRole === 'Super Admin' || userRole === 'CEO / Gerente';

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [nuevoProyecto, setNuevoProyecto] = useState({
    nombre: '',
    ubicacion: '',
    description: '',
    lot_blocks: [],
  });

  // Modal para que el CEO asigne el Administrador al proyecto
  const [assignModalOpen, setAssignModalOpen] = useState(false);
  const [selectedProjectForAssign, setSelectedProjectForAssign] = useState(null);
  const [selectedAdminId, setSelectedAdminId] = useState('');
  const [administratorsList, setAdministratorsList] = useState(null);
  const [loadingAdministrators, setLoadingAdministrators] = useState(false);
  const [savingAdmin, setSavingAdmin] = useState(false);

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

  const fetchAdministrators = async () => {
    setLoadingAdministrators(true);
    try {
      const res = await axios.get('/api/users/options');
      const users = res.data?.data || res.data || [];
      const admins = users.filter((u) => u.roles?.some((r) => r.name === 'Administrador'));
      setAdministratorsList(admins);
    } catch (err) {
      console.error('Error al cargar administradores:', err);
    } finally {
      setLoadingAdministrators(false);
    }
  };

  const fetchProyectos = async () => {
    setLoading(true);
    try {
      const res = await axios.get('/api/projects');
      const data = Array.isArray(res.data) ? res.data : (res.data.data || []);
      setProyectos(data);
    } catch (err) {
      console.error('Error al cargar proyectos:', err);
      setToastMessage('Error al consultar el catálogo de proyectos.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (initialProjectsRequested.current) return;
    initialProjectsRequested.current = true;
    fetchProyectos();
  }, []);

  const handleOpenAssignModal = (proj) => {
    setSelectedProjectForAssign(proj);
    const currentAdminId = proj.administrators?.[0]?.id || proj.assigned_users?.[0]?.id || '';
    setSelectedAdminId(currentAdminId);
    setAssignModalOpen(true);
    if (!administratorsList && !loadingAdministrators) fetchAdministrators();
  };

  const [handleSaveAssignAdmin, handleSaveAssignAdminPending] = useSingleSubmit(async (e) => {
    if (!selectedProjectForAssign || !administratorsList) return;
    setSavingAdmin(true);
    try {
      const projId = selectedProjectForAssign.id;
      await axios.post(`/api/projects/${projId}/assign-admin`, {
        admin_id: selectedAdminId ? Number(selectedAdminId) : null,
      });

      const assignedObj = administratorsList.find((a) => String(a.id) === String(selectedAdminId));
      const adminNameStr = assignedObj ? assignedObj.name : 'Sin asignar';

      setToastMessage(`Administrador "${adminNameStr}" asignado correctamente a "${selectedProjectForAssign.name || selectedProjectForAssign.nombre}".`);
      setAssignModalOpen(false);
      fetchProyectos();
    } catch (err) {
      if (err?.isDuplicateBlocked) return;
      console.error('Error al asignar administrador:', err);
      setToastMessage('No se pudo asignar el administrador al proyecto.');
    } finally {
      setSavingAdmin(false);
      setTimeout(() => setToastMessage(null), 5000);
    }
  }, { form: true });

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setNuevoProyecto((prev) => ({
      ...prev,
      [name]: value,
    }));
  };

  const [handleGuardarProyecto, handleGuardarProyectoPending] = useSingleSubmit(async (e) => {
    if (!nuevoProyecto.nombre.trim()) return;

    setIsSubmitting(true);
    try {
      await axios.post('/api/projects', {
        nombre: nuevoProyecto.nombre.trim(),
        ubicacion: nuevoProyecto.ubicacion.trim() || 'Vía Principal',
        description: nuevoProyecto.description,
        lot_blocks: nuevoProyecto.lot_blocks,
        estado: 'En Desarrollo',
      });

      setToastMessage(`Proyecto "${nuevoProyecto.nombre}" registrado exitosamente.`);
      setNuevoProyecto({ nombre: '', ubicacion: '', description: '', lot_blocks: [] });
      setIsModalOpen(false);
      fetchProyectos();
    } catch (err) {
      if (err?.isDuplicateBlocked) return;
      console.error('Error al registrar proyecto:', err);
      setToastMessage(Object.values(err.response?.data?.errors || {}).flat()[0] || 'No se pudo registrar el nuevo proyecto.');
    } finally {
      setIsSubmitting(false);
      setTimeout(() => {
        setToastMessage(null);
      }, 5000);
    }
  }, { form: true });

  return (
    <div className="space-y-6">
      {/* Notificación Toast */}
      {toastMessage && (
        <div className="bg-emerald-50 border border-emerald-200 text-emerald-800 p-3.5 rounded-lg flex items-center justify-between shadow-xs animate-fade-in">
          <div className="flex items-center gap-2.5">
            <CheckCircle className="w-4 h-4 text-emerald-600 shrink-0" />
            <p className="text-xs font-semibold">{toastMessage}</p>
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

      {/* Cabecera Ejecutiva Formal */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-200 pb-4">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold text-slate-900 tracking-tight">
            Portafolio de Proyectos
          </h1>
          <p className="text-xs sm:text-sm text-slate-500 mt-0.5">
            Administración de lotizaciones e inventario comercial
          </p>
        </div>

        <button
          type="button"
          onClick={() => setIsModalOpen(true)}
          className="inline-flex items-center justify-center gap-1.5 px-4 py-2 rounded-md font-semibold text-white bg-slate-900 hover:bg-slate-800 active:bg-black transition text-xs cursor-pointer shadow-xs"
        >
          <Plus className="w-4 h-4" />
          <span>Nuevo Proyecto</span>
        </button>
      </div>

      {/* Contenido Principal */}
      {loading ? (
        <div className="py-24 flex flex-col items-center justify-center text-slate-400 gap-3">
          <Loader2 className="w-7 h-7 animate-spin text-slate-600" />
          <p className="text-xs font-medium text-slate-500">Cargando portafolio de proyectos...</p>
        </div>
      ) : proyectos.length === 0 ? (
        <div className="py-16 text-center text-slate-400 bg-white rounded-lg border border-slate-200 text-xs">
          No hay proyectos registrados en el inventario actual.
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          {proyectos.map((proyecto) => {
            const nombre = proyecto.nombre || proyecto.name || 'Sin Nombre';
            const ubicacion = proyecto.ubicacion || proyecto.location || 'Sin Ubicación';
            const totalLotes = Number(proyecto.lotesTotales ?? proyecto.lots_count ?? 0);
            const vendLotes = Number(proyecto.lotesVendidos ?? proyecto.sold_lots_count ?? 0);
            const dispLotes = Number(proyecto.available_lots_count ?? Math.max(0, totalLotes - vendLotes));
            const porcentaje = totalLotes > 0 ? Math.round((vendLotes / totalLotes) * 100) : 0;
            const slug = nombre.toLowerCase().replace(/\s+/g, '-');

            // Cálculo dinámico riguroso del estado
            let badgeLabel = 'Comercialización Activa';
            let badgeStyle = 'bg-emerald-50 text-emerald-800 border-emerald-200';
            if (totalLotes > 0 && vendLotes === totalLotes) {
              badgeLabel = '100% Vendido';
              badgeStyle = 'bg-slate-100 text-slate-700 border-slate-300';
            } else if (totalLotes === 0) {
              badgeLabel = 'Sin Lotes';
              badgeStyle = 'bg-amber-50 text-amber-800 border-amber-200';
            }

            return (
              /* Tarjeta Ejecutiva de Proyecto Formal */
              <div
                key={proyecto.id}
                className="bg-white border border-slate-200 rounded-lg p-5 hover:border-slate-300 transition-all flex flex-col justify-between shadow-xs"
              >
                <div>
                  {/* Fila Superior: Nombre, Ubicación y Badge */}
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <h2 className="text-lg font-semibold text-slate-900 truncate tracking-tight">
                        {nombre}
                      </h2>
                      <div className="flex items-center gap-1 text-slate-500 text-xs mt-0.5">
                        <MapPin className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                        <span className="truncate">{ubicacion}</span>
                      </div>
                    </div>

                    <span
                      className={`inline-block px-2.5 py-0.5 rounded text-[11px] font-semibold border whitespace-nowrap shrink-0 ${badgeStyle}`}
                    >
                      {badgeLabel}
                    </span>
                  </div>

                  {/* Bloque Central: Métricas de Inventario en Cuadrícula Interna */}
                  <div className="grid grid-cols-3 gap-2 bg-slate-50 p-3 rounded-md border border-slate-100 my-4 text-center">
                    <div>
                      <span className="text-[10px] uppercase font-bold text-slate-400 block tracking-wider">
                        Total
                      </span>
                      <span className="text-base font-bold text-slate-900 mt-0.5 block">
                        {totalLotes}
                      </span>
                    </div>

                    <div className="border-x border-slate-200">
                      <span className="text-[10px] uppercase font-bold text-slate-400 block tracking-wider">
                        Disponibles
                      </span>
                      <span className="text-base font-bold text-emerald-700 mt-0.5 block">
                        {dispLotes}
                      </span>
                    </div>

                    <div>
                      <span className="text-[10px] uppercase font-bold text-slate-400 block tracking-wider">
                        Vendidos
                      </span>
                      <span className="text-base font-bold text-slate-800 mt-0.5 block">
                        {vendLotes}
                      </span>
                    </div>
                  </div>

                  {/* Barra Delgada de Ocupación con Porcentaje */}
                  <div className="space-y-1.5 mb-2">
                    <div className="flex justify-between items-center text-xs">
                      <span className="text-[11px] font-medium text-slate-500">
                        Ocupación del Proyecto
                      </span>
                      <span className="font-bold text-slate-800 text-xs">
                        {porcentaje}%
                      </span>
                    </div>
                    <div className="w-full bg-slate-100 rounded-sm h-1.5 overflow-hidden">
                      <div
                        className="bg-slate-900 h-1.5 rounded-sm transition-all duration-300"
                        style={{ width: `${Math.min(porcentaje, 100)}%` }}
                      />
                    </div>
                  </div>

                  {/* Administrador a cargo y Botón Asignar del CEO */}
                  {(() => {
                    const adminName = (proyecto.administrators && proyecto.administrators.length > 0)
                      ? proyecto.administrators.map((a) => a.name).join(', ')
                      : (proyecto.assigned_users && proyecto.assigned_users.length > 0
                          ? proyecto.assigned_users.map((a) => a.name).join(', ')
                          : 'Sin asignar');

                    return (
                      <div className="p-2 bg-slate-50 border border-slate-200/90 rounded-md my-2.5 flex items-center justify-between gap-1.5">
                        <div className="flex items-center gap-1.5 min-w-0">
                          <Building2 className="w-3.5 h-3.5 text-indigo-600 shrink-0" />
                          <span className="text-[11px] font-medium text-slate-500 shrink-0">Administrador:</span>
                          <span className="text-[11px] font-bold text-slate-800 truncate" title={adminName}>
                            {adminName}
                          </span>
                        </div>

                        {isSuperAdmin && (
                          <button
                            type="button"
                            onClick={() => handleOpenAssignModal(proyecto)}
                            className="inline-flex items-center gap-1 text-[11px] font-bold text-indigo-700 hover:text-indigo-900 bg-indigo-50 hover:bg-indigo-100 border border-indigo-200 px-2 py-0.5 rounded transition cursor-pointer shrink-0"
                            title="Asignar Administrador a este proyecto"
                          >
                            <UserCheck className="w-3.5 h-3.5" />
                            <span>Asignar</span>
                          </button>
                        )}
                      </div>
                    );
                  })()}
                </div>

                {/* Pie de Tarjeta: Dos Botones Formales */}
                <div className="grid grid-cols-2 gap-2 pt-3 border-t border-slate-100 mt-2">
                  <button
                    type="button"
                    onClick={() => navigate('/proyectos/' + slug + '/lotes')}
                    className="rounded-md text-xs font-medium py-2 border border-slate-300 text-slate-700 hover:bg-slate-50 transition text-center cursor-pointer"
                  >
                    Inventario de Lotes
                  </button>

                  <button
                    type="button"
                    onClick={() => navigate('/proyectos/' + slug + '/clientes')}
                    className="rounded-md text-xs font-medium py-2 bg-slate-900 text-white hover:bg-slate-800 transition text-center cursor-pointer"
                  >
                    Gestión de Cobros
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Modal para Crear Proyecto Formal */}
      {isModalOpen && (
        <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-xs flex items-center justify-center z-50 p-4 animate-fade-in">
          <div className="bg-white rounded-lg w-full max-w-2xl max-h-[92dvh] overflow-y-auto p-4 sm:p-6 shadow-xl border border-slate-200 transition-all">
            <div className="flex items-center justify-between border-b border-slate-200 pb-3 mb-4">
              <div className="flex items-center gap-2">
                <Building2 className="w-5 h-5 text-slate-800" />
                <h3 className="text-base font-bold text-slate-900">
                  Registrar Nuevo Proyecto
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setIsModalOpen(false)}
                className="p-1 rounded text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleGuardarProyecto} className="space-y-3.5">
              <div>
                <label htmlFor="new-project-name" className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1">
                  Nombre de la Lotización *
                </label>
                <input
                  type="text"
                  id="new-project-name"
                  name="nombre"
                  required
                  placeholder="Ej: Residencial Guapuca"
                  value={nuevoProyecto.nombre}
                  onChange={handleInputChange}
                  className="w-full px-3 py-2 rounded-md border border-slate-300 bg-white text-xs sm:text-sm text-slate-900 focus:outline-none focus:ring-1 focus:ring-slate-900 focus:border-slate-900 transition"
                />
              </div>

              <div>
                <label htmlFor="new-project-location" className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1">
                  Ubicación / Sector *
                </label>
                <input
                  type="text"
                  id="new-project-location"
                  name="ubicacion"
                  required
                  placeholder="Ej: Vía Principal Km 12"
                  value={nuevoProyecto.ubicacion}
                  onChange={handleInputChange}
                  className="w-full px-3 py-2 rounded-md border border-slate-300 bg-white text-xs sm:text-sm text-slate-900 focus:outline-none focus:ring-1 focus:ring-slate-900 focus:border-slate-900 transition"
                />
              </div>

              <label className="block text-sm font-semibold text-slate-700">
                Descripción (opcional)
                <textarea id="new-project-description" name="description" maxLength={5000} value={nuevoProyecto.description} onChange={handleInputChange} className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 font-normal" />
              </label>

              <fieldset className="space-y-3 rounded-lg border border-slate-200 p-3">
                <legend className="px-1 text-sm font-bold">Grupos de Lotes</legend>
                {nuevoProyecto.lot_blocks.map((block, index) => (
                  <div key={index} className="grid grid-cols-1 items-end gap-2 rounded-lg bg-slate-50 p-3 sm:grid-cols-[1fr_1fr_1fr_auto]">
                    {[
                      { name: 'quantity', label: 'Cantidad de Lotes', min: 1, max: 500, step: 1 },
                      { name: 'area', label: 'Área (m²)', min: 0.01, max: 99999999.99, step: 0.01 },
                      { name: 'price', label: 'Precio ($ USD)', min: 0.01, max: 9999999999.99, step: 0.01 },
                    ].map(({ name, label, ...limits }) => (
                      <label key={name} className="min-w-0 text-xs font-semibold">
                        {label}
                        <input id={`project-group-${index + 1}-${name}`} name={`lot_blocks[${index}][${name}]`} type="number" required {...limits} value={block[name]} onChange={(event) => {
                          const value = event.target.value;
                          setNuevoProyecto((current) => ({
                            ...current,
                            lot_blocks: current.lot_blocks.map((row, i) => i === index ? { ...row, [name]: value } : row),
                          }));
                        }} className="mt-1 w-full rounded-md border border-slate-300 px-2 py-2 text-base font-normal" />
                      </label>
                    ))}
                    <button type="button" aria-label={`Quitar grupo ${index + 1}`} onClick={() => setNuevoProyecto((current) => ({
                      ...current, lot_blocks: current.lot_blocks.filter((_, i) => i !== index),
                    }))} className="rounded-md px-2 py-2 text-xs font-semibold text-rose-700 hover:bg-rose-50">Quitar</button>
                  </div>
                ))}
                <button type="button" onClick={() => setNuevoProyecto((current) => ({
                  ...current, lot_blocks: [...current.lot_blocks, { quantity: '', area: '', price: '' }],
                }))} className="min-h-[42px] rounded-md border border-slate-300 px-3 text-sm font-semibold">
                  + Agregar Grupo de Lotes
                </button>
                <p className="text-sm text-slate-600" aria-live="polite">
                  Total a generar: {nuevoProyecto.lot_blocks.reduce((sum, row) => sum + (Number(row.quantity) || 0), 0)} lotes distribuidos en {nuevoProyecto.lot_blocks.length} grupos
                </p>
              </fieldset>

              <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-200">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="px-3 py-1.5 text-xs font-medium text-slate-600 hover:text-slate-800 hover:bg-slate-100 rounded-md transition cursor-pointer"
                >
                  Cancelar
                </button>
                <ActionButton loading={handleGuardarProyectoPending}
                  type="submit"
                  disabled={isSubmitting}
                  className="inline-flex items-center gap-1.5 px-4 py-1.5 text-xs font-semibold text-white bg-slate-900 hover:bg-slate-800 rounded-md transition cursor-pointer disabled:opacity-50"
                >
                  {isSubmitting && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                  <span>{isSubmitting ? 'Guardando...' : 'Guardar Proyecto'}</span>
                </ActionButton>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal del CEO para Asignar Administrador al Proyecto */}
      {assignModalOpen && selectedProjectForAssign && (
        <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-xs flex items-center justify-center z-50 p-4 animate-fade-in">
          <div className="bg-white rounded-lg w-full max-w-md p-6 shadow-xl border border-slate-200">
            <div className="flex items-center justify-between border-b border-slate-200 pb-3 mb-4">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-md bg-indigo-50 border border-indigo-200 flex items-center justify-center text-indigo-700">
                  <UserCheck className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-slate-900">
                    Asignar Administrador
                  </h3>
                  <p className="text-xs text-slate-500">
                    Proyecto: <strong className="text-slate-800">{selectedProjectForAssign.name || selectedProjectForAssign.nombre}</strong>
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setAssignModalOpen(false)}
                className="p-1 rounded text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSaveAssignAdmin} className="space-y-4">
              <div>
                <label htmlFor="project-assigned-admin" className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1.5">
                  Seleccionar Administrador Responsable
                </label>
                <select
                  id="project-assigned-admin"
                  name="admin_id"
                  disabled={loadingAdministrators || !administratorsList}
                  value={selectedAdminId}
                  onChange={(e) => setSelectedAdminId(e.target.value)}
                  className="w-full px-3 py-2 rounded-md border border-slate-300 bg-white text-xs text-slate-900 focus:outline-none focus:ring-1 focus:ring-indigo-600 focus:border-indigo-600 transition"
                >
                  <option value="">{loadingAdministrators ? 'Cargando administradores…' : 'Sin administrador asignado'}</option>
                  {administratorsList?.map((adm) => (
                    <option key={adm.id} value={adm.id}>
                      {adm.name} ({adm.email})
                    </option>
                  ))}
                </select>
                {!loadingAdministrators && !administratorsList && (
                  <button type="button" onClick={fetchAdministrators} className="mt-2 text-xs font-semibold text-indigo-700 underline">
                    Reintentar carga de administradores
                  </button>
                )}
                <p className="text-[11px] text-slate-500 mt-1.5">
                  Al asignar este proyecto, el Administrador tendrá acceso exclusivo para gestionar las 12 etapas de escrituras, lotes y recibos correspondientes.
                </p>
              </div>

              <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-200">
                <button
                  type="button"
                  onClick={() => setAssignModalOpen(false)}
                  className="px-3 py-1.5 text-xs font-medium text-slate-600 hover:text-slate-800 hover:bg-slate-100 rounded-md transition cursor-pointer"
                >
                  Cancelar
                </button>
                <ActionButton loading={handleSaveAssignAdminPending}
                  type="submit"
                  disabled={savingAdmin || !administratorsList}
                  className="inline-flex items-center gap-1.5 px-4 py-1.5 text-xs font-semibold text-white bg-indigo-600 hover:bg-indigo-700 rounded-md transition cursor-pointer disabled:opacity-50"
                >
                  {savingAdmin && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                  <span>{savingAdmin ? 'Guardando...' : 'Guardar en 1 Clic'}</span>
                </ActionButton>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
