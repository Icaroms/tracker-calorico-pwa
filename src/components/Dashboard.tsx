import React from 'react';
import { Droplet, Flame, TrendingDown, AlertTriangle, Plus, Check, RefreshCw, Download } from 'lucide-react';
import type { NutritionPlan } from '../lib/calorieEngine';
import type { NutrientProgress, NutrientKey } from '../lib/dailyTotals';
import type { MealOption } from '../lib/mealSuggester';
import WeightSparkline from './WeightSparkline';
import { useTheme, type Palette } from '../theme';

const LABEL: Partial<Record<NutrientKey, string>> = {
  protein: 'Proteína', carb: 'Carboidrato', fat: 'Gordura total', saturatedFat: 'Gordura saturada',
  fiberSoluble: 'Fibra solúvel', omega3: 'Ômega-3', calcium: 'Cálcio', magnesium: 'Magnésio',
  iron: 'Ferro', potassium: 'Potássio', sodium: 'Sódio', selenium: 'Selênio', vitaminA: 'Vit. A', vitaminC: 'Vit. C',
  vitaminB1: 'B1', vitaminB2: 'B2', vitaminB3: 'B3', vitaminB5: 'B5', vitaminB6: 'B6',
  vitaminB7: 'B7 (est.)', vitaminB9: 'B9', vitaminB12: 'B12', vitaminD: 'Vit. D',
};

const MACRO_KEYS: NutrientKey[] = ['protein', 'carb', 'fat', 'saturatedFat', 'sodium'];

const statusColor = (p: NutrientProgress, C: Palette) =>
  p.direction === 'max' ? (p.status === 'over' ? C.coral : C.green)
    : p.percent >= 100 ? C.green : p.percent >= 60 ? C.amber : C.coral;

export interface DashboardProps {
  plan: NutritionPlan;
  kcalConsumed: number;
  progress: NutrientProgress[];
  waterMl: number;
  onAddWater: (ml: number) => void;
  weight: Array<{ idx: number; weightKg: number; avg: number }>;
  suggestions: MealOption[];
  fasting: { advice: string; reason: string };
  recalcRecommended: boolean;
  onPickSuggestion?: (s: MealOption) => void;
  onExportXlsx?: () => void;
  /** kcal gasto em exercício hoje — soma à meta base pro anel de calorias. */
  exerciseKcalBurned?: number;
}

function BalanceRing({ consumed, target }: { consumed: number; target: number }) {
  const C = useTheme();
  const pct = Math.min(target > 0 ? consumed / target : 0, 1);
  const r = 88, circ = 2 * Math.PI * r;
  const over = consumed > target;
  return (
    <div className="relative" style={{ width: 220, height: 220 }}>
      <svg width="220" height="220" className="-rotate-90">
        <defs>
          <linearGradient id="ring" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0%" stopColor={C.teal} /><stop offset="100%" stopColor={C.green} />
          </linearGradient>
        </defs>
        <circle cx="110" cy="110" r={r} fill="none" stroke={C.line} strokeWidth="16" />
        <circle cx="110" cy="110" r={r} fill="none" stroke={over ? C.coral : 'url(#ring)'} strokeWidth="16"
          strokeLinecap="round" strokeDasharray={circ} strokeDashoffset={circ * (1 - pct)}
          style={{ transition: 'stroke-dashoffset .6s ease' }} />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span className="text-xs uppercase tracking-widest" style={{ color: C.slate }}>{over ? 'acima da meta' : 'restam hoje'}</span>
        <span className="text-5xl font-light tabular-nums tracking-tight" style={{ color: C.ink }}>
          {over ? `+${consumed - target}` : Math.max(target - consumed, 0)}
        </span>
        <span className="text-sm" style={{ color: C.slate }}>de {target} kcal</span>
      </div>
    </div>
  );
}

function Bar({ p }: { p: NutrientProgress }) {
  const C = useTheme();
  if (!p.hasData) {
    return (
      <div>
        <div className="flex justify-between items-baseline mb-1">
          <span className="text-sm" style={{ color: C.slate }}>{LABEL[p.key] ?? p.key}</span>
          <span className="text-xs" style={{ color: C.slate }} title="Nenhum alimento registrado hoje mede este nutriente — não é o mesmo que 'consumiu zero'.">
            sem dado hoje
          </span>
        </div>
        <div className="h-2 rounded-full" style={{ background: C.line, opacity: 0.4 }} />
      </div>
    );
  }
  const col = statusColor(p, C);
  const pct = Math.min(p.percent, 100);
  return (
    <div>
      <div className="flex justify-between items-baseline mb-1">
        <span className="text-sm" style={{ color: C.ink }}>{LABEL[p.key] ?? p.key}{p.direction === 'max' ? ' (limite)' : ''}</span>
        <span className="text-xs tabular-nums" style={{ color: C.slate }}>{p.consumed} / {p.target} {p.direction === 'max' && p.status === 'over' ? '⚠' : ''}</span>
      </div>
      <div className="h-2 rounded-full" style={{ background: C.line }}>
        <div className="h-2 rounded-full" style={{ width: `${pct}%`, background: col, transition: 'width .5s ease' }} />
      </div>
    </div>
  );
}

export default function Dashboard(props: DashboardProps) {
  const C = useTheme();
  const { plan, kcalConsumed, progress, waterMl, onAddWater, weight, suggestions, fasting, recalcRecommended, exerciseKcalBurned = 0 } = props;
  const macros = progress.filter((p) => MACRO_KEYS.includes(p.key));
  const micros = progress.filter((p) => !MACRO_KEYS.includes(p.key));
  const protein = progress.find((p) => p.key === 'protein');

  return (
    <div style={{ background: C.bg, color: C.ink, fontFamily: 'ui-sans-serif, system-ui, sans-serif' }} className="p-5 rounded-2xl">
      <div className="flex items-center justify-between mb-5 flex-wrap gap-2">
        <div>
          <div className="text-xs uppercase tracking-widest" style={{ color: C.slate }}>Hoje</div>
          <h1 className="text-2xl font-semibold tracking-tight">Seu dia</h1>
        </div>
        <div className="flex gap-2 items-center">
          {fasting.advice !== 'ok' && (
            <span className="flex items-center gap-1 text-xs px-3 py-1.5 rounded-full" style={{ background: C.tintAmber, color: C.amber }}>
              <AlertTriangle size={13} /> Jejum: {fasting.advice}
            </span>
          )}
          {props.onExportXlsx && (
            <button onClick={props.onExportXlsx} className="flex items-center gap-1 text-xs px-3 py-1.5 rounded-full" style={{ background: C.line, color: C.ink }}>
              <Download size={13} /> Planilha
            </button>
          )}
        </div>
      </div>

      {recalcRecommended && (
        <div className="flex items-center gap-2 text-sm mb-4 px-4 py-2 rounded-xl" style={{ background: C.tintGreen, color: C.green }}>
          <RefreshCw size={15} /> Seu peso mudou — vale recalcular o plano.
        </div>
      )}

      <div className="rounded-2xl p-5 mb-4 flex flex-col md:flex-row items-center gap-6" style={{ background: C.card }}>
        <BalanceRing consumed={kcalConsumed} target={plan.calories.target + exerciseKcalBurned} />
        <div className="flex-1 w-full space-y-4">
          {exerciseKcalBurned > 0 && (
            <div className="flex items-center gap-2 text-xs px-3 py-1.5 rounded-full w-fit" style={{ background: C.tintGreen, color: C.green }}>
              <Flame size={12} /> +{exerciseKcalBurned} kcal de exercício hoje — já somado à meta
            </div>
          )}
          <div className="flex items-center gap-2 text-sm" style={{ color: C.slate }}>
            <Flame size={15} style={{ color: C.amber }} /> Macronutrientes {protein && <span className="ml-auto text-xs">proteína prioritária</span>}
          </div>
          {macros.map((p) => <Bar key={p.key} p={p} />)}
        </div>
      </div>

      <div className="grid md:grid-cols-2 gap-4 mb-4">
        <div className="rounded-2xl p-5" style={{ background: C.card }}>
          <div className="flex items-center justify-between mb-3">
            <span className="flex items-center gap-2 text-sm" style={{ color: C.slate }}><Droplet size={15} style={{ color: C.teal }} /> Água</span>
            <button onClick={() => onAddWater(250)} className="flex items-center gap-1 text-xs px-3 py-1.5 rounded-full text-white" style={{ background: C.teal }}>
              <Plus size={13} /> 250 ml
            </button>
          </div>
          <div className="text-3xl font-light tabular-nums">{waterMl}<span className="text-base" style={{ color: C.slate }}> / {plan.waterMl} ml</span></div>
          <div className="h-2 rounded-full mt-3" style={{ background: C.line }}>
            <div className="h-2 rounded-full" style={{ width: `${Math.min((waterMl / plan.waterMl) * 100, 100)}%`, background: C.teal, transition: 'width .4s' }} />
          </div>
        </div>

        <div className="rounded-2xl p-5" style={{ background: C.card }}>
          <div className="flex items-center gap-2 text-sm mb-2" style={{ color: C.slate }}>
            <TrendingDown size={15} style={{ color: C.green }} /> Peso · média móvel 7d
          </div>
          <WeightSparkline data={weight} />
        </div>
      </div>

      <div className="rounded-2xl p-5 mb-4" style={{ background: C.card }}>
        <div className="text-sm mb-4" style={{ color: C.slate }}>Micronutrientes essenciais</div>
        <div className="grid sm:grid-cols-2 gap-x-6 gap-y-3">
          {micros.map((p) => <Bar key={p.key} p={p} />)}
        </div>
      </div>

      <div className="rounded-2xl p-5" style={{ background: C.card }}>
        <div className="text-sm mb-4" style={{ color: C.slate }}>Próxima refeição · fecha as lacunas do dia</div>
        {suggestions.length === 0 ? (
          <div className="text-sm" style={{ color: C.slate }}>Sem lacunas no orçamento atual — você está no rumo certo.</div>
        ) : (
          <div className="grid sm:grid-cols-3 gap-3">
            {suggestions.map((s, i) => (
              <button key={i} onClick={() => props.onPickSuggestion?.(s)} className="text-left rounded-xl p-4 border transition hover:shadow-md" style={{ borderColor: C.line }}>
                <div className="text-sm font-medium mb-1">{s.foods.map((f) => `${f.name} (${f.grams}g)`).join(' + ')}</div>
                <div className="text-xs tabular-nums mb-2" style={{ color: C.slate }}>{s.kcal} kcal</div>
                <div className="flex flex-wrap gap-1">
                  {s.covers.map((c) => (
                    <span key={c} className="text-[10px] px-2 py-0.5 rounded-full flex items-center gap-0.5" style={{ background: C.tintGreen, color: C.green }}>
                      <Check size={9} /> {LABEL[c] ?? c}
                    </span>
                  ))}
                </div>
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
