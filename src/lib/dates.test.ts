import { describe, it, expect } from 'vitest';
import { localDay, daysAgo, lastNDays } from './dates';

/**
 * Estes testes rodam com TZ=America/Manaus (configurado em vite.config.ts,
 * test.env). Sem isso, rodando em UTC (padrão de CI), o bug antigo era
 * invisível: em UTC, "dia UTC" e "dia local" sempre coincidem.
 */
describe('fuso horário do ambiente de teste', () => {
  it('está em Manaus (UTC−4), senão os testes abaixo não provam nada', () => {
    // 2026-10-02 12:00 UTC == 08:00 em Manaus → offset de 240 minutos
    expect(new Date('2026-10-02T12:00:00Z').getTimezoneOffset()).toBe(240);
  });
});

describe('localDay — regressão do bug de fuso', () => {
  it('21h de 02/10 em Manaus continua sendo 02/10 (antes virava 03/10)', () => {
    const vinteUmaHorasManaus = new Date(2026, 9, 2, 21, 0, 0); // mês 0-indexado: 9 = outubro
    expect(localDay(vinteUmaHorasManaus)).toBe('2026-10-02');
    // Prova de que o método antigo estava errado nesse mesmo instante:
    expect(vinteUmaHorasManaus.toISOString().slice(0, 10)).toBe('2026-10-03');
  });

  it('meia-noite e um segundo já é o dia seguinte (fronteira certa no fuso local)', () => {
    expect(localDay(new Date(2026, 9, 3, 0, 0, 1))).toBe('2026-10-03');
  });

  it('23:59:59 ainda é o mesmo dia', () => {
    expect(localDay(new Date(2026, 9, 2, 23, 59, 59))).toBe('2026-10-02');
  });

  it('formata com zero à esquerda (mês e dia de 1 dígito)', () => {
    expect(localDay(new Date(2026, 0, 5, 12))).toBe('2026-01-05');
  });
});

describe('daysAgo / lastNDays', () => {
  const base = new Date(2026, 9, 2, 21, 0, 0); // 02/10 às 21h em Manaus

  it('daysAgo(0) é hoje no fuso local, mesmo às 21h', () => {
    expect(daysAgo(0, base)).toBe('2026-10-02');
  });

  it('atravessa virada de mês corretamente', () => {
    expect(daysAgo(2, base)).toBe('2026-09-30');
  });

  it('lastNDays(7) termina hoje e começa 6 dias atrás, em ordem', () => {
    const days = lastNDays(7, base);
    expect(days).toHaveLength(7);
    expect(days[0]).toBe('2026-09-26');
    expect(days[6]).toBe('2026-10-02');
  });

  it('atravessa virada de ano', () => {
    expect(daysAgo(1, new Date(2026, 0, 1, 22))).toBe('2025-12-31');
  });
});
