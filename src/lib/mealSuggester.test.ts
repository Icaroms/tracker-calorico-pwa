import { describe, it, expect } from 'vitest';
import { suggestMeals } from './mealSuggester';
import type { FoodItem } from './referenceData';

const base: FoodItem[] = [
  { id: 'frango', name: 'Frango', per100g: { kcal: 165, protein: 31, carb: 0, fat: 3.6 }, lactoseLevel: 'none', goodFor: ['protein'] },
  { id: 'queijo', name: 'Queijo integral', per100g: { kcal: 300, protein: 20, carb: 2, fat: 25, calcium: 700 }, lactoseLevel: 'high', goodFor: ['calcium'] },
  { id: 'brocolis', name: 'Brócolis', per100g: { kcal: 34, protein: 2.8, carb: 7, fat: 0.4, vitaminC: 89 }, lactoseLevel: 'none', goodFor: ['vitaminC'] },
  { id: 'sem-lacuna', name: 'Alimento neutro', per100g: { kcal: 100, protein: 5, carb: 10, fat: 2 }, lactoseLevel: 'none' }, // não cobre nenhuma lacuna
];

describe('suggestMeals', () => {
  it('só sugere alimentos que cobrem alguma lacuna pedida', () => {
    const options = suggestMeals({ remainingKcal: 1000, gaps: ['protein'] }, base);
    const usedIds = options.flatMap((o) => o.foods.map((f) => f.id));
    expect(usedIds).not.toContain('sem-lacuna');
  });

  it('respeita o teto de lactose (maxLactose)', () => {
    const options = suggestMeals({ remainingKcal: 1000, gaps: ['calcium'], maxLactose: 'none' }, base);
    const usedIds = options.flatMap((o) => o.foods.map((f) => f.id));
    expect(usedIds).not.toContain('queijo'); // é 'high', acima do teto 'none'
  });

  it('permite queijo quando o teto de lactose é alto o bastante', () => {
    const options = suggestMeals({ remainingKcal: 1000, gaps: ['calcium'], maxLactose: 'high' }, base);
    const usedIds = options.flatMap((o) => o.foods.map((f) => f.id));
    expect(usedIds).toContain('queijo');
  });

  it('respeita o orçamento calórico restante', () => {
    const options = suggestMeals({ remainingKcal: 50, gaps: ['protein'] }, base, 3); // porção de 120g de frango = ~198kcal, não cabe
    for (const o of options) expect(o.kcal).toBeLessThanOrEqual(50);
  });

  it('não sugere nada se não houver alimento que caiba no orçamento', () => {
    const options = suggestMeals({ remainingKcal: 5, gaps: ['protein'] }, base);
    expect(options.length).toBe(0);
  });

  it('cada opção sugerida cobre ao menos 1 lacuna pedida', () => {
    const options = suggestMeals({ remainingKcal: 1000, gaps: ['protein', 'vitaminC'] }, base);
    for (const o of options) expect(o.covers.length).toBeGreaterThan(0);
  });
});
