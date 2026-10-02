/**
 * useTracker.ts
 * -------------
 * Hooks que ligam a UI ao IndexedDB. Usam useLiveQuery do Dexie: quando o
 * banco muda (você registra água, peso, refeição), a tela reage sozinha.
 *
 * useDashboardData() entrega tudo já no formato que o Dashboard consome.
 */
import { useMemo, useCallback } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import {
  db, addWater as dbAddWater, latestWeightLog, latestPlanSnapshot,
  entriesForDay, getDayMeta, weightHistory, logFood, removeEntry, updateEntry, addWeightLog,
  updateWeightLog, deleteWeightLog,
  exercisesForDay, logExercise, removeExerciseEntry, updateExerciseEntry,
  type WeightLog, type Goal, type MealSlot, type Profile, type ExerciseEntry,
} from '../lib/db';
import {
  buildPlan, needsRecalculation, type BodyProfile, type NutritionPlan,
} from '../lib/calorieEngine';
import {
  sumEntries, progressVsGoals, nutrientGaps,
  type GoalDef, type NutrientKey, type NutrientProgress,
} from '../lib/dailyTotals';
import { foodById, recommendFasting, FOOD_BASE, type FoodItem, type LactoseLevel } from '../lib/referenceData';
import { recipeAsFood, type Recipe, type RecipeIngredient } from '../lib/recipes';
import { suggestMeals, type MealOption } from '../lib/mealSuggester';
import { exerciseById, kcalBurned, EXERCISE_BASE } from '../lib/exerciseEngine';
import { type DayAgg, type WeightPoint as WeeklyWeightPoint } from '../lib/weeklyAnalyst';

const today = (): string => new Date().toISOString().slice(0, 10);

const slugify = (s: string): string =>
  s.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase()
    .replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '').slice(0, 40);

// ── Resolvedor de alimento: base estática + customizados do usuário ─────────
export function useFoodResolver(): (id: string) => FoodItem | undefined {
  const customs = useLiveQuery(() => db.customFoods.toArray(), [], []);
  return useMemo(() => {
    const map = new Map<string, FoodItem>(
      (customs ?? []).map((c) => [
        c.id!,
        { id: c.id!, name: c.name, per100g: c.per100g as FoodItem['per100g'], lactoseLevel: c.lactoseLevel ?? 'none' },
      ]),
    );
    return (id: string) => foodById(id) ?? map.get(id);
  }, [customs]);
}

// ── Metas como mapa tipado p/ o agregador ───────────────────────────────────
export function goalsToMap(goals: Goal[]): Partial<Record<NutrientKey, GoalDef>> {
  const out: Partial<Record<NutrientKey, GoalDef>> = {};
  for (const g of goals) {
    out[g.key as NutrientKey] = { target: g.target, unit: g.unit, direction: g.direction ?? 'min' };
  }
  return out;
}

// ── Plano do dia (recalcula via buildPlan a partir do último peso) ──────────
export interface DailyPlanState {
  plan: NutritionPlan;
  weightKg: number;
  recalcRecommended: boolean;
  recalcReasons: string[];
}

export function useDailyPlan(): DailyPlanState | undefined {
  const profile = useLiveQuery(() => db.profile.get(1));
  const latestW = useLiveQuery(() => latestWeightLog());
  const lastSnap = useLiveQuery(() => latestPlanSnapshot());

  return useMemo(() => {
    if (!profile || !latestW) return undefined;
    const bodyProfile: BodyProfile = {
      weightKg: latestW.weightKg, heightCm: profile.heightCm, age: profile.age, sex: profile.sex,
      bodyFatPercent: latestW.bodyFatPercent, waistCm: latestW.waistCm, hipCm: latestW.hipCm,
    };
    const plan = buildPlan(bodyProfile, {
      activityLevel: profile.activityLevel, deficit: profile.deficit, proteinPerKg: profile.proteinPerKg,
    });
    const recalc = lastSnap
      ? needsRecalculation({ lastCalcWeightKg: lastSnap.weightKg, currentWeightKg: latestW.weightKg, lastCalcDate: lastSnap.createdAt })
      : { recommended: false, reasons: [] as string[], weightDelta: 0, daysElapsed: 0 };
    return { plan, weightKg: latestW.weightKg, recalcRecommended: recalc.recommended, recalcReasons: recalc.reasons };
  }, [profile, latestW, lastSnap]);
}

// ── Totais e progresso do dia ───────────────────────────────────────────────
export interface DayTotalsState {
  progress: NutrientProgress[];
  gaps: NutrientKey[];
  kcalConsumed: number;
  proteinConsumed: number;
}

export function useDayTotals(day = today()): DayTotalsState | undefined {
  const entries = useLiveQuery(() => entriesForDay(day), [day]);
  const goals = useLiveQuery(() => db.goals.toArray(), [], []);
  const resolve = useFoodResolver();

  return useMemo(() => {
    if (!entries || !goals) return undefined;
    const { totals, coveredKeys, resolvedCount } = sumEntries(entries, resolve);
    const progress = progressVsGoals(totals, goalsToMap(goals), { coveredKeys, resolvedCount });
    return {
      progress,
      gaps: nutrientGaps(progress),
      kcalConsumed: Math.round(totals.kcal ?? 0),
      proteinConsumed: Math.round(totals.protein ?? 0),
    };
  }, [entries, goals, resolve]);
}

// ── Água do dia (escreve no banco; a tela reage) ────────────────────────────
export function useWater(day = today()) {
  const meta = useLiveQuery(() => getDayMeta(day), [day]);
  const add = useCallback((ml: number) => dbAddWater(ml, day), [day]);
  return { waterMl: meta?.waterMl ?? 0, addWater: add };
}

// ── Histórico de peso com média móvel ───────────────────────────────────────
export interface WeightPoint extends WeightLog { avg: number; idx: number; }

export function useWeightHistory(sinceDay?: string, window = 7): WeightPoint[] {
  const logs = useLiveQuery(() => weightHistory(sinceDay), [sinceDay], []);
  return useMemo(() => {
    const arr = logs ?? [];
    return arr.map((d, i) => {
      const slice = arr.slice(Math.max(0, i - window + 1), i + 1);
      return { ...d, idx: i + 1, avg: Number((slice.reduce((s, x) => s + x.weightKg, 0) / slice.length).toFixed(2)) };
    });
  }, [logs, window]);
}

// ── Registrar alimento ou refeição rapidamente ──────────────────────────────
export function useLogFood(day = today()) {
  return useCallback(
    (foodId: string, meal: MealSlot, grams: number) => logFood({ foodId, meal, grams, day }),
    [day],
  );
}

// ── Busca de alimentos (base + customizados + receitas) ─────────────────────
export interface SearchFood { id: string; name: string; kcal100: number; lactoseLevel: string; isRecipe?: boolean; portions?: { label: string; grams: number }[]; }

export function useSearchableFoods(): SearchFood[] {
  const customs = useLiveQuery(() => db.customFoods.toArray(), [], []);
  const recipes = useLiveQuery(() => db.recipes.toArray(), [], []);
  const resolve = useFoodResolver();
  return useMemo(() => {
    const base: SearchFood[] = FOOD_BASE.map((f) => ({ id: f.id, name: f.name, kcal100: f.per100g.kcal, lactoseLevel: f.lactoseLevel, portions: f.portions }));
    const cust: SearchFood[] = (customs ?? []).map((c) => ({ id: c.id!, name: c.name, kcal100: (c.per100g.kcal as number) ?? 0, lactoseLevel: c.lactoseLevel ?? 'none' }));
    const recs: SearchFood[] = (recipes ?? []).map((r) => { const f = recipeAsFood(r, resolve); return { id: f.id, name: f.name, kcal100: f.per100g.kcal ?? 0, lactoseLevel: f.lactoseLevel, isRecipe: true }; });
    return [...base, ...cust, ...recs];
  }, [customs, recipes, resolve]);
}

// ── Alimentos frequentes (para registro em 1 toque) ─────────────────────────
export interface FrequentFood { id: string; name: string; defaultGrams: number; defaultLabel: string; }

export function useFrequentFoods(limit = 8): FrequentFood[] {
  const entries = useLiveQuery(() => db.foodEntries.orderBy('createdAt').reverse().limit(400).toArray(), [], []);
  const resolve = useFoodResolver();
  return useMemo(() => {
    const count = new Map<string, number>();
    for (const e of entries ?? []) count.set(e.foodId, (count.get(e.foodId) ?? 0) + 1);
    return [...count.entries()]
      .sort((a, b) => b[1] - a[1])
      .slice(0, limit)
      .map(([id]) => {
        const f = resolve(id);
        const p = f?.portions?.[0];
        return { id, name: f?.name ?? id, defaultGrams: p?.grams ?? 100, defaultLabel: p?.label ?? '100g' };
      })
      .filter((x) => !!resolve(x.id));
  }, [entries, resolve, limit]);
}

export interface EntryRow { id: number; meal: MealSlot; grams: number; name: string; kcal: number; createdAt: string; }

export function useTodayEntries(day = today()) {
  const entries = useLiveQuery(() => entriesForDay(day), [day], []);
  const resolve = useFoodResolver();
  const rows = useMemo<EntryRow[]>(
    () => (entries ?? []).map((e) => {
      const food = resolve(e.foodId);
      const kcal = food ? Math.round(((food.per100g.kcal ?? 0) * e.grams) / 100) : 0;
      return { id: e.id!, meal: e.meal, grams: e.grams, name: food?.name ?? e.foodId, kcal, createdAt: e.createdAt };
    }),
    [entries, resolve],
  );
  const totalKcal = rows.reduce((s, r) => s + r.kcal, 0);
  return {
    rows, totalKcal,
    remove: (id: number) => removeEntry(id),
    update: (id: number, grams: number) => updateEntry(id, { grams }),
  };
}

// ── Exercícios do dia ────────────────────────────────────────────────────────
export interface ExerciseRow { id: number; exerciseName: string; minutes: number; kcalBurned: number; }

export function useTodayExercise(day = today()) {
  const entries = useLiveQuery(() => exercisesForDay(day), [day], []);
  const rows = useMemo<ExerciseRow[]>(
    () => (entries ?? []).map((e) => ({
      id: e.id!, minutes: e.minutes, kcalBurned: e.kcalBurned,
      exerciseName: exerciseById(e.exerciseId)?.name ?? e.exerciseId,
    })),
    [entries],
  );
  const totalKcalBurned = rows.reduce((s, r) => s + r.kcalBurned, 0);
  return {
    rows, totalKcalBurned,
    remove: (id: number) => removeExerciseEntry(id),
    update: (id: number, minutes: number) => updateExerciseEntry(id, { minutes }),
  };
}

/** Registra um exercício — calcula e GRAVA o kcal gasto usando o peso atual. */
export function useLogExercise() {
  const daily = useDailyPlan();
  return useCallback(
    (exerciseId: string, minutes: number) => {
      const ex = exerciseById(exerciseId);
      const weightKg = daily?.weightKg;
      if (!ex || !weightKg || minutes <= 0) return;
      return logExercise({ exerciseId, minutes, kcalBurned: kcalBurned(ex.met, weightKg, minutes) });
    },
    [daily?.weightKg],
  );
}

export { EXERCISE_BASE };
export type { ExerciseEntry };

// ── Pesos: listar, editar, excluir ──────────────────────────────────────────
export function useWeightLogs() {
  const logs = useLiveQuery(() => db.weightLogs.orderBy('createdAt').reverse().toArray(), [], []);
  return {
    logs: logs ?? [],
    update: (id: number, changes: Partial<WeightLog>) => updateWeightLog(id, changes),
    remove: (id: number) => deleteWeightLog(id),
  };
}

// ── Perfil + peso (alimenta os cálculos de meta) ────────────────────────────
export function useProfile() {
  return useLiveQuery(() => db.profile.get(1));
}

export function useSaveProfile() {
  return useCallback(
    async (
      profile: Omit<Profile, 'id'>,
      weight: { weightKg: number; bodyFatPercent?: number; waistCm?: number; hipCm?: number },
    ) => {
      await db.profile.put({ id: 1, ...profile });
      await addWeightLog(weight);
    },
    [],
  );
}

// ── Cadastrar alimento próprio ──────────────────────────────────────────────
export function useSaveCustomFood() {
  return useCallback(
    async (input: { name: string; per100g: Record<string, number>; lactoseLevel?: LactoseLevel }) => {
      const id = 'custom:' + slugify(input.name);
      await db.customFoods.put({ id, name: input.name, per100g: input.per100g, lactoseLevel: input.lactoseLevel });
      return id;
    },
    [],
  );
}

// ── Metas (ler reativo) ─────────────────────────────────────────────────────
export function useGoals(): Goal[] {
  return useLiveQuery(() => db.goals.toArray(), [], []) ?? [];
}

// ── Receitas (listar / salvar / excluir) ────────────────────────────────────
export function useRecipes(): Recipe[] {
  return useLiveQuery(() => db.recipes.toArray(), [], []) ?? [];
}

export function useSaveRecipe() {
  return useCallback(
    async (name: string, ingredients: RecipeIngredient[], yieldGrams?: number) => {
      const id = 'recipe:' + slugify(name);
      await db.recipes.put({ id, name, ingredients, yieldGrams });
      return id;
    },
    [],
  );
}

export function useDeleteRecipe() {
  return useCallback((id: string) => db.recipes.delete(id), []);
}

// ── Histórico (dia/semana/mês) ──────────────────────────────────────────────
export interface HistoryDay { day: string; kcal: number; entries: number; }

export function useHistory(rangeDays = 30) {
  const since = useMemo(() => {
    const d = new Date();
    d.setDate(d.getDate() - rangeDays + 1);
    return d.toISOString().slice(0, 10);
  }, [rangeDays]);

  const entries = useLiveQuery(() => db.foodEntries.where('day').aboveOrEqual(since).toArray(), [since], []);
  const resolve = useFoodResolver();
  const weight = useWeightHistory(since);

  const days = useMemo<HistoryDay[]>(() => {
    const byDay = new Map<string, { kcal: number; entries: number }>();
    for (const e of entries ?? []) {
      const food = resolve(e.foodId);
      const kcal = food ? ((food.per100g.kcal ?? 0) * e.grams) / 100 : 0;
      const cur = byDay.get(e.day) ?? { kcal: 0, entries: 0 };
      byDay.set(e.day, { kcal: cur.kcal + kcal, entries: cur.entries + 1 });
    }
    return [...byDay.entries()]
      .map(([day, v]) => ({ day, kcal: Math.round(v.kcal), entries: v.entries }))
      .sort((a, b) => a.day.localeCompare(b.day));
  }, [entries, resolve]);

  return { days, weight, since };
}

// ── Agregação dos últimos N dias pro relatório semanal ──────────────────────
function lastNDays(n: number): string[] {
  const out: string[] = [];
  const d = new Date();
  for (let i = n - 1; i >= 0; i--) {
    const day = new Date(d);
    day.setDate(d.getDate() - i);
    out.push(day.toISOString().slice(0, 10));
  }
  return out;
}

/**
 * Agrega os últimos `n` dias (padrão 7) em `DayAgg[]` pra alimentar
 * `analyzeWeek()`. Usa a meta calórica ATUAL pra todos os dias (não
 * reconstrói o histórico de metas passadas — se o plano mudou no meio da
 * semana, a aderência calórica de dias antigos fica uma aproximação, não
 * exata; documentado aqui em vez de fingir precisão que não existe).
 */
export function useWeeklyRaw(n = 7) {
  const days = useMemo(() => lastNDays(n), [n]);
  const goals = useGoals();
  const resolve = useFoodResolver();
  const daily = useDailyPlan();

  const entriesByDay = useLiveQuery(() => Promise.all(days.map((d) => entriesForDay(d))), [days]);
  const exercisesByDay = useLiveQuery(() => Promise.all(days.map((d) => exercisesForDay(d))), [days]);
  const weightLogs = useLiveQuery(
    () => db.weightLogs.where('day').aboveOrEqual(days[0]).toArray(),
    [days],
    [],
  );

  const dayAggs: DayAgg[] = useMemo(() => {
    if (!entriesByDay || !exercisesByDay) return [];
    return days.map((day, i) => {
      const entries = entriesByDay[i] ?? [];
      const { totals, coveredKeys } = sumEntries(entries, resolve);
      const exerciseKcal = (exercisesByDay[i] ?? []).reduce((s, e) => s + e.kcalBurned, 0);
      return {
        day, totals, coveredKeys, hasEntries: entries.length > 0,
        kcalTarget: daily?.plan.calories.target ?? 2000,
        exerciseKcal,
      };
    });
  }, [days, entriesByDay, exercisesByDay, resolve, daily]);

  const weightPoints: WeeklyWeightPoint[] = useMemo(
    () => (weightLogs ?? []).map((w) => ({ day: w.day, weightKg: w.weightKg })),
    [weightLogs],
  );

  return {
    ready: !!entriesByDay && !!exercisesByDay,
    dayAggs,
    goalsMap: goalsToMap(goals),
    weightPoints,
  };
}

// ── Agregador final: tudo que o Dashboard precisa ───────────────────────────
export interface DashboardData {
  ready: boolean;
  plan?: NutritionPlan;
  weightKg?: number;
  recalcRecommended: boolean;
  kcalConsumed: number;
  proteinConsumed: number;
  progress: NutrientProgress[];
  waterMl: number;
  addWater: (ml: number) => void;
  weight: WeightPoint[];
  suggestions: MealOption[];
  fasting: { advice: string; reason: string };
  /** kcal gasto em exercício hoje — soma de volta à meta do dia (ver BalanceRing). */
  exerciseKcalBurned: number;
}

export function useDashboardData(opts?: { pangastrite?: boolean; maxLactose?: 'none' | 'low' | 'moderate' | 'high' }): DashboardData {
  const daily = useDailyPlan();
  const totals = useDayTotals();
  const { waterMl, addWater } = useWater();
  const weight = useWeightHistory();
  const { totalKcalBurned: exerciseKcalBurned } = useTodayExercise();

  // Meta efetiva do dia = meta base + o que já foi gasto em exercício —
  // mesmo modelo mental da maioria dos apps de fitness ("treinou, ganhou
  // espaço"). Nível de atividade do onboarding já entra no TDEE base; isso
  // aqui é o extra além do padrão assumido, não uma duplicata.
  const effectiveTarget = (daily?.plan.calories.target ?? 0) + exerciseKcalBurned;
  const remainingKcal = Math.max(effectiveTarget - (totals?.kcalConsumed ?? 0), 0);
  const suggestions = useMemo(
    () => suggestMeals({ remainingKcal, gaps: totals?.gaps ?? [], maxLactose: opts?.maxLactose ?? 'low' }),
    [remainingKcal, totals?.gaps, opts?.maxLactose],
  );
  const fasting = useMemo(() => recommendFasting({ pangastrite: opts?.pangastrite ?? false }), [opts?.pangastrite]);

  return {
    ready: !!daily && !!totals,
    plan: daily?.plan,
    weightKg: daily?.weightKg,
    recalcRecommended: daily?.recalcRecommended ?? false,
    kcalConsumed: totals?.kcalConsumed ?? 0,
    proteinConsumed: totals?.proteinConsumed ?? 0,
    progress: totals?.progress ?? [],
    waterMl,
    addWater,
    weight,
    suggestions,
    fasting,
    exerciseKcalBurned,
  };
}
