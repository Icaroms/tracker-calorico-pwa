import React, { useState, useMemo } from 'react';
import { ChevronDown, Search, Plus, X, Check, Trash2, ChefHat } from 'lucide-react';
import { useSearchableFoods, useFoodResolver, useRecipes, useSaveRecipe, useDeleteRecipe } from '../hooks/useTracker';
import { recipeNutrients, recipePer100g, recipeTotalGrams, recipeLactoseLevel, type Recipe } from '../lib/recipes';
import { useTheme } from '../theme';

const norm = (s: string) => s.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
const LACT_LABEL: Record<string, string> = { none: 'sem lactose', low: 'lactose baixa', moderate: 'lactose moderada', high: 'lactose alta' };

interface Ing { foodId: string; grams: number; name: string; }

export default function RecipeBuilder() {
  const C = useTheme();
  const inputStyle = { background: C.chipBg, color: C.ink };
  const foods = useSearchableFoods();
  const resolve = useFoodResolver();
  const recipes = useRecipes();
  const saveRecipe = useSaveRecipe();
  const deleteRecipe = useDeleteRecipe();

  const [open, setOpen] = useState(false);
  const [name, setName] = useState('');
  const [yieldG, setYieldG] = useState<number | ''>('');
  const [ings, setIngs] = useState<Ing[]>([]);
  const [query, setQuery] = useState('');
  const [done, setDone] = useState('');

  const results = useMemo(() => {
    const q = norm(query.trim());
    return foods.filter((f) => !f.isRecipe && (!q || norm(f.name).includes(q))).slice(0, 12);
  }, [foods, query]);

  // prévia: monta uma receita temporária e calcula
  const preview = useMemo(() => {
    if (ings.length === 0) return null;
    const tmp: Recipe = { id: 'preview', name, ingredients: ings.map((i) => ({ foodId: i.foodId, grams: i.grams })), yieldGrams: yieldG === '' ? undefined : Number(yieldG) };
    const total = recipeNutrients(tmp, resolve);
    const per = recipePer100g(tmp, resolve);
    return { totalKcal: Math.round(total.kcal ?? 0), per100Kcal: Math.round(per.kcal ?? 0), grams: recipeTotalGrams(tmp), protein: Math.round(total.protein ?? 0), lactose: recipeLactoseLevel(tmp, resolve) };
  }, [ings, yieldG, name, resolve]);

  const addIng = (id: string, nm: string) => setIngs((s) => [...s, { foodId: id, grams: 100, name: nm }]);
  const setGrams = (i: number, g: number) => setIngs((s) => s.map((x, idx) => (idx === i ? { ...x, grams: g } : x)));
  const removeIng = (i: number) => setIngs((s) => s.filter((_, idx) => idx !== i));

  const save = async () => {
    if (!name.trim() || ings.length === 0) return;
    await saveRecipe(name.trim(), ings.map((i) => ({ foodId: i.foodId, grams: i.grams })), yieldG === '' ? undefined : Number(yieldG));
    setDone(name.trim());
    setName(''); setYieldG(''); setIngs([]); setQuery('');
    setTimeout(() => setDone(''), 2500);
  };

  return (
    <div className="rounded-2xl p-4 mb-4" style={{ background: C.card }}>
      <button onClick={() => setOpen((o) => !o)} className="w-full flex items-center justify-between text-sm" style={{ color: C.slate }}>
        <span className="flex items-center gap-2"><ChefHat size={15} /> Criar receita / prato</span>
        <ChevronDown size={16} style={{ transform: open ? 'rotate(180deg)' : 'none', transition: 'transform .2s' }} />
      </button>

      {open && (
        <div className="mt-3" style={{ color: C.ink }}>
          <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Nome do prato (ex.: Feijoada light)"
            className="w-full text-sm px-3 py-2 rounded-lg outline-none mb-3" style={inputStyle} />

          {/* ingredientes adicionados */}
          {ings.length > 0 && (
            <ul className="space-y-2 mb-3">
              {ings.map((ing, i) => (
                <li key={i} className="flex items-center gap-2">
                  <span className="text-sm flex-1 truncate">{ing.name}</span>
                  <input type="number" value={ing.grams} onChange={(e) => setGrams(i, Math.max(0, Number(e.target.value)))}
                    className="w-16 text-sm text-right px-2 py-1 rounded-lg outline-none" style={inputStyle} />
                  <span className="text-xs" style={{ color: C.slate }}>g</span>
                  <button onClick={() => removeIng(i)} style={{ color: C.slate }}><X size={15} /></button>
                </li>
              ))}
            </ul>
          )}

          {/* buscar ingrediente */}
          <div className="flex items-center gap-2 mb-2 px-3 py-2 rounded-xl" style={{ background: C.chipBg }}>
            <Search size={15} style={{ color: C.slate }} />
            <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Adicionar ingrediente"
              className="bg-transparent outline-none text-sm flex-1" style={{ color: C.ink }} />
          </div>
          <div className="divide-y mb-3" style={{ borderColor: C.line }}>
            {results.map((f) => (
              <button key={f.id} onClick={() => addIng(f.id, f.name)} className="w-full flex items-center justify-between py-2 text-left">
                <span className="text-sm truncate">{f.name}</span>
                <Plus size={15} style={{ color: C.teal }} />
              </button>
            ))}
          </div>

          {/* rendimento + prévia */}
          <label className="flex items-center justify-between text-sm mb-3">
            <span style={{ color: C.slate }}>Rendimento final (g, opcional)</span>
            <input type="number" value={yieldG} onChange={(e) => setYieldG(e.target.value === '' ? '' : Number(e.target.value))}
              placeholder={preview ? String(preview.grams) : ''} className="w-20 text-sm text-right px-2 py-1 rounded-lg outline-none" style={inputStyle} />
          </label>

          {preview && (
            <div className="rounded-xl p-3 mb-3 text-sm" style={{ background: C.chipBg }}>
              <div className="flex justify-between"><span style={{ color: C.slate }}>Total</span><span className="tabular-nums">{preview.totalKcal} kcal · {preview.grams} g</span></div>
              <div className="flex justify-between"><span style={{ color: C.slate }}>Por 100 g</span><span className="tabular-nums">{preview.per100Kcal} kcal · {preview.protein}g proteína total</span></div>
              <div className="flex justify-between"><span style={{ color: C.slate }}>Lactose</span><span>{LACT_LABEL[preview.lactose]}</span></div>
            </div>
          )}

          <button onClick={save} disabled={!name.trim() || ings.length === 0}
            className="w-full flex items-center justify-center gap-2 text-sm py-2 rounded-xl text-white"
            style={{ background: done ? C.green : (!name.trim() || ings.length === 0) ? C.slate : C.teal }}>
            {done ? <><Check size={15} /> "{done}" salva!</> : 'Salvar receita'}
          </button>

          {/* receitas existentes */}
          {recipes.length > 0 && (
            <div className="mt-4">
              <p className="text-xs mb-2" style={{ color: C.slate }}>Suas receitas ({recipes.length})</p>
              <ul className="space-y-1">
                {recipes.map((r) => (
                  <li key={r.id} className="flex items-center justify-between text-sm">
                    <span className="truncate">{r.name} <span style={{ color: C.slate }}>· {r.ingredients.length} ingr.</span></span>
                    <button onClick={() => deleteRecipe(r.id)} style={{ color: C.slate }}><Trash2 size={14} /></button>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
