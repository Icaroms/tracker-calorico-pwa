/**
 * mealSuggester.ts
 * ----------------
 * Gera múltiplas opções de próxima refeição a partir das lacunas do dia,
 * respeitando o orçamento calórico restante e a tolerância à lactose.
 *
 * Estratégia: para cada lacuna prioritária, escolhe um alimento "âncora" que a
 * cubra e cabe no orçamento; opcionalmente adiciona um complemento que cubra
 * outras lacunas. Devolve opções distintas e ranqueadas.
 */
import { FOOD_BASE, type FoodItem, type LactoseLevel } from './referenceData';
import type { NutrientKey } from './dailyTotals';

const LACTOSE_ORDER: Record<LactoseLevel, number> = { none: 0, low: 1, moderate: 2, high: 3 };

export interface SuggestContext {
  remainingKcal: number;
  gaps: NutrientKey[];
  /** Nível máximo de lactose tolerado (intolerância moderada → 'low'). */
  maxLactose?: LactoseLevel;
  portionGrams?: number; // porção padrão p/ estimar kcal (default 120 g)
}

export interface MealOption {
  foods: Array<{ id: string; name: string; grams: number }>;
  kcal: number;
  covers: NutrientKey[]; // lacunas que esta opção ajuda a fechar
  score: number;
}

function lactoseOk(food: FoodItem, max: LactoseLevel): boolean {
  return LACTOSE_ORDER[food.lactoseLevel] <= LACTOSE_ORDER[max];
}

function kcalFor(food: FoodItem, grams: number): number {
  return Math.round((food.per100g.kcal * grams) / 100);
}

/** Quantas das lacunas atuais este alimento cobre. */
function gapsCovered(food: FoodItem, gaps: NutrientKey[]): NutrientKey[] {
  const good = new Set(food.goodFor ?? []);
  return gaps.filter((g) => good.has(g));
}

export function suggestMeals(
  ctx: SuggestContext,
  base: FoodItem[] = FOOD_BASE,
  count = 3,
): MealOption[] {
  const max = ctx.maxLactose ?? 'low';
  const portion = ctx.portionGrams ?? 120;

  // Candidatos: respeitam lactose, cabem no orçamento e cobrem ≥1 lacuna.
  const candidates = base
    .filter((f) => lactoseOk(f, max))
    .map((f) => ({
      food: f,
      grams: portion,
      kcal: kcalFor(f, portion),
      covers: gapsCovered(f, ctx.gaps),
    }))
    .filter((c) => c.kcal <= ctx.remainingKcal && c.covers.length > 0)
    .sort((a, b) => b.covers.length - a.covers.length || a.kcal - b.kcal);

  const options: MealOption[] = [];
  const usedAnchors = new Set<string>();

  for (const anchor of candidates) {
    if (options.length >= count) break;
    if (usedAnchors.has(anchor.food.id)) continue;
    usedAnchors.add(anchor.food.id);

    const covered = new Set(anchor.covers);
    const foods = [{ id: anchor.food.id, name: anchor.food.name, grams: anchor.grams }];
    let kcal = anchor.kcal;

    // Tenta um complemento que cubra lacunas ainda não cobertas.
    const remainingGaps = ctx.gaps.filter((g) => !covered.has(g));
    const complement = candidates.find(
      (c) =>
        c.food.id !== anchor.food.id &&
        kcal + c.kcal <= ctx.remainingKcal &&
        c.covers.some((g) => remainingGaps.includes(g)),
    );
    if (complement) {
      foods.push({ id: complement.food.id, name: complement.food.name, grams: complement.grams });
      kcal += complement.kcal;
      complement.covers.forEach((g) => covered.add(g));
    }

    options.push({
      foods,
      kcal,
      covers: [...covered],
      score: covered.size * 10 - kcal / 100, // mais lacunas e menos kcal = melhor
    });
  }

  return options.sort((a, b) => b.score - a.score);
}
