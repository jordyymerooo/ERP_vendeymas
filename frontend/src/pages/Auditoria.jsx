import React, { useState, useEffect } from 'react';
import axios from 'axios';
import {
  Activity,
  Search,
  RefreshCw,
  Shield,
  ShieldCheck,
  UserCheck,
  Smartphone,
  Monitor,
  Globe,
  Filter,
  Calendar,
  Clock,
  Layers,
  ChevronLeft,
  ChevronRight,
  Info,
  CheckCircle2,
  Copy,
  Check,
  AlertCircle,
  Eye,
  X,
  DatabaseBackup,
  Loader2,
  HardDriveDownload,
  Sparkles,
  Trash2,
  AlertTriangle,
} from 'lucide-react';

export default function Auditoria() {
  const [logs, setLogs] = useState([]);
  const [pagination, setPagination] = useState({
    current_page: 1,
    last_page: 1,
    total: 0,
    from: 0,
    to: 0,
  });
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedModule, setSelectedModule] = useState('TODOS');
  const [copiedIp, setCopiedIp] = useState(null);
  const [selectedLogDetail, setSelectedLogDetail] = useState(null);

  // Rol del usuario activo
  const [currentUserRole, setCurrentUserRole] = useState(() => localStorage.getItem('user_role') || 'Super Admin');
  const isSuperAdmin = currentUserRole === 'Super Admin';

  // Estados de Descarga de Respaldo de Base de Datos
  const [downloadingBackup, setDownloadingBackup] = useState(false);
  const [toastNotification, setToastNotification] = useState(null);

  // Estados de Simulación y Formateo a Cero
  const [simulatingData, setSimulatingData] = useState(false);
  const [resetModalOpen, setResetModalOpen] = useState(false);
  const [resetConfirmText, setResetConfirmText] = useState('');
  const [resetWithBase, setResetWithBase] = useState(true);
  const [resetSubmitting, setResetSubmitting] = useState(false);

  // Módulos disponibles para filtrar
  const modules = ['TODOS', 'Autenticación', 'Cobros', 'Clientes', 'Usuarios'];

  // Sincronizar rol si cambia en sesión
  useEffect(() => {
    const handleRoleChange = () => {
      setCurrentUserRole(localStorage.getItem('user_role') || 'Super Admin');
    };
    window.addEventListener('storage', handleRoleChange);
    window.addEventListener('roleChanged', handleRoleChange);
    return () => {
      window.removeEventListener('storage', handleRoleChange);
      window.removeEventListener('roleChanged', handleRoleChange);
    };
  }, []);

  // Cargar registros de auditoría
  const fetchLogs = async (page = 1, mod = selectedModule, search = searchTerm) => {
    setLoading(true);
    try {
      const params = { page };
      if (mod && mod !== 'TODOS') params.module = mod;
      if (search && search.trim()) params.search = search.trim();

      const res = await axios.get('/api/audit-logs', { params });
      const data = res.data;
      if (data && data.data) {
        setLogs(data.data);
        setPagination({
          current_page: data.current_page,
          last_page: data.last_page,
          total: data.total,
          from: data.from || 0,
          to: data.to || 0,
        });
      }
    } catch (err) {
      console.error('Error al obtener registros de auditoría:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchLogs(1, selectedModule, searchTerm);
  }, [selectedModule]);

  // Manejar búsqueda con enter o submit
  const handleSearchSubmit = (e) => {
    e.preventDefault();
    fetchLogs(1, selectedModule, searchTerm);
  };

  // Copiar IP al portapapeles
  const handleCopyIp = (ip) => {
    if (!ip) return;
    navigator.clipboard.writeText(ip);
    setCopiedIp(ip);
    setTimeout(() => setCopiedIp(null), 2000);
  };

  // Analizador técnico del User-Agent
  const parseUserAgent = (ua) => {
    if (!ua) {
      return {
        browser: 'Desconocido',
        os: 'Desconocido',
        isMobile: false,
        deviceLabel: 'Dispositivo genérico',
      };
    }

    let browser = 'Navegador Web';
    if (ua.includes('Edg/')) browser = 'Edge';
    else if (ua.includes('Chrome/') && !ua.includes('Edg/')) browser = 'Chrome';
    else if (ua.includes('Safari/') && !ua.includes('Chrome/')) browser = 'Safari';
    else if (ua.includes('Firefox/')) browser = 'Firefox';
    else if (ua.includes('Opera') || ua.includes('OPR/')) browser = 'Opera';

    let os = 'SO';
    let isMobile = false;
    if (/iPhone/i.test(ua)) {
      os = 'iOS (iPhone)';
      isMobile = true;
    } else if (/iPad/i.test(ua)) {
      os = 'iPadOS (iPad)';
      isMobile = true;
    } else if (/Android/i.test(ua)) {
      os = 'Android';
      isMobile = true;
    } else if (/Windows NT 10.0/i.test(ua)) {
      os = 'Windows 10/11';
    } else if (/Windows/i.test(ua)) {
      os = 'Windows';
    } else if (/Macintosh|Mac OS X/i.test(ua)) {
      os = 'macOS';
    } else if (/Linux/i.test(ua)) {
      os = 'Linux';
    }

    return {
      browser,
      os,
      isMobile,
      deviceLabel: isMobile ? 'Móvil / Tablet' : 'PC Escritorio',
    };
  };

  // Formato amigable de fecha y hora
  const formatDateTime = (dateStr) => {
    if (!dateStr) return { date: 'N/A', time: '' };
    const dateObj = new Date(dateStr);
    const date = dateObj.toLocaleDateString('es-EC', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
    });
    const time = dateObj.toLocaleTimeString('es-EC', {
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hour12: true,
    });
    return { date, time };
  };

  // Colores para etiquetas de módulos
  const getModuleBadgeStyle = (mod) => {
    switch (mod) {
      case 'Autenticación':
        return 'bg-blue-50 text-blue-700 border-blue-200/80 ring-1 ring-blue-500/20';
      case 'Cobros':
        return 'bg-emerald-50 text-emerald-700 border-emerald-200/80 ring-1 ring-emerald-500/20';
      case 'Clientes':
        return 'bg-amber-50 text-amber-700 border-amber-200/80 ring-1 ring-amber-500/20';
      case 'Usuarios':
        return 'bg-purple-50 text-purple-700 border-purple-200/80 ring-1 ring-purple-500/20';
      default:
        return 'bg-slate-50 text-slate-700 border-slate-200 ring-1 ring-slate-400/20';
    }
  };

  // Contadores por categoría calculados de los registros cargados
  const authLogsCount = logs.filter((l) => l.module === 'Autenticación').length;
  const cobrosLogsCount = logs.filter((l) => l.module === 'Cobros').length;
  const clientesLogsCount = logs.filter((l) => l.module === 'Clientes').length;

  // Manejador para Descargar Respaldo Completo de la Base de Datos (.sql)
  const handleDownloadBackup = async () => {
    setDownloadingBackup(true);
    setToastNotification(null);
    try {
      const response = await axios.get('/api/system/backup', {
        responseType: 'blob',
      });

      // Extraer nombre de archivo de la cabecera o asignar por defecto
      const disposition = response.headers['content-disposition'];
      let filename = `Respaldo_VendeYMas_${new Date().toISOString().slice(0, 10)}.sql`;
      if (disposition && disposition.indexOf('filename=') !== -1) {
        const matches = /filename[^;=\n]*=((['"]).*?\2|[^;\n]*)/.exec(disposition);
        if (matches != null && matches[1]) {
          filename = matches[1].replace(/['"]/g, '');
        }
      }

      // Crear URL de descarga y disparar en el navegador
      const blob = new Blob([response.data], { type: 'application/sql' });
      const downloadUrl = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = downloadUrl;
      link.setAttribute('download', filename);
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(downloadUrl);

      setToastNotification({
        type: 'success',
        message: `¡Respaldo completo de la base de datos descargado con éxito! Archivo: ${filename}`,
      });

      // Refrescar registros de auditoría para reflejar la acción
      fetchLogs(1, selectedModule, searchTerm);
    } catch (err) {
      console.error('Error al descargar respaldo de base de datos:', err);
      let errMsg = 'Error al generar el respaldo de la base de datos.';
      if (err.response && err.response.data instanceof Blob) {
        try {
          const text = await err.response.data.text();
          const parsed = JSON.parse(text);
          errMsg = parsed.message || errMsg;
        } catch (_) {}
      } else if (err.response?.data?.message) {
        errMsg = err.response.data.message;
      }
      setToastNotification({
        type: 'error',
        message: errMsg,
      });
    } finally {
      setDownloadingBackup(false);
      setTimeout(() => setToastNotification(null), 6000);
    }
  };

  // Manejador para Simulación Operativa Masiva (100 Clientes)
  const handleSimulateData = async () => {
    if (
      !window.confirm(
        '¿Deseas generar la simulación completa con 100 clientes, 120 lotes, 6 proyectos y ~250 recibos?\n\nEsta acción reiniciará y cargará los datos de demostración.'
      )
    ) {
      return;
    }
    setSimulatingData(true);
    setToastNotification(null);
    try {
      const res = await axios.post('/api/system/simulate');
      setToastNotification({
        type: 'success',
        message: res.data.message || '¡Simulación masiva de 100 clientes generada con éxito!',
      });
      fetchLogs(1, selectedModule, searchTerm);
    } catch (err) {
      console.error('Error al ejecutar simulación masiva:', err);
      setToastNotification({
        type: 'error',
        message: err.response?.data?.message || 'Error al ejecutar la simulación del sistema.',
      });
    } finally {
      setSimulatingData(false);
      setTimeout(() => setToastNotification(null), 7000);
    }
  };

  // Manejador para Formatear Sistema a Cero (Producción)
  const handleResetSubmit = async (e) => {
    e.preventDefault();
    if (resetConfirmText.trim() !== 'CONFIRMAR') {
      alert('Debes escribir CONFIRMAR en mayúsculas para proceder.');
      return;
    }
    setResetSubmitting(true);
    setToastNotification(null);
    try {
      const res = await axios.post('/api/system/reset', {
        confirm: 'CONFIRMAR',
        base: resetWithBase,
      });
      setResetModalOpen(false);
      setResetConfirmText('');
      setToastNotification({
        type: 'success',
        message: res.data.message || 'Sistema formateado a cero con éxito para producción.',
      });
      fetchLogs(1, selectedModule, searchTerm);
    } catch (err) {
      console.error('Error al reiniciar el sistema:', err);
      setToastNotification({
        type: 'error',
        message: err.response?.data?.message || 'Error al ejecutar el formateo del sistema.',
      });
    } finally {
      setResetSubmitting(false);
      setTimeout(() => setToastNotification(null), 7000);
    }
  };

  return (
    <div className="space-y-6 animate-fade-in w-full pb-8">
      {/* Toast Notification */}
      {toastNotification && (
        <div
          className={`p-4 rounded-xl flex items-center justify-between shadow-xs animate-fade-in border ${
            toastNotification.type === 'success'
              ? 'bg-emerald-50 border-emerald-200 text-emerald-800'
              : 'bg-rose-50 border-rose-200 text-rose-800'
          }`}
        >
          <div className="flex items-center gap-3">
            {toastNotification.type === 'success' ? (
              <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0" />
            ) : (
              <AlertCircle className="w-5 h-5 text-rose-600 shrink-0" />
            )}
            <p className="text-sm font-semibold">{toastNotification.message}</p>
          </div>
          <button
            type="button"
            onClick={() => setToastNotification(null)}
            className="text-xs font-semibold underline cursor-pointer hover:opacity-80"
          >
            Cerrar
          </button>
        </div>
      )}

      {/* ================= CABECERA PRINCIPAL ================= */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white p-5 rounded-lg border border-slate-200 shadow-xs">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-lg bg-slate-100 border border-slate-200 flex items-center justify-center text-slate-700">
            <Activity className="w-5 h-5" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="text-[11px] font-semibold text-slate-600 uppercase tracking-wider bg-slate-100 px-2 py-0.5 rounded-md border border-slate-200">
                Seguridad y Control
              </span>
            </div>
            <h1 className="text-xl sm:text-2xl font-bold text-slate-900 mt-0.5">
              Registro de Auditoría y Trazabilidad
            </h1>
          </div>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          {/* Botones Exclusivos para Super Admin */}
          {isSuperAdmin && (
            <>
              {/* Botón 1: Simulación Demo 100 Clientes */}
              <button
                type="button"
                onClick={handleSimulateData}
                disabled={simulatingData || resetSubmitting || downloadingBackup}
                className="inline-flex items-center gap-2 px-3.5 py-2 rounded-md font-bold text-white bg-emerald-600 hover:bg-emerald-500 active:bg-emerald-700 transition text-xs shrink-0 cursor-pointer shadow-xs disabled:opacity-50"
                title="Cargar simulación de volumen real con 100 clientes, 120 lotes y 250 recibos"
              >
                {simulatingData ? (
                  <Loader2 className="w-3.5 h-3.5 animate-spin text-white" />
                ) : (
                  <Sparkles className="w-3.5 h-3.5 text-emerald-200" />
                )}
                <span>{simulatingData ? 'Simulando Datos...' : 'Cargar Simulación Demo (100 Clientes)'}</span>
              </button>

              {/* Botón 2: Formatear Sistema a Cero (Producción) */}
              <button
                type="button"
                onClick={() => {
                  setResetConfirmText('');
                  setResetModalOpen(true);
                }}
                disabled={simulatingData || resetSubmitting || downloadingBackup}
                className="inline-flex items-center gap-2 px-3.5 py-2 rounded-md font-bold text-white bg-rose-600 hover:bg-rose-500 active:bg-rose-700 transition text-xs shrink-0 cursor-pointer shadow-xs disabled:opacity-50"
                title="Borrar todos los datos y dejar el sistema en cero para producción"
              >
                <Trash2 className="w-3.5 h-3.5 text-rose-200" />
                <span>Formatear Sistema a Cero (Producción)</span>
              </button>
            </>
          )}

          <button
            type="button"
            onClick={handleDownloadBackup}
            disabled={downloadingBackup || simulatingData || resetSubmitting}
            className="inline-flex items-center gap-2 px-3.5 py-2 rounded-md font-bold text-white bg-slate-900 hover:bg-slate-800 active:bg-black transition text-xs shrink-0 cursor-pointer shadow-xs disabled:opacity-50"
            title="Descargar volcado completo SQL (.sql) de la base de datos PostgreSQL"
          >
            {downloadingBackup ? (
              <Loader2 className="w-3.5 h-3.5 animate-spin text-slate-300" />
            ) : (
              <DatabaseBackup className="w-3.5 h-3.5 text-cyan-400" />
            )}
            <span>{downloadingBackup ? 'Generando Respaldo...' : 'Descargar Respaldo BD (.sql)'}</span>
          </button>

          <button
            type="button"
            onClick={() => fetchLogs(pagination.current_page, selectedModule, searchTerm)}
            disabled={loading}
            className="inline-flex items-center gap-2 px-3.5 py-2 rounded-md font-medium text-slate-700 bg-white hover:bg-slate-50 border border-slate-200 transition text-xs shrink-0 cursor-pointer shadow-xs"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin text-slate-600' : ''}`} />
            <span>Actualizar Registros</span>
          </button>
        </div>
      </div>

      {/* ================= CONTADORES ESTADÍSTICOS ================= */}
      <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
        {/* Total Eventos */}
        <div className="bg-white p-4 rounded-lg border border-slate-200 shadow-xs flex items-center justify-between">
          <div>
            <span className="text-xs font-medium text-slate-500 block mb-0.5">
              Eventos Registrados
            </span>
            <span className="text-2xl font-bold text-slate-900">{pagination.total}</span>
            <span className="text-[10px] text-slate-400 block mt-0.5">Total Registros</span>
          </div>
          <div className="w-10 h-10 rounded-md bg-slate-100 flex items-center justify-center text-slate-700 border border-slate-200">
            <Layers className="w-5 h-5" />
          </div>
        </div>

        {/* Inicios de Sesión */}
        <div className="bg-white p-4 rounded-lg border border-slate-200 shadow-xs flex items-center justify-between">
          <div>
            <span className="text-xs font-medium text-slate-700 block mb-0.5">Autenticación / Acceso</span>
            <span className="text-2xl font-bold text-slate-900">{authLogsCount}</span>
            <span className="text-[10px] text-slate-500 block mt-0.5">Accesos y seguridad</span>
          </div>
          <div className="w-10 h-10 rounded-md bg-slate-100 flex items-center justify-center text-slate-700 border border-slate-200">
            <ShieldCheck className="w-5 h-5" />
          </div>
        </div>

        {/* Cobros y Pagos */}
        <div className="bg-white p-4 rounded-lg border border-slate-200 shadow-xs flex items-center justify-between">
          <div>
            <span className="text-xs font-medium text-slate-700 block mb-0.5">Cobros & Recibos</span>
            <span className="text-2xl font-bold text-slate-900">{cobrosLogsCount}</span>
            <span className="text-[10px] text-slate-500 block mt-0.5">Emisión de pagos</span>
          </div>
          <div className="w-10 h-10 rounded-md bg-slate-100 flex items-center justify-center text-slate-700 border border-slate-200">
            <CheckCircle2 className="w-5 h-5" />
          </div>
        </div>

        {/* Clientes y CRM */}
        <div className="bg-white p-4 rounded-lg border border-slate-200 shadow-xs flex items-center justify-between">
          <div>
            <span className="text-xs font-medium text-slate-700 block mb-0.5">Clientes & Ventas</span>
            <span className="text-2xl font-bold text-slate-900">{clientesLogsCount}</span>
            <span className="text-[10px] text-slate-500 block mt-0.5">Operaciones de padrón</span>
          </div>
          <div className="w-10 h-10 rounded-md bg-slate-100 flex items-center justify-center text-slate-700 border border-slate-200">
            <UserCheck className="w-5 h-5" />
          </div>
        </div>
      </div>

      {/* ================= BARRA DE FILTROS SUPERIOR ================= */}
      <div className="bg-white p-4 rounded-lg border border-slate-200 shadow-xs flex flex-col md:flex-row items-center justify-between gap-3">
        {/* Buscador */}
        <form onSubmit={handleSearchSubmit} className="relative w-full md:w-96">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="Buscar por usuario, acción o IP..."
            className="w-full pl-9 pr-20 py-2 text-xs sm:text-sm rounded-md border border-slate-200 bg-slate-50 focus:bg-white focus:outline-none focus:ring-1 focus:ring-slate-900 focus:border-slate-400 transition"
          />
          <button
            type="submit"
            className="absolute right-1.5 top-1/2 -translate-y-1/2 px-2.5 py-1 bg-slate-900 hover:bg-slate-800 text-white rounded-md text-xs font-medium cursor-pointer transition shadow-xs"
          >
            Filtrar
          </button>
        </form>

        {/* Selector de Módulos */}
        <div className="flex items-center gap-1.5 w-full md:w-auto overflow-x-auto pb-1 md:pb-0">
          <Filter className="w-3.5 h-3.5 text-slate-400 shrink-0 mr-1 hidden sm:block" />
          {modules.map((mod) => (
            <button
              key={mod}
              type="button"
              onClick={() => setSelectedModule(mod)}
              className={`px-3 py-1.5 rounded-md text-xs font-medium transition whitespace-nowrap cursor-pointer border ${
                selectedModule === mod
                  ? 'bg-slate-900 text-white border-slate-900 shadow-xs'
                  : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50'
              }`}
            >
              {mod}
            </button>
          ))}
        </div>
      </div>

      {/* ================= TABLA DE AUDITORÍA (DATAGRID) ================= */}
      <div className="bg-white rounded-lg border border-slate-200 shadow-xs overflow-hidden">
        <div className="overflow-x-auto w-full">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-slate-50/80 border-b border-slate-200 text-[11px] uppercase tracking-wider font-semibold text-slate-500">
                <th className="py-3 px-4">Fecha y Hora</th>
                <th className="py-3 px-4">Usuario / Asesor</th>
                <th className="py-3 px-4">Módulo & Acción Realizada</th>
                <th className="py-3 px-4">Detalles (IP / Dispositivo)</th>
                <th className="py-3 px-4 text-center">Detalle</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-sm">
              {loading ? (
                <tr>
                  <td colSpan="5" className="py-16 text-center text-slate-400">
                    <div className="flex flex-col items-center justify-center gap-2">
                      <RefreshCw className="w-6 h-6 animate-spin text-slate-600" />
                      <span className="text-xs font-medium text-slate-500">
                        Cargando registros de auditoría...
                      </span>
                    </div>
                  </td>
                </tr>
              ) : logs.length === 0 ? (
                <tr>
                  <td colSpan="5" className="py-14 text-center text-slate-400">
                    <div className="flex flex-col items-center justify-center gap-2">
                      <AlertCircle className="w-8 h-8 text-slate-300" />
                      <span className="text-sm font-semibold text-slate-600">
                        No se encontraron registros de auditoría
                      </span>
                      <span className="text-xs text-slate-400">
                        Prueba con otros términos de búsqueda o selecciona otro módulo.
                      </span>
                    </div>
                  </td>
                </tr>
              ) : (
                logs.map((log) => {
                  const { date, time } = formatDateTime(log.created_at);
                  const technical = parseUserAgent(log.user_agent);
                  const userRole =
                    log.user?.roles && log.user.roles.length > 0
                      ? log.user.roles[0].name
                      : 'Asesor Comercial';
                  const isSuperAdmin = userRole === 'Super Admin';

                  return (
                    <tr
                      key={log.id}
                      className="hover:bg-slate-50/80 transition-colors duration-150 group"
                    >
                      {/* Fecha y Hora */}
                      <td className="py-4 px-5 whitespace-nowrap">
                        <div className="flex flex-col">
                          <div className="flex items-center gap-1.5 text-slate-800 font-bold text-xs">
                            <Calendar className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                            <span>{date}</span>
                          </div>
                          <div className="flex items-center gap-1.5 text-slate-500 text-[11px] mt-0.5">
                            <Clock className="w-3 h-3 text-slate-400 shrink-0" />
                            <span>{time}</span>
                          </div>
                        </div>
                      </td>

                      {/* Usuario y Rol */}
                      <td className="py-4 px-5">
                        <div className="flex items-center gap-3">
                          <div
                            className={`w-9 h-9 rounded-xl font-bold flex items-center justify-center text-xs shrink-0 shadow-xs ${
                              isSuperAdmin
                                ? 'bg-indigo-100 text-indigo-700 border border-indigo-200'
                                : 'bg-cyan-100 text-cyan-800 border border-cyan-200'
                            }`}
                          >
                            {log.user?.name ? log.user.name.charAt(0).toUpperCase() : 'U'}
                          </div>
                          <div>
                            <div className="font-bold text-slate-900 text-xs flex items-center gap-1.5">
                              <span>{log.user?.name || 'Usuario desconocido'}</span>
                              {log.user?.id === 1 && (
                                <span className="text-[9px] bg-amber-100 text-amber-800 font-extrabold px-1 rounded">
                                  Super
                                </span>
                              )}
                            </div>
                            <div className="text-[11px] text-slate-400 truncate max-w-[160px]">
                              {log.user?.email || 'Sin correo'}
                            </div>
                            <div className="mt-1">
                              {isSuperAdmin ? (
                                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-semibold bg-slate-100 text-slate-800 border border-slate-200">
                                  <Shield className="w-2.5 h-2.5 text-slate-600" />
                                  <span>Super Admin</span>
                                </span>
                              ) : (
                                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-medium bg-teal-50 text-teal-800 border border-teal-200">
                                  <UserCheck className="w-2.5 h-2.5 text-teal-600" />
                                  <span>{userRole}</span>
                                </span>
                              )}
                            </div>
                          </div>
                        </div>
                      </td>

                      {/* Módulo y Acción */}
                      <td className="py-4 px-5">
                        <div className="space-y-1.5">
                          <span
                            className={`inline-block px-2.5 py-0.5 rounded-md text-[10px] font-semibold tracking-wide border uppercase ${getModuleBadgeStyle(
                              log.module
                            )}`}
                          >
                            {log.module}
                          </span>
                          <div className="text-xs font-semibold text-slate-800 leading-snug">
                            {log.action}
                          </div>
                        </div>
                      </td>

                      {/* Detalles Técnicos: IP y Dispositivo */}
                      <td className="py-4 px-5">
                        <div className="flex flex-col gap-1.5 text-xs">
                          {/* IP */}
                          <div className="flex items-center gap-2">
                            <span className="font-mono text-[11px] font-bold text-slate-700 bg-slate-100 px-2 py-0.5 rounded-md border border-slate-200">
                              {log.ip_address || '127.0.0.1'}
                            </span>
                            <button
                              type="button"
                              onClick={() => handleCopyIp(log.ip_address)}
                              title="Copiar dirección IP"
                              className="text-slate-400 hover:text-cyan-600 p-0.5 transition cursor-pointer"
                            >
                              {copiedIp === log.ip_address ? (
                                <Check className="w-3.5 h-3.5 text-emerald-600" />
                              ) : (
                                <Copy className="w-3.5 h-3.5" />
                              )}
                            </button>
                          </div>

                          {/* Dispositivo y Navegador */}
                          <div className="flex items-center gap-1.5 text-[11px] text-slate-500">
                            {technical.isMobile ? (
                              <Smartphone className="w-3.5 h-3.5 text-amber-500 shrink-0" />
                            ) : (
                              <Monitor className="w-3.5 h-3.5 text-cyan-600 shrink-0" />
                            )}
                            <span className="font-medium text-slate-700">
                              {technical.browser} en {technical.os}
                            </span>
                          </div>
                        </div>
                      </td>

                      {/* Botón Ver Detalle Raw */}
                      <td className="py-4 px-5 text-center">
                        <button
                          type="button"
                          onClick={() => setSelectedLogDetail(log)}
                          title="Ver detalle técnico completo"
                          className="inline-flex items-center justify-center w-8 h-8 rounded-lg text-slate-400 hover:text-cyan-700 hover:bg-cyan-50 border border-transparent hover:border-cyan-200 transition cursor-pointer"
                        >
                          <Eye className="w-4 h-4" />
                        </button>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        {/* Paginación */}
        <div className="p-4 border-t border-slate-100 bg-slate-50/50 flex flex-col sm:flex-row items-center justify-between gap-3 text-xs text-slate-500">
          <div>
            Mostrando registros del <span className="font-bold text-slate-700">{pagination.from}</span> al{' '}
            <span className="font-bold text-slate-700">{pagination.to}</span> de un total de{' '}
            <span className="font-bold text-slate-700">{pagination.total}</span> eventos
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              disabled={pagination.current_page <= 1 || loading}
              onClick={() =>
                fetchLogs(pagination.current_page - 1, selectedModule, searchTerm)
              }
              className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg border border-slate-200 bg-white hover:bg-slate-100 font-semibold text-slate-700 disabled:opacity-40 disabled:cursor-not-allowed transition cursor-pointer"
            >
              <ChevronLeft className="w-3.5 h-3.5" />
              <span>Anterior</span>
            </button>

            <span className="font-bold text-slate-700 px-2">
              Página {pagination.current_page} de {pagination.last_page || 1}
            </span>

            <button
              type="button"
              disabled={pagination.current_page >= pagination.last_page || loading}
              onClick={() =>
                fetchLogs(pagination.current_page + 1, selectedModule, searchTerm)
              }
              className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg border border-slate-200 bg-white hover:bg-slate-100 font-semibold text-slate-700 disabled:opacity-40 disabled:cursor-not-allowed transition cursor-pointer"
            >
              <span>Siguiente</span>
              <ChevronRight className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      </div>

      {/* ================= MODAL DE DETALLE TÉCNICO RAW ================= */}
      {selectedLogDetail && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center z-50 p-4 animate-fade-in">
          <div className="bg-white rounded-lg w-full max-w-lg p-6 shadow-xl border border-slate-200">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3 mb-4">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-md bg-slate-100 border border-slate-200 text-slate-700 flex items-center justify-center">
                  <Info className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-slate-900">
                    Inspección de Registro
                  </h3>
                  <span className="text-[11px] text-slate-400 font-mono">ID de Log: #{selectedLogDetail.id}</span>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setSelectedLogDetail(null)}
                className="p-1 rounded-md text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-3.5 text-xs text-slate-600">
              <div className="bg-slate-50 p-3 rounded-md border border-slate-200 space-y-1.5">
                <div className="flex justify-between">
                  <span className="text-slate-400 font-medium">Módulo:</span>
                  <span className="font-semibold text-slate-800">{selectedLogDetail.module}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-400 font-medium">Acción:</span>
                  <span className="font-semibold text-slate-800">{selectedLogDetail.action}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-400 font-medium">Usuario:</span>
                  <span className="font-semibold text-slate-800">
                    {selectedLogDetail.user?.name} ({selectedLogDetail.user?.email})
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-400 font-medium">Dirección IP:</span>
                  <span className="font-mono font-semibold text-slate-800">
                    {selectedLogDetail.ip_address || 'No registrada'}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-400 font-medium">Fecha ISO:</span>
                  <span className="font-mono text-[11px] text-slate-700">
                    {selectedLogDetail.created_at}
                  </span>
                </div>
              </div>

              <div>
                <label className="block text-[11px] font-semibold text-slate-700 uppercase tracking-wider mb-1">
                  User Agent (Dispositivo y Cabecera HTTP):
                </label>
                <div className="p-3 bg-slate-900 text-slate-200 rounded-md font-mono text-[11px] leading-relaxed break-all select-all border border-slate-800">
                  {selectedLogDetail.user_agent || 'Sin información de User-Agent'}
                </div>
              </div>
            </div>

            <div className="mt-5 flex justify-end">
              <button
                type="button"
                onClick={() => setSelectedLogDetail(null)}
                className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 font-medium rounded-md text-xs transition cursor-pointer"
              >
                Cerrar Detalle
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ================= MODAL: FORMATEAR SISTEMA A CERO (PRODUCCIÓN) ================= */}
      {resetModalOpen && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-xl shadow-2xl max-w-lg w-full overflow-hidden border border-rose-200 animate-fade-in">
            {/* Cabecera */}
            <div className="p-5 bg-rose-600 text-white flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-lg bg-white/20 flex items-center justify-center text-white shrink-0">
                  <AlertTriangle className="w-5 h-5 text-white" />
                </div>
                <div>
                  <h3 className="font-bold text-base leading-tight">
                    Formatear Sistema a Cero (Producción)
                  </h3>
                  <p className="text-xs text-rose-100 mt-0.5">
                    Acción irreversible de reinicio total de base de datos
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => !resetSubmitting && setResetModalOpen(false)}
                disabled={resetSubmitting}
                className="p-1 rounded-md text-white/80 hover:text-white hover:bg-white/10 transition cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Contenido / Formulario */}
            <form onSubmit={handleResetSubmit} className="p-6 space-y-4">
              <div className="bg-rose-50 border border-rose-200 rounded-lg p-4 text-xs text-rose-900 space-y-2">
                <p className="font-bold flex items-center gap-1.5 text-rose-800">
                  <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
                  ¡ADVERTENCIA CRÍTICA DE PRODUCCIÓN!
                </p>
                <p>
                  Esta operación ejecutará un <span className="font-mono font-bold">TRUNCATE ... RESTART IDENTITY CASCADE</span> en PostgreSQL, eliminando permanentemente todos los clientes, ventas, lotes, recibos, prospectos y bitácoras forenses. Todos los correlativos de recibos volverán a iniciar en <strong>1</strong>.
                </p>
                <p>
                  Únicamente se mantendrá el usuario <strong>Super Admin (admin@vendeymas.com)</strong>.
                </p>
              </div>

              {/* Selector de modo */}
              <div className="space-y-2 pt-1">
                <label className="block text-xs font-bold text-slate-700">
                  Modo de Reinicio:
                </label>
                <div className="space-y-2">
                  <label className="flex items-start gap-3 p-3 rounded-lg border border-slate-200 hover:bg-slate-50 cursor-pointer transition">
                    <input
                      type="radio"
                      name="resetMode"
                      checked={resetWithBase}
                      onChange={() => setResetWithBase(true)}
                      className="mt-0.5 text-rose-600 focus:ring-rose-500"
                    />
                    <div>
                      <span className="text-xs font-bold text-slate-900 block">
                        Modo Estructura Base (--base) (Recomendado)
                      </span>
                      <span className="text-[11px] text-slate-500 block mt-0.5">
                        Limpia todas las ventas y clientes, pero conserva los 3 proyectos iniciales vacíos (Bosque Urbano, Guapuca, Valle Verde) y las 3 cuentas de asesores.
                      </span>
                    </div>
                  </label>

                  <label className="flex items-start gap-3 p-3 rounded-lg border border-slate-200 hover:bg-slate-50 cursor-pointer transition">
                    <input
                      type="radio"
                      name="resetMode"
                      checked={!resetWithBase}
                      onChange={() => setResetWithBase(false)}
                      className="mt-0.5 text-rose-600 focus:ring-rose-500"
                    />
                    <div>
                      <span className="text-xs font-bold text-slate-900 block">
                        Modo Cero Absoluto (Purga Total)
                      </span>
                      <span className="text-[11px] text-slate-500 block mt-0.5">
                        Elimina absolutamente todos los proyectos y asesores. El sistema queda 100% en blanco listo para crear proyectos desde cero.
                      </span>
                    </div>
                  </label>
                </div>
              </div>

              {/* Confirmación obligatoria por texto */}
              <div className="space-y-1.5 pt-2">
                <label className="block text-xs font-semibold text-slate-800">
                  Escribe <span className="font-mono font-bold text-rose-700 bg-rose-100 px-1.5 py-0.5 rounded">CONFIRMAR</span> para autorizar el formateo:
                </label>
                <input
                  type="text"
                  value={resetConfirmText}
                  onChange={(e) => setResetConfirmText(e.target.value)}
                  placeholder="Escribe CONFIRMAR"
                  disabled={resetSubmitting}
                  className="w-full px-3.5 py-2.5 rounded-lg border border-slate-300 text-sm font-mono tracking-wider focus:outline-none focus:ring-2 focus:ring-rose-500 focus:border-rose-500 transition"
                  required
                />
              </div>

              {/* Acciones */}
              <div className="pt-3 flex items-center justify-end gap-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setResetModalOpen(false)}
                  disabled={resetSubmitting}
                  className="px-4 py-2 rounded-lg text-xs font-medium text-slate-600 hover:bg-slate-100 transition cursor-pointer"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={resetConfirmText.trim() !== 'CONFIRMAR' || resetSubmitting}
                  className="inline-flex items-center gap-2 px-5 py-2.5 rounded-lg text-xs font-bold text-white bg-rose-600 hover:bg-rose-700 active:bg-rose-800 transition cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed shadow-xs"
                >
                  {resetSubmitting ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin text-white" />
                      <span>Formateando Sistema...</span>
                    </>
                  ) : (
                    <>
                      <Trash2 className="w-4 h-4 text-white" />
                      <span>Confirmar y Formatear a Cero</span>
                    </>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
