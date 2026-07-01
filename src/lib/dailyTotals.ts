/**
 * dailyTotals.ts
 * --------------
 * Soma os nutrientes do dia (entradas × base de alimentos) e compara com metas.
 * Pura: recebe entradas + resolvedor de alimento, devolve totais e progresso.
 */
import type { FoodEntry } from './db';
import { foodById, type FoodItem } from './referenceData';

export const TRACKED_NUTRIENTS = [
  'kcal', 'protein', 'carb', 'fat', 'saturatedFat',
  'fiberSoluble', 'omega3', 'calcium', 'magnesium', 'iron',
  'potassium', 'selenium', 'vitaminA', 'vitaminC',
  'vitaminB1', 'vitaminB2', 'vitaminB3', 'vitaminB5', 'vitaminB6',
  'vitaminB7', 'vitaminB9', 'vitaminB12', 'vitaminD',
] as const;

export type NutrientKey = (typeof TRACKED_NUTRIENTS)[number];
export type NutrientTotals = Partial<Record<NutrientKey, number>>;
export type FoodResolver = (id: string) => FoodItem | undefined;

/** Rótulos legíveis (pt-BR) para UI e para o analista. */
export const NUTRIENT_LABELS: Record<NutrientKey, string> = {
  kcal: 'calorias', protein: 'proteína', carb: 'carboidrato', fat: 'gordura total',
  saturatedFat: 'gordura saturada', fiberSoluble: 'fibra solúvel', omega3: 'ômega-3',
  calcium: 'cálcio', magnesium: 'magnésio', iron: 'ferro', potassium: 'potássio',
  selenium: 'selênio', vitaminA: 'vitamina A', vitaminC: 'vitamina C',
  vitaminB1: 'vitamina B1', vitaminB2: 'vitamina B2', vitaminB3: 'vitamina B3',
  vitaminB5: 'vitamina B5', vitaminB6: 'vitamina B6', vitaminB7: 'vitamina B7',
  vitaminB9: 'vitamina B9', vitaminB12: 'vitamina B12', vitaminD: 'vitamina D',
};

export interface DailyTotalsResult {
  totals: NutrientTotals;
  /** Nutrientes medidos por PELO MENOS um alimento do dia (mesmo que o valor seja 0 de verdade). */
  coveredKeys: Set<NutrientKey>;
  /** Quantas entradas resolveram pra um alimento real (grams>0, id existente). */
  resolvedCount: number;
}

/** Soma os nutrientes de uma lista de entradas (escala por gramas). */
export function sumEntries(entries: FoodEntry[], resolve: FoodResolver = foodById): DailyTotalsResult {
  const totals: NutrientTotals = {};
  const coveredKeys = new Set<NutrientKey>();
  let resolvedCount = 0;
  for (const entry of entries) {
    const food = resolve(entry.foodId);
    if (!food) continue;
    resolvedCount++;
    const factor = entry.grams / 100;
    for (const key of TRACKED_NUTRIENTS) {
      const per100 = food.per100g[key];
      if (per100 == null) continue;
      coveredKeys.add(key);
      totals[key] = Number(((totals[key] ?? 0) + per100 * factor).toFixed(2));
    }
  }
  return { totals, coveredKeys, resolvedCount };
}

export interface GoalDef {
  target: number;
  unit: string;
  /** 'min' = quanto mais melhor (proteína); 'max' = limite (gordura saturada). */
  direction?: 'min' | 'max';
}

export interface NutrientProgress {
  key: NutrientKey;
  consumed: number;
  target: number;
  unit: string;
  remaining: number; // pode ser negativo se passou
  percent: number; // 0–100+ (clamp só na UI)
  direction: 'min' | 'max';
  status: 'under' | 'met' | 'over';
  /**
   * false = você já comeu algo hoje, mas NENHUM alimento registrado mede
   * esse nutriente (gap real da base de dados — comum p/ vit. D, B12, B5,
   * B7, B9, selênio nos itens importados da TACO). Nesse caso "0%" não
   * significa "consumiu zero", significa "não sabemos" — a UI e o
   * analista de regras devem tratar diferente (ver Dashboard.tsx e
   * nutritionAnalyst.ts). Em um dia sem nenhuma entrada ainda, hasData
   * fica true (0% é literalmente verdade, não uma lacuna de dado).
   */
  hasData: boolean;
}

/** Calcula progresso de cada nutriente com meta definida. */
export function progressVsGoals(
  totals: NutrientTotals,
  goals: Partial<Record<NutrientKey, GoalDef>>,
  coverage?: Pick<DailyTotalsResult, 'coveredKeys' | 'resolvedCount'>,
): NutrientProgress[] {
  const out: NutrientProgress[] = [];
  for (const key of Object.keys(goals) as NutrientKey[]) {
    const goal = goals[key]!;
    const consumed = totals[key] ?? 0;
    const direction = goal.direction ?? 'min';
    const percent = goal.target > 0 ? Number(((consumed / goal.target) * 100).toFixed(0)) : 0;
    let status: NutrientProgress['status'];
    if (direction === 'max') {
      status = consumed > goal.target ? 'over' : 'met';
    } else {
      status = percent >= 100 ? 'met' : 'under';
    }
    const hasData = !coverage || coverage.resolvedCount === 0 || coverage.coveredKeys.has(key);
    out.push({
      key,
      consumed: Number(consumed.toFixed(1)),
      target: goal.target,
      unit: goal.unit,
      remaining: Number((goal.target - consumed).toFixed(1)),
      percent,
      direction,
      status,
      hasData,
    });
  }
  return out;
}

/** Nutrientes do tipo 'min' ainda abaixo da meta — alimenta o sugeridor.
 *  Exclui os sem dado hoje (ver NutrientProgress.hasData): não faz sentido
 *  sugerir alimento pra "fechar" uma lacuna que na verdade é a base de
 *  dados não medindo aquele nutriente, não uma deficiência real conhecida. */
export function nutrientGaps(progress: NutrientProgress[]): NutrientKey[] {
  return progress.filter((p) => p.direction === 'min' && p.status === 'under' && p.hasData).map((p) => p.key);
}
