import { useId } from 'react';
import useSingleSubmit from '../hooks/useSingleSubmit';
import ActionButton from './ActionButton';
import { useEffect, useRef, useState } from 'react';
import axios from 'axios';
import { Hash } from 'lucide-react';

export default function ReceiptSequenceDialog({ sequences, onClose, onSaved }) {
  const fieldId = useId();
  const ref = useRef(null);
  const [numbers, setNumbers] = useState(() => Object.fromEntries(
    sequences.map(({ prefix, last_manual_number }) => [prefix, String(last_manual_number)])
  ));
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    ref.current.showModal();
  }, []);

  const [save, savePending] = useSingleSubmit(async (event) => {
    if (saving) return;
    setSaving(true);
    setError('');
    try {
      await axios.put('/api/receipt-sequences', {
        sequences: sequences.map(({ prefix }) => ({ prefix, last_manual_number: Number(numbers[prefix]) })),
      });
      onSaved();
    } catch (err) {
      if (err?.isDuplicateBlocked) return;
      const response = err.response?.data;
      setError(Object.values(response?.errors || {}).flat()[0] || response?.message || 'No se pudo guardar la numeración.');
    } finally {
      setSaving(false);
    }
  }, { form: true });

  return (
    <dialog ref={ref} aria-labelledby="receipt-sequence-title"
      onCancel={(event) => { event.preventDefault(); if (!saving) onClose(); }}
      className="m-auto max-h-[92dvh] w-[calc(100%-1rem)] max-w-xl rounded-xl border border-slate-200 bg-white text-slate-900 shadow-xl backdrop:bg-slate-900/60">
      <form onSubmit={save} className="space-y-4 p-4 sm:p-6">
        <h2 id="receipt-sequence-title" className="flex items-center gap-2 text-lg font-bold">
          <Hash className="h-5 w-5" /> Configurar Numeración
        </h2>
        <p className="text-sm text-slate-600">Ingresa el último número usado en papel para cada talonario.</p>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          {sequences.map(({ prefix, book_name, max_digital_number }) => {
            const entered = Number(numbers[prefix]);
            const next = Math.max(entered, max_digital_number) + 1;
            return (
              <fieldset key={prefix} className="min-w-0 rounded-lg border border-slate-200 p-3">
                <legend className="px-1 text-sm font-bold">{book_name} · {prefix}</legend>
                <label className="block text-xs font-semibold text-slate-700">
                  Último N° de recibo emitido a mano
                  <input id={`receipt-sequence-${prefix.toLowerCase()}${fieldId}`} name={`receipt_sequence_${prefix.slice(0, -1).toLowerCase()}`} type="number" required min="0" max="999999" step="1" value={numbers[prefix]} disabled={saving}
                    onChange={(event) => setNumbers({ ...numbers, [prefix]: event.target.value })}
                    className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-base" />
                </label>
                <p className="mt-2 text-xs text-slate-700" aria-live="polite">
                  Próximo comprobante digital: <strong className="font-mono">{prefix}{String(next).padStart(5, '0')}</strong>
                </p>
              </fieldset>
            );
          })}
        </div>
        {error && <p role="alert" className="text-sm text-rose-700">{error}</p>}
        <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
          <button type="button" disabled={saving} onClick={onClose} className="min-h-[44px] rounded-md px-4 font-semibold hover:bg-slate-100">Cancelar</button>
          <ActionButton loading={savePending} type="submit" disabled={saving} className="min-h-[44px] rounded-md bg-slate-900 px-4 font-semibold text-white disabled:opacity-50">
            {saving ? 'Guardando…' : 'Guardar numeración'}
          </ActionButton>
        </div>
      </form>
    </dialog>
  );
}
