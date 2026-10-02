import React, { useState } from 'react';
import { Check, ChevronDown } from 'lucide-react';
import { useSaveCustomFood } from '../hooks/useTracker';
import type { LactoseLevel } from '../lib/referenceData';
import { useTheme } from '../theme';

// Campos por 100 g. kcal e proteína são os mais úteis; o resto é opcional.
const FIELDS: { key: string; label: string }[] = [
  { key: 'kcal', label: 'Calorias (kcal)' }, { key: 'protein', label: 'Proteína (g)' },
  { key: 'carb', label: 'Carboidrato (g)' }, { key: 'fat', label: 'Gordura (g)' },
  { key: 'saturatedFat', label: 'Gord. saturada (g)' }, { key: 'fiberSoluble', label: 'Fibra solúvel (g)' },
  { key: 'omega3', label: 'Ômega-3 (g)' }, { key: 'calcium', label: 'Cálcio (mg)' },
  { key: 'iron', label: 'Ferro (mg)' }, { key: 'vitaminC', label: 'Vitamina C (mg)' },
];

export default function CustomFoodForm() {
  const C = useTheme();
  const inputStyle = { background: C.chipBg, color: C.ink };
  const saveCustom = useSaveCustomFood();
  const [open, setOpen] = useState(false);
  const [name, setName] = useState('');
  const [lactose, setLactose] = useState<LactoseLevel>('none');
  const [vals, setVals] = useState<Record<string, string>>({});
  const [done, setDone] = useState('');

  const setVal = (k: string, v: string) => setVals((s) => ({ ...s, [k]: v }));

  const onSave = async () => {
    if (!name.trim()) return;
    const per100g: Record<string, number> = {};
    for (const f of FIELDS) {
      const n = Number(vals[f.key]);
      if (vals[f.key] !== undefined && vals[f.key] !== '' && Number.isFinite(n)) per100g[f.key] = n;
    }
    await saveCustom({ name: name.trim(), per100g, lactoseLevel: lactose });
    setDone(name.trim());
    setName(''); setVals({}); setLactose('none');
    setTimeout(() => setDone(''), 2500);
  };

  return (
    <div className="rounded-2xl p-4 mb-4" style={{ background: C.card }}>
      <button onClick={() => setOpen((o) => !o)} className="w-full flex items-center justify-between text-sm" style={{ color: C.slate }}>
        <span>Cadastrar alimento próprio</span>
        <ChevronDown size={16} style={{ transform: open ? 'rotate(180deg)' : 'none', transition: 'transform .2s' }} />
      </button>

      {open && (
        <div className="mt-3">
          <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Nome (ex.: Tapioca da vó)"
            className="w-full text-sm px-3 py-2 rounded-lg outline-none mb-3" style={inputStyle} />
          <p className="text-[11px] mb-2" style={{ color: C.slate }}>Valores por 100 g. Preencha ao menos calorias; o resto é opcional.</p>
          <div className="grid grid-cols-2 gap-2">
            {FIELDS.map((f) => (
              <label key={f.key} className="block">
                <span className="text-[11px]" style={{ color: C.slate }}>{f.label}</span>
                <input type="number" value={vals[f.key] ?? ''} onChange={(e) => setVal(f.key, e.target.value)}
                  className="w-full text-sm px-2 py-1.5 rounded-lg outline-none mt-0.5" style={inputStyle} />
              </label>
            ))}
          </div>
          <label className="block mt-3">
            <span className="text-[11px]" style={{ color: C.slate }}>Lactose</span>
            <select value={lactose} onChange={(e) => setLactose(e.target.value as LactoseLevel)}
              className="w-full text-sm px-2 py-1.5 rounded-lg outline-none mt-0.5" style={inputStyle}>
              <option value="none">Sem lactose</option><option value="low">Baixa</option>
              <option value="moderate">Moderada</option><option value="high">Alta</option>
            </select>
          </label>
          <button onClick={onSave} className="mt-3 w-full flex items-center justify-center gap-2 text-sm py-2 rounded-xl text-white" style={{ background: done ? C.green : C.teal }}>
            {done ? <><Check size={15} /> "{done}" salvo!</> : 'Salvar alimento'}
          </button>
          {done && <p className="text-[11px] mt-2" style={{ color: C.slate }}>Já aparece na busca acima.</p>}
        </div>
      )}
    </div>
  );
}
