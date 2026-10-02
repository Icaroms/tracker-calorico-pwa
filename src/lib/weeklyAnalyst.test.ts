import { describe, it, expect } from 'vitest';
import { analyzeWeek, sanitizeWeekForLLM, type DayAgg } from './weeklyAnalyst';
import type { GoalDef, NutrientKey } from './dailyTotals';

const goals: Partial<Record<NutrientKey, GoalDef>> = {
  protein: { target: 100, unit: 'g', direction: 'min' },
  calcium: { target: 1000, unit: 'mg', direction: 'min' },
  sodium: { target: 2000, unit: 'mg', direction: 'max' },
};

function day(overrides: Partial<DayAgg> & { day: string }): DayAgg {
  return {
    totals: {}, coveredKeys: new Set(), hasEntries: true, kcalTarget: 2000, exerciseKcal: 0,
    ...overrides,
  };
}

describe('analyzeWeek — dia sem registro nenhum', () => {
  it('7 dias vazios: headline avisa, sem crash', () => {
    const days = Array.from({ length: 7 }, (_, i) => day({ day: `2026-01-0${i + 1}`, hasEntries: false }));
    const r = analyzeWeek(days, goals);
    expect(r.daysLogged).toBe(0);
    expect(r.headline).toMatch(/sem registro/i);
  });
});

describe('analyzeWeek — médias e aderência calórica', () => {
  const days = [
    day({ day: '2026-01-01', totals: { kcal: 1900 }, kcalTarget: 2000 }),
    day({ day: '2026-01-02', totals: { kcal: 2000 }, kcalTarget: 2000 }),
    day({ day: '2026-01-03', totals: { kcal: 2100 }, kcalTarget: 2000 }),
  ];

  it('calcula a média correta só dos dias registrados', () => {
    const r = analyzeWeek(days, goals);
    expect(r.avgKcal).toBe(2000);
    expect(r.daysLogged).toBe(3);
  });

  it('reconhece aderência calórica dentro de 90-110%', () => {
    const r = analyzeWeek(days, goals);
    expect(r.insights.some((i) => i.level === 'good' && /bem alinhada/i.test(i.message))).toBe(true);
  });

  it('dia sem registro não entra na média (não conta como 0 kcal)', () => {
    const withGap = [...days, day({ day: '2026-01-04', hasEntries: false })];
    const r = analyzeWeek(withGap, goals);
    expect(r.avgKcal).toBe(2000); // não caiu por causa do dia vazio
    expect(r.daysLogged).toBe(3);
    expect(r.daysTotal).toBe(4);
    expect(r.insights.some((i) => /3 de 4 dias/.test(i.message))).toBe(true);
  });
});

describe('analyzeWeek — nutriente consistentemente baixo', () => {
  it('exige pelo menos 3 dias com dado pra considerar "consistente"', () => {
    const days = [
      day({ day: '2026-01-01', totals: { protein: 30 }, coveredKeys: new Set(['protein']) }),
      day({ day: '2026-01-02', totals: { protein: 30 }, coveredKeys: new Set(['protein']) }),
    ];
    const r = analyzeWeek(days, goals);
    const proteinSummary = r.nutrientSummaries.find((n) => n.key === 'protein')!;
    expect(proteinSummary.status).toBe('insufficient'); // só 2 dias, não é confiável ainda
  });

  it('com dado suficiente, calcula a média e marca "low" corretamente', () => {
    const days = Array.from({ length: 4 }, (_, i) =>
      day({ day: `2026-01-0${i + 1}`, totals: { protein: 40 }, coveredKeys: new Set(['protein']) }));
    const r = analyzeWeek(days, goals);
    const proteinSummary = r.nutrientSummaries.find((n) => n.key === 'protein')!;
    expect(proteinSummary.avgPercent).toBe(40); // 40/100
    expect(proteinSummary.status).toBe('low');
    expect(r.headline).toMatch(/proteína/i);
    expect(r.insights.some((i) => i.key === 'protein' && i.level === 'alert')).toBe(true);
  });

  it('dia sem dado do nutriente específico não conta na média dele (mesmo com outros nutrientes no dia)', () => {
    const days = [
      day({ day: '2026-01-01', totals: { protein: 100 }, coveredKeys: new Set(['protein']) }),
      day({ day: '2026-01-02', totals: { protein: 100 }, coveredKeys: new Set(['protein']) }),
      day({ day: '2026-01-03', totals: { protein: 100 }, coveredKeys: new Set(['protein']) }),
      day({ day: '2026-01-04', totals: { kcal: 500 }, coveredKeys: new Set() }), // comeu algo, mas nada com proteína medida
    ];
    const r = analyzeWeek(days, goals);
    const proteinSummary = r.nutrientSummaries.find((n) => n.key === 'protein')!;
    expect(proteinSummary.daysWithData).toBe(3); // não conta o dia 4
    expect(proteinSummary.avgPercent).toBe(100);
  });
});

describe('analyzeWeek — limite (direction max)', () => {
  it('marca "high" quando a média passa do teto', () => {
    const days = Array.from({ length: 4 }, (_, i) =>
      day({ day: `2026-01-0${i + 1}`, totals: { sodium: 2500 }, coveredKeys: new Set(['sodium']) }));
    const r = analyzeWeek(days, goals);
    const sodiumSummary = r.nutrientSummaries.find((n) => n.key === 'sodium')!;
    expect(sodiumSummary.status).toBe('high');
    expect(r.insights.some((i) => i.key === 'sodium' && i.level === 'alert')).toBe(true);
  });
});

describe('analyzeWeek — exercício e peso', () => {
  it('conta sessões e soma kcal de exercício', () => {
    const days = [
      day({ day: '2026-01-01', exerciseKcal: 300 }),
      day({ day: '2026-01-02', exerciseKcal: 0 }),
      day({ day: '2026-01-03', exerciseKcal: 250 }),
    ];
    const r = analyzeWeek(days, goals);
    expect(r.totalExerciseSessions).toBe(2);
    expect(r.totalExerciseKcal).toBe(550);
    expect(r.insights.some((i) => /2 dia\(s\) com exerc/i.test(i.message))).toBe(true);
  });

  it('calcula variação de peso do primeiro ao último registro da semana', () => {
    const days = [day({ day: '2026-01-01' })];
    const weightLogs = [{ day: '2026-01-01', weightKg: 80 }, { day: '2026-01-05', weightKg: 78.5 }];
    const r = analyzeWeek(days, goals, weightLogs);
    expect(r.weightChangeKg).toBe(-1.5);
    expect(r.insights.some((i) => /perdeu 1.5 kg/i.test(i.message))).toBe(true);
  });

  it('sem pelo menos 2 registros de peso, não calcula variação', () => {
    const days = [day({ day: '2026-01-01' })];
    const r = analyzeWeek(days, goals, [{ day: '2026-01-01', weightKg: 80 }]);
    expect(r.weightChangeKg).toBeUndefined();
  });
});

describe('sanitizeWeekForLLM', () => {
  it('exclui nutrientes com dado insuficiente do payload pra IA', () => {
    const days = [
      day({ day: '2026-01-01', totals: { protein: 100 }, coveredKeys: new Set(['protein']) }),
    ];
    const r = analyzeWeek(days, goals);
    const payload = sanitizeWeekForLLM(r);
    expect(payload.nutrients.some((n) => n.key === 'protein')).toBe(false); // só 1 dia, insuficiente
  });

  it('inclui nutrientes com dado suficiente', () => {
    const days = Array.from({ length: 4 }, (_, i) =>
      day({ day: `2026-01-0${i + 1}`, totals: { protein: 100 }, coveredKeys: new Set(['protein']) }));
    const r = analyzeWeek(days, goals);
    const payload = sanitizeWeekForLLM(r);
    expect(payload.nutrients.some((n) => n.key === 'protein')).toBe(true);
  });
});
