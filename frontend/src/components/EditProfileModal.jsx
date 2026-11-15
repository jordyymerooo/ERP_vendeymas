import useSingleSubmit from '../hooks/useSingleSubmit';
import ActionButton from './ActionButton';
import { useEffect, useRef, useState } from 'react';
import axios from 'axios';

const fields = [
  { name: 'name', label: 'Nombre Completo', type: 'text', autoComplete: 'name', required: true, maxLength: 120 },
  { name: 'phone', label: 'Número de Teléfono / WhatsApp', type: 'tel', autoComplete: 'tel', maxLength: 25 },
  { name: 'email', label: 'Correo Electrónico', type: 'email', autoComplete: 'email', required: true, maxLength: 150 },
  {
    name: 'password',
    label: 'Nueva Contraseña (opcional)',
    type: 'password',
    autoComplete: 'new-password',
    minLength: 6,
    placeholder: 'Dejar en blanco para mantener la actual',
  },
];

export default function EditProfileModal({ user, onClose, onSaved }) {
  const dialog = useRef(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    dialog.current.showModal();
  }, []);

  const [handleSubmit, handleSubmitPending] = useSingleSubmit(async (event) => {
    if (saving) return;

    const payload = Object.fromEntries(new FormData(event.currentTarget));
    if (!payload.password) delete payload.password;

    setSaving(true);
    setError('');
    try {
      const { data } = await axios.put('/api/profile', payload, {
        headers: { Accept: 'application/json' },
      });
      onSaved(data.data);
    } catch (err) {
      if (err?.isDuplicateBlocked) return;
      const response = err.response?.data;
      setError(Object.values(response?.errors ?? {}).flat()[0] ||
        response?.message || 'No se pudo actualizar el perfil.');
    } finally {
      setSaving(false);
    }
  }, { form: true });

  return (
    <dialog
      ref={dialog}
      aria-labelledby="edit-profile-title"
      onCancel={(event) => {
        event.preventDefault();
        if (!saving) onClose();
      }}
      className="m-auto max-h-[90vh] w-[calc(100%-2rem)] max-w-md rounded-2xl border border-slate-200 bg-white p-6 text-slate-900 shadow-xl backdrop:bg-slate-900/60"
    >
      <h2 id="edit-profile-title" className="text-base font-bold">Editar mi Perfil</h2>
      <form onSubmit={handleSubmit} className="mt-4 space-y-4">
        {fields.map(({ label, ...input }) => (
          <label key={input.name} className="block text-sm font-semibold text-slate-700">
            {label}
            <input
              {...input}
              id={`edit-profile-${input.name}`}
              defaultValue={input.name === 'password' ? '' : user?.[input.name] ?? ''}
              disabled={saving}
              className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm font-normal text-slate-900"
            />
          </label>
        ))}
        {error && <p role="alert" className="text-sm text-rose-700">{error}</p>}
        <div className="flex justify-end gap-2">
          <button type="button" onClick={onClose} disabled={saving} className="rounded-lg px-4 py-2 text-sm font-semibold text-slate-600 hover:bg-slate-100 disabled:opacity-50">
            Cancelar
          </button>
          <ActionButton loading={handleSubmitPending} type="submit" disabled={saving} className="rounded-lg bg-slate-900 px-4 py-2 text-sm font-semibold text-white disabled:opacity-50">
            {saving ? 'Guardando...' : 'Guardar cambios'}
          </ActionButton>
        </div>
      </form>
    </dialog>
  );
}
