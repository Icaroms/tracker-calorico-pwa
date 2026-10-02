import { describe, it, expect } from 'vitest';
import { recipeTotalGrams, recipeNutrients, recipePer100g, recipeLactoseLevel, expandRecipe, type Recipe } from './recipes';
import type { FoodItem } from './referenceData';

const frango: FoodItem = { id: 'frango', name: 'Frango', per100g: { kcal: 165, protein: 31, carb: 0, fat: 3.6 }, lactoseLevel: 'none' };
const queijo: FoodItem = { id: 'queijo', name: 'Queijo', per100g: { kcal: 300, protein: 20, carb: 2, fat: 25 }, lactoseLevel: 'high' };
const resolve = (id: string) => ({ frango, queijo }[id]);

const receita: Recipe = { id: 'recipe:x', name: 'Frango com queijo', ingredients: [{ foodId: 'frango', grams: 150 }, { foodId: 'queijo', grams: 50 }] };

describe('recipeTotalGrams', () => {
  it('soma os ingredientes quando não há yieldGrams', () => {
    expect(recipeTotalGrams(receita)).toBe(200);
  });
  it('usa yieldGrams quando informado (perda de água no cozimento, etc.)', () => {
    expect(recipeTotalGrams({ ...receita, yieldGrams: 180 })).toBe(180);
  });
});

describe('recipeNutrients', () => {
  it('soma os nutrientes escalados de cada ingrediente', () => {
    const n = recipeNutrients(receita, resolve);
    // frango 150g: kcal=247.5; queijo 50g: kcal=150 → total 397.5
    expect(n.kcal).toBeCloseTo(397.5, 1);
  });
  it('ingrediente não resolvido é pulado sem quebrar', () => {
    const r2: Recipe = { id: 'x', name: 'x', ingredients: [{ foodId: 'fantasma', grams: 100 }] };
    expect(() => recipeNutrients(r2, resolve)).not.toThrow();
    expect(recipeNutrients(r2, resolve).kcal).toBeUndefined();
  });
});

describe('recipePer100g', () => {
  it('normaliza pra 100g do prato pronto', () => {
    const per100 = recipePer100g(receita, resolve);
    const total = recipeNutrients(receita, resolve);
    expect(per100.kcal).toBeCloseTo((total.kcal! * 100) / 200, 1);
  });
  it('retorna objeto vazio se o rendimento for 0 (evita divisão por zero)', () => {
    const per100 = recipePer100g({ ...receita, yieldGrams: 0 }, resolve);
    expect(per100).toEqual({});
  });
});

describe('recipeLactoseLevel', () => {
  it('usa o PIOR caso entre os ingredientes (intolerância não corre risco)', () => {
    expect(recipeLactoseLevel(receita, resolve)).toBe('high'); // queijo puxa pra cima
  });
  it('receita só com ingredientes sem lactose fica "none"', () => {
    const r2: Recipe = { id: 'x', name: 'x', ingredients: [{ foodId: 'frango', grams: 100 }] };
    expect(recipeLactoseLevel(r2, resolve)).toBe('none');
  });
});

describe('expandRecipe', () => {
  it('escala os ingredientes proporcionalmente à porção pedida', () => {
    const parts = expandRecipe(receita, 100); // metade da receita (200g total)
    expect(parts.find((p) => p.foodId === 'frango')!.grams).toBeCloseTo(75, 1);
    expect(parts.find((p) => p.foodId === 'queijo')!.grams).toBeCloseTo(25, 1);
  });
  it('retorna array vazio se o total da receita for 0', () => {
    expect(expandRecipe({ ...receita, yieldGrams: 0 }, 100)).toEqual([]);
  });
});
