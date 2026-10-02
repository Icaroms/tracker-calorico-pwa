/**
 * meals.ts
 * --------
 * Lista única de refeições do dia. Antes era copiada em 3 componentes
 * (LogFood, BarcodeScanner, FoodCamera) — mudar um rótulo em um só deixaria
 * as telas inconsistentes.
 */
import type { MealSlot } from './db';

export const MEALS: ReadonlyArray<{ value: MealSlot; label: string }> = [
  { value: 'cafe', label: 'Café' },
  { value: 'almoco', label: 'Almoço' },
  { value: 'lanche', label: 'Lanche' },
  { value: 'jantar', label: 'Jantar' },
  { value: 'ceia', label: 'Ceia' },
];

/**
 * Refeição sugerida pela hora do dia — antes todas as telas abriam em
 * "Lanche" fixo, e o card de sugestão do Dashboard registrava tudo como
 * "Almoço", mesmo às 22h. Faixas aproximadas, o usuário sempre pode trocar.
 */
export function mealForHour(hour: number): MealSlot {
  if (hour >= 5 && hour < 10) return 'cafe';
  if (hour >= 10 && hour < 15) return 'almoco';
  if (hour >= 15 && hour < 18) return 'lanche';
  if (hour >= 18 && hour < 22) return 'jantar';
  return 'ceia';
}

export const currentMeal = (): MealSlot => mealForHour(new Date().getHours());
