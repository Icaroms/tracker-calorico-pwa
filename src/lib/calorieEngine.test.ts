import { describe, it, expect } from 'vitest';
import {
  bmrMifflin, bmrKatchMcArdle, leanBodyMass, estimateBMR, tdee, calorieTarget,
  macroTargets, waterTargetMl, waistHipRatio, needsRecalculation, buildPlan,
  validateProfile, MIN_CALORIES, type BodyProfile,
} from './calorieEngine';

const male: BodyProfile = { weightKg: 80, heightCm: 175, age: 25, sex: 'male' };
const female: BodyProfile = { weightKg: 65, heightCm: 165, age: 30, sex: 'female' };

describe('bmrMifflin', () => {
  it('homem: base + 5', () => {
    // 10*80 + 6.25*175 - 5*25 + 5 = 800 + 1093.75 - 125 + 5 = 1773.75
    expect(bmrMifflin(male)).toBeCloseTo(1773.75, 1);
  });
  it('mulher: base - 161', () => {
    // 10*65 + 6.25*165 - 5*30 - 161 = 650 + 1031.25 - 150 - 161 = 1370.25
    expect(bmrMifflin(female)).toBeCloseTo(1370.25, 1);
  });
});

describe('bmrKatchMcArdle', () => {
  it('370 + 21.6 × massa magra', () => {
    expect(bmrKatchMcArdle(60)).toBeCloseTo(370 + 21.6 * 60, 1);
  });
});

describe('leanBodyMass', () => {
  it('peso × (1 − %gordura/100)', () => {
    expect(leanBodyMass(80, 20)).toBeCloseTo(64, 5);
  });
});

describe('estimateBMR', () => {
  it('sem % de gordura → Mifflin-St Jeor', () => {
    const r = estimateBMR(male);
    expect(r.method).toBe('mifflin-st-jeor');
    expect(r.leanMassKg).toBeUndefined();
  });
  it('com % de gordura → Katch-McArdle', () => {
    const r = estimateBMR({ ...male, bodyFatPercent: 15 });
    expect(r.method).toBe('katch-mcardle');
    expect(r.leanMassKg).toBeCloseTo(68, 1);
  });
  it('bodyFatPercent = 0 não conta como "informado" (evita massa magra = peso total)', () => {
    const r = estimateBMR({ ...male, bodyFatPercent: 0 });
    expect(r.method).toBe('mifflin-st-jeor');
  });
});

describe('tdee', () => {
  it('multiplica BMR pelo fator de atividade', () => {
    expect(tdee(1700, 'sedentary')).toBeCloseTo(1700 * 1.2, 1);
    expect(tdee(1700, 'veryActive')).toBeCloseTo(1700 * 1.9, 1);
  });
  it('activityLevel inválido lança erro', () => {
    // @ts-expect-error testando entrada inválida de propósito
    expect(() => tdee(1700, 'invalido')).toThrow();
  });
});

describe('calorieTarget — piso de segurança', () => {
  it('déficit normal não bate no piso', () => {
    const r = calorieTarget(2500, 500, 'male');
    expect(r.target).toBe(2000);
    expect(r.clampedToFloor).toBe(false);
    expect(r.effectiveDeficit).toBe(500);
  });
  it('déficit agressivo é limitado ao piso masculino (1500)', () => {
    const r = calorieTarget(1800, 800, 'male'); // 1800-800=1000, abaixo de 1500
    expect(r.target).toBe(MIN_CALORIES.male);
    expect(r.clampedToFloor).toBe(true);
    expect(r.effectiveDeficit).toBe(1800 - MIN_CALORIES.male);
  });
  it('piso feminino é 1200, diferente do masculino', () => {
    const r = calorieTarget(1400, 500, 'female'); // 1400-500=900, abaixo de 1200
    expect(r.target).toBe(MIN_CALORIES.female);
    expect(r.clampedToFloor).toBe(true);
  });
});

describe('macroTargets', () => {
  it('proteína prioritária, gordura por %, carbo preenche o resto', () => {
    const m = macroTargets(2000, 80, 1.6, 0.27);
    expect(m.protein).toBe(Math.round(1.6 * 80)); // 128g
    expect(m.fat).toBe(Math.round((2000 * 0.27) / 9)); // 60g
    // carbo = resto das calorias após proteína+gordura, em gramas
    const proteinKcal = m.protein * 4, fatKcal = m.fat * 9;
    expect(m.carb).toBeCloseTo((2000 - proteinKcal - fatKcal) / 4, 0);
  });
  it('nunca gera carboidrato negativo mesmo com proteína+gordura excedendo a meta', () => {
    const m = macroTargets(1000, 150, 3.0, 0.5); // proteína+gordura sozinhas já passam de 1000kcal
    expect(m.carb).toBeGreaterThanOrEqual(0);
  });
});

describe('waterTargetMl', () => {
  it('35ml por kg por padrão', () => {
    expect(waterTargetMl(80)).toBe(2800);
  });
});

describe('waistHipRatio', () => {
  it('classifica risco alto pra homem ≥0.9', () => {
    expect(waistHipRatio(95, 100, 'male').risk).toBe('high');
  });
  it('classifica risco baixo pra mulher <0.8', () => {
    expect(waistHipRatio(70, 100, 'female').risk).toBe('low');
  });
  it('hipCm inválido lança erro', () => {
    expect(() => waistHipRatio(80, 0, 'male')).toThrow();
  });
});

describe('needsRecalculation', () => {
  it('recomenda por variação de peso ≥3kg', () => {
    const r = needsRecalculation({ lastCalcWeightKg: 80, currentWeightKg: 83.5, lastCalcDate: new Date() });
    expect(r.recommended).toBe(true);
    expect(r.reasons).toContain('weight');
  });
  it('recomenda por tempo ≥28 dias', () => {
    const past = new Date(Date.now() - 30 * 86_400_000);
    const r = needsRecalculation({ lastCalcWeightKg: 80, currentWeightKg: 80, lastCalcDate: past });
    expect(r.recommended).toBe(true);
    expect(r.reasons).toContain('time');
  });
  it('não recomenda se nada mudou', () => {
    const r = needsRecalculation({ lastCalcWeightKg: 80, currentWeightKg: 80.5, lastCalcDate: new Date() });
    expect(r.recommended).toBe(false);
  });
});

describe('validateProfile', () => {
  it('rejeita peso ≤0', () => expect(() => validateProfile({ ...male, weightKg: 0 })).toThrow());
  it('rejeita idade fora do intervalo', () => expect(() => validateProfile({ ...male, age: 150 })).toThrow());
  it('rejeita % de gordura fora de 0–75', () => expect(() => validateProfile({ ...male, bodyFatPercent: 90 })).toThrow());
  it('aceita perfil válido sem lançar', () => expect(() => validateProfile(male)).not.toThrow());
});

describe('buildPlan — orquestrador completo', () => {
  it('monta plano coerente ponta a ponta', () => {
    const plan = buildPlan(male, { activityLevel: 'moderate', deficit: 500, proteinPerKg: 1.6 });
    expect(plan.bmr).toBeGreaterThan(0);
    expect(plan.tdee).toBeGreaterThan(plan.bmr); // fator de atividade sempre >1
    expect(plan.calories.target).toBeLessThan(plan.tdee); // déficit aplicado
    expect(plan.calories.target).toBeGreaterThanOrEqual(MIN_CALORIES.male); // nunca abaixo do piso
    expect(plan.macros.protein).toBeGreaterThan(0);
    expect(plan.waterMl).toBe(2800);
    expect(plan.cardio).toBeUndefined(); // sem cintura/quadril informados
  });
  it('inclui cardio quando cintura/quadril são informados', () => {
    const plan = buildPlan({ ...male, waistCm: 90, hipCm: 100 }, { activityLevel: 'sedentary', deficit: 300 });
    expect(plan.cardio).toBeDefined();
    expect(plan.cardio!.risk).toBeDefined();
  });
});
