import React from 'react';
import { Sparkles, CircleCheck, CircleAlert, TriangleAlert, ShieldCheck, CalendarDays } from 'lucide-react';
import type { WeeklyAnalysisState } from '../hooks/useAnalysis';
import { useTheme } from '../theme';

export default function WeeklyReport({ analysis, hasKey }: { analysis: WeeklyAnalysisState; hasKey: boolean }) {
  const C = useTheme();
  const ICON = {
    good: <CircleCheck size={15} style={{ color: C.good }} />,
    warn: <CircleAlert size={15} style={{ color: C.warn }} />,
    alert: <TriangleAlert size={15} style={{ color: C.alert }} />,
  };
  const { rules, aiText, aiLoading, aiError, source } = analysis;

  return (
    <div className="rounded-2xl p-5 mb-4" style={{ background: C.card }}>
      <div className="flex items-center justify-between mb-3">
        <span className="flex items-center gap-2 text-sm" style={{ color: C.slate }}>
          <CalendarDays size={15} /> Resumo da semana
        </span>
        {rules.daysLogged > 0 && (
          <span className="flex items-center gap-1 text-[11px]" style={{ color: C.slate }}>
            <ShieldCheck size={12} /> {source === 'gemini' ? 'IA · dados anonimizados' : 'offline · no aparelho'}
          </span>
        )}
      </div>

      <p className="text-base font-medium mb-3" style={{ color: C.ink }}>{rules.headline}</p>

      {rules.daysLogged > 0 && (
        <div className="grid grid-cols-3 gap-3 mb-3">
          <div className="rounded-xl p-3 text-center" style={{ background: C.chipBg }}>
            <div className="text-lg font-medium tabular-nums" style={{ color: C.ink }}>{rules.daysLogged}/{rules.daysTotal}</div>
            <div className="text-[11px]" style={{ color: C.slate }}>dias registrados</div>
          </div>
          <div className="rounded-xl p-3 text-center" style={{ background: C.chipBg }}>
            <div className="text-lg font-medium tabular-nums" style={{ color: C.ink }}>{rules.avgKcal}</div>
            <div className="text-[11px]" style={{ color: C.slate }}>kcal/dia em média</div>
          </div>
          <div className="rounded-xl p-3 text-center" style={{ background: C.chipBg }}>
            <div className="text-lg font-medium tabular-nums" style={{ color: C.ink }}>
              {rules.weightChangeKg == null ? '—' : `${rules.weightChangeKg > 0 ? '+' : ''}${rules.weightChangeKg}`}
            </div>
            <div className="text-[11px]" style={{ color: C.slate }}>kg na semana</div>
          </div>
        </div>
      )}

      <ul className="space-y-2 mb-2">
        {rules.insights.map((it, i) => (
          <li key={i} className="flex items-start gap-2 text-sm" style={{ color: C.ink }}>
            <span className="mt-0.5">{ICON[it.level]}</span>
            <span>{it.message}</span>
          </li>
        ))}
      </ul>

      {/* Camada 2 — IA opcional */}
      {rules.daysLogged > 0 && (
        hasKey ? (
          <div className="mt-3 rounded-xl p-3" style={{ background: C.chipBg }}>
            <div className="flex items-center gap-1 text-xs mb-1" style={{ color: C.teal }}>
              <Sparkles size={13} /> Balanço da semana por IA
            </div>
            {aiLoading && <p className="text-sm" style={{ color: C.slate }}>Analisando…</p>}
            {aiText && <p className="text-sm" style={{ color: C.ink }}>{aiText}</p>}
            {aiError && <p className="text-sm" style={{ color: C.warn }}>IA indisponível ({aiError}). Mostrando o resumo local.</p>}
          </div>
        ) : (
          <p className="text-xs mt-2" style={{ color: C.slate }}>
            Dica: configure uma chave do Gemini em Ajustes pra um balanço da semana em linguagem natural.
          </p>
        )
      )}
    </div>
  );
}
