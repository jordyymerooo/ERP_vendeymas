import { useId } from 'react';
import useSingleSubmit from '../hooks/useSingleSubmit';
import ActionButton from './ActionButton';
import { useEffect, useRef, useState } from 'react';
import axios from 'axios';

export default function InventoryDialog({ action, project, onClose, onSaved }) {
  const fieldId = useId();
  const dialog = useRef(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [confirmation, setConfirmation] = useState('');
  const deleting = action.type === 'delete';
  const bulk = action.type === 'bulk';
  const lot = action.lot;
  const title = deleting ? 'Eliminar Proyecto' : bulk ? 'Editar por Rango' : 'Editar Lote';

  useEffect(() => {
    dialog.current.showModal();
  }, []);

  const [save, savePending] = useSingleSubmit(async (event) => {
    if (saving || (deleting && confirmation !== project.name)) return;

    const payload = Object.fromEntries(new FormData(event.currentTarget));
    setSaving(true);
    setError('');
    try {
      if (deleting) {
        await axios.delete(`/api/projects/${project.id}`);
      } else if (bulk) {
        await axios.post(`/api/projects/${project.id}/lots/bulk-update`, payload);
      } else {
        await axios.put(`/api/lots/${lot.id}`, payload);
      }
      onSaved();
    } catch (err) {
      if (err?.isDuplicateBlocked) return;
      const response = err.response?.data;
      setError(Object.values(response?.errors || {}).flat()[0] || response?.message || 'No se pudo completar la operación.');
    } finally {
      setSaving(false);
    }
  }, { form: true });

  const fieldClass = 'mt-1 block w-full rounded-md border border-slate-300 px-3 py-2 text-base font-normal';

  return (
    <dialog
      ref={dialog}
      aria-labelledby="inventory-dialog-title"
      className="m-auto max-h-[92dvh] w-[calc(100%-1rem)] max-w-lg rounded-xl border border-slate-200 bg-white text-slate-900 shadow-xl backdrop:bg-slate-900/60"
      onCancel={(event) => { event.preventDefault(); if (!saving) onClose(); }}
    >
      <form onSubmit={save} className="space-y-4 p-4 sm:p-6">
        <h2 id="inventory-dialog-title" className="text-lg font-bold">{title}</h2>
        {deleting ? (
          <>
            <p className="rounded-md bg-rose-50 p-3 text-sm text-rose-900">
              Se eliminarán definitivamente el proyecto <strong>{project.name}</strong>, sus lotes, escrituras, pagos y trabajos de topografía asociados.
            </p>
            <label className="block text-sm font-semibold">
              Escribe el nombre exacto del proyecto
              <input id={`inventario-project-confirmation-${fieldId}`} name="inventario_project_confirmation" required autoComplete="off" value={confirmation} onChange={(event) => setConfirmation(event.target.value)} className={fieldClass} />
            </label>
          </>
        ) : (
          <>
            {bulk ? (
              <>
                <p className="text-sm text-slate-600">El rango incluye ambos extremos y lotes con sufijos, como Lote 15A.</p>
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                  <label className="text-sm font-semibold">Desde el lote<input id={`inventario-from-lot-${fieldId}`} name="from_lot" type="number" min="1" required className={fieldClass} /></label>
                  <label className="text-sm font-semibold">Hasta el lote<input id={`inventario-to-lot-${fieldId}`} name="to_lot" type="number" min="1" required className={fieldClass} /></label>
                </div>
              </>
            ) : (
              <label className="block text-sm font-semibold">Nombre/N° de Lote<input id={`inventario-lot-number-${fieldId}`} name="lot_number" maxLength={50} required defaultValue={lot.lot_number} className={fieldClass} /></label>
            )}
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <label className="text-sm font-semibold">Área (m²)<input id={`inventario-area-${fieldId}`} name="area" type="number" min="0.01" max="99999999.99" step="0.01" required defaultValue={lot?.area_m2} className={fieldClass} /></label>
              <label className="text-sm font-semibold">Precio ($ USD)<input id={`inventario-price-${fieldId}`} name="price" type="number" min="0.01" max="9999999999.99" step="0.01" required defaultValue={lot?.total_price} className={fieldClass} /></label>
            </div>
          </>
        )}
        {error && <p role="alert" className="text-sm font-semibold text-rose-700">{error}</p>}
        <div className="flex flex-col-reverse gap-2 border-t border-slate-200 pt-3 sm:flex-row sm:justify-end">
          <button type="button" disabled={saving} onClick={onClose} className="min-h-[44px] rounded-md bg-slate-100 px-4 font-semibold">Cancelar</button>
          <ActionButton loading={savePending} type="submit" disabled={saving || (deleting && confirmation !== project.name)} className={`min-h-[44px] rounded-md px-4 font-semibold text-white disabled:opacity-50 ${deleting ? 'bg-rose-700' : 'bg-slate-900'}`}>
            {saving ? 'Procesando…' : deleting ? 'Eliminar definitivamente' : 'Guardar cambios'}
          </ActionButton>
        </div>
      </form>
    </dialog>
  );
}
