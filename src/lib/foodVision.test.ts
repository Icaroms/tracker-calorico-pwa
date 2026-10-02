import { describe, it, expect } from 'vitest';
import { parseVisionResponse } from './foodVision';

describe('parseVisionResponse', () => {
  it('parseia um JSON válido completo', () => {
    const r = parseVisionResponse(JSON.stringify({
      foodName: 'arroz branco cozido', estimatedAmount: 150, unit: 'g',
      confidence: 'media', notes: 'porção média de prato', notFood: false,
    }));
    expect(r.foodName).toBe('arroz branco cozido');
    expect(r.estimatedAmount).toBe(150);
    expect(r.unit).toBe('g');
    expect(r.confidence).toBe('media');
    expect(r.notFood).toBe(false);
  });

  it('remove cerca de markdown ```json se o modelo ainda mandar apesar do responseMimeType', () => {
    const wrapped = '```json\n' + JSON.stringify({ foodName: 'banana', estimatedAmount: 90, unit: 'g', confidence: 'alta', notes: null, notFood: false }) + '\n```';
    const r = parseVisionResponse(wrapped);
    expect(r.foodName).toBe('banana');
  });

  it('notFound: true vira notFood=true e o resto null, mesmo com campos ausentes', () => {
    const r = parseVisionResponse(JSON.stringify({ notFood: true }));
    expect(r.notFood).toBe(true);
    expect(r.foodName).toBeNull();
    expect(r.estimatedAmount).toBeNull();
  });

  it('confidence/unit fora do enum esperado vira null (não aceita qualquer string)', () => {
    const r = parseVisionResponse(JSON.stringify({ foodName: 'x', confidence: 'certeza total', unit: 'kg', notFood: false }));
    expect(r.confidence).toBeNull();
    expect(r.unit).toBeNull(); // 'kg' não é 'g' nem 'ml' — não aceita
  });

  it('estimatedAmount não-numérico (string, NaN) vira null, não quebra', () => {
    const r = parseVisionResponse(JSON.stringify({ foodName: 'x', estimatedAmount: 'muito', notFood: false }));
    expect(r.estimatedAmount).toBeNull();
  });

  it('foodName vazio ou só espaço vira null', () => {
    const r = parseVisionResponse(JSON.stringify({ foodName: '   ', notFood: false }));
    expect(r.foodName).toBeNull();
  });

  it('JSON inválido lança erro claro (não deixa a UI travar com um texto cru)', () => {
    expect(() => parseVisionResponse('isso não é json nenhum')).toThrow(/JSON válido/);
  });

  it('JSON válido mas não é um objeto (ex.: array solto) lança erro', () => {
    expect(() => parseVisionResponse('[1,2,3]')).toThrow(/formato inesperado/);
  });
});
