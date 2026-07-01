/**
 * geminiAdapter.ts
 * ----------------
 * Camada 2: análise por LLM (Gemini). Opcional, só roda online + com chave.
 *
 * Privacidade: SÓ envia o payload sanitizado (números). Chama assertSanitized
 * antes de transmitir — se algo não-numérico vazar, falha em vez de enviar.
 * A chave vai no header x-goog-api-key (não na URL).
 */
import { assertSanitized, type LLMPayload } from './nutritionAnalyst';

export interface GeminiOptions {
  apiKey: string;
  model?: string; // free tier: 'gemini-2.5-flash' (padrão) ou '-flash-lite'
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

const ENDPOINT = 'https://generativelanguage.googleapis.com/v1beta/models';

export async function analyzeWithGemini(payload: LLMPayload, opts: GeminiOptions): Promise<string> {
  assertSanitized(payload); // trava de privacidade: nada não-numérico passa daqui

  const model = opts.model ?? 'gemini-2.5-flash';
  const res = await fetch(`${ENDPOINT}/${model}:generateContent`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'x-goog-api-key': opts.apiKey },
    body: JSON.stringify({
      contents: [{ parts: [{ text: formatGeminiPrompt(payload) }] }],
      generationConfig: { temperature: 0.4, maxOutputTokens: 220 },
    }),
    signal: opts.signal,
  });

  if (!res.ok) {
    if (res.status === 429) throw new Error('Limite do free tier atingido — tente mais tarde.');
    throw new Error(`Gemini respondeu ${res.status}`);
  }
  const data = await res.json();
  const text: string = (data?.candidates?.[0]?.content?.parts ?? [])
    .map((p: { text?: string }) => p.text ?? '')
    .join('')
    .trim();
  if (!text) throw new Error('Resposta vazia do Gemini');
  return text;
}
