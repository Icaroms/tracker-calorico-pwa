/**
 * weeklyAnalyst.ts
 * ----------------
 * Relatório semanal — mesma filosofia de camadas do diário
 * (nutritionAnalyst.ts): Camada 1 (regras, aqui) sempre roda, grátis,
 * offline. Camada 2 (Gemini) narra em cima do resumo desta Camada 1,
 * nunca substitui.
 *
 * Trata "sem dado" igual ao diário: um nutriente só entra na média
 * semanal nos dias em que teve dado real (mesmo princípio do
 * NutrientProgress.hasData em dailyTotals.ts — ver §8.5 do HANDOFF). Dia
 * sem NENHUM registro não conta pra média de nutriente nenhum (não é
 * "consumiu zero", é "não registrou").
 */
import { NUTRIENT_LABELS, type NutrientKey, type NutrientTotals, type GoalDef } from './dailyTotals';
import type { Insight } from './nutritionAnalyst';

const label = (k: NutrientKey) => NUTRIENT_LABELS[k] ?? k;

export interface DayAgg {
  day: string; // YYYY-MM-DD
  totals: NutrientTotals;
  coveredKeys: Set<NutrientKey>;
  hasEntries: boolean;
  kcalTarget: number;
  exerciseKcal: number;
}

export interface WeightPoint { day: string; weightKg: number }

export interface NutrientWeekSummary {
  key: NutrientKey;
  direction: 'min' | 'max';
  avgPercent: number;
  daysWithData: number;
  status: 'good' | 'low' | 'high' | 'insufficient';
}

export interface WeeklyAnalysis {
  daysLogged: number;
  daysTotal: number;
  avgKcal: number;
  avgKcalTarget: number;
  totalExerciseSessions: number;
  totalExerciseKcal: number;
  weightChangeKg?: number;
  nutrientSummaries: NutrientWeekSummary[];
  headline: string;
  insights: Insight[];
}

const MIN_DAYS_FOR_TREND = 3; // menos que isso, "consistente" não quer dizer nada

export function analyzeWeek(
  days: DayAgg[],
  goals: Partial<Record<NutrientKey, GoalDef>>,
  weightLogs: WeightPoint[] = [],
): WeeklyAnalysis {
  const logged = days.filter((d) => d.hasEntries);
  const daysLogged = logged.length;
  const daysTotal = days.length;

  const avgKcal = daysLogged ? Math.round(logged.reduce((s, d) => s + (d.totals.kcal ?? 0), 0) / daysLogged) : 0;
  const avgKcalTarget = daysLogged ? Math.round(logged.reduce((s, d) => s + d.kcalTarget, 0) / daysLogged) : 0;

  const totalExerciseSessions = days.reduce((s, d) => s + (d.exerciseKcal > 0 ? 1 : 0), 0);
  const totalExerciseKcal = days.reduce((s, d) => s + d.exerciseKcal, 0);

  let weightChangeKg: number | undefined;
  if (weightLogs.length >= 2) {
    const sorted = [...weightLogs].sort((a, b) => a.day.localeCompare(b.day));
    weightChangeKg = Number((sorted[sorted.length - 1].weightKg - sorted[0].weightKg).toFixed(1));
  }

  // Resumo por nutriente com meta — só considera dias com dado REAL daquele nutriente.
  const nutrientSummaries: NutrientWeekSummary[] = [];
  for (const key of Object.keys(goals) as NutrientKey[]) {
    const goal = goals[key]!;
    const daysWithData = logged.filter((d) => d.coveredKeys.has(key));
    if (daysWithData.length < MIN_DAYS_FOR_TREND) {
      nutrientSummaries.push({ key, direction: goal.direction ?? 'min', avgPercent: 0, daysWithData: daysWithData.length, status: 'insufficient' });
      continue;
    }
    const avgConsumed = daysWithData.reduce((s, d) => s + (d.totals[key] ?? 0), 0) / daysWithData.length;
    const avgPercent = goal.target > 0 ? Math.round((avgConsumed / goal.target) * 100) : 0;
    const direction = goal.direction ?? 'min';
    let status: NutrientWeekSummary['status'];
    if (direction === 'max') status = avgPercent > 100 ? 'high' : 'good';
    else status = avgPercent >= 90 ? 'good' : 'low';
    nutrientSummaries.push({ key, direction, avgPercent, daysWithData: daysWithData.length, status });
  }

  // ── Insights ──
  const insights: Insight[] = [];

  if (daysLogged === 0) {
    return {
      daysLogged, daysTotal, avgKcal, avgKcalTarget, totalExerciseSessions, totalExerciseKcal, weightChangeKg,
      nutrientSummaries: [],
      headline: 'Sem registros essa semana ainda.',
      insights: [{ level: 'warn', message: 'Nenhum dia com alimento registrado nos últimos 7 dias — o resumo semanal fica mais útil com pelo menos alguns dias de dados.' }],
    };
  }

  const kcalAdherence = avgKcalTarget > 0 ? Math.round((avgKcal / avgKcalTarget) * 100) : 0;
  if (kcalAdherence >= 90 && kcalAdherence <= 110) {
    insights.push({ level: 'good', message: `Média de ${avgKcal} kcal/dia — bem alinhada com a meta (${avgKcalTarget} kcal).` });
  } else if (kcalAdherence > 110) {
    insights.push({ level: 'warn', message: `Média de ${avgKcal} kcal/dia ficou ${kcalAdherence - 100}% acima da meta ao longo da semana.` });
  } else {
    insights.push({ level: 'warn', message: `Média de ${avgKcal} kcal/dia ficou ${100 - kcalAdherence}% abaixo da meta ao longo da semana.` });
  }

  if (daysLogged < daysTotal) {
    insights.push({ level: 'warn', message: `Registrou ${daysLogged} de ${daysTotal} dias — os outros dias não entram nas médias acima.` });
  }

  const lowNutrients = nutrientSummaries.filter((n) => n.direction === 'min' && n.status === 'low').sort((a, b) => a.avgPercent - b.avgPercent);
  const goodMins = nutrientSummaries.filter((n) => n.direction === 'min' && n.status === 'good');
  const highLimits = nutrientSummaries.filter((n) => n.direction === 'max' && n.status === 'high');

  for (const n of lowNutrients.slice(0, 3)) {
    insights.push({ level: 'alert', key: n.key, message: `${label(n.key)} ficou consistentemente abaixo da meta (média de ${n.avgPercent}% nos ${n.daysWithData} dias com dado).` });
  }
  for (const n of highLimits) {
    insights.push({ level: 'alert', key: n.key, message: `${label(n.key)} passou do limite em média ao longo da semana (${n.avgPercent}% do teto).` });
  }
  if (goodMins.length > 0) {
    insights.push({ level: 'good', message: `${goodMins.length} nutriente(s) mantidos na meta a semana toda: ${goodMins.map((n) => label(n.key)).join(', ')}.` });
  }

  if (totalExerciseSessions > 0) {
    insights.push({ level: 'good', message: `${totalExerciseSessions} dia(s) com exercício registrado, ${totalExerciseKcal} kcal gastos no total.` });
  }

  if (weightChangeKg != null) {
    const dir = weightChangeKg < 0 ? 'perdeu' : weightChangeKg > 0 ? 'ganhou' : 'manteve';
    insights.push({ level: 'good', message: weightChangeKg === 0 ? 'Peso estável na semana.' : `Peso: ${dir} ${Math.abs(weightChangeKg)} kg na semana.` });
  }

  const headline = lowNutrients.length > 0
    ? `Prioridade da semana: ${label(lowNutrients[0].key)} (média de ${lowNutrients[0].avgPercent}% da meta).`
    : kcalAdherence >= 90 && kcalAdherence <= 110
      ? 'Semana consistente — calorias e nutrientes majoritariamente na meta.'
      : `Semana com calorias ${kcalAdherence > 100 ? 'acima' : 'abaixo'} da meta.`;

  return { daysLogged, daysTotal, avgKcal, avgKcalTarget, totalExerciseSessions, totalExerciseKcal, weightChangeKg, nutrientSummaries, headline, insights };
}

// ── Sanitização pra Camada 2 (mesmo princípio do diário) ───────────────────

export interface WeeklyLLMPayload {
  daysLogged: number;
  daysTotal: number;
  avgKcal: number;
  avgKcalTarget: number;
  totalExerciseSessions: number;
  totalExerciseKcal: number;
  weightChangeKg?: number;
  nutrients: Array<{ key: NutrientKey; avgPercent: number; direction: 'min' | 'max' }>;
}

/** Só números — mesma trava de privacidade do relatório diário. */
export function sanitizeWeekForLLM(w: WeeklyAnalysis): WeeklyLLMPayload {
  return {
    daysLogged: w.daysLogged,
    daysTotal: w.daysTotal,
    avgKcal: w.avgKcal,
    avgKcalTarget: w.avgKcalTarget,
    totalExerciseSessions: w.totalExerciseSessions,
    totalExerciseKcal: w.totalExerciseKcal,
    weightChangeKg: w.weightChangeKg,
    nutrients: w.nutrientSummaries
      .filter((n) => n.status !== 'insufficient')
      .map((n) => ({ key: n.key, avgPercent: n.avgPercent, direction: n.direction })),
  };
}
