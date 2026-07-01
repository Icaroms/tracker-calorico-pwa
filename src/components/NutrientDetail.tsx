import React from 'react';
import { Info } from 'lucide-react';
import { NUTRIENT_LABELS, TRACKED_NUTRIENTS } from '../lib/dailyTotals';
import { foodById } from '../lib/referenceData';
import { SOURCE_META, NUTRIENT_UNITS } from '../lib/nutrientSourceMeta';

const C = { ink: '#0F2A33', slate: '#6B7E84', line: '#DCE5E6' };

/**
 * Detalhe nutricional de um alimento com badge de fonte por nutriente
 * (TACO / USDA / Manual / Estimado). Só existe para alimentos resolvidos
 * via foodById (base curada + TACO) — receitas e cadastros próprios não
 * têm rastreabilidade por nutriente, então mostram um aviso simples.
 */
export default function NutrientDetail({ foodId }: { foodId: string }) {
  const food = foodById(foodId);

  if (!food) {
    return (
      <p className="text-[11px] py-2" style={{ color: C.slate }}>
        Sem rastreabilidade de fonte para este item (receita ou cadastro próprio).
      </p>
    );
  }

  const rows = TRACKED_NUTRIENTS
    .filter((k) => food.per100g[k] != null)
    .map((k) => ({
      key: k,
      label: NUTRIENT_LABELS[k],
      value: food.per100g[k]!,
      unit: NUTRIENT_UNITS[k],
      source: food.nutrientSources?.[k],
    }));

  const missing = TRACKED_NUTRIENTS.filter((k) => food.per100g[k] == null);

  return (
    <div className="pt-2 pb-1">
      <div className="flex items-center gap-1.5 mb-2 text-[11px]" style={{ color: C.slate }}>
        <Info size={12} /> Valores por 100 g, com a fonte de cada dado
      </div>
      <div className="grid grid-cols-1 gap-1">
        {rows.map((r) => {
          const meta = r.source ? SOURCE_META[r.source] : undefined;
          return (
            <div key={r.key} className="flex items-center justify-between text-xs py-1 border-b" style={{ borderColor: C.line }}>
              <span style={{ color: C.ink }}>{r.label}</span>
              <div className="flex items-center gap-2">
                <span className="tabular-nums" style={{ color: C.slate }}>{r.value}{r.unit}</span>
                {meta && (
                  <span
                    className="text-[10px] px-1.5 py-0.5 rounded-full whitespace-nowrap"
                    style={{ background: meta.bg, color: meta.color }}
                    title={meta.isEstimate ? 'Estimativa — sem medição direta' : meta.label}
                  >
                    {meta.isEstimate ? '⚠ ' : ''}{meta.short}
                  </span>
                )}
              </div>
            </div>
          );
        })}
      </div>
      {missing.length > 0 && (
        <p className="text-[11px] mt-2" style={{ color: C.slate }}>
          Sem dado para: {missing.map((k) => NUTRIENT_LABELS[k]).join(', ')}.
        </p>
      )}
    </div>
  );
}
