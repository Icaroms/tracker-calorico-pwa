import React, { useState, useRef, useEffect } from 'react';
import { ChevronDown, ScanLine, Camera, Search, Plus, Check, X, WifiOff } from 'lucide-react';
import { fetchOffProduct, offFoodId, type OffFood } from '../lib/openFoodFacts';
import { startBarcodeScan, isValidGtin, cleanBarcode, type ScannerHandle } from '../lib/barcode';
import { useSaveCustomFood, useLogFood } from '../hooks/useTracker';
import { db, type MealSlot } from '../lib/db';
import { MEALS, currentMeal } from '../lib/meals';
import { useTheme } from '../theme';

/**
 * Leitor de código de barras de embalagem.
 *
 * Fluxo: câmera → código lido e validado (dígito verificador) → procura
 * primeiro nos produtos JÁ escaneados (funciona offline) → senão busca no
 * Open Food Facts → usuário confere gramas/refeição → salva como alimento
 * (id = 'off:<código>') e registra no dia.
 *
 * A câmera funciona em qualquer navegador moderno: usa a API nativa quando
 * existe e cai pro ZXing quando não (iPhone, Firefox, Chrome do Windows) —
 * ver lib/barcode.ts.
 */
type Status = 'idle' | 'loading' | 'notfound' | 'offline' | 'invalid' | 'camera-error';

export default function BarcodeScanner() {
  const C = useTheme();
  const inputStyle = { background: C.chipBg, color: C.ink };
  const saveCustom = useSaveCustomFood();
  const logFood = useLogFood();

  const [open, setOpen] = useState(false);
  const [scanning, setScanning] = useState(false);
  const [manual, setManual] = useState('');
  const [status, setStatus] = useState<Status>('idle');
  const [lastCode, setLastCode] = useState('');
  const [product, setProduct] = useState<OffFood | null>(null);
  const [fromCache, setFromCache] = useState(false);
  const [grams, setGrams] = useState(100);
  const [meal, setMeal] = useState<MealSlot>(currentMeal);
  const [added, setAdded] = useState(false);

  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const scannerRef = useRef<ScannerHandle | null>(null);

  const cameraAvailable = typeof navigator !== 'undefined' && !!navigator.mediaDevices?.getUserMedia;

  const stopCamera = () => {
    scannerRef.current?.stop();
    scannerRef.current = null;
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
    setScanning(false);
  };
  useEffect(() => () => stopCamera(), []);

  const lookup = async (raw: string) => {
    const code = cleanBarcode(raw);
    setLastCode(code); setProduct(null); setAdded(false); setFromCache(false);
    if (!isValidGtin(code)) { setStatus('invalid'); return; }
    setStatus('loading');

    // 1) Já escaneado antes? Usa o salvo — funciona sem internet.
    const cached = await db.customFoods.get(offFoodId(code));
    if (cached) {
      setProduct({ barcode: code, id: cached.id!, name: cached.name, per100g: cached.per100g, lactoseLevel: cached.lactoseLevel ?? 'none' });
      setFromCache(true); setStatus('idle');
      return;
    }

    // 2) Senão, Open Food Facts.
    try {
      const found = await fetchOffProduct(code);
      if (found) { setProduct(found); setStatus('idle'); } else setStatus('notfound');
    } catch {
      setStatus('offline');
    }
  };

  const startCamera = async () => {
    setStatus('idle'); setProduct(null);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'environment', width: { ideal: 1280 }, height: { ideal: 720 } },
      });
      streamRef.current = stream;
      setScanning(true);
      // Espera o <video> montar (depende de scanning=true) antes de ligar o stream nele.
      await new Promise((r) => requestAnimationFrame(r));
      const video = videoRef.current!;
      video.srcObject = stream;
      await video.play();
      scannerRef.current = await startBarcodeScan(video, stream, (code) => {
        if (navigator.vibrate) navigator.vibrate(80); // retorno tátil no celular
        stopCamera();
        lookup(code);
      });
    } catch {
      stopCamera();
      setStatus('camera-error');
    }
  };

  const add = async () => {
    if (!product) return;
    const id = await saveCustom({ id: product.id, name: product.name, per100g: product.per100g, lactoseLevel: product.lactoseLevel });
    await logFood(id, meal, grams);
    setAdded(true);
    setTimeout(() => { setAdded(false); setProduct(null); setManual(''); setStatus('idle'); }, 1800);
  };

  const kcal = product ? Math.round(((product.per100g.kcal ?? 0) * grams) / 100) : 0;

  return (
    <div className="rounded-2xl p-4 mb-4" style={{ background: C.card }}>
      <button onClick={() => { setOpen((o) => !o); if (open) stopCamera(); }} className="w-full flex items-center justify-between text-sm" style={{ color: C.slate }}>
        <span className="flex items-center gap-2"><ScanLine size={15} /> Escanear código de barras</span>
        <ChevronDown size={16} style={{ transform: open ? 'rotate(180deg)' : 'none', transition: 'transform .2s' }} />
      </button>

      {open && (
        <div className="mt-3" style={{ color: C.ink }}>
          {scanning ? (
            <div className="mb-3">
              <div className="relative">
                <video ref={videoRef} className="w-full rounded-xl" style={{ maxHeight: 240, objectFit: 'cover', background: '#000' }} muted playsInline />
                {/* Guia visual de onde posicionar o código */}
                <div className="absolute inset-x-8 top-1/2 -translate-y-1/2 h-16 rounded-lg pointer-events-none"
                  style={{ border: `2px solid ${C.teal}`, boxShadow: '0 0 0 9999px rgba(0,0,0,0.25)' }} />
              </div>
              <p className="text-[11px] mt-1.5 text-center" style={{ color: C.slate }}>Centralize o código de barras no retângulo</p>
              <button onClick={stopCamera} className="mt-2 w-full text-sm py-2 rounded-xl" style={{ background: C.line, color: C.ink }}>Parar câmera</button>
            </div>
          ) : (
            cameraAvailable && (
              <button onClick={startCamera} className="w-full flex items-center justify-center gap-2 text-sm py-2 rounded-xl text-white mb-3" style={{ background: C.teal }}>
                <Camera size={15} /> Escanear com a câmera
              </button>
            )
          )}

          {/* Entrada manual */}
          <form onSubmit={(e) => { e.preventDefault(); if (manual.trim()) lookup(manual); }}
            className="flex items-center gap-2 mb-1 px-3 py-2 rounded-xl" style={{ background: C.chipBg }}>
            <Search size={15} style={{ color: C.slate }} />
            <input value={manual} onChange={(e) => setManual(e.target.value)} inputMode="numeric" placeholder="Ou digite o código (EAN)"
              className="bg-transparent outline-none text-sm flex-1" style={{ color: C.ink }} />
            <button type="submit" className="text-xs px-3 py-1 rounded-full text-white" style={{ background: C.teal }}>Buscar</button>
          </form>

          {/* Estados */}
          {status === 'loading' && <p className="text-sm py-2" style={{ color: C.slate }}>Buscando produto…</p>}
          {status === 'invalid' && (
            <p className="text-sm py-2" style={{ color: C.coral }}>
              Código "{lastCode}" inválido — confira os números (precisa ter 8, 12 ou 13 dígitos).
            </p>
          )}
          {status === 'notfound' && (
            <p className="text-sm py-2" style={{ color: C.coral }}>
              Produto {lastCode} não está no Open Food Facts. Cadastre em "Cadastrar alimento próprio" com os dados do rótulo.
            </p>
          )}
          {status === 'offline' && (
            <p className="text-sm py-2 flex items-start gap-2" style={{ color: C.coral }}>
              <WifiOff size={15} className="mt-0.5 flex-shrink-0" />
              Sem conexão pra buscar esse produto. Produtos já escaneados antes funcionam offline.
            </p>
          )}
          {status === 'camera-error' && (
            <p className="text-sm py-2" style={{ color: C.coral }}>
              Não deu pra abrir a câmera (permissão negada ou em uso por outro app). Use o campo de digitar.
            </p>
          )}

          {/* Resultado */}
          {product && (
            <div className="rounded-xl p-3 mt-2" style={{ background: C.chipBg }}>
              <div className="flex items-start justify-between gap-2">
                <div className="text-sm font-medium">{product.name}</div>
                <button onClick={() => setProduct(null)} aria-label="Fechar resultado"><X size={14} style={{ color: C.slate }} /></button>
              </div>
              {product.brand && <div className="text-[11px]" style={{ color: C.slate }}>{product.brand}</div>}
              <div className="text-xs mt-1 mb-2" style={{ color: C.slate }}>
                {Math.round(product.per100g.kcal ?? 0)} kcal/100g · {Math.round(product.per100g.protein ?? 0)}g proteína
                {product.per100g.sodium != null && ` · ${Math.round(product.per100g.sodium)}mg sódio`}
                {' · '}{product.lactoseLevel === 'none' ? 'sem lactose indicada' : 'pode ter lactose'}
              </div>
              <div className="flex items-center gap-1.5 mb-2 flex-wrap">
                {MEALS.map((m) => (
                  <button key={m.value} onClick={() => setMeal(m.value)} className="text-xs px-2.5 py-1 rounded-full"
                    style={{ background: meal === m.value ? C.teal : C.line, color: meal === m.value ? '#fff' : C.ink }}>{m.label}</button>
                ))}
              </div>
              <div className="flex items-center gap-2">
                <input type="number" value={grams} onChange={(e) => setGrams(Math.max(0, Number(e.target.value)))}
                  className="w-20 text-sm text-right px-2 py-1 rounded-lg outline-none" style={inputStyle} />
                <span className="text-xs" style={{ color: C.slate }}>g · {kcal} kcal</span>
                <button onClick={add} disabled={grams <= 0} className="ml-auto flex items-center gap-1 text-sm px-3 py-1.5 rounded-xl text-white disabled:opacity-50" style={{ background: added ? C.green : C.teal }}>
                  {added ? <><Check size={14} /> Adicionado</> : <><Plus size={14} /> Adicionar ao dia</>}
                </button>
              </div>
              <p className="text-[10px] mt-2" style={{ color: C.slate }}>
                {fromCache ? 'Já escaneado antes — carregado do aparelho, sem internet.' : 'Dados do Open Food Facts (comunitário — confira com o rótulo). Fica salvo pra próximas vezes.'}
              </p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
