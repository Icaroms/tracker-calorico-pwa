import React, { useState, useMemo } from 'react';
import { Search, Plus, X, Utensils, Star, Check, ChevronDown } from 'lucide-react';
import { useSearchableFoods, useTodayEntries, useFrequentFoods, type SearchFood } from '../hooks/useTracker';
import { logFood, logRecipe, type MealSlot } from '../lib/db';
import CustomFoodForm from './CustomFoodForm';
import RecipeBuilder from './RecipeBuilder';
import BarcodeScanner from './BarcodeScanner';
import NutrientDetail from './NutrientDetail';
import ExerciseLog from './ExerciseLog';

import { expandSearchTerms } from '../lib/searchSynonyms';
import { useTheme } from '../theme';

const MEALS: { value: MealSlot; label: string }[] = [
  { value: 'cafe', label: 'Café' }, { value: 'almoco', label: 'Almoço' },
  { value: 'lanche', label: 'Lanche' }, { value: 'jantar', label: 'Jantar' }, { value: 'ceia', label: 'Ceia' },
];
const norm = (s: string) => s.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();

export default function LogFood() {
  const C = useTheme();
  const inputStyle = { background: C.chipBg, color: C.ink };
  const foods = useSearchableFoods();
  const frequent = useFrequentFoods(8);
  const { rows, totalKcal, remove, update } = useTodayEntries();
  const [query, setQuery] = useState('');
  const [meal, setMeal] = useState<MealSlot>('lanche');

  const results = useMemo(() => {
    const q = norm(query.trim());
    if (!q) return foods.slice(0, 25);
    const terms = expandSearchTerms(q);
    return foods.filter((f) => { const n = norm(f.name); return terms.some((t) => n.includes(t)); }).slice(0, 25);
  }, [foods, query]);

  const quickLog = (id: string, grams: number) => logFood({ foodId: id, meal, grams });

  return (
    <div style={{ color: C.ink }}>
      {/* Refeição (compartilhada por frequentes e busca) */}
      <div className="flex gap-1 mb-3 flex-wrap">
        {MEALS.map((m) => (
          <button key={m.value} onClick={() => setMeal(m.value)}
            className="text-xs px-3 py-1.5 rounded-full" style={{ background: meal === m.value ? C.teal : C.line, color: meal === m.value ? '#fff' : C.ink }}>
            {m.label}
          </button>
        ))}
      </div>

      {/* Frequentes — 1 toque */}
      {frequent.length > 0 && (
        <div className="rounded-2xl p-4 mb-4" style={{ background: C.card }}>
          <div className="flex items-center gap-2 text-sm mb-2" style={{ color: C.slate }}><Star size={14} /> Frequentes · 1 toque</div>
          <div className="flex gap-2 flex-wrap">
            {frequent.map((f) => (
              <button key={f.id} onClick={() => quickLog(f.id, f.defaultGrams)}
                className="text-xs px-3 py-1.5 rounded-full" style={{ background: C.chipBg, color: C.ink, border: `1px solid ${C.line}` }}>
                {f.name} <span style={{ color: C.slate }}>· {f.defaultLabel}</span>
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Busca */}
      <div className="rounded-2xl p-4 mb-4" style={{ background: C.card }}>
        <div className="flex items-center gap-2 mb-3 px-3 py-2 rounded-xl" style={{ background: C.chipBg }}>
          <Search size={16} style={{ color: C.slate }} />
          <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Buscar alimento (ex.: banana)"
            className="bg-transparent outline-none text-sm flex-1" style={{ color: C.ink }} />
        </div>
        <div className="divide-y" style={{ borderColor: C.line }}>
          {results.map((f) => <FoodRow key={f.id} food={f} meal={meal} />)}
          {results.length === 0 && <p className="text-sm py-3" style={{ color: C.slate }}>Nada encontrado.</p>}
        </div>
      </div>

      {/* Escanear código de barras */}
      <BarcodeScanner />

      {/* Cadastrar alimento próprio */}
      <CustomFoodForm />

      {/* Criar receita / prato */}
      <RecipeBuilder />

      {/* Registrar exercício */}
      <ExerciseLog />

      {/* Comidos hoje */}
      <div className="rounded-2xl p-4" style={{ background: C.card }}>
        <div className="flex items-center justify-between mb-3">
          <span className="flex items-center gap-2 text-sm" style={{ color: C.slate }}><Utensils size={15} /> Hoje</span>
          <span className="text-sm tabular-nums" style={{ color: C.ink }}>{totalKcal} kcal</span>
        </div>
        {rows.length === 0 ? (
          <p className="text-sm" style={{ color: C.slate }}>Nada registrado ainda. Use os frequentes ou busque acima.</p>
        ) : (
          <ul className="space-y-2">
            {rows.map((r) => (
              <li key={r.id} className="flex items-center gap-2 text-sm">
                <span className="flex-1 truncate">{r.name}</span>
                <input type="number" value={r.grams} onChange={(e) => update(r.id, Math.max(0, Number(e.target.value)))}
                  className="w-16 text-right px-2 py-1 rounded-lg outline-none" style={inputStyle} />
                <span className="text-xs" style={{ color: C.slate }}>g</span>
                <span className="text-xs tabular-nums w-16 text-right" style={{ color: C.slate }}>{r.kcal} kcal</span>
                <button onClick={() => remove(r.id)} className="p-1 rounded-full" style={{ color: C.slate }}><X size={15} /></button>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}

function FoodRow({ food, meal }: { food: SearchFood; meal: MealSlot }) {
  const C = useTheme();
  const inputStyle = { background: C.chipBg, color: C.ink };
  const [grams, setGrams] = useState(100);
  const [flash, setFlash] = useState(false);
  const [showDetail, setShowDetail] = useState(false);
  const add = (g: number) => {
    if (food.isRecipe) logRecipe(food.id, meal, g); else logFood({ foodId: food.id, meal, grams: g });
    setFlash(true); setTimeout(() => setFlash(false), 900);
  };
  const chips = food.portions && food.portions.length ? food.portions : [{ label: '100g', grams: 100 }, { label: '150g', grams: 150 }];
  return (
    <div className="py-2">
      <div className="flex items-center gap-2">
        <div className="flex-1 min-w-0">
          <button onClick={() => setShowDetail((s) => !s)} className="flex items-center gap-1 text-left w-full">
            <div className="text-sm truncate" style={{ color: C.ink }}>{food.name}{food.isRecipe && <span className="text-[10px] ml-1" style={{ color: C.green }}>receita</span>}</div>
            <ChevronDown size={12} style={{ color: C.slate, transform: showDetail ? 'rotate(180deg)' : 'none', transition: 'transform .2s', flexShrink: 0 }} />
          </button>
          <div className="text-xs" style={{ color: C.slate }}>{Math.round(food.kcal100)} kcal/100g · {Math.round((food.kcal100 * grams) / 100)} kcal</div>
        </div>
        {flash && <Check size={16} style={{ color: C.green }} />}
        <input type="number" value={grams} onChange={(e) => setGrams(Math.max(0, Number(e.target.value)))}
          className="w-16 text-right px-2 py-1 rounded-lg outline-none" style={inputStyle} />
        <span className="text-xs" style={{ color: C.slate }}>g</span>
        <button onClick={() => add(grams)} className="p-1.5 rounded-full text-white" style={{ background: C.teal }}><Plus size={15} /></button>
      </div>
      <div className="flex gap-1 flex-wrap mt-1.5">
        {chips.map((p, i) => (
          <button key={i} onClick={() => add(p.grams)} className="text-[11px] px-2 py-0.5 rounded-full" style={{ background: C.chipBg, color: C.teal, border: `1px solid ${C.line}` }}>
            {p.label}
          </button>
        ))}
      </div>
      {showDetail && !food.isRecipe && <NutrientDetail foodId={food.id} />}
    </div>
  );
}
