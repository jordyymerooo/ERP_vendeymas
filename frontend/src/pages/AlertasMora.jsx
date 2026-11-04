import React, { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import {
  AlertTriangle,
  Search,
  Filter,
  ArrowUpDown,
  Phone,
  Building2,
  Receipt,
  ArrowRight,
  ShieldCheck,
  ChevronLeft,
  ChevronRight,
  RefreshCw,
  Layers,
  ArrowLeft,
  DollarSign,
  User,
  CreditCard,
} from 'lucide-react';

export default function AlertasMora() {
  const navigate = useNavigate();

  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);

  // Filtros y ordenamiento
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedProject, setSelectedProject] = useState('TODOS');
  const [sortBy, setSortBy] = useState('monto_desc'); // 'monto_desc' | 'monto_asc' | 'cuotas_desc' | 'nombre_asc'

  // Paginación (12 tarjetas por página)
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 12;

  // Cargar métricas y clientes morosos
  const fetchStats = async () => {
    setLoading(true);
    try {
      const res = await axios.get('/api/dashboard/stats');
      if (res.data.success && res.data.stats) {
        setStats(res.data.stats);
      }
    } catch (err) {
      console.error('Error al cargar datos de alertas de mora:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchStats();
  }, []);

  // Lista cruda de clientes en mora
  const delinquentCustomers = stats?.delinquent_customers || [];
  const totalMoraAmount = stats?.total_mora_amount || 0;

  // Lista de proyectos disponibles para el filtro
  const projectsList = useMemo(() => {
    const set = new Set();
    delinquentCustomers.forEach((d) => {
      if (d.project_name) set.add(d.project_name);
    });
    return Array.from(set).sort();
  }, [delinquentCustomers]);

  // Filtrado y Ordenamiento en memoria (reactivo en tiempo real)
  const filteredAndSortedList = useMemo(() => {
    let result = [...delinquentCustomers];

    // 1. Filtro por Proyecto
    if (selectedProject !== 'TODOS') {
      result = result.filter((d) => d.project_name === selectedProject);
    }

    // 2. Filtro por Buscador (Nombre, Cédula o Lote)
    if (searchTerm.trim()) {
      const q = searchTerm.toLowerCase().trim();
      result = result.filter(
        (d) =>
          d.customer_name?.toLowerCase().includes(q) ||
          d.customer_id_card?.toLowerCase().includes(q) ||
          d.lot_number?.toLowerCase().includes(q) ||
          d.customer_phone?.toLowerCase().includes(q)
      );
    }

    // 3. Ordenamiento
    result.sort((a, b) => {
      if (sortBy === 'monto_desc') {
        return (Number(b.overdue_amount) || 0) - (Number(a.overdue_amount) || 0);
      }
      if (sortBy === 'monto_asc') {
        return (Number(a.overdue_amount) || 0) - (Number(b.overdue_amount) || 0);
      }
      if (sortBy === 'cuotas_desc') {
        return (Number(b.overdue_installments) || 0) - (Number(a.overdue_installments) || 0);
      }
      if (sortBy === 'nombre_asc') {
        return (a.customer_name || '').localeCompare(b.customer_name || '');
      }
      return 0;
    });

    return result;
  }, [delinquentCustomers, selectedProject, searchTerm, sortBy]);

  // Reiniciar a página 1 cuando cambia algún filtro
  useEffect(() => {
    setCurrentPage(1);
  }, [searchTerm, selectedProject, sortBy]);

  // Cálculo de Paginación
  const totalItems = filteredAndSortedList.length;
  const totalPages = Math.ceil(totalItems / itemsPerPage) || 1;
  const startIndex = (currentPage - 1) * itemsPerPage;
  const endIndex = Math.min(startIndex + itemsPerPage, totalItems);
  const currentItems = filteredAndSortedList.slice(startIndex, endIndex);

  // Suma de mora de los elementos actualmente filtrados
  const filteredMoraSum = useMemo(() => {
    return filteredAndSortedList.reduce((acc, curr) => acc + (Number(curr.overdue_amount) || 0), 0);
  }, [filteredAndSortedList]);

  return (
    <div className="space-y-6 animate-fade-in w-full pb-10">
      {/* ================= CABECERA Y RESUMEN ================= */}
      <div className="bg-white p-5 rounded-lg border border-slate-200 shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={() => navigate('/dashboard')}
            className="p-2 rounded-lg text-slate-500 hover:text-slate-900 hover:bg-slate-100 border border-slate-200 transition cursor-pointer"
            title="Volver al Centro de Mando"
          >
            <ArrowLeft className="w-4 h-4" />
          </button>

          <div className="w-10 h-10 rounded-lg bg-rose-50 border border-rose-200 text-rose-600 flex items-center justify-center shrink-0">
            <AlertTriangle className="w-5 h-5" />
          </div>

          <div>
            <div className="flex items-center gap-2">
              <span className="text-[11px] font-semibold text-rose-700 uppercase tracking-wider bg-rose-50 px-2 py-0.5 rounded-md border border-rose-200">
                Control de Cobranza & Cartera
              </span>
              <span className="text-xs font-bold text-slate-500">
                &bull; {delinquentCustomers.length} en mora
              </span>
            </div>
            <h1 className="text-xl sm:text-2xl font-bold text-slate-900 mt-0.5">
              Alertas de Mora y Cobranza Pendiente
            </h1>
          </div>
        </div>

        <div className="flex items-center gap-4 flex-wrap">
          {/* Tarjeta de Resumen Financiero Total Vencido */}
          <div className="bg-rose-50/80 border border-rose-200 px-4 py-2.5 rounded-lg flex items-center gap-3">
            <div className="w-8 h-8 rounded-md bg-rose-100 flex items-center justify-center text-rose-700">
              <DollarSign className="w-4 h-4" />
            </div>
            <div>
              <span className="text-[10px] font-bold uppercase tracking-wider text-rose-700 block">
                Total Vencido en Cartera
              </span>
              <span className="text-lg sm:text-xl font-extrabold text-rose-900">
                ${Number(totalMoraAmount).toLocaleString('en-US', { minimumFractionDigits: 2 })} USD
              </span>
            </div>
          </div>

          <button
            type="button"
            onClick={fetchStats}
            disabled={loading}
            className="inline-flex items-center gap-2 px-3.5 py-2.5 rounded-md font-medium text-slate-700 bg-white hover:bg-slate-50 border border-slate-200 transition text-xs shrink-0 cursor-pointer shadow-xs disabled:opacity-50"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin text-slate-600' : ''}`} />
            <span>Actualizar</span>
          </button>
        </div>
      </div>

      {/* ================= BARRA DE FILTROS Y BUSCADOR ================= */}
      <div className="bg-white p-4 rounded-lg border border-slate-200 shadow-xs flex flex-col sm:flex-row items-center justify-between gap-3">
        {/* Buscador en Tiempo Real */}
        <div className="relative w-full sm:w-80">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="Buscar por cliente, cédula o lote..."
            className="w-full pl-9 pr-3 py-2 text-xs rounded-md border border-slate-200 focus:outline-none focus:ring-1 focus:ring-slate-900 focus:border-slate-400 transition bg-slate-50 focus:bg-white"
          />
          {searchTerm && (
            <button
              type="button"
              onClick={() => setSearchTerm('')}
              className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 text-xs font-bold"
            >
              &times;
            </button>
          )}
        </div>

        {/* Controles de Filtro y Ordenamiento */}
        <div className="flex items-center gap-2.5 w-full sm:w-auto flex-wrap">
          {/* Selector de Proyecto */}
          <div className="flex items-center gap-1.5 text-xs text-slate-600">
            <Building2 className="w-3.5 h-3.5 text-slate-400" />
            <select
              value={selectedProject}
              onChange={(e) => setSelectedProject(e.target.value)}
              className="px-2.5 py-2 text-xs rounded-md border border-slate-200 bg-white text-slate-700 focus:outline-none focus:ring-1 focus:ring-slate-900 cursor-pointer"
            >
              <option value="TODOS">Todos los Proyectos ({delinquentCustomers.length})</option>
              {projectsList.map((p) => {
                const count = delinquentCustomers.filter((d) => d.project_name === p).length;
                return (
                  <option key={p} value={p}>
                    {p} ({count})
                  </option>
                );
              })}
            </select>
          </div>

          {/* Selector de Orden */}
          <div className="flex items-center gap-1.5 text-xs text-slate-600">
            <ArrowUpDown className="w-3.5 h-3.5 text-slate-400" />
            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value)}
              className="px-2.5 py-2 text-xs rounded-md border border-slate-200 bg-white text-slate-700 focus:outline-none focus:ring-1 focus:ring-slate-900 cursor-pointer"
            >
              <option value="monto_desc">Mayor monto vencido ($)</option>
              <option value="monto_asc">Menor monto vencido ($)</option>
              <option value="cuotas_desc">Más cuotas vencidas</option>
              <option value="nombre_asc">Nombre del cliente (A - Z)</option>
            </select>
          </div>
        </div>
      </div>

      {/* Subbarra informativa de resultados */}
      <div className="flex items-center justify-between text-xs text-slate-500 px-1">
        <div>
          Mostrando <span className="font-bold text-slate-900">{totalItems === 0 ? 0 : startIndex + 1}</span> a{' '}
          <span className="font-bold text-slate-900">{endIndex}</span> de{' '}
          <span className="font-bold text-slate-900">{totalItems}</span> casos encontrados
          {selectedProject !== 'TODOS' && <span> en <strong className="text-slate-800">{selectedProject}</strong></span>}
        </div>
        {totalItems > 0 && (
          <div className="text-right">
            Subtotal filtrado: <strong className="text-rose-700">${filteredMoraSum.toLocaleString('en-US', { minimumFractionDigits: 2 })} USD</strong>
          </div>
        )}
      </div>

      {/* ================= GRILLA DE TARJETAS (MÁXIMO 12 POR PÁGINA) ================= */}
      {loading ? (
        <div className="py-24 flex flex-col items-center justify-center gap-3 text-slate-400 bg-white rounded-lg border border-slate-200 shadow-xs">
          <RefreshCw className="w-6 h-6 animate-spin text-slate-600" />
          <p className="text-sm font-medium text-slate-600">Consultando cartera en mora...</p>
        </div>
      ) : totalItems === 0 ? (
        <div className="p-12 text-center bg-white rounded-lg border border-slate-200 shadow-xs flex flex-col items-center justify-center gap-3">
          <div className="w-12 h-12 rounded-full bg-emerald-50 text-emerald-600 flex items-center justify-center border border-emerald-200">
            <ShieldCheck className="w-6 h-6" />
          </div>
          <h3 className="text-base font-bold text-slate-900">
            {delinquentCustomers.length === 0
              ? '¡Excelente! Cartera totalmente al día'
              : 'No se encontraron clientes con los filtros aplicados'}
          </h3>
          <p className="text-xs text-slate-500 max-w-md">
            {delinquentCustomers.length === 0
              ? 'No existen cuotas vencidas en ninguno de los proyectos inmobiliarios.'
              : 'Prueba cambiando el término de búsqueda o seleccionando "Todos los Proyectos".'}
          </p>
          {(searchTerm || selectedProject !== 'TODOS') && (
            <button
              type="button"
              onClick={() => {
                setSearchTerm('');
                setSelectedProject('TODOS');
              }}
              className="mt-2 px-3.5 py-1.5 text-xs font-semibold text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-md transition cursor-pointer"
            >
              Restablecer Filtros
            </button>
          )}
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {currentItems.map((d, index) => (
            <div
              key={`${d.lot_id}-${index}`}
              className="p-4 rounded-xl border border-rose-200 bg-white hover:border-rose-300 hover:shadow-md transition duration-150 flex flex-col justify-between space-y-3.5 shadow-xs group"
            >
              <div>
                {/* Cabecera del Cliente */}
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <h4 className="font-bold text-sm text-slate-900 truncate group-hover:text-rose-900 transition-colors">
                      {d.customer_name}
                    </h4>
                    <div className="flex items-center gap-2 text-[11px] text-slate-500 mt-0.5">
                      <span className="font-mono text-[10px] bg-slate-100 px-1 rounded">
                        C.I: {d.customer_id_card || 'N/A'}
                      </span>
                      {d.customer_phone && d.customer_phone !== 'N/A' && (
                        <a
                          href={`tel:${d.customer_phone}`}
                          className="flex items-center gap-1 text-slate-600 hover:text-cyan-700 hover:underline"
                          title="Llamar al cliente"
                        >
                          <Phone className="w-3 h-3 text-cyan-600" />
                          <span>{d.customer_phone}</span>
                        </a>
                      )}
                    </div>
                  </div>

                  <span className="px-2 py-0.5 rounded-md text-[10px] font-bold uppercase bg-rose-50 text-rose-800 border border-rose-200 shrink-0">
                    {d.overdue_installments} {d.overdue_installments === 1 ? 'cuota' : 'cuotas'}
                  </span>
                </div>

                {/* Ubicación del Lote */}
                <div className="flex items-center gap-1.5 text-xs font-semibold text-slate-700 bg-slate-50 p-2.5 rounded-lg border border-slate-200/80 my-2.5">
                  <Building2 className="w-3.5 h-3.5 text-slate-500 shrink-0" />
                  <span className="truncate">{d.project_name}</span>
                  <span className="text-slate-900 font-bold">&bull; {d.lot_number}</span>
                </div>

                {/* Desglose Financiero */}
                <div className="space-y-1.5 text-xs bg-rose-50/30 p-2.5 rounded-lg border border-rose-100">
                  <div className="flex justify-between items-center text-slate-700">
                    <span className="font-semibold text-slate-600">Monto Vencido:</span>
                    <span className="font-extrabold text-rose-700 text-sm">
                      ${Number(d.overdue_amount).toLocaleString('en-US', { minimumFractionDigits: 2 })}
                    </span>
                  </div>
                  <div className="flex justify-between items-center text-[11px] text-slate-600">
                    <span>Cuota Mensual:</span>
                    <span className="font-semibold text-slate-800">
                      ${Number(d.installment_amount).toLocaleString('en-US', { minimumFractionDigits: 2 })}{' '}
                      <span className="text-slate-400 font-normal">(Día {d.payment_day})</span>
                    </span>
                  </div>
                  <div className="flex justify-between items-center text-[11px] text-slate-600">
                    <span>Total Abonado:</span>
                    <span className="font-semibold text-emerald-700">
                      ${Number(d.actual_paid).toLocaleString('en-US', { minimumFractionDigits: 2 })}
                    </span>
                  </div>
                </div>
              </div>

              {/* Botón Ir a Cobrar */}
              <div className="pt-2 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => navigate(`/proyectos/${d.project_slug}/clientes`)}
                  className="w-full py-2 px-3 rounded-lg text-xs font-bold text-white bg-rose-600 hover:bg-rose-700 active:bg-rose-800 transition flex items-center justify-center gap-1.5 cursor-pointer shadow-xs"
                >
                  <Receipt className="w-3.5 h-3.5" />
                  <span className="truncate">Ir a Cobrar a {d.customer_name.split(' ')[0]}</span>
                  <ArrowRight className="w-3.5 h-3.5 shrink-0" />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* ================= CONTROLES DE PAGINACIÓN ================= */}
      {totalPages > 1 && (
        <div className="p-4 bg-white rounded-lg border border-slate-200 shadow-xs flex flex-col sm:flex-row items-center justify-between gap-3 text-xs text-slate-500">
          <div>
            Página <strong className="text-slate-900">{currentPage}</strong> de{' '}
            <strong className="text-slate-900">{totalPages}</strong> &bull; Total: {totalItems} alertas
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              disabled={currentPage <= 1}
              onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
              className="inline-flex items-center gap-1 px-3 py-1.5 rounded-md border border-slate-200 bg-white text-slate-700 hover:bg-slate-50 disabled:opacity-40 disabled:cursor-not-allowed font-medium cursor-pointer transition shadow-xs"
            >
              <ChevronLeft className="w-3.5 h-3.5" />
              <span>Anterior</span>
            </button>

            <span className="font-bold text-slate-800 px-2">
              Página {currentPage} de {totalPages}
            </span>

            <button
              type="button"
              disabled={currentPage >= totalPages}
              onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
              className="inline-flex items-center gap-1 px-3 py-1.5 rounded-md border border-slate-200 bg-white text-slate-700 hover:bg-slate-50 disabled:opacity-40 disabled:cursor-not-allowed font-medium cursor-pointer transition shadow-xs"
            >
              <span>Siguiente</span>
              <ChevronRight className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
