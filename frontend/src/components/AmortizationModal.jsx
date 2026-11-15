import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { authenticatedApiUrl } from '../utils/receiptPdfUrl';
import {
  FileSpreadsheet,
  Download,
  ExternalLink,
  X,
  Loader2,
  Calendar,
  AlertTriangle,
  CheckCircle2,
  Clock,
  Printer,
  DollarSign,
  Building2,
  User,
} from 'lucide-react';

export default function AmortizationModal({ isOpen, onClose, lotId, customerName }) {
  const [loading, setLoading] = useState(false);
  const [data, setData] = useState(null);
  const [error, setError] = useState(null);
  const [filterState, setFilterState] = useState('TODAS'); // 'TODAS' | 'PAGADAS' | 'MORA' | 'PENDIENTES'

  useEffect(() => {
    if (isOpen && lotId) {
      fetchAmortization();
    } else {
      setData(null);
      setError(null);
      setFilterState('TODAS');
    }
  }, [isOpen, lotId]);

  const fetchAmortization = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await axios.get(`/api/lots/${lotId}/amortization`);
      setData(res.data.data);
    } catch (err) {
      console.error('Error al consultar tabla de amortización:', err);
      setError(
        err.response?.data?.message ||
          'Error al calcular el cronograma de cuotas del lote.'
      );
    } finally {
      setLoading(false);
    }
  };

  if (!isOpen) return null;

  const pdfUrl = authenticatedApiUrl(`/api/lots/${lotId}/amortization-pdf`);

  const rows = data?.rows || [];
  const filteredRows = rows.filter((r) => {
    if (filterState === 'PAGADAS') return r.status === 'PAGADA';
    if (filterState === 'MORA') return r.status === 'VENCIDA (EN MORA)';
    if (filterState === 'PENDIENTES')
      return r.status === 'PENDIENTE' || r.status === 'ABONO PARCIAL';
    return true;
  });

  return (
    <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center z-50 p-3 sm:p-4 animate-fade-in">
      <div className="bg-white rounded-xl w-full max-w-4xl max-h-[90vh] shadow-2xl border border-slate-200 flex flex-col overflow-hidden">
        {/* Cabecera del Modal */}
        <div className="px-5 py-4 border-b border-slate-100 flex items-center justify-between gap-3 bg-slate-50/50 shrink-0">
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-10 h-10 rounded-lg bg-indigo-50 border border-indigo-200 text-indigo-700 flex items-center justify-center shrink-0">
              <FileSpreadsheet className="w-5 h-5" />
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <h3 className="text-base font-bold text-slate-900 truncate">
                  Cronograma de Pagos y Amortización
                </h3>
                {data?.lot && (
                  <span className="px-2 py-0.5 rounded text-xs font-bold bg-slate-900 text-white font-mono">
                    {data.lot.lot_number}
                  </span>
                )}
              </div>
              <p className="text-xs text-slate-500 mt-0.5 truncate">
                {data?.project?.name || 'Proyecto'} •{' '}
                {data?.customer?.name || customerName || 'Comprador'}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            {lotId && (
              <a
                href={pdfUrl}
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold text-white bg-indigo-600 hover:bg-indigo-700 active:bg-indigo-800 transition shadow-xs cursor-pointer"
                title="Abrir e imprimir PDF oficial del cronograma"
              >
                <Download className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">Descargar PDF Oficial</span>
                <span className="sm:hidden">PDF</span>
              </a>
            )}
            <button
              type="button"
              onClick={onClose}
              className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Contenido scrolleable */}
        <div className="p-5 overflow-y-auto space-y-4">
          {loading ? (
            <div className="py-20 flex flex-col items-center justify-center gap-3 text-slate-400">
              <Loader2 className="w-8 h-8 animate-spin text-indigo-600" />
              <p className="text-xs font-semibold text-slate-600">
                Calculando cronograma de amortización y cuotas...
              </p>
            </div>
          ) : error ? (
            <div className="p-6 text-center bg-rose-50 rounded-xl border border-rose-200 text-rose-800 space-y-2">
              <AlertTriangle className="w-8 h-8 mx-auto text-rose-600" />
              <p className="text-sm font-bold">{error}</p>
            </div>
          ) : data ? (
            <>
              {/* Tarjetas Informativas del Contrato */}
              <div className="bg-slate-50/80 rounded-xl p-4 border border-slate-200/80 grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
                <div>
                  <span className="text-slate-400 text-[11px] block">Valor Contratado</span>
                  <span className="text-base font-extrabold text-slate-900 block">
                    ${Number(data.total_price).toLocaleString('en-US', { minimumFractionDigits: 2 })}
                  </span>
                  <span className="text-[10px] text-slate-500">
                    {data.installments_count} cuotas pactadas
                  </span>
                </div>

                <div>
                  <span className="text-emerald-700 font-semibold text-[11px] block">Total Abonado</span>
                  <span className="text-base font-extrabold text-emerald-800 block">
                    ${Number(data.total_paid).toLocaleString('en-US', { minimumFractionDigits: 2 })}
                  </span>
                  <span className="text-[10px] text-emerald-600">
                    {data.summary.paid_count} cuotas cubiertas
                  </span>
                </div>

                <div>
                  <span className="text-amber-800 font-semibold text-[11px] block">Saldo Deudor</span>
                  <span className="text-base font-extrabold text-amber-900 block">
                    ${Number(data.debt_balance).toLocaleString('en-US', { minimumFractionDigits: 2 })}
                  </span>
                  <span className="text-[10px] text-amber-700">Por amortizar</span>
                </div>

                <div>
                  <span className="text-cyan-800 font-semibold text-[11px] block">Cuota Mensual</span>
                  <span className="text-base font-extrabold text-cyan-900 block">
                    ${Number(data.installment_base).toLocaleString('en-US', { minimumFractionDigits: 2 })}
                  </span>
                  <span className="text-[10px] text-cyan-700">
                    Día {data.payment_day} de cada mes
                  </span>
                </div>
              </div>

              {/* Indicadores de Estado de Cuotas (Filtros rápidos) */}
              <div className="flex flex-wrap items-center gap-2">
                <button
                  type="button"
                  onClick={() => setFilterState('TODAS')}
                  className={`px-3 py-1.5 rounded-lg text-xs font-bold transition cursor-pointer border ${
                    filterState === 'TODAS'
                      ? 'bg-slate-900 text-white border-slate-900'
                      : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50'
                  }`}
                >
                  Todas ({rows.length})
                </button>

                <button
                  type="button"
                  onClick={() => setFilterState('PAGADAS')}
                  className={`px-3 py-1.5 rounded-lg text-xs font-bold transition cursor-pointer border flex items-center gap-1.5 ${
                    filterState === 'PAGADAS'
                      ? 'bg-emerald-600 text-white border-emerald-600'
                      : 'bg-emerald-50 text-emerald-800 border-emerald-200 hover:bg-emerald-100'
                  }`}
                >
                  <CheckCircle2 className="w-3.5 h-3.5" />
                  <span>Pagadas ({data.summary.paid_count})</span>
                </button>

                {data.summary.partial_count > 0 && (
                  <button
                    type="button"
                    onClick={() => setFilterState('PENDIENTES')}
                    className={`px-3 py-1.5 rounded-lg text-xs font-bold transition cursor-pointer border ${
                      filterState === 'PENDIENTES'
                        ? 'bg-amber-600 text-white border-amber-600'
                        : 'bg-amber-50 text-amber-800 border-amber-200 hover:bg-amber-100'
                    }`}
                  >
                    <span>Abono Parcial ({data.summary.partial_count})</span>
                  </button>
                )}

                <button
                  type="button"
                  onClick={() => setFilterState('MORA')}
                  className={`px-3 py-1.5 rounded-lg text-xs font-bold transition cursor-pointer border flex items-center gap-1.5 ${
                    filterState === 'MORA'
                      ? 'bg-rose-600 text-white border-rose-600'
                      : 'bg-rose-50 text-rose-800 border-rose-200 hover:bg-rose-100'
                  }`}
                >
                  <AlertTriangle className="w-3.5 h-3.5" />
                  <span>En Mora ({data.summary.overdue_count})</span>
                </button>

                <button
                  type="button"
                  onClick={() => setFilterState('PENDIENTES')}
                  className={`px-3 py-1.5 rounded-lg text-xs font-bold transition cursor-pointer border ${
                    filterState === 'PENDIENTES' && data.summary.partial_count === 0
                      ? 'bg-slate-700 text-white border-slate-700'
                      : 'bg-slate-100 text-slate-700 border-slate-200 hover:bg-slate-200'
                  }`}
                >
                  <span>Pendientes ({data.summary.pending_count})</span>
                </button>
              </div>

              {/* Tabla Detallada del Cronograma */}
              <div className="border border-slate-200 rounded-lg overflow-hidden">
                <table className="w-full text-left border-collapse text-xs">
                  <thead>
                    <tr className="bg-slate-50 border-b border-slate-200 text-slate-600 font-semibold uppercase tracking-wider text-[11px]">
                      <th className="py-2.5 px-3 text-center">N°</th>
                      <th className="py-2.5 px-3">Vencimiento</th>
                      <th className="py-2.5 px-3 text-right">Valor Cuota</th>
                      <th className="py-2.5 px-3 text-right">Abonado</th>
                      <th className="py-2.5 px-3 text-right">Saldo</th>
                      <th className="py-2.5 px-3 text-center">Estado</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {filteredRows.map((r) => {
                      const isPaid = r.status === 'PAGADA';
                      const isPartial = r.status === 'ABONO PARCIAL';
                      const isMora = r.status === 'VENCIDA (EN MORA)';

                      return (
                        <tr
                          key={r.installment_number}
                          className={`hover:bg-slate-50 transition ${
                            isMora ? 'bg-rose-50/30' : isPaid ? 'bg-emerald-50/20' : ''
                          }`}
                        >
                          <td className="py-2 px-3 text-center font-bold text-slate-700 font-mono">
                            {String(r.installment_number).padStart(2, '0')}
                          </td>
                          <td className="py-2 px-3 whitespace-nowrap font-medium text-slate-800">
                            {r.due_date}
                          </td>
                          <td className="py-2 px-3 text-right font-bold text-slate-900">
                            ${Number(r.installment_amount).toLocaleString('en-US', { minimumFractionDigits: 2 })}
                          </td>
                          <td className="py-2 px-3 text-right font-bold text-emerald-700">
                            ${Number(r.covered_amount).toLocaleString('en-US', { minimumFractionDigits: 2 })}
                          </td>
                          <td
                            className={`py-2 px-3 text-right font-bold ${
                              r.remaining_amount > 0 ? 'text-rose-600' : 'text-slate-400'
                            }`}
                          >
                            ${Number(r.remaining_amount).toLocaleString('en-US', { minimumFractionDigits: 2 })}
                          </td>
                          <td className="py-2 px-3 text-center whitespace-nowrap">
                            {isPaid && (
                              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-800 border border-emerald-200">
                                <span className="w-1.5 h-1.5 rounded-full bg-emerald-600"></span>
                                Pagada
                              </span>
                            )}
                            {isPartial && (
                              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-100 text-amber-800 border border-amber-200">
                                <span className="w-1.5 h-1.5 rounded-full bg-amber-600"></span>
                                Parcial
                              </span>
                            )}
                            {isMora && (
                              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-rose-100 text-rose-800 border border-rose-200">
                                <span className="w-1.5 h-1.5 rounded-full bg-rose-600"></span>
                                En Mora
                              </span>
                            )}
                            {!isPaid && !isPartial && !isMora && (
                              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-slate-100 text-slate-700 border border-slate-200">
                                <span className="w-1.5 h-1.5 rounded-full bg-slate-400"></span>
                                Pendiente
                              </span>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </>
          ) : null}
        </div>

        {/* Pie del modal */}
        <div className="px-5 py-3 border-t border-slate-100 bg-slate-50 flex items-center justify-between text-xs shrink-0">
          <span className="text-slate-500">
            Documento de amortización y cronograma oficial de cuotas
          </span>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onClose}
              className="px-3.5 py-1.5 text-xs font-semibold text-slate-600 hover:text-slate-800 hover:bg-slate-200 rounded-lg transition cursor-pointer"
            >
              Cerrar
            </button>
            {lotId && (
              <a
                href={pdfUrl}
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center gap-1.5 px-4 py-1.5 rounded-lg text-xs font-bold text-white bg-slate-900 hover:bg-slate-800 transition cursor-pointer shadow-xs"
              >
                <Printer className="w-3.5 h-3.5" />
                <span>Imprimir / Descargar PDF</span>
              </a>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
