import { describe, it, expect } from 'vitest';
import { sumEntries, progressVsGoals, nutrientGaps, type GoalDef } from './dailyTotals';
import type { FoodItem } from './referenceData';
import type { FoodEntry } from './db';

const arroz: FoodItem = {
  id: 'arroz', name: 'Arroz teste',
  per100g: { kcal: 130, protein: 2.7, carb: 28, fat: 0.3 }, // sem vitaminB12 — simula gap real da TACO
  lactoseLevel: 'none',
};
const sardinha: FoodItem = {
  id: 'sardinha', name: 'Sardinha teste',
  per100g: { kcal: 200, protein: 25, carb: 0, fat: 12, vitaminB12: 8.9 },
  lactoseLevel: 'none',
};
const resolve = (id: string) => ({ arroz, sardinha }[id]);
const entry = (foodId: string, grams: number): FoodEntry =>
  ({ id: 1, day: '2026-01-01', meal: 'almoco', foodId, grams, createdAt: new Date().toISOString() });

describe('sumEntries', () => {
  it('soma nutrientes escalados por grama', () => {
    const { totals } = sumEntries([entry('arroz', 200)], resolve);
    expect(totals.kcal).toBeCloseTo(260, 1); // 130 * 2
    expect(totals.protein).toBeCloseTo(5.4, 1);
  });
  it('soma múltiplas entradas do mesmo dia', () => {
    const { totals } = sumEntries([entry('arroz', 100), entry('sardinha', 100)], resolve);
    expect(totals.kcal).toBeCloseTo(330, 1);
  });
  it('pula entrada cujo alimento não resolve (id inexistente)', () => {
    const { totals, resolvedCount } = sumEntries([entry('inexistente', 100)], resolve);
    expect(resolvedCount).toBe(0);
    expect(totals.kcal).toBeUndefined();
  });
  it('coveredKeys só inclui nutrientes medidos por ao menos 1 alimento', () => {
    const { coveredKeys } = sumEntries([entry('arroz', 100)], resolve);
    expect(coveredKeys.has('kcal')).toBe(true);
    expect(coveredKeys.has('vitaminB12')).toBe(false); // arroz não mede B12
  });
  it('coveredKeys inclui nutriente mesmo quando o alimento não tem esse campo mas outro do dia tem', () => {
    const { coveredKeys } = sumEntries([entry('arroz', 100), entry('sardinha', 100)], resolve);
    expect(coveredKeys.has('vitaminB12')).toBe(true); // sardinha cobre
  });
});

describe('progressVsGoals — hasData (correção do "0% enganoso")', () => {
  const goals: Partial<Record<'vitaminB12' | 'protein', GoalDef>> = {
    vitaminB12: { target: 2.4, unit: 'mcg', direction: 'min' },
    protein: { target: 100, unit: 'g', direction: 'min' },
  };

  it('dia vazio (sem entradas): hasData=true — 0% é real, não é lacuna', () => {
    const empty = sumEntries([], resolve);
    const progress = progressVsGoals(empty.totals, goals as any, empty);
    for (const p of progress) expect(p.hasData).toBe(true);
  });

  it('comeu algo, mas nutriente não medido por nada do dia: hasData=false', () => {
    const s = sumEntries([entry('arroz', 200)], resolve); // arroz não tem B12
    const progress = progressVsGoals(s.totals, goals as any, s);
    const b12 = progress.find((p) => p.key === 'vitaminB12')!;
    const protein = progress.find((p) => p.key === 'protein')!;
    expect(b12.hasData).toBe(false);
    expect(protein.hasData).toBe(true); // arroz tem proteína real
  });

  it('comeu algo que mede o nutriente: hasData=true com percentual real', () => {
    const s = sumEntries([entry('sardinha', 100)], resolve); // sardinha tem B12
    const progress = progressVsGoals(s.totals, goals as any, s);
    const b12 = progress.find((p) => p.key === 'vitaminB12')!;
    expect(b12.hasData).toBe(true);
    expect(b12.percent).toBeCloseTo(Math.round((8.9 / 2.4) * 100), 0);
  });

  it('sem coverage informado (retrocompatibilidade): hasData sempre true', () => {
    const progress = progressVsGoals({ protein: 50 }, goals as any);
    expect(progress.every((p) => p.hasData)).toBe(true);
  });

  it('direction max: status "over" quando ultrapassa, "met" caso contrário', () => {
    const maxGoals = { saturatedFat: { target: 20, unit: 'g', direction: 'max' as const } };
    const under = progressVsGoals({ saturatedFat: 15 }, maxGoals);
    const over = progressVsGoals({ saturatedFat: 25 }, maxGoals);
    expect(under[0].status).toBe('met');
    expect(over[0].status).toBe('over');
  });
});

describe('nutrientGaps', () => {
  it('exclui nutrientes sem dado das lacunas (não sugere "consertar" o que não foi medido)', () => {
    const s = sumEntries([entry('arroz', 200)], resolve);
    const goals = { vitaminB12: { target: 2.4, unit: 'mcg', direction: 'min' as const }, protein: { target: 100, unit: 'g', direction: 'min' as const } };
    const progress = progressVsGoals(s.totals, goals, s);
    const gaps = nutrientGaps(progress);
    expect(gaps).not.toContain('vitaminB12'); // sem dado, não é lacuna "de verdade"
    expect(gaps).toContain('protein'); // dado real, abaixo da meta
  });
});
