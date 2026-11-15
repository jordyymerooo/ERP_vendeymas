import { Loader2 } from 'lucide-react';

export default function ActionButton({
  onClick, loading = false, disabled, loadingText = 'Procesando...', className = '', children, ...props
}) {
  return (
    <button
      {...props}
      onClick={onClick}
      disabled={disabled || loading}
      aria-busy={loading}
      className={`${className} disabled:pointer-events-none disabled:opacity-60 disabled:cursor-not-allowed`}
    >
      {loading ? <><Loader2 aria-hidden="true" className="inline h-4 w-4 shrink-0 animate-spin" /> <span>{loadingText}</span></> : children}
    </button>
  );
}
