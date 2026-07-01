/**
 * recipes.ts
 * ----------
 * Modelo de "prato": uma receita é uma combinação de ingredientes.
 * Permite registrar um prato composto num toque, em vez de ingrediente a
 * ingrediente — e somar nutrientes, água e lactose corretamente.
 *
 * Puro: não toca no IndexedDB. A persistência vive no db.ts.
 */
import { foodById, type FoodItem, type LactoseLevel } from './referenceData';
import { TRACKED_NUTRIENTS, type NutrientKey, type NutrientTotals, type FoodResolver } from './dailyTotals';

export interface RecipeIngredient {
  foodId: string;
  grams: number;
}

export interface Recipe {
  id: string; // ex.: 'recipe:feijoada'
  name: string;
  ingredients: RecipeIngredient[];
  /** Rendimento final em gramas. Default = soma dos ingredientes crus. */
  yieldGrams?: number;
}

const LACTOSE_ORDER: Record<LactoseLevel, number> = { none: 0, low: 1, moderate: 2, high: 3 };
const LACTOSE_LABEL: LactoseLevel[] = ['none', 'low', 'moderate', 'high'];

/** Peso total do prato (rendimento informado, ou soma dos ingredientes). */
export function recipeTotalGrams(recipe: Recipe): number {
  if (recipe.yieldGrams != null) return recipe.yieldGrams;
  return recipe.ingredients.reduce((s, i) => s + i.grams, 0);
}

/** Nutrientes do prato INTEIRO (soma dos ingredientes escalados). */
export function recipeNutrients(recipe: Recipe, resolve: FoodResolver = foodById): NutrientTotals {
  const totals: NutrientTotals = {};
  for (const ing of recipe.ingredients) {
    const food = resolve(ing.foodId);
    if (!food) continue;
    const factor = ing.grams / 100;
    for (const key of TRACKED_NUTRIENTS) {
      const v = food.per100g[key];
      if (v == null) continue;
      totals[key] = Number(((totals[key] ?? 0) + v * factor).toFixed(3));
    }
  }
  return totals;
}

/** Nutrientes por 100 g do prato pronto — permite tratar a receita como alimento. */
export function recipePer100g(recipe: Recipe, resolve: FoodResolver = foodById): NutrientTotals {
  const total = recipeNutrients(recipe, resolve);
  const grams = recipeTotalGrams(recipe);
  if (grams <= 0) return {};
  const per100: NutrientTotals = {};
  for (const key of TRACKED_NUTRIENTS) {
    if (total[key] == null) continue;
    per100[key] = Number(((total[key]! * 100) / grams).toFixed(3));
  }
  return per100;
}

/** Maior nível de lactose entre os ingredientes (intolerância usa o pior caso). */
export function recipeLactoseLevel(recipe: Recipe, resolve: FoodResolver = foodById): LactoseLevel {
  let worst = 0;
  for (const ing of recipe.ingredients) {
    const food = resolve(ing.foodId);
    if (food) worst = Math.max(worst, LACTOSE_ORDER[food.lactoseLevel]);
  }
  return LACTOSE_LABEL[worst];
}

/**
 * Converte a receita num FoodItem (per 100 g do prato), para a receita aparecer
 * na base, ser sugerida e ser cacheada como alimento. goodFor = união dos
 * ingredientes; assim o prato também ajuda a fechar lacunas.
 */
export function recipeAsFood(recipe: Recipe, resolve: FoodResolver = foodById): FoodItem {
  const per100 = recipePer100g(recipe, resolve);
  const goodFor = new Set<string>();
  for (const ing of recipe.ingredients) {
    resolve(ing.foodId)?.goodFor?.forEach((g) => goodFor.add(g));
  }
  return {
    id: recipe.id,
    name: recipe.name,
    per100g: per100 as FoodItem['per100g'],
    lactoseLevel: recipeLactoseLevel(recipe, resolve),
    goodFor: [...goodFor],
    tags: ['receita'],
  };
}

/**
 * Expande uma porção do prato de volta em gramas por ingrediente.
 * Ex.: "comi 300 g de feijoada" → quantos g de feijão, carne, etc.
 * Usado ao registrar por ingrediente, mantendo o agregador inalterado.
 */
export function expandRecipe(
  recipe: Recipe,
  portionGrams: number,
): Array<{ foodId: string; grams: number }> {
  const total = recipeTotalGrams(recipe);
  if (total <= 0) return [];
  const ratio = portionGrams / total;
  return recipe.ingredients.map((i) => ({
    foodId: i.foodId,
    grams: Number((i.grams * ratio).toFixed(1)),
  }));
}
