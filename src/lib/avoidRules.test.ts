import { describe, it, expect } from 'vitest';
import { avoidByLimit, timingCautions } from './avoidRules';
import type { NutrientProgress } from './dailyTotals';

const maxProgress = (key: 'saturatedFat' | 'sodium', percent: number, status: 'met' | 'over'): NutrientProgress => ({
  key, consumed: 0, target: 100, unit: 'g', remaining: 0, percent, direction: 'max', status, hasData: true,
});

describe('avoidByLimit', () => {
  it('não dispara abaixo de 70% do limite', () => {
    const tips = avoidByLimit([maxProgress('saturatedFat', 50, 'met')], 1000, 2000);
    expect(tips.find((t) => t.key === 'saturatedFat')).toBeUndefined();
  });
  it('dispara "warn" entre 70% e o limite (perto, mas não estourou)', () => {
    const tips = avoidByLimit([maxProgress('sodium', 85, 'met')], 1000, 2000);
    const t = tips.find((x) => x.key === 'sodium')!;
    expect(t.level).toBe('warn');
    expect(t.message).toMatch(/perto do limite/i);
  });
  it('dispara "alert" quando já estourou (status=over)', () => {
    const tips = avoidByLimit([maxProgress('saturatedFat', 170, 'over')], 1000, 2000);
    const t = tips.find((x) => x.key === 'saturatedFat')!;
    expect(t.level).toBe('alert');
    expect(t.message).toMatch(/já passou/i);
  });
  it('ignora nutrientes sem dado hoje (hasData=false) — não avisa sobre lacuna', () => {
    const noData: NutrientProgress = { ...maxProgress('sodium', 90, 'met'), hasData: false };
    const tips = avoidByLimit([noData], 1000, 2000);
    expect(tips.find((t) => t.key === 'sodium')).toBeUndefined();
  });
  it('avisa sobre "caloria vazia" quando resta <15% das calorias do dia', () => {
    const tips = avoidByLimit([], 1900, 2000); // resta 100 = 5%
    expect(tips.some((t) => /refrigerante/i.test(t.message))).toBe(true);
  });
  it('não avisa sobre caloria vazia com folga de calorias', () => {
    const tips = avoidByLimit([], 1000, 2000); // resta 50%
    expect(tips.some((t) => /refrigerante/i.test(t.message))).toBe(false);
  });
  it('inclui categorias concretas de alimento, não só o nome do nutriente', () => {
    const tips = avoidByLimit([maxProgress('sodium', 90, 'met')], 1000, 2000);
    expect(tips[0].message).toMatch(/embutidos|salgadinhos/i);
  });
});

describe('timingCautions', () => {
  it('café depois das 18h dispara aviso de cafeína', () => {
    const cautions = timingCautions([{ name: 'Café, infusão 10%', hour: 21 }]);
    expect(cautions.some((c) => /cafeína/i.test(c.message))).toBe(true);
  });
  it('café de manhã NÃO dispara aviso de cafeína', () => {
    const cautions = timingCautions([{ name: 'Café, infusão 10%', hour: 8 }]);
    expect(cautions.some((c) => /cafeína/i.test(c.message))).toBe(false);
  });
  it('chá de erva-doce (sem cafeína) não dispara, mesmo à noite — evita falso positivo', () => {
    const cautions = timingCautions([{ name: 'Chá, erva-doce, infusão 5%', hour: 21 }]);
    expect(cautions.some((c) => /cafeína/i.test(c.message))).toBe(false);
  });
  it('chá mate à noite dispara (tem cafeína de verdade)', () => {
    const cautions = timingCautions([{ name: 'Chá, mate, infusão 5%', hour: 20 }]);
    expect(cautions.some((c) => /cafeína/i.test(c.message))).toBe(true);
  });
  it('refrigerante antes das 10h dispara aviso de açúcar em jejum', () => {
    const cautions = timingCautions([{ name: 'Refrigerante, tipo cola', hour: 7 }]);
    expect(cautions.some((c) => /açúcar/i.test(c.message))).toBe(true);
  });
  it('refrigerante à tarde não dispara o aviso de manhã', () => {
    const cautions = timingCautions([{ name: 'Refrigerante, tipo cola', hour: 15 }]);
    expect(cautions.some((c) => /açúcar/i.test(c.message))).toBe(false);
  });
  it('não duplica a mesma mensagem pra múltiplas entradas parecidas', () => {
    const cautions = timingCautions([
      { name: 'Café, infusão 10%', hour: 20 },
      { name: 'Café, pó, torrado', hour: 21 },
    ]);
    const cafeinaMsgs = cautions.filter((c) => /cafeína/i.test(c.message));
    expect(cafeinaMsgs.length).toBe(1);
  });
  it('dia sem nada problemático não gera nenhum aviso', () => {
    const cautions = timingCautions([{ name: 'Banana prata', hour: 15 }]);
    expect(cautions.length).toBe(0);
  });
});
