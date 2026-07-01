/**
 * useAnalysis.ts
 * --------------
 * Camada 1 (regras) sempre disponível. Camada 2 (Gemini) só dispara online +
 * com chave; em offline/erro/sem chave, fica só nas regras.
 */
import { useEffect, useMemo, useState } from 'react';
import {
  analyzeDaily, sanitizeForLLM, type AnalysisInput, type DailyAnalysis,
} from '../lib/nutritionAnalyst';
import { analyzeWithGemini } from '../lib/geminiAdapter';

export interface AnalysisConfig { geminiApiKey?: string; geminiModel?: string; }

export interface AnalysisState {
  rules: DailyAnalysis;
  aiText?: string;
  aiLoading: boolean;
  aiError?: string;
  source: 'rules' | 'gemini';
}

export function useDailyAnalysis(
  input: AnalysisInput | undefined,
  config: AnalysisConfig = {},
): AnalysisState | undefined {
  const [ai, setAi] = useState<{ text?: string; loading: boolean; error?: string }>({ loading: false });

  // payload estável → só refaz a chamada quando os números mudam de verdade
  const payloadKey = useMemo(() => (input ? JSON.stringify(sanitizeForLLM(input)) : ''), [input]);

  useEffect(() => {
    if (!input || !config.geminiApiKey) return;
    if (typeof navigator !== 'undefined' && navigator.onLine === false) return;

    const controller = new AbortController();
    setAi({ loading: true });
    analyzeWithGemini(sanitizeForLLM(input), {
      apiKey: config.geminiApiKey, model: config.geminiModel, signal: controller.signal,
    })
      .then((text) => setAi({ loading: false, text }))
      .catch((err) => { if (err?.name !== 'AbortError') setAi({ loading: false, error: String(err?.message ?? err) }); });

    return () => controller.abort();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [payloadKey, config.geminiApiKey, config.geminiModel]);

  if (!input) return undefined;
  const rules = analyzeDaily(input);
  return { rules, aiText: ai.text, aiLoading: ai.loading, aiError: ai.error, source: ai.text ? 'gemini' : 'rules' };
}
