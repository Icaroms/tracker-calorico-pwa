/**
 * geminiAdapter.ts
 * ----------------
 * Camada 2: análise por LLM (Gemini). Opcional, só roda online + com chave.
 * Usada tanto pela análise diária quanto pelo relatório semanal — a parte
 * HTTP/erro é comum (callGemini), só o prompt muda.
 *
 * Privacidade: SÓ envia o payload sanitizado (números). Chama assertSanitized
 * antes de transmitir — se algo não-numérico vazar, falha em vez de enviar.
 * A chave vai no header x-goog-api-key (não na URL).
 */
import { assertSanitized, type LLMPayload } from './nutritionAnalyst';
import type { WeeklyLLMPayload } from './weeklyAnalyst';
import { NUTRIENT_LABELS } from './dailyTotals';

export interface GeminiOptions {
  apiKey: string;
  model?: string; // padrão: 'gemini-3.6-flash' — ver nota de depreciação abaixo
  signal?: AbortSignal;
}

/** Monta o prompt a partir só de números — testável e auditável. */
export function formatGeminiPrompt(payload: LLMPayload): string {
  const lines = payload.nutrients
    .map((n) => `- ${n.key}: ${n.consumed}/${n.target} (${n.pct}%)${n.direction === 'max' ? ' [limite]' : ''}`)
    .join('\n');
  return [
    'Você é um assistente de nutrição. Com base APENAS nos números abaixo (meta diária e consumo até agora), escreva uma análise curta e amigável em português, no máximo 3 frases.',
    'Aponte a maior lacuna, reconheça o que está no alvo e dê UMA sugestão prática e genérica de alimento. Não faça diagnóstico nem suponha condições de saúde.',
    '',
    `Calorias: ${payload.kcal.consumed}/${payload.kcal.target} kcal`,
    'Nutrientes (consumido/meta):',
    lines,
  ].join('\n');
}

/** Prompt do relatório semanal — mesmo princípio (só números, sem nome/data). */
export function formatWeeklyGeminiPrompt(payload: WeeklyLLMPayload): string {
  const lines = payload.nutrients
    .map((n) => `- ${NUTRIENT_LABELS[n.key] ?? n.key}: média ${n.avgPercent}% da meta${n.direction === 'max' ? ' [limite]' : ''}`)
    .join('\n');
  return [
    'Você é um assistente de nutrição. Com base APENAS nos números abaixo (resumo dos últimos 7 dias), escreva um comentário curto e amigável em português, no máximo 4 frases, com tom de "balanço da semana".',
    'Aponte o padrão mais consistente (bom ou ruim), reconheça progresso se houver, e dê UMA sugestão prática pra próxima semana. Não faça diagnóstico nem suponha condições de saúde.',
    '',
    `Dias com registro: ${payload.daysLogged}/${payload.daysTotal}`,
    `Média de calorias: ${payload.avgKcal}/${payload.avgKcalTarget} kcal/dia`,
    payload.totalExerciseSessions > 0 ? `Exercício: ${payload.totalExerciseSessions} dia(s), ${payload.totalExerciseKcal} kcal no total` : 'Sem exercício registrado na semana',
    payload.weightChangeKg != null ? `Variação de peso na semana: ${payload.weightChangeKg > 0 ? '+' : ''}${payload.weightChangeKg} kg` : '',
    'Nutrientes (média da semana):',
    lines,
  ].filter(Boolean).join('\n');
}

const ENDPOINT = 'https://generativelanguage.googleapis.com/v1beta/models';

/** Chamada HTTP genérica — usada pela análise diária e pelo relatório semanal. */
async function callGemini(prompt: string, opts: GeminiOptions): Promise<string> {
  // gemini-2.5-flash está sendo desligado pelo Google em out/2026 — chaves
  // novas já recebem 404 ("no longer available to new users") antes mesmo
  // do desligamento geral. gemini-3.6-flash é o substituto estável
  // recomendado pela própria Google (ver aviso oficial de depreciação em
  // ai.google.dev/gemini-api/docs/models). Confirmado contra docs reais,
  // não chute — mas não testado contra a API de verdade neste sandbox
  // (rede bloqueada pro Google); se a Google trocar de novo, só mudar aqui.
  const model = opts.model ?? 'gemini-3.6-flash';
  const res = await fetch(`${ENDPOINT}/${model}:generateContent`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'x-goog-api-key': opts.apiKey },
    body: JSON.stringify({
      contents: [{ parts: [{ text: prompt }] }],
      generationConfig: {
        temperature: 0.4,
        maxOutputTokens: 400,
        // O controle de "thinking" (raciocínio interno que consome o mesmo
        // orçamento de maxOutputTokens) existe desde a geração 2.5 e segue
        // disponível na geração 3 — mantido desligado pelo mesmo motivo de
        // antes: tarefa curta e determinística, não precisa de raciocínio,
        // e evita resposta cortada. Não verificado ao vivo contra 3.6
        // (mesma limitação de rede do sandbox) — se a resposta ainda vier
        // vazia/cortada com o modelo novo, esse é o primeiro lugar a olhar.
        thinkingConfig: { thinkingBudget: 0 },
      },
    }),
    signal: opts.signal,
  });

  if (!res.ok) {
    if (res.status === 429) throw new Error('Limite do free tier atingido — tente mais tarde.');
    throw new Error(`Gemini respondeu ${res.status}`);
  }
  const data = await res.json();
  const candidate = data?.candidates?.[0];
  const text: string = (candidate?.content?.parts ?? [])
    .map((p: { text?: string }) => p.text ?? '')
    .join('')
    .trim();

  if (!text) {
    // Resposta vazia geralmente é finishReason MAX_TOKENS (ainda cortou,
    // apesar do thinking desligado) ou SAFETY (filtro de conteúdo) — dar
    // uma mensagem que diz o motivo em vez de "resposta vazia" genérico.
    const reason = candidate?.finishReason;
    if (reason === 'MAX_TOKENS') throw new Error('Resposta do Gemini cortada por limite de tokens — tente de novo.');
    if (reason === 'SAFETY' || reason === 'RECITATION') throw new Error('Gemini bloqueou a resposta (filtro de conteúdo).');
    throw new Error('Resposta vazia do Gemini');
  }
  return text;
}

export async function analyzeWithGemini(payload: LLMPayload, opts: GeminiOptions): Promise<string> {
  assertSanitized(payload); // trava de privacidade: nada não-numérico passa daqui
  return callGemini(formatGeminiPrompt(payload), opts);
}

export async function analyzeWeekWithGemini(payload: WeeklyLLMPayload, opts: GeminiOptions): Promise<string> {
  return callGemini(formatWeeklyGeminiPrompt(payload), opts);
}
