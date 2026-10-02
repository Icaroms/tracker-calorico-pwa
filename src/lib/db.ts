/**
 * db.ts
 * ------
 * Camada de dados do tracker (IndexedDB via Dexie).
 *
 * Guarda APENAS dados gerados pelo usuário (leves):
 *   - logs de peso/medidas
 *   - refeições registradas
 *   - snapshots do plano calculado
 *   - metas, metadados do dia (jejum, água), alimentos customizados
 *
 * A base de alimentos de referência e o conteúdo de saúde NÃO vivem aqui —
 * ficam em referenceData.ts (estático, cacheado pelo Service Worker).
 *
 * Convenções de data:
 *   - `day` = 'YYYY-MM-DD' (chave de dia, indexável)
 *   - `createdAt` = timestamp ISO completo
 */
import Dexie, { type Table } from 'dexie';
import type { Sex, ActivityLevel } from './calorieEngine';
import { expandRecipe, type Recipe } from './recipes';

// ─── Tipos das tabelas ──────────────────────────────────────────────────────

export interface WeightLog {
  id?: number;
  day: string; // 'YYYY-MM-DD'
  weightKg: number;
  bodyFatPercent?: number;
  waistCm?: number;
  hipCm?: number;
  createdAt: string;
}

export type MealSlot = 'cafe' | 'almoco' | 'lanche' | 'jantar' | 'ceia';

export interface FoodEntry {
  id?: number;
  day: string;
  meal: MealSlot;
  foodId: string; // referencia referenceData ou customFoods
  grams: number;
  recipeId?: string; // se veio de um prato, agrupa os ingredientes
  createdAt: string;
}

/**
 * Exercício registrado. `kcalBurned` é GRAVADO no momento do registro (não
 * recalculado depois) — usa o peso da pessoa NAQUELE dia. Se o peso mudar
 * mais tarde, o histórico continua correto em vez de mudar retroativamente.
 */
export interface ExerciseEntry {
  id?: number;
  day: string;
  exerciseId: string; // referencia exerciseEngine.EXERCISE_BASE
  minutes: number;
  kcalBurned: number;
  createdAt: string;
}

export interface CustomFood {
  id?: string; // ex.: 'custom:tapioca'
  name: string;
  /** Valores por 100 g. Mesmo formato do FoodItem de referenceData. */
  per100g: Record<string, number>;
  lactoseLevel?: 'none' | 'low' | 'moderate' | 'high';
}

export interface PlanSnapshot {
  id?: number;
  day: string;
  weightKg: number;
  bmrMethod: string;
  tdee: number;
  calorieTarget: number;
  proteinG: number;
  waterMl: number;
  createdAt: string;
}

export interface DayMeta {
  day: string; // PK
  fasting?: boolean; // o usuário jejuou nesse dia?
  waterMl?: number; // água consumida acumulada
  notes?: string;
}

export interface Goal {
  key: string; // 'protein' | 'water' | 'fiber' | 'calcium' ...
  target: number;
  unit: string; // 'g' | 'ml' | 'mg' | 'mcg'
  direction?: 'min' | 'max'; // 'max' = limite (ex.: gordura saturada)
}

export interface Profile {
  id?: number; // sempre 1 (singleton)
  heightCm: number;
  age: number;
  sex: Sex;
  activityLevel: ActivityLevel;
  deficit: number; // kcal/dia a subtrair do TDEE
  proteinPerKg?: number;
}

// ─── Banco ──────────────────────────────────────────────────────────────────

export class TrackerDB extends Dexie {
  weightLogs!: Table<WeightLog, number>;
  foodEntries!: Table<FoodEntry, number>;
  customFoods!: Table<CustomFood, string>;
  planSnapshots!: Table<PlanSnapshot, number>;
  dayMeta!: Table<DayMeta, string>;
  goals!: Table<Goal, string>;
  profile!: Table<Profile, number>;
  recipes!: Table<Recipe, string>;
  exerciseEntries!: Table<ExerciseEntry, number>;

  constructor() {
    super('DeficitTrackerDB');
    this.version(1).stores({
      // ++ = auto-incremento; índices listados após a PK
      weightLogs: '++id, day, createdAt',
      foodEntries: '++id, day, [day+meal], foodId',
      customFoods: 'id, name',
      planSnapshots: '++id, day, createdAt',
      dayMeta: 'day',
      goals: 'key',
      profile: '++id',
    });
    // v2: receitas + índice recipeId nas entradas (migração automática do Dexie)
    this.version(2).stores({
      foodEntries: '++id, day, [day+meal], foodId, recipeId',
      recipes: 'id, name',
    });
    // v3: 'createdAt' faltava no índice de foodEntries — useFrequentFoods()
    // usa orderBy('createdAt'), e o Dexie exige que o campo esteja indexado
    // pra isso (não basta existir no objeto). Sem isso, a aba "Registrar"
    // lançava SchemaError em TODA visita (mesmo com o dia vazio) e caía no
    // ErrorBoundary. Migração automática do Dexie, não perde dado nenhum.
    this.version(3).stores({
      foodEntries: '++id, day, [day+meal], foodId, recipeId, createdAt',
    });
    // v4: registro de exercícios (gasto calórico por MET).
    this.version(4).stores({
      exerciseEntries: '++id, day, createdAt',
    });
  }
}

export const db = new TrackerDB();

// ─── Helpers de peso/medidas ────────────────────────────────────────────────

const today = (): string => new Date().toISOString().slice(0, 10);
const now = (): string => new Date().toISOString();

export async function addWeightLog(
  entry: Omit<WeightLog, 'id' | 'day' | 'createdAt'> & { day?: string },
): Promise<number> {
  return db.weightLogs.add({ ...entry, day: entry.day ?? today(), createdAt: now() });
}

export async function latestWeightLog(): Promise<WeightLog | undefined> {
  return db.weightLogs.orderBy('createdAt').last();
}

export async function weightHistory(sinceDay?: string): Promise<WeightLog[]> {
  const coll = sinceDay
    ? db.weightLogs.where('day').aboveOrEqual(sinceDay)
    : db.weightLogs.toCollection();
  return (await coll.toArray()).sort((a, b) => a.day.localeCompare(b.day));
}

export async function updateWeightLog(id: number, changes: Partial<WeightLog>): Promise<void> {
  await db.weightLogs.update(id, changes);
}

export async function deleteWeightLog(id: number): Promise<void> {
  await db.weightLogs.delete(id);
}

// ─── Helpers de refeições ───────────────────────────────────────────────────

export async function logFood(
  entry: Omit<FoodEntry, 'id' | 'createdAt' | 'day'> & { day?: string },
): Promise<number> {
  return db.foodEntries.add({ ...entry, day: entry.day ?? today(), createdAt: now() });
}

export async function entriesForDay(day: string = today()): Promise<FoodEntry[]> {
  return db.foodEntries.where('day').equals(day).toArray();
}

export async function removeEntry(id: number): Promise<void> {
  await db.foodEntries.delete(id);
}

export async function updateEntry(id: number, changes: Partial<FoodEntry>): Promise<void> {
  await db.foodEntries.update(id, changes);
}

// ─── Helpers de exercício ───────────────────────────────────────────────────

export async function logExercise(
  entry: Omit<ExerciseEntry, 'id' | 'createdAt' | 'day'> & { day?: string },
): Promise<number> {
  return db.exerciseEntries.add({ ...entry, day: entry.day ?? today(), createdAt: now() });
}

export async function exercisesForDay(day: string = today()): Promise<ExerciseEntry[]> {
  return db.exerciseEntries.where('day').equals(day).toArray();
}

export async function removeExerciseEntry(id: number): Promise<void> {
  await db.exerciseEntries.delete(id);
}

export async function updateExerciseEntry(id: number, changes: Partial<ExerciseEntry>): Promise<void> {
  await db.exerciseEntries.update(id, changes);
}

// ─── Helpers de receita/prato ───────────────────────────────────────────────

export async function saveRecipe(recipe: Recipe): Promise<string> {
  return db.recipes.put(recipe);
}

export async function allRecipes(): Promise<Recipe[]> {
  return db.recipes.toArray();
}

export async function getRecipe(id: string): Promise<Recipe | undefined> {
  return db.recipes.get(id);
}

/**
 * Registra um prato: expande a porção em entradas por ingrediente (tagueadas
 * com recipeId), para o agregador continuar somando sem mudança.
 */
export async function logRecipe(
  recipeId: string,
  meal: MealSlot,
  portionGrams: number,
  day: string = today(),
): Promise<number[]> {
  const recipe = await db.recipes.get(recipeId);
  if (!recipe) throw new Error(`Receita não encontrada: ${recipeId}`);
  const parts = expandRecipe(recipe, portionGrams);
  const ts = now();
  return db.foodEntries.bulkAdd(
    parts.map((p) => ({ ...p, day, meal, recipeId, createdAt: ts })),
    { allKeys: true },
  ) as Promise<number[]>;
}

// ─── Plano / metas / metadados do dia ───────────────────────────────────────

export async function savePlanSnapshot(
  snap: Omit<PlanSnapshot, 'id' | 'createdAt' | 'day'> & { day?: string },
): Promise<number> {
  return db.planSnapshots.add({ ...snap, day: snap.day ?? today(), createdAt: now() });
}

export async function latestPlanSnapshot(): Promise<PlanSnapshot | undefined> {
  return db.planSnapshots.orderBy('createdAt').last();
}

export async function setGoal(goal: Goal): Promise<string> {
  return db.goals.put(goal);
}

export async function allGoals(): Promise<Goal[]> {
  return db.goals.toArray();
}

export async function upsertDayMeta(meta: DayMeta): Promise<string> {
  return db.dayMeta.put(meta);
}

export async function getDayMeta(day: string = today()): Promise<DayMeta | undefined> {
  return db.dayMeta.get(day);
}

/** Soma água do dia incrementalmente (botão "+250 ml"). */
export async function addWater(ml: number, day: string = today()): Promise<void> {
  const meta = (await db.dayMeta.get(day)) ?? { day };
  await db.dayMeta.put({ ...meta, waterMl: (meta.waterMl ?? 0) + ml });
}

// ─── Backup: export / import (JSON) ─────────────────────────────────────────
// Implementado cedo porque é barato e salva o usuário se o navegador
// limpar o IndexedDB.

export async function exportAll(): Promise<string> {
  const dump = {
    version: 1,
    exportedAt: now(),
    weightLogs: await db.weightLogs.toArray(),
    foodEntries: await db.foodEntries.toArray(),
    customFoods: await db.customFoods.toArray(),
    planSnapshots: await db.planSnapshots.toArray(),
    dayMeta: await db.dayMeta.toArray(),
    goals: await db.goals.toArray(),
    profile: await db.profile.toArray(),
    recipes: await db.recipes.toArray(),
    exerciseEntries: await db.exerciseEntries.toArray(),
  };
  return JSON.stringify(dump);
}

export async function importAll(json: string): Promise<void> {
  const data = JSON.parse(json);
  await db.transaction(
    'rw',
    [db.weightLogs, db.foodEntries, db.customFoods, db.planSnapshots, db.dayMeta, db.goals, db.profile, db.recipes, db.exerciseEntries],
    async () => {
      await Promise.all([
        db.weightLogs.bulkPut(data.weightLogs ?? []),
        db.foodEntries.bulkPut(data.foodEntries ?? []),
        db.customFoods.bulkPut(data.customFoods ?? []),
        db.planSnapshots.bulkPut(data.planSnapshots ?? []),
        db.dayMeta.bulkPut(data.dayMeta ?? []),
        db.goals.bulkPut(data.goals ?? []),
        db.profile.bulkPut(data.profile ?? []),
        db.recipes.bulkPut(data.recipes ?? []),
        db.exerciseEntries.bulkPut(data.exerciseEntries ?? []),
      ]);
    },
  );
}
