import { useEffect, useRef } from 'react';

export const passwordInputClass = 'mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm font-normal text-slate-900';
export const passwordButtonClass = 'rounded-lg bg-slate-900 px-4 py-2 text-sm font-semibold text-white disabled:opacity-50';

export default function PasswordDialog({ title, onClose, busy, children }) {
  const dialog = useRef(null);

  useEffect(() => {
    dialog.current.showModal();
  }, []);

  return (
    <dialog
      ref={dialog}
      aria-labelledby="password-dialog-title"
      onCancel={(event) => {
        event.preventDefault();
        if (!busy) onClose();
      }}
      className="m-auto max-h-[90vh] w-[calc(100%-2rem)] max-w-md rounded-2xl border border-slate-200 bg-white p-6 text-slate-900 shadow-xl backdrop:bg-slate-900/60"
    >
      <h2 id="password-dialog-title" className="mb-4 text-base font-bold">{title}</h2>
      {children}
    </dialog>
  );
}
