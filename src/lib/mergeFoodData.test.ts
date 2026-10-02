import { describe, it, expect } from 'vitest';
import { mergeFood, coverage, flattenForApp, GAP_NUTRIENTS, type MergeInput } from './mergeFoodData';

describe('mergeFood — prioridade de fonte', () => {
  it('nutriente comum: TACO vence sobre USDA', () => {
    const input: MergeInput = { id: 'x', name: 'X', taco: { kcal: 100 }, usda: { kcal: 999 } };
    const r = mergeFood(input);
    expect(r.per100g.kcal).toEqual({ value: 100, source: 'taco' });
  });

  it('nutriente "gap" (ex.: vitaminD): USDA vence sobre TACO', () => {
    const input: MergeInput = { id: 'x', name: 'X', taco: { vitaminD: 999 }, usda: { vitaminD: 5 } };
    const r = mergeFood(input);
    expect(r.per100g.vitaminD).toEqual({ value: 5, source: 'usda' });
    expect(GAP_NUTRIENTS).toContain('vitaminD');
  });

  it('manual sempre vence, mesmo com TACO/USDA presentes', () => {
    const input: MergeInput = { id: 'x', name: 'X', taco: { kcal: 100 }, usda: { kcal: 200 }, manual: { kcal: 50 } };
    const r = mergeFood(input);
    expect(r.per100g.kcal).toEqual({ value: 50, source: 'manual' });
  });

  it('deduced só entra quando nenhuma outra fonte tem o dado', () => {
    const input: MergeInput = { id: 'x', name: 'X', deduced: { vitaminB7: 3 } };
    const r = mergeFood(input);
    expect(r.per100g.vitaminB7).toEqual({ value: 3, source: 'deduced' });
  });

  it('nutriente ausente em TODAS as fontes fica undefined (não zerado, não inventado)', () => {
    const input: MergeInput = { id: 'x', name: 'X', taco: { kcal: 100 } };
    const r = mergeFood(input);
    expect(r.per100g.selenium).toBeUndefined();
    expect('selenium' in r.per100g).toBe(false);
  });
});

describe('coverage', () => {
  it('separa nutrientes cobertos dos ausentes corretamente', () => {
    const r = mergeFood({ id: 'x', name: 'X', taco: { kcal: 100, protein: 10 } });
    const cov = coverage(r);
    expect(cov.covered).toContain('kcal');
    expect(cov.covered).toContain('protein');
    expect(cov.missing).toContain('vitaminD');
    expect(cov.covered.length + cov.missing.length).toBe(24); // total de NutrientKey (com sódio)
  });

  it('bySource conta corretamente por fonte', () => {
    const r = mergeFood({ id: 'x', name: 'X', taco: { kcal: 100 }, manual: { protein: 5 } });
    const cov = coverage(r);
    expect(cov.bySource.taco).toBe(1);
    expect(cov.bySource.manual).toBe(1);
    expect(cov.bySource.usda).toBe(0);
  });
});

describe('flattenForApp', () => {
  it('remove a fonte, deixa só o valor numérico', () => {
    const r = mergeFood({ id: 'x', name: 'X', taco: { kcal: 100 } });
    const flat = flattenForApp(r);
    expect(flat.per100g.kcal).toBe(100);
    expect(flat.id).toBe('x');
  });
});
