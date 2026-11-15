import { useEffect, useState } from 'react';
import axios from 'axios';

export default function EmitterSignaturePreview() {
  const [emitter, setEmitter] = useState();

  useEffect(() => {
    const controller = new AbortController();
    axios.get('/api/profile/signature', { signal: controller.signal })
      .then(({ data }) => setEmitter(data))
      .catch(() => {
        if (!controller.signal.aborted) setEmitter(null);
      });
    return () => controller.abort();
  }, []);

  return (
    <section className="min-w-0 space-y-2">
      <h3 className="text-sm font-bold text-slate-700">Firma Digital del Emisor</h3>
      <div className="rounded-xl border border-slate-200 bg-slate-50 p-3 text-sm text-slate-600">
        {emitter?.signature_base64 ? (
          <img src={emitter.signature_base64} alt="Firma digital del emisor" className="mb-2 h-16 max-w-full object-contain" />
        ) : (
          <p>{emitter === undefined ? 'Cargando firma…' : emitter ? 'Firma digital sin configurar' : 'No se pudo consultar la firma'}</p>
        )}
        {emitter?.name && <p className="break-words text-xs font-semibold">{emitter.name} · {emitter.role}</p>}
      </div>
    </section>
  );
}
