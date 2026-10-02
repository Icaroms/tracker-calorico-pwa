import { describe, it, expect, beforeEach } from 'vitest';
import Dexie from 'dexie';
import {
  db, logFood, entriesForDay, removeEntry, updateEntry,
  logExercise, exercisesForDay, removeExerciseEntry,
  exportAll, importAll, setGoal, allGoals,
} from './db';

// Cada teste começa com o banco limpo — fake-indexeddb persiste entre testes
// do mesmo arquivo se não for resetado.
beforeEach(async () => {
  await Promise.all(db.tables.map((t) => t.clear()));
});

describe('schema — regressão do bug do §6.5 (createdAt não indexado)', () => {
  it('orderBy("createdAt") em foodEntries NÃO lança SchemaError', async () => {
    // Esse teste teria pego o bug real: useFrequentFoods() usa orderBy('createdAt'),
    // e until a v3 do schema isso lançava SchemaError em QUALQUER visita à
    // aba Registrar, mesmo com o dia vazio.
    await expect(db.foodEntries.orderBy('createdAt').toArray()).resolves.toEqual([]);
  });

  it('orderBy("createdAt") continua funcionando com dado real na tabela', async () => {
    await logFood({ meal: 'almoco', foodId: 'arroz', grams: 100 });
    await logFood({ meal: 'jantar', foodId: 'feijao', grams: 100 });
    const rows = await db.foodEntries.orderBy('createdAt').reverse().toArray();
    expect(rows.length).toBe(2);
  });

  it('todas as versões do schema aplicam sem erro (migração limpa do zero)', async () => {
    expect(db.verno).toBeGreaterThanOrEqual(4);
    // Se alguma version().stores() tivesse sintaxe inválida, open() já teria falhado
    await expect(db.open()).resolves.toBeDefined();
  });
});

describe('foodEntries — CRUD', () => {
  it('logFood grava e entriesForDay recupera', async () => {
    const day = '2026-01-15';
    await logFood({ meal: 'cafe', foodId: 'aveia', grams: 50, day });
    const rows = await entriesForDay(day);
    expect(rows.length).toBe(1);
    expect(rows[0].foodId).toBe('aveia');
    expect(rows[0].grams).toBe(50);
    expect(rows[0].createdAt).toBeDefined();
  });

  it('removeEntry apaga a entrada', async () => {
    const id = await logFood({ meal: 'cafe', foodId: 'aveia', grams: 50 });
    await removeEntry(id);
    const rows = await entriesForDay();
    expect(rows.find((r) => r.id === id)).toBeUndefined();
  });

  it('updateEntry altera só os campos passados', async () => {
    const id = await logFood({ meal: 'cafe', foodId: 'aveia', grams: 50 });
    await updateEntry(id, { grams: 80 });
    const rows = await entriesForDay();
    const row = rows.find((r) => r.id === id)!;
    expect(row.grams).toBe(80);
    expect(row.foodId).toBe('aveia'); // não mudou
  });

  it('entriesForDay filtra corretamente por dia (não mistura dias diferentes)', async () => {
    await logFood({ meal: 'cafe', foodId: 'a', grams: 1, day: '2026-01-01' });
    await logFood({ meal: 'cafe', foodId: 'b', grams: 1, day: '2026-01-02' });
    const dia1 = await entriesForDay('2026-01-01');
    expect(dia1.length).toBe(1);
    expect(dia1[0].foodId).toBe('a');
  });
});

describe('exerciseEntries — CRUD', () => {
  it('logExercise grava e exercisesForDay recupera', async () => {
    const day = '2026-01-15';
    await logExercise({ exerciseId: 'remador', minutes: 30, kcalBurned: 294, day });
    const rows = await exercisesForDay(day);
    expect(rows.length).toBe(1);
    expect(rows[0].kcalBurned).toBe(294);
  });

  it('removeExerciseEntry apaga a entrada', async () => {
    const id = await logExercise({ exerciseId: 'remador', minutes: 30, kcalBurned: 294 });
    await removeExerciseEntry(id);
    const rows = await exercisesForDay();
    expect(rows.find((r) => r.id === id)).toBeUndefined();
  });
});

describe('goals', () => {
  it('setGoal grava e allGoals lista', async () => {
    await setGoal({ key: 'sodium', target: 2000, unit: 'mg', direction: 'max' });
    const goals = await allGoals();
    expect(goals.find((g) => g.key === 'sodium')?.target).toBe(2000);
  });
});

describe('backup — export/import round-trip', () => {
  it('exportAll → importAll preserva os dados de todas as tabelas, incluindo exercícios', async () => {
    await logFood({ meal: 'cafe', foodId: 'aveia', grams: 50 });
    await logExercise({ exerciseId: 'remador', minutes: 30, kcalBurned: 294 });
    await setGoal({ key: 'protein', target: 128, unit: 'g', direction: 'min' });

    const dump = await exportAll();
    await Promise.all(db.tables.map((t) => t.clear())); // simula "perdeu o banco"
    await importAll(dump);

    const foods = await entriesForDay();
    const exercises = await exercisesForDay();
    const goals = await allGoals();
    expect(foods.length).toBe(1);
    expect(exercises.length).toBe(1);
    expect(goals.find((g) => g.key === 'protein')).toBeDefined();
  });
});
