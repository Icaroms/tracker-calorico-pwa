/**
 * foodVision.ts
 * -------------
 * Reconhecimento de alimento por foto (Gemini Vision) + estimativa de
 * peso/volume. Fluxo de PRIVACIDADE DIFERENTE do resto da IA do app: aqui
 * uma foto de verdade é enviada pro Gemini (Google), não só números
 * anonimizados como em nutritionAnalyst.ts/weeklyAnalyst.ts — por isso é
 * um módulo separado, com seu próprio aviso claro na UI, e a foto nunca é
 * salva (processada em memória, descartada depois da resposta).
 *
 * IMPORTANTE (mantém a honestidade de dado do resto do app): o Gemini NÃO
 * decide os valores nutricionais do que foi reconhecido — ele só sugere um
 * NOME (pra buscar na base real, TACO/curada) e uma ESTIMATIVA DE PESO
 * (claramente marcada como chute). A nutrição de verdade sempre vem da
 * busca normal, nunca da IA. Ver FoodCamera.tsx pra como isso se conecta.
 */
export interface FoodVisionResult {
  /** Nome em português do que a IA achou que viu — usar pra buscar na base real, nunca pra nutrição. */
  foodName: string | null;
  /** Estimativa de peso/volume — CHUTE, sem referência de escala na foto. */
  estimatedAmount: number | null;
  unit: 'g' | 'ml' | null;
  confidence: 'baixa' | 'media' | 'alta' | null;
  /** Observação curta da IA (ex.: "difícil estimar sem referência de tamanho"). */
  notes: string | null;
  /** true se a IA não conseguiu identificar nada que pareça comida. */
  notFood: boolean;
}

export interface GeminiVisionOptions {
  apiKey: string;
  model?: string;
  signal?: AbortSignal;
}

const ENDPOINT = 'https://generativelanguage.googleapis.com/v1beta/models';

const PROMPT = `Você é um assistente de identificação de alimentos a partir de foto.
Olhe a imagem e responda APENAS com um JSON válido (sem markdown, sem explicação fora do JSON), neste formato exato:

{
  "foodName": "nome do alimento em português, descrição simples (ex: 'arroz branco cozido', 'maçã', 'peito de frango grelhado')",
  "estimatedAmount": número (peso em gramas, ou volume em mililitros se for líquido),
  "unit": "g" ou "ml",
  "confidence": "baixa", "media" ou "alta" (sua confiança na estimativa de peso/volume, dado que não há objeto de referência de escala na foto),
  "notes": "observação curta opcional sobre a estimativa, ou null",
  "notFood": true se a imagem não parece conter comida, false caso contrário
}

Se não conseguir identificar comida na imagem, retorne notFood: true e os outros campos null.
Se houver mais de um alimento, identifique o principal/maior porção visível.
Seja honesto sobre a confiança — sem referência de escala (moeda, mão, prato padrão) na foto, a estimativa de peso é sempre uma aproximação, não deixe de marcar "baixa" quando for o caso.`;

/** Analisa uma foto (base64, sem o prefixo data:...) e retorna o reconhecimento + estimativa. */
export async function recognizeFoodPhoto(
  imageBase64: string,
  mimeType: string,
  opts: GeminiVisionOptions,
): Promise<FoodVisionResult> {
  const model = opts.model ?? 'gemini-3.6-flash';
  const res = await fetch(`${ENDPOINT}/${model}:generateContent`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'x-goog-api-key': opts.apiKey },
    body: JSON.stringify({
      contents: [{
        parts: [
          { text: PROMPT },
          { inline_data: { mime_type: mimeType, data: imageBase64 } },
        ],
      }],
      generationConfig: {
        temperature: 0.2, // baixa — queremos resposta consistente, não criativa
        maxOutputTokens: 2048, // folga generosa: reconhecimento visual pode usar mais "pensamento" que o resumo de texto
        responseMimeType: 'application/json',
        // Sem thinkingConfig aqui de propósito — diferente da análise de
        // texto (nutritionAnalyst), reconhecer comida numa foto e estimar
        // porção se beneficia de raciocínio visual; deixamos o padrão do
        // modelo decidir quanto "pensar", só damos orçamento de token de
        // sobra pra não cortar a resposta (mesmo bug do geminiAdapter.ts).
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
    const reason = candidate?.finishReason;
    if (reason === 'MAX_TOKENS') throw new Error('Resposta cortada por limite de tokens — tente de novo.');
    if (reason === 'SAFETY' || reason === 'RECITATION') throw new Error('Gemini bloqueou a resposta (filtro de conteúdo).');
    throw new Error('Resposta vazia do Gemini');
  }

  return parseVisionResponse(text);
}

/** Parse defensivo — mesmo com responseMimeType:'application/json', vale não confiar cegamente. */
export function parseVisionResponse(text: string): FoodVisionResult {
  // Às vezes o modelo ainda embrulha em ```json apesar do responseMimeType — remove se vier.
  const cleaned = text.replace(/^```json\s*/i, '').replace(/```\s*$/, '').trim();
  let parsed: unknown;
  try {
    parsed = JSON.parse(cleaned);
  } catch {
    throw new Error('Resposta da IA não veio em JSON válido — tente tirar a foto de novo.');
  }
  if (typeof parsed !== 'object' || parsed === null || Array.isArray(parsed)) {
    throw new Error('Resposta da IA em formato inesperado.');
  }
  const p = parsed as Record<string, unknown>;
  const confidence = p.confidence === 'baixa' || p.confidence === 'media' || p.confidence === 'alta' ? p.confidence : null;
  const unit = p.unit === 'g' || p.unit === 'ml' ? p.unit : null;
  return {
    foodName: typeof p.foodName === 'string' && p.foodName.trim() ? p.foodName.trim() : null,
    estimatedAmount: typeof p.estimatedAmount === 'number' && Number.isFinite(p.estimatedAmount) ? p.estimatedAmount : null,
    unit,
    confidence,
    notes: typeof p.notes === 'string' && p.notes.trim() ? p.notes.trim() : null,
    notFood: p.notFood === true,
  };
}
