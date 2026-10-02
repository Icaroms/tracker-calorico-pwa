import { describe, it, expect } from 'vitest';
import { analyzeDaily, sanitizeForLLM, assertSanitized, type AnalysisInput } from './nutritionAnalyst';
import type { NutrientProgress } from './dailyTotals';

const progress = (over: Partial<NutrientProgress>): NutrientProgress => ({
  key: 'protein', consumed: 50, target: 100, unit: 'g', remaining: 50, percent: 50,
  direction: 'min', status: 'under', hasData: true, ...over,
});

describe('analyzeDaily', () => {
  it('alerta quando passou da meta calórica', () => {
    const input: AnalysisInput = { progress: [], kcalConsumed: 2200, kcalTarget: 2000 };
    const r = analyzeDaily(input);
    expect(r.insights.some((i) => i.level === 'alert' && /passou/.test(i.message))).toBe(true);
  });

  it('reconhece saldo calórico bem ajustado', () => {
    const input: AnalysisInput = { progress: [], kcalConsumed: 1950, kcalTarget: 2000 };
    const r = analyzeDaily(input);
    expect(r.insights.some((i) => i.level === 'good')).toBe(true);
  });

  it('lista lacunas priorizando as mais atrasadas primeiro', () => {
    const input: AnalysisInput = {
      progress: [
        progress({ key: 'protein', percent: 80, status: 'under' }),
        progress({ key: 'calcium', percent: 20, status: 'under' }),
      ],
      kcalConsumed: 1000, kcalTarget: 2000,
    };
    const r = analyzeDaily(input);
    expect(r.headline).toMatch(/cálcio/i); // a pior lacuna vira manchete
  });

  it('NÃO gera insight de lacuna pra nutriente sem dado hoje (hasData=false)', () => {
    const input: AnalysisInput = {
      progress: [progress({ key: 'vitaminB12', percent: 0, status: 'under', hasData: false })],
      kcalConsumed: 1000, kcalTarget: 2000,
    };
    const r = analyzeDaily(input);
    expect(r.insights.some((i) => i.key === 'vitaminB12')).toBe(false);
  });

  it('reforça positivamente nutrientes já no alvo', () => {
    const input: AnalysisInput = {
      progress: [progress({ key: 'iron', percent: 100, status: 'met' })],
      kcalConsumed: 1000, kcalTarget: 2000,
    };
    const r = analyzeDaily(input);
    expect(r.insights.some((i) => i.level === 'good' && /ferro|1 nutriente/i.test(i.message))).toBe(true);
  });

  it('inclui aviso de jejum quando não é "ok" — mas isso é só local, não vai pro LLM', () => {
    const input: AnalysisInput = { progress: [], kcalConsumed: 1000, kcalTarget: 2000, fastingAdvice: 'evitar' };
    const r = analyzeDaily(input);
    expect(r.insights.some((i) => /jejum/i.test(i.message))).toBe(true);
  });
});

describe('sanitizeForLLM', () => {
  it('exclui nutrientes sem dado hoje do payload pra IA', () => {
    const input: AnalysisInput = {
      progress: [
        progress({ key: 'protein', hasData: true }),
        progress({ key: 'vitaminB12', hasData: false }),
      ],
      kcalConsumed: 1000, kcalTarget: 2000,
    };
    const payload = sanitizeForLLM(input);
    expect(payload.nutrients.some((n) => n.key === 'vitaminB12')).toBe(false);
    expect(payload.nutrients.some((n) => n.key === 'protein')).toBe(true);
  });

  it('só contém números — sem nome, data ou condição de saúde', () => {
    const input: AnalysisInput = { progress: [progress({})], kcalConsumed: 1000, kcalTarget: 2000, fastingAdvice: 'evitar' };
    const payload = sanitizeForLLM(input);
    const json = JSON.stringify(payload);
    expect(json).not.toMatch(/jejum|evitar/i); // fastingAdvice NUNCA vaza pro payload
  });
});

describe('assertSanitized', () => {
  it('aceita payload válido sem lançar', () => {
    const payload = { kcal: { consumed: 1000, target: 2000 }, nutrients: [{ key: 'protein', consumed: 50, target: 100, pct: 50, direction: 'min' as const }] };
    expect(() => assertSanitized(payload)).not.toThrow();
  });
  it('rejeita chave de nutriente desconhecida (defesa contra payload malformado)', () => {
    const payload = { kcal: { consumed: 1000, target: 2000 }, nutrients: [{ key: 'nao-existe', consumed: 1, target: 1, pct: 1, direction: 'min' as const }] };
    expect(() => assertSanitized(payload)).toThrow();
  });
  it('rejeita kcal não numérico', () => {
    const payload = { kcal: { consumed: NaN, target: 2000 }, nutrients: [] };
    expect(() => assertSanitized(payload)).toThrow();
  });
  it('rejeita direction inválida', () => {
    const payload = { kcal: { consumed: 1000, target: 2000 }, nutrients: [{ key: 'protein', consumed: 1, target: 1, pct: 1, direction: 'lateral' as any }] };
    expect(() => assertSanitized(payload)).toThrow();
  });
});
