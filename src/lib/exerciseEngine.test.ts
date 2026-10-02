import { describe, it, expect } from 'vitest';
import { kcalBurned, exerciseById, EXERCISE_BASE } from './exerciseEngine';

describe('kcalBurned — fórmula ACSM (MET × 3.5 × peso × min / 200)', () => {
  it('remador (7.0 MET), 80kg, 30min = 294 kcal', () => {
    expect(kcalBurned(7.0, 80, 30)).toBe(294);
  });
  it('funcional (8.0 MET), 70kg, 45min', () => {
    // 8*3.5*70*45/200 = 88200/200 = 441
    expect(kcalBurned(8.0, 70, 45)).toBe(441);
  });
  it('escala linearmente com o tempo', () => {
    expect(kcalBurned(5, 70, 60)).toBe(kcalBurned(5, 70, 30) * 2);
  });
  it('escala linearmente com o peso', () => {
    expect(kcalBurned(5, 140, 30)).toBe(kcalBurned(5, 70, 30) * 2);
  });
  it('entradas inválidas retornam 0 em vez de NaN/negativo', () => {
    expect(kcalBurned(0, 70, 30)).toBe(0);
    expect(kcalBurned(5, 0, 30)).toBe(0);
    expect(kcalBurned(5, 70, 0)).toBe(0);
    expect(kcalBurned(-5, 70, 30)).toBe(0);
  });
});

describe('EXERCISE_BASE', () => {
  it('tem remador e funcional (os 2 pedidos originalmente)', () => {
    expect(exerciseById('remador')).toBeDefined();
    expect(exerciseById('funcional')).toBeDefined();
  });
  it('tem a ampliação de esportes/academia/casa/luta pedida depois', () => {
    for (const id of ['futebol', 'basquete', 'volei', 'pilates', 'eliptico', 'escada', 'calistenia', 'alongamento', 'luta-artes-marciais']) {
      expect(exerciseById(id), `${id} deveria existir`).toBeDefined();
    }
  });
  it('artes marciais tem MET bem mais alto que alongamento (intensidades opostas fazem sentido)', () => {
    expect(exerciseById('luta-artes-marciais')!.met).toBeGreaterThan(exerciseById('alongamento')!.met * 3);
  });
  it('todo item tem MET > 0 e fonte declarada', () => {
    for (const ex of EXERCISE_BASE) {
      expect(ex.met).toBeGreaterThan(0);
      expect(ex.source).toBe('compendium');
    }
  });
  it('ids são únicos (sem duplicata acidental)', () => {
    const ids = EXERCISE_BASE.map((e) => e.id);
    expect(new Set(ids).size).toBe(ids.length);
  });
  it('exerciseById retorna undefined pra id inexistente', () => {
    expect(exerciseById('nao-existe')).toBeUndefined();
  });
});
