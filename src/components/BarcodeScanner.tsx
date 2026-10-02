import React, { useState, useRef, useEffect } from 'react';
import { ChevronDown, ScanLine, Camera, Search, Plus, Check, X } from 'lucide-react';
import { fetchOffProduct, type OffFood } from '../lib/openFoodFacts';
import { useSaveCustomFood, useLogFood } from '../hooks/useTracker';
import type { MealSlot } from '../lib/db';
import { useTheme } from '../theme';

const MEALS: { value: MealSlot; label: string }[] = [
  { value: 'cafe', label: 'Café' }, { value: 'almoco', label: 'Almoço' },
  { value: 'lanche', label: 'Lanche' }, { value: 'jantar', label: 'Jantar' }, { value: 'ceia', label: 'Ceia' },
];

type Status = 'idle' | 'loading' | 'notfound' | 'error';

export default function BarcodeScanner() {
  const C = useTheme();
  const inputStyle = { background: C.chipBg, color: C.ink };
  const saveCustom = useSaveCustomFood();
  const logFood = useLogFood();

  const [open, setOpen] = useState(false);
  const [scanning, setScanning] = useState(false);
  const [manual, setManual] = useState('');
  const [status, setStatus] = useState<Status>('idle');
  const [product, setProduct] = useState<OffFood | null>(null);
  const [grams, setGrams] = useState(100);
  const [meal, setMeal] = useState<MealSlot>('lanche');
  const [added, setAdded] = useState(false);

  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const loopRef = useRef<number | null>(null);

  const supported = typeof window !== 'undefined' && 'BarcodeDetector' in window;

  const stopCamera = () => {
    if (loopRef.current) cancelAnimationFrame(loopRef.current);
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
    setScanning(false);
  };

  useEffect(() => () => stopCamera(), []);

  const lookup = async (code: string) => {
    setStatus('loading'); setProduct(null); setAdded(false);
    try {
      const found = await fetchOffProduct(code.trim());
      if (found) { setProduct(found); setStatus('idle'); } else setStatus('notfound');
    } catch { setStatus('error'); }
  };

  const startCamera = async () => {
    if (!supported) return;
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' } });
      streamRef.current = stream;
      setScanning(true);
      const video = videoRef.current!;
      video.srcObject = stream;
      await video.play();
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const detector = new (window as any).BarcodeDetector({ formats: ['ean_13', 'ean_8', 'upc_a', 'upc_e'] });
      const tick = async () => {
        if (!streamRef.current) return;
        try {
          const codes = await detector.detect(video);
          if (codes && codes.length) { stopCamera(); lookup(codes[0].rawValue); return; }
        } catch { /* ignora frames sem leitura */ }
        loopRef.current = requestAnimationFrame(tick);
      };
      loopRef.current = requestAnimationFrame(tick);
    } catch { setStatus('error'); setScanning(false); }
  };

  const add = async () => {
    if (!product) return;
    const id = await saveCustom({ name: product.name, per100g: product.per100g, lactoseLevel: product.lactoseLevel });
    await logFood(id, meal, grams);
    setAdded(true);
    setTimeout(() => { setAdded(false); setProduct(null); setManual(''); }, 2000);
  };

  return (
    <div className="rounded-2xl p-4 mb-4" style={{ background: C.card }}>
      <button onClick={() => setOpen((o) => !o)} className="w-full flex items-center justify-between text-sm" style={{ color: C.slate }}>
        <span className="flex items-center gap-2"><ScanLine size={15} /> Escanear código de barras</span>
        <ChevronDown size={16} style={{ transform: open ? 'rotate(180deg)' : 'none', transition: 'transform .2s' }} />
      </button>

      {open && (
        <div className="mt-3" style={{ color: C.ink }}>
          {/* Câmera */}
          {scanning ? (
            <div className="mb-3">
              <video ref={videoRef} className="w-full rounded-xl" style={{ maxHeight: 220, objectFit: 'cover', background: '#000' }} muted playsInline />
              <button onClick={stopCamera} className="mt-2 w-full text-sm py-2 rounded-xl" style={{ background: C.line, color: C.ink }}>Parar câmera</button>
            </div>
          ) : (
            supported && (
              <button onClick={startCamera} className="w-full flex items-center justify-center gap-2 text-sm py-2 rounded-xl text-white mb-3" style={{ background: C.teal }}>
                <Camera size={15} /> Escanear com a câmera
              </button>
            )
          )}

          {/* Entrada manual */}
          <div className="flex items-center gap-2 mb-1 px-3 py-2 rounded-xl" style={{ background: C.chipBg }}>
            <Search size={15} style={{ color: C.slate }} />
            <input value={manual} onChange={(e) => setManual(e.target.value)} inputMode="numeric" placeholder="Ou digite o código (EAN)"
              className="bg-transparent outline-none text-sm flex-1" style={{ color: C.ink }} />
            <button onClick={() => manual.trim() && lookup(manual)} className="text-xs px-3 py-1 rounded-full text-white" style={{ background: C.teal }}>Buscar</button>
          </div>
          {!supported && <p className="text-[11px] mb-2" style={{ color: C.slate }}>Câmera de scan não suportada neste navegador — use a entrada manual.</p>}

          {/* Estados */}
          {status === 'loading' && <p className="text-sm py-2" style={{ color: C.slate }}>Buscando produto…</p>}
          {status === 'notfound' && <p className="text-sm py-2" style={{ color: C.coral }}>Produto não encontrado na base. Cadastre manualmente acima.</p>}
          {status === 'error' && <p className="text-sm py-2" style={{ color: C.coral }}>Falha (sem internet ou câmera negada). Tente a entrada manual.</p>}

          {/* Resultado */}
          {product && (
            <div className="rounded-xl p-3 mt-2" style={{ background: C.chipBg }}>
              <div className="text-sm font-medium mb-1">{product.name}</div>
              <div className="text-xs mb-2" style={{ color: C.slate }}>
                {Math.round(product.per100g.kcal ?? 0)} kcal/100g · {Math.round(product.per100g.protein ?? 0)}g proteína · {product.lactoseLevel === 'none' ? 'sem lactose' : 'pode ter lactose'}
              </div>
              <div className="flex items-center gap-2 mb-2 flex-wrap">
                {MEALS.map((m) => (
                  <button key={m.value} onClick={() => setMeal(m.value)} className="text-xs px-2.5 py-1 rounded-full"
                    style={{ background: meal === m.value ? C.teal : C.line, color: meal === m.value ? '#fff' : C.ink }}>{m.label}</button>
                ))}
              </div>
              <div className="flex items-center gap-2">
                <input type="number" value={grams} onChange={(e) => setGrams(Math.max(0, Number(e.target.value)))}
                  className="w-20 text-sm text-right px-2 py-1 rounded-lg outline-none" style={inputStyle} />
                <span className="text-xs" style={{ color: C.slate }}>g · {Math.round(((product.per100g.kcal ?? 0) * grams) / 100)} kcal</span>
                <button onClick={add} className="ml-auto flex items-center gap-1 text-sm px-3 py-1.5 rounded-xl text-white" style={{ background: added ? C.green : C.teal }}>
                  {added ? <><Check size={14} /> Adicionado</> : <><Plus size={14} /> Adicionar ao dia</>}
                </button>
              </div>
              <p className="text-[10px] mt-2" style={{ color: C.slate }}>Salvo nos seus alimentos — fica disponível na busca depois.</p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
