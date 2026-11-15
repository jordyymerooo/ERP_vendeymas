import { forwardRef, useImperativeHandle, useLayoutEffect, useRef, useState } from 'react';
import { RotateCcw } from 'lucide-react';

export default forwardRef(function SignaturePadField(_, ref) {
  const container = useRef(null);
  const canvas = useRef(null);
  const strokes = useRef([]);
  const active = useRef(null);
  const originalSize = useRef(null);
  const view = useRef({ scale: 1, x: 0, y: 0, ratio: 1 });
  const [hasInk, setHasInk] = useState(false);

  function paint() {
    const element = canvas.current;
    const context = element.getContext('2d');
    const { ratio, scale, x, y } = view.current;
    context.resetTransform();
    context.clearRect(0, 0, element.width, element.height);
    context.setTransform(ratio * scale, 0, 0, ratio * scale, ratio * x, ratio * y);
    context.strokeStyle = context.fillStyle = '#0f172a';
    context.lineWidth = 2.2;
    context.lineCap = context.lineJoin = 'round';
    for (const stroke of strokes.current) {
      const first = stroke[0];
      context.beginPath();
      if (stroke.length === 1) {
        context.arc(first.x, first.y, 1.1, 0, 2 * Math.PI);
        context.fill();
        continue;
      }
      context.moveTo(first.x, first.y);
      for (const point of stroke.slice(1)) context.lineTo(point.x, point.y);
      context.stroke();
    }
  }

  useLayoutEffect(() => {
    const element = canvas.current;
    function resize() {
      const { width, height } = element.getBoundingClientRect();
      if (!width || !height) return;
      originalSize.current ??= { width, height };
      const original = originalSize.current;
      const ratio = window.devicePixelRatio || 1;
      const scale = Math.min(width / original.width, height / original.height);
      view.current = {
        ratio, scale,
        x: (width - original.width * scale) / 2,
        y: (height - original.height * scale) / 2,
      };
      element.width = Math.round(width * ratio);
      element.height = Math.round(height * ratio);
      paint();
    }
    resize();
    const observer = new ResizeObserver(resize);
    observer.observe(container.current);
    window.addEventListener('resize', resize);
    return () => {
      observer.disconnect();
      window.removeEventListener('resize', resize);
    };
  }, []);

  function clear() {
    strokes.current = [];
    active.current = null;
    setHasInk(false);
    paint();
  }

  useImperativeHandle(ref, () => ({
    clear,
    isEmpty: () => strokes.current.length === 0,
    toDataURL: () => canvas.current.toDataURL('image/png'),
  }));

  function addPoints(event) {
    const bounds = canvas.current.getBoundingClientRect();
    const { x, y, scale } = view.current;
    const samples = event.nativeEvent.getCoalescedEvents?.() ?? [];
    for (const point of samples.length ? samples : [event]) {
      active.current.points.push({
        x: (point.clientX - bounds.left - x) / scale,
        y: (point.clientY - bounds.top - y) / scale,
      });
    }
    paint();
  }

  function start(event) {
    if (active.current || event.button !== 0) return;
    event.currentTarget.setPointerCapture(event.pointerId);
    const points = [];
    active.current = { id: event.pointerId, points };
    strokes.current.push(points);
    addPoints(event);
    setHasInk(true);
  }

  function finish(event) {
    if (active.current?.id !== event.pointerId) return;
    if (event.type === 'pointerup') addPoints(event);
    active.current = null;
  }

  return (
    <fieldset className="min-w-0 space-y-2">
      <legend className="text-sm font-bold text-slate-700">Firma del Cliente</legend>
      <div ref={container} className="h-44 w-full overflow-hidden rounded-xl border border-dashed border-slate-300 bg-slate-50 sm:h-48">
        <canvas
          ref={canvas}
          aria-label="Lienzo para firmar con el dedo, lápiz o ratón"
          className="block h-full w-full touch-none select-none cursor-crosshair"
          style={{ touchAction: 'none' }}
          onPointerDown={start}
          onPointerMove={(event) => {
            if (active.current?.id === event.pointerId) addPoints(event);
          }}
          onPointerUp={finish}
          onPointerCancel={finish}
          onLostPointerCapture={finish}
        />
      </div>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <button type="button" onClick={clear} disabled={!hasInk} className="inline-flex min-h-[42px] items-center gap-2 rounded-lg bg-slate-100 px-4 text-sm font-semibold text-slate-700 disabled:opacity-50">
          <RotateCcw className="h-4 w-4" /> Limpiar Firma
        </button>
        <span role="status" className={`rounded-full px-2.5 py-1 text-xs font-semibold ${hasInk ? 'bg-emerald-100 text-emerald-800' : 'bg-slate-100 text-slate-600'}`}>
          {hasInk ? 'Firma capturada' : 'Sin firma'}
        </span>
      </div>
    </fieldset>
  );
});
