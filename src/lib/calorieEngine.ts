/**
 * calorieEngine.ts
 * -----------------
 * Núcleo de cálculo do tracker de déficit calórico.
 *
 * Princípios de projeto:
 *  - Lógica PURA (sem React, sem IndexedDB): fácil de testar e reutilizar.
 *  - Seleção AUTOMÁTICA do melhor método: usa Katch-McArdle quando o % de
 *    gordura é conhecido (mais preciso), senão Mifflin-St Jeor.
 *  - PISO DE SEGURANÇA: a meta nunca desce abaixo de um mínimo saudável.
 *  - NÃO usamos IMC para nada do cálculo energético — ele ignora composição
 *    corporal. Fica fora de propósito aqui.
 *
 * AVISO: estimativas estatísticas têm erro de ~10%. Metas reais devem ser
 * validadas com nutricionista/médico, ainda mais com histórico clínico.
 */

// ─────────────────────────────────────────────────────────────────────────────
// Tipos e constantes
// ─────────────────────────────────────────────────────────────────────────────

export type Sex = 'male' | 'female';

export type ActivityLevel =
  | 'sedentary'
  | 'light'
  | 'moderate'
  | 'active'
  | 'veryActive';

/** Multiplicadores de atividade aplicados ao BMR para chegar ao TDEE. */
export const ACTIVITY_FACTORS: Record<ActivityLevel, number> = {
  sedentary: 1.2, // pouco ou nenhum exercício
  light: 1.375, // exercício leve 1–3 dias/semana
  moderate: 1.55, // exercício moderado 3–5 dias/semana
  active: 1.725, // exercício intenso 6–7 dias/semana
  veryActive: 1.9, // físico muito pesado / treino 2x ao dia
};

/** Piso calórico conservador (kcal/dia). Abaixo disso só com acompanhamento. */
export const MIN_CALORIES: Record<Sex, number> = {
  male: 1500,
  female: 1200,
};

/** Calorias por grama de cada macronutriente. */
export const KCAL_PER_GRAM = { protein: 4, carb: 4, fat: 9 } as const;

export interface BodyProfile {
  weightKg: number;
  heightCm: number;
  age: number;
  sex: Sex;
  /** Opcional. Se presente (>0), o motor troca para Katch-McArdle. */
  bodyFatPercent?: number;
  /** Opcionais — usados no risco cardiovascular, não no cálculo energético. */
  waistCm?: number;
  hipCm?: number;
}

export interface PlanOptions {
  activityLevel: ActivityLevel;
  /** kcal/dia a subtrair do TDEE. Recomendado 250–500. */
  deficit: number;
  /** g de proteína por kg de peso. Padrão 1.6 (preservação em déficit). */
  proteinPerKg?: number;
  /** Fração das calorias vinda de gordura. Padrão 0.27. */
  fatPercent?: number;
  /** ml de água por kg de peso. Padrão 35. */
  waterMlPerKg?: number;
}

// ─────────────────────────────────────────────────────────────────────────────
// Validação (mentalidade QA: falhar cedo e com mensagem clara)
// ─────────────────────────────────────────────────────────────────────────────

export function validateProfile(p: BodyProfile): void {
  if (p.weightKg <= 0) throw new RangeError('weightKg deve ser > 0');
  if (p.heightCm <= 0) throw new RangeError('heightCm deve ser > 0');
  if (p.age <= 0 || p.age > 120) throw new RangeError('age fora do intervalo válido');
  if (p.sex !== 'male' && p.sex !== 'female') {
    throw new TypeError("sex deve ser 'male' ou 'female'");
  }
  if (p.bodyFatPercent != null && (p.bodyFatPercent <= 0 || p.bodyFatPercent >= 75)) {
    throw new RangeError('bodyFatPercent deve estar entre 0 e 75');
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Cálculos primários
// ─────────────────────────────────────────────────────────────────────────────

/** Massa magra (kg) = peso × (1 − %gordura/100). */
export function leanBodyMass(weightKg: number, bodyFatPercent: number): number {
  return weightKg * (1 - bodyFatPercent / 100);
}

/** BMR via Mifflin-St Jeor — padrão para adultos saudáveis. */
export function bmrMifflin({ weightKg, heightCm, age, sex }: BodyProfile): number {
  const base = 10 * weightKg + 6.25 * heightCm - 5 * age;
  return sex === 'male' ? base + 5 : base - 161;
}

/** BMR via Katch-McArdle — mais preciso quando se conhece a massa magra. */
export function bmrKatchMcArdle(leanMassKg: number): number {
  return 370 + 21.6 * leanMassKg;
}

export interface BmrResult {
  bmr: number;
  method: 'mifflin-st-jeor' | 'katch-mcardle';
  leanMassKg?: number;
}

/** Escolhe automaticamente o método mais preciso disponível. */
export function estimateBMR(profile: BodyProfile): BmrResult {
  if (profile.bodyFatPercent != null && profile.bodyFatPercent > 0) {
    const leanMassKg = leanBodyMass(profile.weightKg, profile.bodyFatPercent);
    return { bmr: bmrKatchMcArdle(leanMassKg), method: 'katch-mcardle', leanMassKg };
  }
  return { bmr: bmrMifflin(profile), method: 'mifflin-st-jeor' };
}

/** TDEE = BMR × fator de atividade. */
export function tdee(bmr: number, activityLevel: ActivityLevel): number {
  const factor = ACTIVITY_FACTORS[activityLevel];
  if (factor == null) throw new TypeError(`activityLevel inválido: ${activityLevel}`);
  return bmr * factor;
}

export interface CalorieTargetResult {
  target: number;
  /** true se a meta bateu no piso de segurança (déficit foi reduzido). */
  clampedToFloor: boolean;
  /** Déficit efetivamente aplicado após respeitar o piso. */
  effectiveDeficit: number;
}

/** Meta calórica com déficit, respeitando o piso mínimo saudável. */
export function calorieTarget(tdeeValue: number, deficit: number, sex: Sex): CalorieTargetResult {
  const floor = MIN_CALORIES[sex];
  const raw = tdeeValue - deficit;
  const target = Math.max(raw, floor);
  return {
    target: Math.round(target),
    clampedToFloor: raw < floor,
    effectiveDeficit: Math.round(tdeeValue - target),
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// Metas derivadas
// ─────────────────────────────────────────────────────────────────────────────

export interface MacroTargets {
  protein: number; // g
  fat: number; // g
  carb: number; // g
}

/**
 * Distribui as calorias em macros. Proteína vem primeiro (prioridade),
 * gordura por fração, carboidrato preenche o resto.
 * Heurística inicial — ajuste com profissional, ainda mais com colesterol alto.
 */
export function macroTargets(
  calorieTarget: number,
  weightKg: number,
  proteinPerKg = 1.6,
  fatPercent = 0.27,
): MacroTargets {
  const proteinG = proteinPerKg * weightKg;
  const proteinKcal = proteinG * KCAL_PER_GRAM.protein;
  const fatKcal = calorieTarget * fatPercent;
  const fatG = fatKcal / KCAL_PER_GRAM.fat;
  const carbKcal = Math.max(calorieTarget - proteinKcal - fatKcal, 0);
  const carbG = carbKcal / KCAL_PER_GRAM.carb;
  return {
    protein: Math.round(proteinG),
    fat: Math.round(fatG),
    carb: Math.round(carbG),
  };
}

/** Meta de água (ml/dia) proporcional ao peso. */
export function waterTargetMl(weightKg: number, mlPerKg = 35): number {
  return Math.round(weightKg * mlPerKg);
}

export type CardioRisk = 'low' | 'moderate' | 'high';

/**
 * Relação cintura/quadril — indicador cardiovascular muito melhor que o IMC.
 * Relevante pro histórico de colesterol. Limiares baseados na OMS.
 */
export function waistHipRatio(
  waistCm: number,
  hipCm: number,
  sex: Sex,
): { ratio: number; risk: CardioRisk } {
  if (hipCm <= 0) throw new RangeError('hipCm deve ser > 0');
  const ratio = waistCm / hipCm;
  const high = sex === 'male' ? 0.9 : 0.85;
  const moderate = sex === 'male' ? 0.85 : 0.8;
  const risk: CardioRisk = ratio >= high ? 'high' : ratio >= moderate ? 'moderate' : 'low';
  return { ratio: Number(ratio.toFixed(2)), risk };
}

// ─────────────────────────────────────────────────────────────────────────────
// Recálculo periódico (o plano "estraga" com o tempo)
// ─────────────────────────────────────────────────────────────────────────────

export interface RecalcInput {
  lastCalcWeightKg: number;
  currentWeightKg: number;
  lastCalcDate: Date | string;
  now?: Date;
}

export interface RecalcResult {
  recommended: boolean;
  reasons: Array<'weight' | 'time'>;
  weightDelta: number;
  daysElapsed: number;
}

const MS_PER_DAY = 86_400_000;

/** Recomenda recálculo se mudou ≥3 kg ou passaram ≥28 dias. */
export function needsRecalculation({
  lastCalcWeightKg,
  currentWeightKg,
  lastCalcDate,
  now = new Date(),
}: RecalcInput): RecalcResult {
  const weightDelta = Math.abs(currentWeightKg - lastCalcWeightKg);
  const daysElapsed = Math.floor((now.getTime() - new Date(lastCalcDate).getTime()) / MS_PER_DAY);
  const reasons: Array<'weight' | 'time'> = [];
  if (weightDelta >= 3) reasons.push('weight');
  if (daysElapsed >= 28) reasons.push('time');
  return { recommended: reasons.length > 0, reasons, weightDelta, daysElapsed };
}

// ─────────────────────────────────────────────────────────────────────────────
// Orquestrador: monta o plano completo de uma vez
// ─────────────────────────────────────────────────────────────────────────────

export interface NutritionPlan {
  bmr: number;
  bmrMethod: BmrResult['method'];
  leanMassKg?: number;
  tdee: number;
  calories: CalorieTargetResult;
  macros: MacroTargets;
  waterMl: number;
  cardio?: { ratio: number; risk: CardioRisk };
}

export function buildPlan(profile: BodyProfile, options: PlanOptions): NutritionPlan {
  validateProfile(profile);

  const bmrResult = estimateBMR(profile);
  const tdeeValue = tdee(bmrResult.bmr, options.activityLevel);
  const calories = calorieTarget(tdeeValue, options.deficit, profile.sex);
  const macros = macroTargets(
    calories.target,
    profile.weightKg,
    options.proteinPerKg,
    options.fatPercent,
  );
  const waterMl = waterTargetMl(profile.weightKg, options.waterMlPerKg);

  const cardio =
    profile.waistCm != null && profile.hipCm != null
      ? waistHipRatio(profile.waistCm, profile.hipCm, profile.sex)
      : undefined;

  return {
    bmr: Math.round(bmrResult.bmr),
    bmrMethod: bmrResult.method,
    leanMassKg: bmrResult.leanMassKg != null ? Number(bmrResult.leanMassKg.toFixed(1)) : undefined,
    tdee: Math.round(tdeeValue),
    calories,
    macros,
    waterMl,
    cardio,
  };
}
