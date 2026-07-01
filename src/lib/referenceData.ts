/**
 * referenceData.ts
 * ----------------
 * Conteúdo ESTÁTICO de referência (empacotado com o app, cacheado offline).
 * Não vai pro IndexedDB.
 *
 * ⚠️ Orientação geral de ponto de partida — valide com nutricionista/médico,
 * principalmente jejum + pangastrite.
 *
 * A base de alimentos combina 8 itens curados à mão (porções, goodFor, tags)
 * com ~590 alimentos reais da TACO (NEPA/UNICAMP, 4ª edição) — ver
 * CURATED_FOOD_BASE, TACO_FOOD_BASE e scripts/importTacoCsv.ts.
 */
import { TACO_FOOD_BASE } from './tacoFoodBase.generated';
import type { NutrientKey } from './dailyTotals';
import type { NutrientSource } from './mergeFoodData';

export type { NutrientSource };

// ─── Base de alimentos ─────────────────────────────────────────────────────

export type LactoseLevel = 'none' | 'low' | 'moderate' | 'high';

export interface FoodItem {
  id: string;
  name: string;
  /** Valores por 100 g. */
  per100g: {
    kcal: number;
    protein: number; // g
    carb: number; // g
    fat: number; // g
    saturatedFat?: number; // g — relevante p/ colesterol
    fiberSoluble?: number; // g
    omega3?: number; // g
    calcium?: number; // mg
    magnesium?: number; // mg
    iron?: number; // mg
    potassium?: number; // mg
    selenium?: number; // mcg
    vitaminA?: number; // mcg RAE
    vitaminC?: number; // mg
    vitaminB1?: number; // mg — tiamina
    vitaminB2?: number; // mg — riboflavina
    vitaminB3?: number; // mg — niacina
    vitaminB5?: number; // mg — ácido pantotênico
    vitaminB6?: number; // mg — piridoxina
    vitaminB7?: number; // mcg — biotina
    vitaminB9?: number; // mcg — folato
    vitaminB12?: number; // mcg — cobalamina
    vitaminD?: number; // mcg
  };
  lactoseLevel: LactoseLevel;
  /** Porções comuns p/ registro rápido (ex.: "1 unidade" = 100g). */
  portions?: { label: string; grams: number }[];
  /** Bom para reforçar este nutriente (usado pelo motor de sugestão). */
  goodFor?: string[];
  tags?: string[];
  /**
   * De onde veio cada valor de per100g — alimenta o badge de fonte/confiança
   * na UI (ver src/lib/nutrientSourceMeta.ts). Ausente = alimento sem
   * rastreabilidade por nutriente (ex.: receita computada, cadastro rápido
   * sem essa granularidade).
   */
  nutrientSources?: Partial<Record<NutrientKey, NutrientSource>>;
}

/**
 * Alimentos curados à mão (poucos, mas com porções/goodFor/tags pensados
 * para o contexto do usuário — colesterol, lactose, jejum). Têm precedência
 * na busca sobre a base gerada da TACO logo abaixo.
 */
export const CURATED_FOOD_BASE: FoodItem[] = [
  {
    id: 'aveia',
    name: 'Aveia em flocos',
    per100g: { kcal: 389, protein: 16.9, carb: 66, fat: 6.9, fiberSoluble: 4, magnesium: 177, iron: 4.7 },
    lactoseLevel: 'none',
    portions: [{ label: '2 colheres', grams: 30 }, { label: 'porção (50g)', grams: 50 }],
    goodFor: ['fiberSoluble', 'magnesium', 'protein'],
    tags: ['colesterol'],
  },
  {
    id: 'feijao-carioca',
    name: 'Feijão carioca cozido',
    per100g: { kcal: 76, protein: 4.8, carb: 13.6, fat: 0.5, fiberSoluble: 2, iron: 1.3, potassium: 256 },
    lactoseLevel: 'none',
    portions: [{ label: '1 concha', grams: 140 }],
    goodFor: ['fiberSoluble', 'protein', 'iron'],
    tags: ['colesterol', 'acessivel'],
  },
  {
    id: 'sardinha',
    name: 'Sardinha (com espinha)',
    per100g: { kcal: 208, protein: 25, carb: 0, fat: 11, omega3: 1.5, calcium: 380, vitaminD: 4.8, vitaminB12: 8.9 },
    lactoseLevel: 'none',
    portions: [{ label: '1 lata', grams: 84 }],
    goodFor: ['omega3', 'calcium', 'protein', 'vitaminB12', 'vitaminD'],
    tags: ['colesterol', 'calcio-sem-lactose'],
  },
  {
    id: 'ovo',
    name: 'Ovo de galinha cozido',
    per100g: { kcal: 146, protein: 13.3, carb: 0.6, fat: 9.5, vitaminB12: 1.1, vitaminD: 2 },
    lactoseLevel: 'none',
    portions: [{ label: '1 unidade', grams: 50 }, { label: '2 unidades', grams: 100 }],
    goodFor: ['protein', 'vitaminB12'],
    tags: ['acessivel'],
  },
  {
    id: 'banana',
    name: 'Banana prata',
    per100g: { kcal: 98, protein: 1.3, carb: 26, fat: 0.1, potassium: 358, vitaminC: 8.7 },
    lactoseLevel: 'none',
    portions: [{ label: '1 unidade', grams: 100 }],
    goodFor: ['potassium', 'vitaminC'],
    tags: ['acessivel'],
  },
  {
    id: 'couve',
    name: 'Couve refogada',
    per100g: { kcal: 90, protein: 1.7, carb: 8, fat: 6, calcium: 131, magnesium: 24, vitaminC: 96 },
    lactoseLevel: 'none',
    portions: [{ label: '1 porção', grams: 80 }],
    goodFor: ['calcium', 'vitaminC'],
    tags: ['calcio-sem-lactose'],
  },
  {
    id: 'frango-peito',
    name: 'Peito de frango grelhado',
    per100g: { kcal: 159, protein: 32, carb: 0, fat: 2.5, magnesium: 29, potassium: 256 },
    lactoseLevel: 'none',
    portions: [{ label: '1 filé', grams: 120 }],
    goodFor: ['protein'],
    tags: ['acessivel'],
  },
  {
    id: 'parmesao',
    name: 'Queijo parmesão',
    per100g: { kcal: 393, protein: 35, carb: 3.7, fat: 25, saturatedFat: 16, calcium: 1184 },
    lactoseLevel: 'low', // curado: lactose quase nula
    portions: [{ label: '1 fatia fina', grams: 20 }],
    goodFor: ['calcium', 'protein'],
    tags: ['lacticinio-liberado'],
  },
];

// Curados são digitados à mão a partir de referência nutricional — cada
// valor presente é, por definição, 'manual' (sem tabela única por trás).
for (const f of CURATED_FOOD_BASE) {
  f.nutrientSources = Object.fromEntries(
    (Object.keys(f.per100g) as NutrientKey[]).map((k) => [k, 'manual' as const]),
  );
}

/**
 * Base completa de busca: curados primeiro (melhor UX — têm porções e
 * goodFor), depois os ~590 alimentos reais da TACO (NEPA/UNICAMP). Ver
 * scripts/importTacoCsv.ts e scripts/data/taco/FONTE.md para regenerar.
 */
export const FOOD_BASE: FoodItem[] = [...CURATED_FOOD_BASE, ...TACO_FOOD_BASE];

// Lookup por id em O(1) — antes era .find() num array de 8 itens, agora são ~600.
const FOOD_BY_ID = new Map(FOOD_BASE.map((f) => [f.id, f] as const));
export const foodById = (id: string): FoodItem | undefined => FOOD_BY_ID.get(id);

// ─── Lactose: o que evitar e o que costuma liberar ───────────────────────────

export const lactoseGuidance = {
  evitar: [
    'Leite integral/desnatado comum',
    'Queijos frescos (minas frescal, ricota, requeijão)',
    'Iogurte tradicional (não fermentado prolongado)',
    'Creme de leite, leite condensado, sorvete de leite',
    'Achocolatado pronto à base de leite',
  ],
  geralmenteLiberado: [
    'Queijos curados (parmesão, prato envelhecido, suíço, provolone) — lactose residual baixa',
    'Manteiga (gordura, quase sem lactose)',
    'Produtos "zero lactose" / "sem lactose"',
    'Iogurte com baixa lactose / kefir (bem tolerados por muitos)',
    'Bebidas vegetais fortificadas com cálcio (aveia, soja)',
  ],
  friosELacticinios: {
    melhores: ['Parmesão', 'Provolone curado', 'Queijo suíço', 'Manteiga'],
    cuidado: ['Mussarela (lactose moderada)', 'Requeijão', 'Queijo minas frescal'],
    nota: 'Quanto mais curado o queijo, menor a lactose. Tolerância é individual — teste porções pequenas.',
  },
} as const;

// ─── Treinos recomendados (colesterol alto e geral) ──────────────────────────

export interface WorkoutRec {
  tipo: string;
  frequencia: string;
  observacao: string;
}

export const workoutRecommendations: WorkoutRec[] = [
  {
    tipo: 'Aeróbico moderado (caminhada rápida, bike, natação)',
    frequencia: '150 min/semana (ex.: 30 min × 5 dias)',
    observacao: 'Pilar para baixar LDL e subir HDL. Acessível e de baixo impacto.',
  },
  {
    tipo: 'Aeróbico intervalado (HIIT leve)',
    frequencia: '1–2×/semana, se liberado',
    observacao: 'Eficiente no tempo; comece gradual.',
  },
  {
    tipo: 'Musculação / resistência',
    frequencia: '2–3×/semana',
    observacao: 'Preserva massa magra no déficit (melhora o cálculo de gasto via Katch-McArdle).',
  },
  {
    tipo: 'Mobilidade / alongamento',
    frequencia: 'Diário leve',
    observacao: 'Recuperação e adesão.',
  },
];

// ─── Jejum intermitente: recomendação conservadora ───────────────────────────

export interface FastingFlags {
  pangastrite?: boolean;
  refluxo?: boolean;
  usaMedicacaoComAlimento?: boolean;
}

export type FastingAdvice = 'evitar' | 'cautela' | 'ok';

/**
 * Recomendação conservadora de jejum. Com pangastrite, o padrão é evitar/cautela
 * porque jejuns longos podem irritar a mucosa gástrica.
 */
export function recommendFasting(flags: FastingFlags): { advice: FastingAdvice; reason: string } {
  if (flags.pangastrite) {
    return {
      advice: 'cautela',
      reason:
        'Pangastrite: jejum prolongado pode irritar a mucosa. Se for jejuar, prefira janelas curtas e valide com seu médico.',
    };
  }
  if (flags.refluxo || flags.usaMedicacaoComAlimento) {
    return { advice: 'cautela', reason: 'Condição que pede acompanhamento antes de jejuar.' };
  }
  return { advice: 'ok', reason: 'Sem contraindicação registrada — ainda assim, ouça seu corpo.' };
}

// ─── Tabela de refeições (exemplo acessível, sem lactose problemática) ───────

export interface MealSuggestion {
  slot: string;
  opcoes: string[];
}

export const sampleMealPlan: MealSuggestion[] = [
  { slot: 'Café da manhã', opcoes: ['Aveia + banana', 'Ovos mexidos + fruta', 'Tapioca com ovo'] },
  { slot: 'Almoço', opcoes: ['Frango + feijão + arroz + couve', 'Peixe + legumes + arroz integral'] },
  { slot: 'Lanche', opcoes: ['Fruta + castanhas', 'Iogurte sem lactose + aveia'] },
  { slot: 'Jantar', opcoes: ['Sardinha + salada + batata', 'Omelete + legumes refogados'] },
];
