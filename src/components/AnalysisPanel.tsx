import React from 'react';
import { Sparkles, CircleCheck, CircleAlert, TriangleAlert, ShieldCheck } from 'lucide-react';
import type { AnalysisState } from '../hooks/useAnalysis';

const C = {
  ink: '#0F2A33', card: '#FFFFFF', slate: '#6B7E84', line: '#DCE5E6',
  good: '#2BA84A', warn: '#E8A33D', alert: '#E0613E', teal: '#0E7C7B',
};

const ICON = {
  good: <CircleCheck size={15} style={{ color: C.good }} />,
  warn: <CircleAlert size={15} style={{ color: C.warn }} />,
  alert: <TriangleAlert size={15} style={{ color: C.alert }} />,
};

export default function AnalysisPanel({ analysis, hasKey }: { analysis: AnalysisState; hasKey: boolean }) {
  const { rules, aiText, aiLoading, aiError, source } = analysis;
  return (
    <div className="rounded-2xl p-5 mt-4" style={{ background: C.card }}>
      <div className="flex items-center justify-between mb-3">
        <span className="text-sm" style={{ color: C.slate }}>Análise do dia</span>
        <span className="flex items-center gap-1 text-[11px]" style={{ color: C.slate }}>
          <ShieldCheck size={12} /> {source === 'gemini' ? 'IA · dados anonimizados' : 'offline · no aparelho'}
        </span>
      </div>

      <p className="text-base font-medium mb-3" style={{ color: C.ink }}>{rules.headline}</p>

      <ul className="space-y-2 mb-2">
        {rules.insights.map((it, i) => (
          <li key={i} className="flex items-start gap-2 text-sm" style={{ color: C.ink }}>
            <span className="mt-0.5">{ICON[it.level]}</span>
            <span>{it.message}</span>
          </li>
        ))}
      </ul>

      {/* Camada 2 — IA opcional */}
      {hasKey ? (
        <div className="mt-3 rounded-xl p-3" style={{ background: '#F1F6F6' }}>
          <div className="flex items-center gap-1 text-xs mb-1" style={{ color: C.teal }}>
            <Sparkles size={13} /> Análise por IA
          </div>
          {aiLoading && <p className="text-sm" style={{ color: C.slate }}>Analisando…</p>}
          {aiText && <p className="text-sm" style={{ color: C.ink }}>{aiText}</p>}
          {aiError && <p className="text-sm" style={{ color: C.warn }}>IA indisponível ({aiError}). Mostrando a análise local.</p>}
        </div>
      ) : (
        <p className="text-xs mt-2" style={{ color: C.slate }}>
          Dica: configure uma chave do Gemini (free tier) para uma análise em linguagem natural. Só números anonimizados são enviados.
        </p>
      )}
    </div>
  );
}
