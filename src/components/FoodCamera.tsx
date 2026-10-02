import React, { useState, useRef, useEffect, useMemo } from 'react';
import { ChevronDown, Camera, Sparkles, Plus, Check, AlertTriangle, RotateCcw } from 'lucide-react';
import { useSearchableFoods, useLogFood, type SearchFood } from '../hooks/useTracker';
import type { MealSlot } from '../lib/db';
import { recognizeFoodPhoto, type FoodVisionResult } from '../lib/foodVision';
import { searchFoods } from '../lib/searchSynonyms';
import { MEALS, currentMeal } from '../lib/meals';
import { useTheme } from '../theme';



const CONFIDENCE_LABEL: Record<string, string> = { baixa: 'confiança baixa', media: 'confiança média', alta: 'confiança alta' };

type Stage = 'idle' | 'camera' | 'analyzing' | 'result' | 'error';

export default function FoodCamera({ geminiApiKey }: { geminiApiKey?: string }) {
  const C = useTheme();
  const inputStyle = { background: C.chipBg, color: C.ink };
  const foods = useSearchableFoods();
  const logFood = useLogFood();

  const [open, setOpen] = useState(false);
  const [stage, setStage] = useState<Stage>('idle');
  const [errorMsg, setErrorMsg] = useState('');
  const [result, setResult] = useState<FoodVisionResult | null>(null);
  const [query, setQuery] = useState('');
  const [selected, setSelected] = useState<SearchFood | null>(null);
  const [grams, setGrams] = useState(100);
  const [meal, setMeal] = useState<MealSlot>(currentMeal);
  const [added, setAdded] = useState(false);

  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const streamRef = useRef<MediaStream | null>(null);

  const stopCamera = () => {
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
  };
  useEffect(() => () => stopCamera(), []);

  const results = useMemo(() => (query.trim() ? searchFoods(foods, query, 8) : []), [foods, query]);

  const reset = () => {
    stopCamera();
    setStage('idle'); setResult(null); setSelected(null); setQuery(''); setGrams(100); setErrorMsg('');
  };

  const startCamera = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' } });
      streamRef.current = stream;
      setStage('camera');
      // espera o próximo tick pro <video> já estar montado (stage mudou)
      requestAnimationFrame(async () => {
        const video = videoRef.current;
        if (video) { video.srcObject = stream; await video.play(); }
      });
    } catch {
      setErrorMsg('Não deu pra acessar a câmera (permissão negada ou indisponível).');
      setStage('error');
    }
  };

  const capture = async () => {
    const video = videoRef.current, canvas = canvasRef.current;
    if (!video || !canvas || !geminiApiKey) return;
    canvas.width = video.videoWidth; canvas.height = video.videoHeight;
    canvas.getContext('2d')!.drawImage(video, 0, 0);
    const dataUrl = canvas.toDataURL('image/jpeg', 0.85);
    stopCamera();
    setStage('analyzing');
    try {
      const base64 = dataUrl.split(',')[1];
      const r = await recognizeFoodPhoto(base64, 'image/jpeg', { apiKey: geminiApiKey });
      if (r.notFood || !r.foodName) {
        setErrorMsg('Não consegui identificar comida nessa foto. Tenta de novo com mais luz/mais de perto, ou busca manualmente.');
        setStage('error');
        return;
      }
      setResult(r);
      setQuery(r.foodName);
      if (r.estimatedAmount) setGrams(Math.round(r.estimatedAmount));
      setStage('result');
    } catch (e) {
      setErrorMsg(e instanceof Error ? e.message : 'Falha ao analisar a foto.');
      setStage('error');
    }
  };

  const confirm = async () => {
    if (!selected) return;
    await logFood(selected.id, meal, grams);
    setAdded(true);
    setTimeout(() => { setAdded(false); reset(); }, 1500);
  };

  if (!geminiApiKey) {
    return (
      <div className="rounded-2xl p-4 mb-4" style={{ background: C.card }}>
        <div className="flex items-center gap-2 text-sm" style={{ color: C.slate }}>
          <Camera size={15} /> Reconhecer alimento por foto
        </div>
        <p className="text-xs mt-2" style={{ color: C.slate }}>
          Precisa de uma chave do Gemini configurada em Ajustes pra usar isso.
        </p>
      </div>
    );
  }

  return (
    <div className="rounded-2xl p-4 mb-4" style={{ background: C.card }}>
      <button onClick={() => { setOpen((o) => !o); if (open) reset(); }} className="w-full flex items-center justify-between text-sm" style={{ color: C.slate }}>
        <span className="flex items-center gap-2"><Camera size={15} /> Reconhecer alimento por foto</span>
        <ChevronDown size={16} style={{ transform: open ? 'rotate(180deg)' : 'none', transition: 'transform .2s' }} />
      </button>

      {open && (
        <div className="mt-3" style={{ color: C.ink }}>
          <canvas ref={canvasRef} className="hidden" />

          {stage === 'idle' && (
            <>
              <button onClick={startCamera} className="w-full flex items-center justify-center gap-2 text-sm py-2 rounded-xl text-white mb-2" style={{ background: C.teal }}>
                <Camera size={15} /> Tirar foto do alimento
              </button>
              <p className="text-[11px]" style={{ color: C.slate }}>
                A foto é enviada só pro Gemini (Google) processar — não fica salva no app nem em nenhum lugar depois disso.
                A IA reconhece o alimento e estima o peso; a nutrição usada é sempre a da base real (TACO), nunca inventada pela IA.
              </p>
            </>
          )}

          {stage === 'camera' && (
            <div>
              <video ref={videoRef} className="w-full rounded-xl mb-2" style={{ maxHeight: 260, objectFit: 'cover', background: '#000' }} muted playsInline />
              <div className="flex gap-2">
                <button onClick={capture} className="flex-1 flex items-center justify-center gap-2 text-sm py-2 rounded-xl text-white" style={{ background: C.teal }}>
                  <Camera size={15} /> Capturar
                </button>
                <button onClick={reset} className="px-4 text-sm py-2 rounded-xl" style={{ background: C.line, color: C.ink }}>Cancelar</button>
              </div>
            </div>
          )}

          {stage === 'analyzing' && (
            <p className="text-sm py-3 flex items-center gap-2" style={{ color: C.slate }}>
              <Sparkles size={15} /> Analisando a foto…
            </p>
          )}

          {stage === 'error' && (
            <div>
              <p className="text-sm py-2 flex items-start gap-2" style={{ color: C.coral }}>
                <AlertTriangle size={15} className="mt-0.5 flex-shrink-0" /> {errorMsg}
              </p>
              <button onClick={reset} className="text-sm px-3 py-1.5 rounded-xl flex items-center gap-1.5" style={{ background: C.chipBg, color: C.ink }}>
                <RotateCcw size={13} /> Tentar de novo
              </button>
            </div>
          )}

          {stage === 'result' && result && (
            <div>
              <div className="rounded-xl p-3 mb-3" style={{ background: C.tintAmber }}>
                <div className="text-sm font-medium mb-1" style={{ color: C.ink }}>Parece: {result.foodName}</div>
                <div className="text-xs" style={{ color: C.warn }}>
                  ⚠ Estimativa da IA{result.confidence ? ` (${CONFIDENCE_LABEL[result.confidence]})` : ''}
                  {result.estimatedAmount ? ` — ~${Math.round(result.estimatedAmount)}${result.unit ?? 'g'}` : ''}. Sem objeto de referência na foto, pode errar — confira o peso abaixo.
                </div>
                {result.notes && <div className="text-[11px] mt-1" style={{ color: C.slate }}>{result.notes}</div>}
              </div>

              <p className="text-xs mb-1.5" style={{ color: C.slate }}>Escolhe o alimento mais parecido na base real:</p>
              <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Buscar alimento"
                className="w-full px-3 py-2 rounded-xl outline-none text-sm mb-2" style={inputStyle} />

              {results.length > 0 && (
                <div className="space-y-1 mb-3">
                  {results.map((f) => (
                    <button key={f.id} onClick={() => setSelected(f)}
                      className="w-full text-left text-sm px-3 py-2 rounded-lg flex items-center justify-between"
                      style={{ background: selected?.id === f.id ? C.teal : C.chipBg, color: selected?.id === f.id ? '#fff' : C.ink }}>
                      <span className="truncate">{f.name}</span>
                      <span className="text-xs opacity-80 flex-shrink-0 ml-2">{Math.round(f.kcal100)} kcal/100g</span>
                    </button>
                  ))}
                </div>
              )}

              {selected && (
                <div className="rounded-xl p-3" style={{ background: C.chipBg }}>
                  <div className="flex items-center gap-2 mb-2 flex-wrap">
                    {MEALS.map((m) => (
                      <button key={m.value} onClick={() => setMeal(m.value)} className="text-xs px-2.5 py-1 rounded-full"
                        style={{ background: meal === m.value ? C.teal : C.line, color: meal === m.value ? '#fff' : C.ink }}>{m.label}</button>
                    ))}
                  </div>
                  <div className="flex items-center gap-2">
                    <input type="number" value={grams} onChange={(e) => setGrams(Math.max(0, Number(e.target.value)))}
                      className="w-20 text-sm text-right px-2 py-1 rounded-lg outline-none" style={inputStyle} />
                    <span className="text-xs" style={{ color: C.slate }}>g (estimativa — confira) · {Math.round((selected.kcal100 * grams) / 100)} kcal</span>
                    <button onClick={confirm} className="ml-auto flex items-center gap-1 text-sm px-3 py-1.5 rounded-xl text-white" style={{ background: added ? C.green : C.teal }}>
                      {added ? <><Check size={14} /> Adicionado</> : <><Plus size={14} /> Adicionar</>}
                    </button>
                  </div>
                </div>
              )}

              <button onClick={reset} className="text-xs mt-3 flex items-center gap-1" style={{ color: C.slate }}>
                <RotateCcw size={12} /> Tirar outra foto
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
