import { useId } from 'react';
import useSingleSubmit from '../hooks/useSingleSubmit';
import ActionButton from './ActionButton';
import { useRef, useState } from 'react';
import axios from 'axios';
import { Copy, KeyRound } from 'lucide-react';
import PasswordDialog, { passwordButtonClass, passwordInputClass } from './PasswordDialog';

function generatePassword() {
  const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz23456789!@#$%*+-_';
  const bytes = new Uint8Array(20);
  let password = '';
  const limit = 256 - (256 % alphabet.length);

  while (password.length < 18) {
    crypto.getRandomValues(bytes);
    for (const byte of bytes) {
      if (byte < limit && password.length < 18) password += alphabet[byte % alphabet.length];
    }
  }
  return password;
}

export default function ResetUserPasswordDialog({ user, onClose, onSaved }) {
  const fieldId = useId();
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState('');
  const [copyStatus, setCopyStatus] = useState('');
  const input = useRef(null);

  async function copyPassword() {
    try {
      if (navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(password);
      } else {
        input.current.select();
        if (!document.execCommand('copy')) throw new Error('Clipboard unavailable');
      }
      setCopyStatus('Contraseña copiada.');
    } catch {
      input.current.select();
      setCopyStatus('Seleccionamos la clave. Presiona Ctrl+C o usa la opción Copiar de tu dispositivo.');
    }
  }

  const [save, savePending] = useSingleSubmit(async (event) => {
    if (!password || busy || saved) return;
    setBusy(true);
    setError('');
    try {
      await axios.post(`/api/users/${user.id}/reset-password`, { new_password: password });
      setSaved(true);
      onSaved();
    } catch (err) {
      if (err?.isDuplicateBlocked) return;
      setError(err.response?.data?.errors?.new_password?.[0] ||
        err.response?.data?.message || 'No se pudo restablecer la contraseña.');
    } finally {
      setBusy(false);
    }
  }, { form: true });

  return (
    <PasswordDialog title="Regenerar Clave" onClose={onClose} busy={busy}>
      <form onSubmit={save} className="space-y-4">
        <p className="text-sm text-slate-600">
          <strong>{user.name}</strong> · {user.email}
        </p>
        {!saved && (
          <button
            type="button"
            disabled={busy}
            onClick={() => {
              setPassword(generatePassword());
              setCopyStatus('');
              setError('');
            }}
            className="inline-flex items-center gap-2 rounded-lg border border-slate-200 px-3 py-2 text-sm font-semibold disabled:opacity-50"
          >
            <KeyRound className="h-4 w-4" /> Generar Clave Aleatoria
          </button>
        )}
        {password && (
          <div className="flex flex-wrap items-end gap-2">
            <label className="min-w-0 flex-1 text-sm font-semibold">
              Nueva contraseña
              <input id={`regenerar-clave-generated-password-${fieldId}`} name="regenerar_clave_generated_password" ref={input} value={password} readOnly spellCheck={false} className={`${passwordInputClass} font-mono`} />
            </label>
            <button type="button" onClick={copyPassword} className="inline-flex items-center gap-1 rounded-lg border border-slate-200 px-3 py-2 text-sm font-semibold">
              <Copy className="h-4 w-4" /> Copiar
            </button>
          </div>
        )}
        {copyStatus && <p role="status" className="text-sm text-slate-600">{copyStatus}</p>}
        {error && <p role="alert" className="text-sm text-rose-700">{error}</p>}
        {saved ? (
          <p role="status" className="rounded-lg bg-emerald-50 p-3 text-sm text-emerald-800">
            Contraseña guardada y sesiones anteriores cerradas. Copia la clave para entregársela a {user.name}.
          </p>
        ) : (
          <p className="text-sm text-slate-600">Al guardar se cerrarán las sesiones anteriores de esta cuenta.</p>
        )}
        <div className="flex justify-end gap-3">
          <button type="button" onClick={onClose} disabled={busy} className="px-3 text-sm font-semibold text-slate-600">{saved ? 'Cerrar' : 'Cancelar'}</button>
          {!saved && <ActionButton loading={savePending} type="submit" disabled={busy || !password} className={passwordButtonClass}>{busy ? 'Guardando...' : 'Guardar contraseña'}</ActionButton>}
        </div>
      </form>
    </PasswordDialog>
  );
}
