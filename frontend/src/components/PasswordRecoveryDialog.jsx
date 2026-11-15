import { useId } from 'react';
import useSingleSubmit from '../hooks/useSingleSubmit';
import ActionButton from './ActionButton';
import { useState } from 'react';
import axios from 'axios';
import { CheckCircle2, ShieldCheck } from 'lucide-react';
import PasswordDialog, { passwordButtonClass, passwordInputClass } from './PasswordDialog';

export default function PasswordRecoveryDialog({ initialEmail, onClose }) {
  const fieldId = useId();
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState(null);
  const [error, setError] = useState('');

  const [submit, submitPending] = useSingleSubmit(async (event) => {
    if (busy) return;
    const email = new FormData(event.currentTarget).get('email').trim();

    setError('');
    setBusy(true);
    try {
      const { data } = await axios.post('/api/forgot-password-request', { email });
      setResult(data);
    } catch (err) {
      if (err?.isDuplicateBlocked) return;
      setError(err.response?.data?.errors?.email?.[0] ||
        err.response?.data?.message || 'No se pudo enviar la solicitud.');
    } finally {
      setBusy(false);
    }
  }, { form: true });

  const isCeo = result?.type === 'ceo';
  const ResultIcon = isCeo ? ShieldCheck : CheckCircle2;

  return (
    <PasswordDialog title="Recuperar contraseña" onClose={onClose} busy={busy}>
      {result ? (
        <div className="space-y-4">
          <div role="status" className={`flex items-start gap-3 rounded-lg border p-3 text-sm ${isCeo ? 'border-amber-200 bg-amber-50 text-amber-900' : 'border-emerald-200 bg-emerald-50 text-emerald-900'}`}>
            <ResultIcon className="mt-0.5 h-5 w-5 shrink-0" />
            <div>
              <p className="font-bold">{isCeo ? 'Contacta al Equipo de Desarrollo de Software' : 'Solicitud registrada en el panel del CEO'}</p>
              <p className="mt-1">{result.message}</p>
            </div>
          </div>
          <button type="button" className={passwordButtonClass} onClick={onClose}>Cerrar</button>
        </div>
      ) : (
        <form onSubmit={submit} className="space-y-4">
          <label className="block text-sm font-semibold">
            Correo electrónico
            <input id={`recuperar-clave-email-${fieldId}`} name="email" type="email" autoComplete="email" required defaultValue={initialEmail} disabled={busy} className={passwordInputClass} />
          </label>
          {error && <p role="alert" className="text-sm text-rose-700">{error}</p>}
          <div className="flex justify-end gap-3">
            <button type="button" disabled={busy} className="px-3 text-sm font-semibold text-slate-600" onClick={onClose}>Cancelar</button>
            <ActionButton loading={submitPending} type="submit" disabled={busy} className={passwordButtonClass}>{busy ? 'Enviando...' : 'Enviar solicitud'}</ActionButton>
          </div>
        </form>
      )}
    </PasswordDialog>
  );
}
