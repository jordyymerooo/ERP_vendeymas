import useSingleSubmit from '../hooks/useSingleSubmit';
import ActionButton from '../components/ActionButton';
import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import {
  Layers,
  CheckCircle2,
  Receipt,
  TrendingUp,
  MapPin,
  Clock,
  DollarSign,
  ArrowRight,
  Building2,
  Loader2,
  CreditCard,
  PieChart,
  AlertTriangle,
  ShieldCheck,
  ChevronRight,
  Users,
  DatabaseBackup,
} from 'lucide-react';

export default function Dashboard() {
  const navigate = useNavigate();

  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);
  const [downloadingBackup, setDownloadingBackup] = useState(false);
  const initialStatsRequested = useRef(false);

  const [downloadBackup, downloadBackupPending] = useSingleSubmit(async () => {
    setDownloadingBackup(true);
    try {
      const response = await axios.get('/api/system/backup', { responseType: 'blob' });
      const disposition = response.headers['content-disposition'] || '';
      const filenameMatch = disposition.match(/filename="?([^";]+)"?/i);
      const filename = filenameMatch?.[1] || `Respaldo_VendeYMas_${new Date().toISOString().slice(0, 10)}.zip`;
      const url = window.URL.createObjectURL(response.data);
      const link = document.createElement('a');
      link.href = url;
      link.download = filename;
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(url);
    } catch (error) {
      if (error?.isDuplicateBlocked) return;
      console.error('Error al descargar el respaldo:', error);
      alert(error.response?.data?.message || 'No se pudo descargar el respaldo disponible.');
    } finally {
      setDownloadingBackup(false);
    }
  });

  const fetchStats = async () => {
    setLoading(true);
    try {
      const res = await axios.get('/api/dashboard/stats');
      if (res.data.success && res.data.stats) {
        setStats(res.data.stats);
      }
    } catch (err) {
      console.error('Error al cargar métricas del Centro de Mando:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (initialStatsRequested.current) return;
    initialStatsRequested.current = true;
    fetchStats();
  }, []);

  const totalLots = stats?.total_lots || 0;
  const availableLots = stats?.available_lots || 0;
  const soldLots = stats?.sold_lots || 0;
  const availablePercent = totalLots > 0 ? Math.round((availableLots / totalLots) * 100) : 0;
  const soldPercent = totalLots > 0 ? Math.round((soldLots / totalLots) * 100) : 0;
  const delinquentCount = stats?.delinquent_count ?? 0;
  const totalMoraAmount = stats?.total_mora_amount || 0;

  // ==============================================================
  // 1. TARJETAS SUPERIORES DE KPIS FINANCIEROS Y DE INVENTARIO
  // ==============================================================
  const kpiCards = [
    {
      title: 'Recaudación Total',
      value: `$${Number(stats?.total_collected_all_time || 0).toLocaleString('en-US', { minimumFractionDigits: 2 })}`,
      unit: 'USD cobrados en caja',
      description: `${stats?.total_receipts_all_time || 0} recibos cobrados`,
      trend: 'Recaudación Histórica',
      icon: DollarSign,
      color: 'emerald',
      badgeBg: 'bg-emerald-50 text-emerald-700 border-emerald-200',
      iconBg: 'bg-emerald-50 text-emerald-600',
    },
    {
      title: 'Saldo por Cobrar',
      value: `$${Number(stats?.total_debt_pending || 0).toLocaleString('en-US', { minimumFractionDigits: 2 })}`,
      unit: 'USD por amortizar',
      description: 'Diferencia de lotes vendidos vs abonos',
      trend: 'Por Cobrar',
      icon: TrendingUp,
      color: 'amber',
      badgeBg: 'bg-amber-50 text-amber-700 border-amber-200',
      iconBg: 'bg-amber-50 text-amber-600',
    },
    {
      title: 'Total Lotes',
      value: `${totalLots}`,
      unit: 'lotes en 6 proyectos',
      description: `${availableLots} libres (${availablePercent}%) &bull; ${soldLots} vendidos (${soldPercent}%)`,
      trend: 'Inventario General',
      icon: Layers,
      color: 'cyan',
      badgeBg: 'bg-cyan-50 text-cyan-700 border-cyan-200',
      iconBg: 'bg-cyan-50 text-cyan-600',
    },
    {
      title: 'Recibos Emitidos',
      value: `${stats?.total_receipts_all_time || 0}`,
      unit: 'comprobantes contables',
      description: `${stats?.receipts_month_count || 0} emitidos en el mes en curso`,
      trend: 'Talonario Activo',
      icon: Receipt,
      color: 'violet',
      badgeBg: 'bg-violet-50 text-violet-700 border-violet-200',
      iconBg: 'bg-violet-50 text-violet-600',
    },
  ];

  return (
    <div className="space-y-6 animate-fade-in w-full pb-10">
      {/* Encabezado del Dashboard */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 tracking-tight">
            Centro de Mando & Control Financiero
          </h1>
          <p className="text-sm text-slate-500 mt-1">
            Resumen ejecutivo del inventario comercial, recaudación y control de cartera.
          </p>
        </div>

        <div className="flex items-center gap-3">
          {(localStorage.getItem('user_role') || '').toLowerCase().includes('super') && (
            <ActionButton loading={downloadBackupPending}
              type="button"
              onClick={downloadBackup}
              disabled={downloadingBackup}
              className="inline-flex items-center gap-2 px-4 py-2 rounded-md text-xs font-bold text-white bg-slate-900 hover:bg-slate-800 disabled:opacity-60"
            >
              {downloadingBackup ? <Loader2 className="w-4 h-4 animate-spin" /> : <DatabaseBackup className="w-4 h-4" />}
              <span>📥 Descargar Respaldo del Día</span>
            </ActionButton>
          )}
          <div className="flex items-center gap-2 text-xs font-medium text-slate-600 bg-white px-3 py-1.5 rounded-md border border-slate-200 shadow-xs">
            <Clock className="w-3.5 h-3.5 text-slate-500" />
            <span>Sistema Actualizado en Vivo</span>
          </div>
        </div>
      </div>

      {loading ? (
        <div className="py-24 flex flex-col items-center justify-center gap-3 text-slate-400 bg-white rounded-lg border border-slate-200 shadow-xs">
          <Loader2 className="w-7 h-7 animate-spin text-slate-600" />
          <p className="text-sm font-medium text-slate-600">Cargando indicadores financieros...</p>
        </div>
      ) : (
        <>
          {/* ============================================================== */}
          {/* 1. TARJETAS SUPERIORES DE KPIS (4 Indicadores Financieros)     */}
          {/* ============================================================== */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {kpiCards.map((item, index) => {
              const Icon = item.icon;
              return (
                <div
                  key={index}
                  className="bg-white rounded-lg border border-slate-200 p-5 shadow-xs hover:border-slate-300 transition-all flex flex-col justify-between"
                >
                  <div>
                    <div className="flex items-center justify-between mb-3">
                      <span className="text-xs font-semibold uppercase tracking-wider text-slate-500">
                        {item.title}
                      </span>
                      <div className={`w-9 h-9 rounded-md flex items-center justify-center ${item.iconBg}`}>
                        <Icon className="w-4 h-4" />
                      </div>
                    </div>

                    <div className="mb-2">
                      <span className="text-2xl font-bold text-slate-900 tracking-tight block">
                        {item.value}
                      </span>
                      <span className="text-xs font-medium text-slate-400">
                        {item.unit}
                      </span>
                    </div>
                  </div>

                  <div className="flex items-center justify-between pt-3 border-t border-slate-100 mt-2">
                    <span
                      className="text-xs text-slate-500 truncate mr-2"
                      dangerouslySetInnerHTML={{ __html: item.description }}
                    />
                    <span className={`inline-flex items-center gap-1 text-[11px] font-semibold px-2 py-0.5 rounded-md border shrink-0 ${item.badgeBg}`}>
                      {item.trend}
                    </span>
                  </div>
                </div>
              );
            })}
          </div>

          {/* ============================================================== */}
          {/* 2. BANNER / TARJETA COMPACTA DE ALERTA DE MORA                */}
          {/* ============================================================== */}
          {delinquentCount > 0 ? (
            <div className="bg-red-50/70 border border-red-200 rounded-lg p-4 flex flex-col sm:flex-row items-center justify-between gap-4 shadow-xs">
              <div className="flex items-center gap-3.5">
                <div className="w-10 h-10 rounded-lg bg-red-100 border border-red-200 flex items-center justify-center text-red-600 shrink-0">
                  <AlertTriangle className="w-5 h-5" />
                </div>
                <div>
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-[11px] font-bold text-red-700 uppercase tracking-wider bg-red-100 px-2 py-0.5 rounded border border-red-200">
                      Atención Requerida
                    </span>
                    <span className="text-xs font-semibold text-slate-800">
                      Existen <strong className="text-red-700 font-bold">{delinquentCount} clientes</strong> con cuotas vencidas en cartera
                    </span>
                  </div>
                  <p className="text-xs text-slate-600 mt-1">
                    Monto total acumulado en mora:{' '}
                    <strong className="text-red-700 text-sm font-extrabold">
                      ${Number(totalMoraAmount).toLocaleString('en-US', { minimumFractionDigits: 2 })} USD
                    </strong>
                  </p>
                </div>
              </div>

              <button
                type="button"
                onClick={() => navigate('/alertas-mora')}
                className="inline-flex items-center gap-2 px-4 py-2.5 rounded-lg text-xs font-bold text-white bg-red-600 hover:bg-red-700 active:bg-red-800 transition cursor-pointer shadow-xs shrink-0 w-full sm:w-auto justify-center"
              >
                <span>Ver y Gestionar Alertas de Mora ({delinquentCount})</span>
                <ArrowRight className="w-4 h-4" />
              </button>
            </div>
          ) : (
            <div className="bg-emerald-50/70 border border-emerald-200 rounded-lg p-4 flex items-center justify-between gap-4 shadow-xs">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-lg bg-emerald-100 text-emerald-700 flex items-center justify-center shrink-0">
                  <ShieldCheck className="w-5 h-5" />
                </div>
                <div>
                  <h4 className="text-xs font-bold text-emerald-900">Cartera de Cobranza al Día</h4>
                  <p className="text-xs text-emerald-700">No existen clientes con cuotas en mora en este momento.</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => navigate('/alertas-mora')}
                className="text-xs font-semibold text-emerald-800 hover:underline flex items-center gap-1 cursor-pointer"
              >
                <span>Ver módulo de mora</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </button>
            </div>
          )}

          {/* ============================================================== */}
          {/* 3. RESUMEN DE INVENTARIO COMERCIAL POR PROYECTO (PROTAGONISTA) */}
          {/* ============================================================== */}
          <div className="bg-white rounded-lg border border-slate-200 p-5 shadow-xs space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-100 pb-4">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-md bg-slate-100 flex items-center justify-center text-slate-700 border border-slate-200">
                  <PieChart className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-lg font-bold text-slate-900">
                    Estado de Inventario Comercial por Proyecto
                  </h3>
                  <p className="text-xs text-slate-500">
                    Avance de ventas, colocación y disponibilidad de lotes por urbanización
                  </p>
                </div>
              </div>
              <span className="text-xs font-medium text-slate-400 self-start sm:self-auto">
                {stats?.projects_summary?.length || 0} proyectos activos en Sucúa
              </span>
            </div>

            {/* Cuadrícula de Tarjetas de Proyectos con Barras de Progreso */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {(stats?.projects_summary || []).map((project) => {
                return (
                  <div
                    key={project.id}
                    className="p-5 rounded-lg border border-slate-200 hover:border-slate-300 transition-all bg-white flex flex-col justify-between space-y-4 shadow-xs"
                  >
                    <div>
                      {/* Cabecera del Proyecto */}
                      <div className="flex items-start justify-between gap-2">
                        <div>
                          <h4 className="font-bold text-base text-slate-900">
                            {project.name}
                          </h4>
                          <div className="flex items-center gap-1 text-xs text-slate-500 mt-0.5">
                            <MapPin className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                            <span>{project.location}</span>
                          </div>
                        </div>

                        <span className="px-2 py-0.5 rounded-md text-xs font-semibold bg-slate-100 text-slate-700 border border-slate-200 shrink-0">
                          {project.sales_percentage}% Colocado
                        </span>
                      </div>

                      {/* Administrador a cargo del proyecto */}
                      <div className="flex items-center gap-1.5 text-xs py-1.5 px-2 bg-indigo-50/70 border border-indigo-100 rounded-md mt-2.5 text-slate-700">
                        <Building2 className="w-3.5 h-3.5 text-indigo-600 shrink-0" />
                        <span className="text-[11px] font-medium text-slate-500">Administrador a cargo:</span>
                        <span className="text-[11px] font-bold text-indigo-900 truncate">
                          {project.admin_name || 'Sin asignar'}
                        </span>
                      </div>

                      {/* Barra de Progreso Real */}
                      <div className="space-y-1 mt-3">
                        <div className="flex justify-between items-center text-xs font-medium">
                          <span className="text-slate-600">Avance de Colocación</span>
                          <span className="text-slate-900 font-semibold">
                            {project.sold_lots} <span className="text-slate-400 font-normal">/ {project.total_lots} lotes</span>
                          </span>
                        </div>
                        <div className="w-full bg-slate-100 rounded-sm h-1.5 overflow-hidden">
                          <div
                            className="bg-slate-900 h-1.5 rounded-sm transition-all duration-500 ease-out"
                            style={{ width: `${Math.min(project.sales_percentage, 100)}%` }}
                          ></div>
                        </div>
                      </div>

                      {/* Métricas Detalladas de Lotes */}
                      <div className="grid grid-cols-2 gap-2 mt-4 pt-3 border-t border-slate-100 text-xs">
                        <div className="bg-slate-50 p-2.5 rounded-md border border-slate-200">
                          <span className="text-[10px] uppercase font-semibold text-slate-500 block">
                            Disponibles
                          </span>
                          <span className="text-base font-bold text-emerald-700">
                            {project.available_lots}
                          </span>
                        </div>

                        <div className="bg-slate-50 p-2.5 rounded-md border border-slate-200">
                          <span className="text-[10px] uppercase font-semibold text-slate-500 block">
                            Vendidos
                          </span>
                          <span className="text-base font-bold text-slate-800">
                            {project.sold_lots}
                          </span>
                        </div>
                      </div>

                      {/* Resumen Financiero del Proyecto */}
                      <div className="mt-3 text-xs space-y-1 text-slate-500 bg-slate-50 p-2.5 rounded-md border border-slate-200">
                        <div className="flex justify-between">
                          <span>Portafolio Vendido:</span>
                          <span className="font-semibold text-slate-800">
                            ${project.portfolio_value.toLocaleString('en-US', { minimumFractionDigits: 2 })}
                          </span>
                        </div>
                        <div className="flex justify-between">
                          <span>Recaudado Total:</span>
                          <span className="font-semibold text-emerald-700">
                            ${project.collected.toLocaleString('en-US', { minimumFractionDigits: 2 })}
                          </span>
                        </div>
                      </div>
                    </div>

                    {/* Botones Rápidos de Navegación */}
                    <div className="pt-2 border-t border-slate-100 flex items-center justify-between gap-2 text-xs">
                      <button
                        type="button"
                        onClick={() => navigate(`/proyectos/${project.slug}/lotes`)}
                        className="flex-1 py-1.5 px-2.5 rounded-md text-slate-700 bg-slate-100 hover:bg-slate-200 font-semibold transition flex items-center justify-center gap-1 cursor-pointer"
                      >
                        <span>Ver Lotes ({project.available_lots})</span>
                        <ChevronRight className="w-3.5 h-3.5" />
                      </button>

                      <button
                        type="button"
                        onClick={() => navigate(`/proyectos/${project.slug}/clientes`)}
                        className="py-1.5 px-3 rounded-md text-cyan-800 bg-cyan-50 hover:bg-cyan-100 border border-cyan-200 font-semibold transition flex items-center justify-center gap-1 cursor-pointer"
                      >
                        <Receipt className="w-3.5 h-3.5" />
                        <span>Cobros</span>
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* ============================================================== */}
          {/* 4. ÚLTIMOS MOVIMIENTOS / RECIBOS RECIENTES                     */}
          {/* ============================================================== */}
          <div className="bg-white rounded-lg border border-slate-200 p-5 shadow-xs space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-md bg-slate-100 flex items-center justify-center text-slate-700 border border-slate-200">
                  <Receipt className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-slate-900">
                    Últimos Movimientos de Caja
                  </h3>
                  <p className="text-[11px] text-slate-500">
                    Últimos 5 cobros registrados en caja con recibo emitido
                  </p>
                </div>
              </div>

              <button
                type="button"
                onClick={() => navigate('/recibos')}
                className="text-xs font-semibold text-slate-700 hover:text-slate-900 flex items-center gap-1 cursor-pointer hover:underline"
              >
                <span>Ver todos los recibos</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </button>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead>
                  <tr className="border-b border-slate-100 text-slate-400 uppercase tracking-wider text-[10px]">
                    <th className="pb-2 font-bold">N° Recibo</th>
                    <th className="pb-2 font-bold">Cliente</th>
                    <th className="pb-2 font-bold">Proyecto & Lote</th>
                    <th className="pb-2 font-bold">Método de Pago</th>
                    <th className="pb-2 font-bold text-right">Monto Cobrado</th>
                    <th className="pb-2 font-bold text-right">Fecha de Emisión</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {stats?.recent_payments && stats.recent_payments.length > 0 ? (
                    stats.recent_payments.map((p) => (
                      <tr key={p.id} className="hover:bg-slate-50 transition-colors">
                        <td className="py-2.5 font-mono font-bold text-slate-900">
                          {p.receipt_number}
                        </td>
                        <td className="py-2.5 font-semibold text-slate-800">
                          {p.customer_name}
                        </td>
                        <td className="py-2.5 text-slate-600">
                          <span className="font-medium text-slate-700">{p.project_name}</span> &bull; <strong className="text-slate-900">{p.lot_number}</strong>
                        </td>
                        <td className="py-2.5">
                          <span className="px-2 py-0.5 rounded text-[10px] font-semibold bg-slate-100 text-slate-700 border border-slate-200">
                            {p.payment_method}
                          </span>
                        </td>
                        <td className="py-2.5 text-right font-extrabold text-emerald-700 font-mono">
                          +${Number(p.amount_paid).toLocaleString('en-US', { minimumFractionDigits: 2 })}
                        </td>
                        <td className="py-2.5 text-right text-slate-500 font-mono text-[11px]">
                          {p.created_at}
                        </td>
                      </tr>
                    ))
                  ) : (
                    <tr>
                      <td colSpan="6" className="py-6 text-center text-slate-400">
                        No hay movimientos recientes registrados.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
