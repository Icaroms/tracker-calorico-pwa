/**
 * mergeFoodData.ts
 * ----------------
 * Combina dados da TACO (base brasileira) com a USDA (preenche os micros que a
 * TACO não mede: vit. D, B12, selênio, ômega-3) num registro único, marcando a
 * FONTE de cada nutriente. Pura e testável; o I/O de arquivos vive no script.
 *
 * Regra de prioridade:
 *   - Nutrientes "gap" (TACO não mede bem) → USDA primeiro, TACO como fallback.
 *   - Demais nutrientes → TACO primeiro (mais fiel ao alimento BR), USDA depois.
 *   - Fibra solúvel é tratada à parte ('manual'): nenhuma tabela separa bem.
 */
import type { NutrientKey } from './dailyTotals';

export type NutrientSource = 'taco' | 'usda' | 'tbca' | 'manual' | 'deduced';

export interface SourcedValue {
  value: number;
  source: NutrientSource;
}

export interface UnifiedFood {
  id: string;
  name: string;
  /** Cada nutriente AUSENTE = não medido (≠ zero). */
  per100g: Partial<Record<NutrientKey, SourcedValue>>;
}

/** Nutrientes que a TACO não cobre — preferimos a USDA. */
export const GAP_NUTRIENTS: NutrientKey[] = [
  'selenium', 'vitaminD', 'vitaminB12', 'omega3',
  'vitaminB5', 'vitaminB7', 'vitaminB9',
];

export type NutrientMap = Partial<Record<NutrientKey, number>>;

export interface MergeInput {
  id: string;
  name: string;
  taco?: NutrientMap;
  usda?: NutrientMap;
  /** Ajustes manuais (ex.: fração de fibra solúvel da literatura). */
  manual?: NutrientMap;
  /** Estimativas/deduções — usadas só quando nenhuma tabela tem o dado. */
  deduced?: NutrientMap;
}

const ALL_KEYS: NutrientKey[] = [
  'kcal', 'protein', 'carb', 'fat', 'saturatedFat', 'fiberSoluble', 'omega3',
  'calcium', 'magnesium', 'iron', 'potassium', 'selenium', 'vitaminA', 'vitaminC',
  'vitaminB1', 'vitaminB2', 'vitaminB3', 'vitaminB5', 'vitaminB6', 'vitaminB7',
  'vitaminB9', 'vitaminB12', 'vitaminD',
];

function pick(
  key: NutrientKey,
  input: MergeInput,
): SourcedValue | undefined {
  // Manual sempre vence (curadoria humana).
  if (input.manual?.[key] != null) return { value: input.manual[key]!, source: 'manual' };

  const order: NutrientSource[] = GAP_NUTRIENTS.includes(key) ? ['usda', 'taco'] : ['taco', 'usda'];
  for (const src of order) {
    const map = src === 'taco' ? input.taco : input.usda;
    if (map?.[key] != null) return { value: map[key]!, source: src };
  }
  // Última opção: dedução/estimativa (marcada como tal).
  if (input.deduced?.[key] != null) return { value: input.deduced[key]!, source: 'deduced' };
  return undefined;
}

/** Funde um alimento das fontes num UnifiedFood com fonte por nutriente. */
export function mergeFood(input: MergeInput): UnifiedFood {
  const per100g: UnifiedFood['per100g'] = {};
  for (const key of ALL_KEYS) {
    const v = pick(key, input);
    if (v) per100g[key] = v;
  }
  return { id: input.id, name: input.name, per100g };
}

export interface CoverageReport {
  id: string;
  covered: NutrientKey[];
  missing: NutrientKey[];
  bySource: Record<NutrientSource, number>;
}

/** Relatório de cobertura — alimenta o aviso de "baixa confiança" na UI. */
export function coverage(food: UnifiedFood): CoverageReport {
  const covered: NutrientKey[] = [];
  const missing: NutrientKey[] = [];
  const bySource: Record<NutrientSource, number> = { taco: 0, usda: 0, tbca: 0, manual: 0, deduced: 0 };
  for (const key of ALL_KEYS) {
    const sv = food.per100g[key];
    if (sv) {
      covered.push(key);
      bySource[sv.source]++;
    } else {
      missing.push(key);
    }
  }
  return { id: food.id, covered, missing, bySource };
}

/** Achata para o FoodItem do runtime (valores puros, sem fonte). */
export function flattenForApp(food: UnifiedFood): { id: string; name: string; per100g: NutrientMap } {
  const per100g: NutrientMap = {};
  for (const key of Object.keys(food.per100g) as NutrientKey[]) {
    per100g[key] = food.per100g[key]!.value;
  }
  return { id: food.id, name: food.name, per100g };
}
