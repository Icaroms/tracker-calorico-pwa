import { describe, it, expect } from 'vitest';
import { mapOffProduct, offFoodId } from './openFoodFacts';

describe('mapOffProduct', () => {
  it('mapeia macros e converte minerais de g para mg', () => {
    const r = mapOffProduct('4006381333931', {
      product_name: 'Biscoito', nutriments: { 'energy-kcal_100g': 450, proteins_100g: 7, calcium_100g: 0.12 },
    })!;
    expect(r.per100g.kcal).toBe(450);
    expect(r.per100g.calcium).toBe(120);
  });

  it('mapeia sódio (g → mg)', () => {
    const r = mapOffProduct('1', { product_name: 'X', nutriments: { 'energy-kcal_100g': 100, sodium_100g: 0.8 } })!;
    expect(r.per100g.sodium).toBe(800);
  });

  it('sem sódio mas com sal: deriva sódio = sal / 2,5', () => {
    const r = mapOffProduct('1', { product_name: 'X', nutriments: { 'energy-kcal_100g': 100, salt_100g: 2 } })!;
    expect(r.per100g.sodium).toBe(800);
  });

  it('só energia em kJ (rótulo importado): converte pra kcal', () => {
    const r = mapOffProduct('1', { product_name: 'X', nutriments: { 'energy-kj_100g': 1674 } })!;
    expect(r.per100g.kcal).toBeCloseTo(400, 0);
  });

  it('não mapeia fibra total como fibra solúvel (significados diferentes)', () => {
    const r = mapOffProduct('1', { product_name: 'X', nutriments: { 'energy-kcal_100g': 100, fiber_100g: 5 } })!;
    expect(r.per100g.fiberSoluble).toBeUndefined();
  });

  it('sem calorias nem proteína → null (não serve pra registro)', () => {
    expect(mapOffProduct('1', { product_name: 'X', nutriments: { fat_100g: 3 } })).toBeNull();
  });

  it('id vem do código de barras, não do nome (evita sobrescrever alimento de mesmo nome)', () => {
    const a = mapOffProduct('7891000100103', { product_name: 'Iogurte natural', nutriments: { 'energy-kcal_100g': 60 } })!;
    const b = mapOffProduct('7896000000000', { product_name: 'Iogurte natural', nutriments: { 'energy-kcal_100g': 70 } })!;
    expect(a.id).toBe(offFoodId('7891000100103'));
    expect(a.id).not.toBe(b.id);
  });

  it('marca possível lactose por alérgeno ou ingrediente', () => {
    const r = mapOffProduct('1', { product_name: 'X', nutriments: { 'energy-kcal_100g': 100 }, ingredients_text: 'leite em pó integral' })!;
    expect(r.lactoseLevel).toBe('moderate');
  });

  it('primeira marca da lista, nome em pt preferido', () => {
    const r = mapOffProduct('1', { product_name: 'Cookie', product_name_pt: 'Biscoito', brands: 'Marca A, Marca B', nutriments: { 'energy-kcal_100g': 100 } })!;
    expect(r.name).toBe('Biscoito');
    expect(r.brand).toBe('Marca A');
  });
});
