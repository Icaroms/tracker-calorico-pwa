import React from 'react';
import { useTheme } from '../theme';

/*
  Sparkline de peso em SVG puro — sem recharts.
  Linha fina = peso diário; linha grossa verde = média móvel 7d.
  preserveAspectRatio="none" + vector-effect mantém o traço fino e nítido
  em qualquer largura; rótulos são HTML sobreposto (não distorcem).
*/
const VB_W = 300, VB_H = 120, PAD_X = 4, PAD_Y = 12;

interface P { idx: number; weightKg: number; avg: number; }

export default function WeightSparkline({ data }: { data: P[] }) {
  const C = useTheme();
  if (data.length === 0) return <div style={{ height: VB_H }} />;

  const vals = data.flatMap((d) => [d.weightKg, d.avg]);
  const min = Math.min(...vals);
  const max = Math.max(...vals);
  const span = max - min || 1;
  const n = data.length;

  const x = (i: number) => PAD_X + (n === 1 ? (VB_W - 2 * PAD_X) / 2 : (i / (n - 1)) * (VB_W - 2 * PAD_X));
  const y = (v: number) => PAD_Y + (1 - (v - min) / span) * (VB_H - 2 * PAD_Y);
  const path = (key: 'weightKg' | 'avg') =>
    data.map((d, i) => `${i === 0 ? 'M' : 'L'} ${x(i).toFixed(1)} ${y(d[key]).toFixed(1)}`).join(' ');

  const last = data[n - 1];

  return (
    <div style={{ position: 'relative', height: VB_H, width: '100%' }}>
      <svg viewBox={`0 0 ${VB_W} ${VB_H}`} preserveAspectRatio="none" width="100%" height={VB_H} style={{ display: 'block', overflow: 'visible' }} role="img" aria-label="Tendência de peso (média móvel 7 dias)">
        {n > 1 && (
          <>
            <path d={path('weightKg')} fill="none" stroke={C.line} strokeWidth={1.5} vectorEffect="non-scaling-stroke" />
            <path d={path('avg')} fill="none" stroke={C.green} strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round" vectorEffect="non-scaling-stroke" />
          </>
        )}
      </svg>
      <span style={{ position: 'absolute', top: 0, left: 4, fontSize: 10, color: C.slate }}>{max.toFixed(1)}</span>
      <span style={{ position: 'absolute', bottom: 0, left: 4, fontSize: 10, color: C.slate }}>{min.toFixed(1)}</span>
      <span style={{ position: 'absolute', top: 0, right: 4, fontSize: 11, fontWeight: 600, color: C.green }}>{last.avg.toFixed(1)} kg</span>
    </div>
  );
}
