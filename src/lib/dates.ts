/**
 * dates.ts
 * --------
 * Fonte ÚNICA de "que dia é" no app, sempre no fuso horário LOCAL do
 * aparelho.
 *
 * Bug que isso corrige: antes, cada arquivo calculava o dia com
 * `new Date().toISOString().slice(0, 10)`. toISOString() devolve o horário
 * em UTC — em Manaus (UTC−4), tudo registrado depois das 20h caía no dia
 * SEGUINTE (comida, exercício, histórico, relatório semanal). Os testes
 * não pegavam porque o ambiente de CI roda em UTC, onde UTC == local.
 *
 * Regra: nenhum outro arquivo deve montar string de dia por conta própria.
 * Carimbos de instante (createdAt) continuam em ISO completo — esses são
 * corretos, porque representam um momento absoluto, não um "dia".
 */

const pad = (n: number) => String(n).padStart(2, '0');

/** Dia local no formato YYYY-MM-DD (ex.: '2026-10-02'). */
export function localDay(date: Date = new Date()): string {
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

/** Atalho pro dia de hoje no fuso local. */
export const today = (): string => localDay();

/** Instante atual em ISO completo — usado pra createdAt (momento absoluto, não "dia"). */
export const now = (): string => new Date().toISOString();

/** Dia local de `n` dias atrás (0 = hoje). Usa setDate, então atravessa mês/ano certo. */
export function daysAgo(n: number, from: Date = new Date()): string {
  const d = new Date(from);
  d.setDate(d.getDate() - n);
  return localDay(d);
}

/** Últimos `n` dias locais em ordem cronológica (o mais antigo primeiro, hoje por último). */
export function lastNDays(n: number, from: Date = new Date()): string[] {
  const out: string[] = [];
  for (let i = n - 1; i >= 0; i--) out.push(daysAgo(i, from));
  return out;
}
