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
import { analyzeWeek, sanitizeWeekForLLM, type DayAgg, type WeightPoint, type WeeklyAnalysis } from '../lib/weeklyAnalyst';
import { analyzeWithGemini, analyzeWeekWithGemini } from '../lib/geminiAdapter';
import type { NutrientKey } from '../lib/dailyTotals';
import type { GoalDef } from '../lib/dailyTotals';

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

// ── Relatório semanal (mesmo padrão de camadas do diário) ──────────────────
export interface WeeklyAnalysisState {
  rules: WeeklyAnalysis;
  aiText?: string;
  aiLoading: boolean;
  aiError?: string;
  source: 'rules' | 'gemini';
}

export function useWeeklyAnalysis(
  dayAggs: DayAgg[],
  goalsMap: Partial<Record<NutrientKey, GoalDef>>,
  weightPoints: WeightPoint[],
  ready: boolean,
  config: AnalysisConfig = {},
): WeeklyAnalysisState | undefined {
  const [ai, setAi] = useState<{ text?: string; loading: boolean; error?: string }>({ loading: false });

  const rules = useMemo(
    () => (ready ? analyzeWeek(dayAggs, goalsMap, weightPoints) : undefined),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [ready, JSON.stringify(dayAggs.map((d) => ({ ...d, coveredKeys: [...d.coveredKeys] }))), goalsMap, weightPoints],
  );

  const payloadKey = useMemo(() => (rules ? JSON.stringify(sanitizeWeekForLLM(rules)) : ''), [rules]);

  useEffect(() => {
    if (!rules || rules.daysLogged === 0 || !config.geminiApiKey) return;
    if (typeof navigator !== 'undefined' && navigator.onLine === false) return;

    const controller = new AbortController();
    setAi({ loading: true });
    analyzeWeekWithGemini(sanitizeWeekForLLM(rules), {
      apiKey: config.geminiApiKey, model: config.geminiModel, signal: controller.signal,
    })
      .then((text) => setAi({ loading: false, text }))
      .catch((err) => { if (err?.name !== 'AbortError') setAi({ loading: false, error: String(err?.message ?? err) }); });

    return () => controller.abort();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [payloadKey, config.geminiApiKey, config.geminiModel]);

  if (!rules) return undefined;
  return { rules, aiText: ai.text, aiLoading: ai.loading, aiError: ai.error, source: ai.text ? 'gemini' : 'rules' };
}
