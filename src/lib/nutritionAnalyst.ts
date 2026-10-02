/**
 * nutritionAnalyst.ts
 * -------------------
 * Camada 1: análise do dia por REGRAS — grátis, offline, determinística.
 * Não envia nada pra lugar nenhum.
 *
 * Também expõe sanitizeForLLM(): produz APENAS números anonimizados (sem nome,
 * sem data, sem rótulo de condição de saúde) para a Camada 2 (LLM) consumir.
 */
import {
  NUTRIENT_LABELS, TRACKED_NUTRIENTS,
  type NutrientProgress, type NutrientKey,
} from './dailyTotals';

export interface AnalysisInput {
  progress: NutrientProgress[];
  kcalConsumed: number;
  kcalTarget: number;
  /** Contexto local — usado só na Camada 1, NUNCA enviado ao LLM. */
  fastingAdvice?: 'ok' | 'cautela' | 'evitar';
}

export type InsightLevel = 'good' | 'warn' | 'alert';
export interface Insight { level: InsightLevel; key?: NutrientKey; message: string; }
export interface DailyAnalysis { headline: string; insights: Insight[]; }

const label = (k: NutrientKey) => NUTRIENT_LABELS[k] ?? k;

export function analyzeDaily(input: AnalysisInput): DailyAnalysis {
  const insights: Insight[] = [];
  const mins = input.progress.filter((p) => p.direction === 'min');
  const maxs = input.progress.filter((p) => p.direction === 'max');

  // Saldo calórico
  const overKcal = input.kcalConsumed - input.kcalTarget;
  if (overKcal > 50) {
    insights.push({ level: 'alert', message: `Você passou ${Math.round(overKcal)} kcal da meta de hoje.` });
  } else if (overKcal > -150) {
    insights.push({ level: 'good', message: 'Saldo calórico bem ajustado à meta.' });
  }

  // Limites (gordura saturada, sódio) agora ficam na seção "Evitar hoje"
  // (avoidRules.ts avoidByLimit) — cobre tanto perto-do-teto quanto
  // já-estourado, com exemplos concretos de alimento. Evita duplicar aviso
  // aqui.

  // Lacunas (do mais atrasado pro menos) — só nutrientes com dado real hoje.
  // hasData=false = base de alimentos não mede esse nutriente pro que foi
  // comido, não é o mesmo que "ficou devendo" (ver dailyTotals.ts).
  const under = mins.filter((p) => p.status === 'under' && p.hasData).sort((a, b) => a.percent - b.percent);
  for (const p of under.slice(0, 3)) {
    const lvl: InsightLevel = p.percent < 50 ? 'alert' : 'warn';
    insights.push({ level: lvl, key: p.key, message: `Faltam ${Math.max(p.remaining, 0)}${p.unit} de ${label(p.key)} (${p.percent}% da meta).` });
  }

  // Reforço positivo
  const met = mins.filter((p) => p.status === 'met');
  if (met.length) {
    insights.push({ level: 'good', message: `${met.length} nutriente(s) já no alvo${met.length <= 3 ? `: ${met.map((p) => label(p.key)).join(', ')}` : ''}.` });
  }

  // Jejum (contexto local; não vai pro LLM)
  if (input.fastingAdvice && input.fastingAdvice !== 'ok') {
    insights.push({ level: 'warn', message: `Jejum hoje: ${input.fastingAdvice} — confirme com seu médico.` });
  }

  // Manchete = o ponto mais importante
  const worst = under[0];
  const headline = maxs.some((p) => p.status === 'over')
    ? 'Atenção a um limite ultrapassado hoje.'
    : worst
      ? `Prioridade: ${label(worst.key)} está em ${worst.percent}% da meta.`
      : 'Dia bem equilibrado até aqui.';

  return { headline, insights };
}

// ── Sanitização para a Camada 2 (LLM) ───────────────────────────────────────

export interface LLMNutrient { key: string; consumed: number; target: number; pct: number; direction: 'min' | 'max'; }
export interface LLMPayload {
  kcal: { consumed: number; target: number };
  nutrients: LLMNutrient[];
}

/** Extrai SÓ números. Sem nome, sem data, sem condição de saúde, sem jejum.
 *  Nutrientes sem dado hoje (hasData=false) ficam de fora — não é seguro
 *  deixar a IA interpretar "0%" como consumo real quando é só lacuna da
 *  base de alimentos (ver dailyTotals.ts NutrientProgress.hasData). */
export function sanitizeForLLM(input: AnalysisInput): LLMPayload {
  return {
    kcal: { consumed: Math.round(input.kcalConsumed), target: Math.round(input.kcalTarget) },
    nutrients: input.progress
      .filter((p) => p.hasData)
      .map((p) => ({
        key: p.key, consumed: p.consumed, target: p.target, pct: p.percent, direction: p.direction,
      })),
  };
}

/** Garante que o payload só tem números e chaves de nutriente conhecidas. */
export function assertSanitized(payload: LLMPayload): void {
  const allowed = new Set<string>(TRACKED_NUTRIENTS as readonly string[]);
  if (!Number.isFinite(payload.kcal.consumed) || !Number.isFinite(payload.kcal.target)) {
    throw new Error('Payload inválido: kcal não numérico');
  }
  for (const n of payload.nutrients) {
    if (!allowed.has(n.key)) throw new Error(`Payload contém chave não permitida: ${n.key}`);
    if (![n.consumed, n.target, n.pct].every(Number.isFinite)) {
      throw new Error(`Payload contém valor não numérico em ${n.key}`);
    }
    if (n.direction !== 'min' && n.direction !== 'max') {
      throw new Error(`direction inválida em ${n.key}`);
    }
  }
}
