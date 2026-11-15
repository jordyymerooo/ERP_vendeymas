import { useId } from 'react';
const buttonClass = 'rounded-md border border-slate-200 bg-white px-2.5 py-1.5 font-semibold text-slate-700 hover:bg-slate-100 disabled:opacity-40';

export default function Pagination({ pagination, perPage, onPageChange, onPerPageChange, loading }) {
  const fieldId = useId();
  const { current_page: page = 1, last_page: last = 1, from, to, total = 0 } = pagination ?? {};
  const pages = [...new Set([1, page - 1, page, page + 1, last])]
    .filter((number) => number > 0 && number <= last)
    .sort((a, b) => a - b);

  return (
    <nav aria-label="Paginación" className="flex flex-wrap items-center justify-between gap-3 border-t border-slate-200 px-4 py-3 text-xs text-slate-600">
      <span aria-live="polite">Mostrando {from ?? 0} a {to ?? 0} de {total} registros</span>
      <label className="flex items-center gap-2">
        Filas por página
        <select id={`pagination-per-page-${fieldId}`} name="pagination_per_page" value={perPage} onChange={(event) => onPerPageChange(Number(event.target.value))} className={buttonClass}>
          {[15, 30, 50].map((size) => <option key={size} value={size}>{size}</option>)}
        </select>
      </label>
      <div className="flex flex-wrap items-center gap-1">
        <button type="button" className={buttonClass} disabled={loading || page <= 1} onClick={() => onPageChange(page - 1)}>Anterior</button>
        {pages.map((number, index) => (
          <span key={number} className="inline-flex items-center gap-1">
            {index > 0 && number > pages[index - 1] + 1 && <span aria-hidden="true">…</span>}
            <button
              type="button"
              className={`${buttonClass} aria-[current=page]:border-slate-900 aria-[current=page]:bg-slate-900 aria-[current=page]:text-white`}
              aria-label={`Página ${number}`}
              aria-current={number === page ? 'page' : undefined}
              disabled={loading || number === page}
              onClick={() => onPageChange(number)}
            >
              {number}
            </button>
          </span>
        ))}
        <button type="button" className={buttonClass} disabled={loading || page >= last} onClick={() => onPageChange(page + 1)}>Siguiente</button>
      </div>
    </nav>
  );
}
