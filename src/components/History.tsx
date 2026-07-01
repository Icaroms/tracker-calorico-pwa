import React, { useState } from 'react';
import { BarChart, Bar, LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer } from 'recharts';
import { ChevronDown, X } from 'lucide-react';
import { useHistory, useTodayEntries } from '../hooks/useTracker';

const C = { ink: '#0F2A33', card: '#FFFFFF', slate: '#6B7E84', line: '#DCE5E6', teal: '#0E7C7B', green: '#2BA84A' };

const RANGES: { days: number; label: string }[] = [
  { days: 7, label: 'Semana' }, { days: 30, label: 'Mês' }, { days: 90, label: '3 meses' },
];

const shortDay = (iso: string) => iso.slice(8, 10) + '/' + iso.slice(5, 7);

export default function History() {
  const [range, setRange] = useState(30);
  const { days, weight } = useHistory(range);

  const loggedDays = days.filter((d) => d.entries > 0);
  const avgKcal = loggedDays.length ? Math.round(loggedDays.reduce((s, d) => s + d.kcal, 0) / loggedDays.length) : 0;
  const chartDays = days.map((d) => ({ ...d, label: shortDay(d.day) }));

  return (
    <div style={{ color: C.ink }}>
      <div className="flex gap-1 mb-4">
        {RANGES.map((r) => (
          <button key={r.days} onClick={() => setRange(r.days)}
            className="text-xs px-3 py-1.5 rounded-full" style={{ background: range === r.days ? C.teal : C.line, color: range === r.days ? '#fff' : C.ink }}>
            {r.label}
          </button>
        ))}
      </div>

      <div className="rounded-2xl p-4 mb-4" style={{ background: C.card }}>
        <div className="flex items-center justify-between mb-3">
          <span className="text-sm" style={{ color: C.slate }}>Calorias por dia</span>
          <span className="text-xs" style={{ color: C.slate }}>média {avgKcal} kcal · {loggedDays.length} dia(s)</span>
        </div>
        {chartDays.length === 0 ? (
          <p className="text-sm" style={{ color: C.slate }}>Sem registros no período ainda.</p>
        ) : (
          <ResponsiveContainer width="100%" height={160}>
            <BarChart data={chartDays} margin={{ top: 5, right: 5, left: -20, bottom: 0 }}>
              <XAxis dataKey="label" tick={{ fontSize: 10, fill: C.slate }} tickLine={false} axisLine={false} interval="preserveStartEnd" />
              <YAxis tick={{ fontSize: 10, fill: C.slate }} tickLine={false} axisLine={false} />
              <Tooltip contentStyle={{ borderRadius: 8, border: 'none', fontSize: 12 }} />
              <Bar dataKey="kcal" fill={C.teal} radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        )}
      </div>

      <div className="rounded-2xl p-4 mb-4" style={{ background: C.card }}>
        <span className="text-sm" style={{ color: C.slate }}>Peso (média móvel 7d)</span>
        {weight.length === 0 ? (
          <p className="text-sm mt-2" style={{ color: C.slate }}>Registre seu peso no Perfil para ver a evolução.</p>
        ) : (
          <ResponsiveContainer width="100%" height={160}>
            <LineChart data={weight.map((w) => ({ ...w, label: shortDay(w.day) }))} margin={{ top: 8, right: 5, left: -20, bottom: 0 }}>
              <XAxis dataKey="label" tick={{ fontSize: 10, fill: C.slate }} tickLine={false} axisLine={false} interval="preserveStartEnd" />
              <YAxis domain={['dataMin - 0.5', 'dataMax + 0.5']} tick={{ fontSize: 10, fill: C.slate }} tickLine={false} axisLine={false} />
              <Tooltip contentStyle={{ borderRadius: 8, border: 'none', fontSize: 12 }} />
              <Line type="monotone" dataKey="weightKg" stroke={C.line} strokeWidth={1.5} dot={false} name="diário" />
              <Line type="monotone" dataKey="avg" stroke={C.green} strokeWidth={2.5} dot={false} name="média 7d" />
            </LineChart>
          </ResponsiveContainer>
        )}
      </div>

      <div className="rounded-2xl p-4" style={{ background: C.card }}>
        <span className="text-sm" style={{ color: C.slate }}>Dias registrados</span>
        <ul className="mt-2 space-y-1">
          {[...chartDays].reverse().slice(0, 20).map((d) => (
            <DayRow key={d.day} day={d.day} kcal={d.kcal} entries={d.entries} />
          ))}
        </ul>
      </div>
    </div>
  );
}

function DayRow({ day, kcal, entries }: { day: string; kcal: number; entries: number }) {
  const [open, setOpen] = useState(false);
  return (
    <li>
      <button onClick={() => setOpen((o) => !o)} className="w-full flex justify-between items-center text-sm py-1">
        <span className="flex items-center gap-1">
          <ChevronDown size={14} style={{ transform: open ? 'rotate(180deg)' : 'none', transition: 'transform .2s', color: C.slate }} /> {day}
        </span>
        <span className="tabular-nums" style={{ color: C.slate }}>{kcal} kcal · {entries} item(ns)</span>
      </button>
      {open && <DayEntries day={day} />}
    </li>
  );
}

function DayEntries({ day }: { day: string }) {
  const { rows, remove, update } = useTodayEntries(day);
  if (rows.length === 0) return <p className="text-xs py-2 pl-5" style={{ color: C.slate }}>Sem itens.</p>;
  return (
    <ul className="space-y-2 py-2 pl-5">
      {rows.map((r) => (
        <li key={r.id} className="flex items-center gap-2 text-sm">
          <span className="flex-1 truncate">{r.name}</span>
          <input type="number" value={r.grams} onChange={(e) => update(r.id, Math.max(0, Number(e.target.value)))}
            className="w-16 text-right px-2 py-1 rounded-lg outline-none" style={{ background: '#F1F6F6', color: C.ink }} />
          <span className="text-xs" style={{ color: C.slate }}>g</span>
          <span className="text-xs tabular-nums w-14 text-right" style={{ color: C.slate }}>{r.kcal} kcal</span>
          <button onClick={() => remove(r.id)} style={{ color: C.slate }}><X size={15} /></button>
        </li>
      ))}
    </ul>
  );
}
