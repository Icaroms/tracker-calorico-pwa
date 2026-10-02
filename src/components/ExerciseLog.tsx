import React, { useState } from 'react';
import { ChevronDown, Flame, Check, X } from 'lucide-react';
import { useLogExercise, useTodayExercise, useDailyPlan, EXERCISE_BASE } from '../hooks/useTracker';
import { kcalBurned } from '../lib/exerciseEngine';
import { useTheme } from '../theme';

export default function ExerciseLog() {
  const C = useTheme();
  const inputStyle = { background: C.chipBg, color: C.ink };
  const [open, setOpen] = useState(false);
  const [exerciseId, setExerciseId] = useState(EXERCISE_BASE[0].id);
  const [minutes, setMinutes] = useState(30);
  const [done, setDone] = useState(false);

  const daily = useDailyPlan();
  const doLog = useLogExercise();
  const { rows, totalKcalBurned, remove } = useTodayExercise();

  const selected = EXERCISE_BASE.find((e) => e.id === exerciseId)!;
  const preview = daily?.weightKg ? kcalBurned(selected.met, daily.weightKg, minutes) : 0;

  const onLog = async () => {
    if (minutes <= 0) return;
    await doLog(exerciseId, minutes);
    setDone(true);
    setTimeout(() => setDone(false), 1500);
  };

  return (
    <div className="rounded-2xl p-4 mb-4" style={{ background: C.card }}>
      <button onClick={() => setOpen((o) => !o)} className="w-full flex items-center justify-between text-sm" style={{ color: C.slate }}>
        <span className="flex items-center gap-2">
          <Flame size={14} style={{ color: C.amber }} /> Registrar exercício
          {totalKcalBurned > 0 && <span style={{ color: C.green }}>· {totalKcalBurned} kcal hoje</span>}
        </span>
        <ChevronDown size={16} style={{ transform: open ? 'rotate(180deg)' : 'none', transition: 'transform .2s' }} />
      </button>

      {open && (
        <div className="mt-3">
          <select value={exerciseId} onChange={(e) => setExerciseId(e.target.value)}
            className="w-full px-3 py-2 rounded-xl outline-none text-sm mb-2" style={inputStyle}>
            {EXERCISE_BASE.map((e) => <option key={e.id} value={e.id}>{e.name}</option>)}
          </select>

          <div className="flex items-center gap-2 mb-2">
            <input type="number" value={minutes} onChange={(e) => setMinutes(Math.max(0, Number(e.target.value)))}
              className="w-20 text-right px-2 py-1.5 rounded-lg outline-none text-sm" style={inputStyle} />
            <span className="text-sm" style={{ color: C.slate }}>minutos</span>
            <span className="ml-auto text-sm tabular-nums" style={{ color: C.ink }}>
              ≈ {preview} kcal
            </span>
          </div>

          <p className="text-[11px] mb-3" style={{ color: C.slate }}>
            Estimativa via MET (Compendium of Physical Activities) × seu peso atual — é uma média
            populacional, não uma medição sua. Serve de referência, não de precisão absoluta.
          </p>

          <button onClick={onLog} disabled={!daily?.weightKg}
            className="w-full py-2 rounded-xl text-sm text-white flex items-center justify-center gap-2 disabled:opacity-50"
            style={{ background: C.teal }}>
            {done ? <><Check size={14} /> Registrado</> : 'Registrar'}
          </button>

          {rows.length > 0 && (
            <div className="mt-3 space-y-1.5">
              {rows.map((r) => (
                <div key={r.id} className="flex items-center justify-between text-sm py-1.5 px-2 rounded-lg" style={{ background: C.chipBg }}>
                  <span style={{ color: C.ink }}>{r.exerciseName} · {r.minutes}min</span>
                  <div className="flex items-center gap-2">
                    <span className="tabular-nums" style={{ color: C.slate }}>{r.kcalBurned} kcal</span>
                    <button onClick={() => remove(r.id)} aria-label="Remover exercício"><X size={13} style={{ color: C.coral }} /></button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
