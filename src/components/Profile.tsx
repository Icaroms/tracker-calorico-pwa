import React, { useState, useEffect } from 'react';
import { Save, Trash2 } from 'lucide-react';
import { useProfile, useSaveProfile, useDailyPlan, useWeightLogs } from '../hooks/useTracker';
import type { ActivityLevel, Sex } from '../lib/calorieEngine';
import type { WeightLog } from '../lib/db';
import { useTheme } from '../theme';

const ACTIVITIES: { v: ActivityLevel; label: string }[] = [
  { v: 'sedentary', label: 'Sedentário' }, { v: 'light', label: 'Leve' },
  { v: 'moderate', label: 'Moderado' }, { v: 'active', label: 'Ativo' }, { v: 'veryActive', label: 'Muito ativo' },
];

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  const C = useTheme();
  return (
    <label className="block">
      <span className="text-xs" style={{ color: C.slate }}>{label}</span>
      <div className="mt-1">{children}</div>
    </label>
  );
}

const inputCls = 'w-full text-sm px-3 py-2 rounded-lg outline-none';

export default function Profile() {
  const C = useTheme();
  const inputStyle = { background: C.chipBg, color: C.ink };
  const profile = useProfile();
  const save = useSaveProfile();
  const plan = useDailyPlan();

  const [form, setForm] = useState({
    heightCm: 178, age: 25, sex: 'male' as Sex, activityLevel: 'moderate' as ActivityLevel,
    deficit: 400, proteinPerKg: 1.6,
    weightKg: 80, bodyFatPercent: '' as number | '', waistCm: '' as number | '', hipCm: '' as number | '',
  });
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    if (profile) setForm((f) => ({ ...f, heightCm: profile.heightCm, age: profile.age, sex: profile.sex, activityLevel: profile.activityLevel, deficit: profile.deficit, proteinPerKg: profile.proteinPerKg ?? 1.6 }));
  }, [profile]);

  const num = (v: number | '') => (v === '' ? undefined : Number(v));

  const onSave = async () => {
    await save(
      { heightCm: Number(form.heightCm), age: Number(form.age), sex: form.sex, activityLevel: form.activityLevel, deficit: Number(form.deficit), proteinPerKg: Number(form.proteinPerKg) },
      { weightKg: Number(form.weightKg), bodyFatPercent: num(form.bodyFatPercent), waistCm: num(form.waistCm), hipCm: num(form.hipCm) },
    );
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  };

  const set = (k: string, v: unknown) => setForm((f) => ({ ...f, [k]: v }));

  return (
    <div style={{ color: C.ink }}>
      <div className="rounded-2xl p-4 mb-4" style={{ background: C.card }}>
        <h2 className="text-sm mb-3" style={{ color: C.slate }}>Você</h2>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Altura (cm)"><input className={inputCls} style={inputStyle} type="number" value={form.heightCm} onChange={(e) => set('heightCm', e.target.value)} /></Field>
          <Field label="Idade"><input className={inputCls} style={inputStyle} type="number" value={form.age} onChange={(e) => set('age', e.target.value)} /></Field>
          <Field label="Sexo">
            <select className={inputCls} style={inputStyle} value={form.sex} onChange={(e) => set('sex', e.target.value)}>
              <option value="male">Masculino</option><option value="female">Feminino</option>
            </select>
          </Field>
          <Field label="Atividade">
            <select className={inputCls} style={inputStyle} value={form.activityLevel} onChange={(e) => set('activityLevel', e.target.value)}>
              {ACTIVITIES.map((a) => <option key={a.v} value={a.v}>{a.label}</option>)}
            </select>
          </Field>
          <Field label="Déficit (kcal/dia)"><input className={inputCls} style={inputStyle} type="number" value={form.deficit} onChange={(e) => set('deficit', e.target.value)} /></Field>
          <Field label="Proteína (g/kg)"><input className={inputCls} style={inputStyle} type="number" step="0.1" value={form.proteinPerKg} onChange={(e) => set('proteinPerKg', e.target.value)} /></Field>
        </div>
      </div>

      <div className="rounded-2xl p-4 mb-4" style={{ background: C.card }}>
        <h2 className="text-sm mb-3" style={{ color: C.slate }}>Peso e medidas de hoje</h2>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Peso (kg)"><input className={inputCls} style={inputStyle} type="number" step="0.1" value={form.weightKg} onChange={(e) => set('weightKg', e.target.value)} /></Field>
          <Field label="% gordura (opcional)"><input className={inputCls} style={inputStyle} type="number" step="0.1" value={form.bodyFatPercent} onChange={(e) => set('bodyFatPercent', e.target.value === '' ? '' : Number(e.target.value))} /></Field>
          <Field label="Cintura (cm, opc.)"><input className={inputCls} style={inputStyle} type="number" value={form.waistCm} onChange={(e) => set('waistCm', e.target.value === '' ? '' : Number(e.target.value))} /></Field>
          <Field label="Quadril (cm, opc.)"><input className={inputCls} style={inputStyle} type="number" value={form.hipCm} onChange={(e) => set('hipCm', e.target.value === '' ? '' : Number(e.target.value))} /></Field>
        </div>
        <button onClick={onSave} className="mt-4 w-full flex items-center justify-center gap-2 text-sm py-2.5 rounded-xl text-white" style={{ background: saved ? C.green : C.teal }}>
          <Save size={15} /> {saved ? 'Salvo!' : 'Salvar'}
        </button>
        <p className="text-[11px] mt-2" style={{ color: C.slate }}>Informar o % de gordura troca o cálculo para Katch-McArdle (mais preciso). Registrar peso novo move sua média e dispara o aviso de recálculo.</p>
      </div>

      {/* Efeito imediato no plano */}
      {plan && (
        <div className="rounded-2xl p-4" style={{ background: C.card }}>
          <h2 className="text-sm mb-3" style={{ color: C.slate }}>Suas metas calculadas</h2>
          <div className="grid grid-cols-2 gap-y-2 text-sm">
            <span style={{ color: C.slate }}>Método</span><span className="text-right">{plan.plan.bmrMethod === 'katch-mcardle' ? 'Katch-McArdle' : 'Mifflin-St Jeor'}</span>
            <span style={{ color: C.slate }}>TDEE</span><span className="text-right tabular-nums">{plan.plan.tdee} kcal</span>
            <span style={{ color: C.slate }}>Meta calórica</span><span className="text-right tabular-nums">{plan.plan.calories.target} kcal</span>
            <span style={{ color: C.slate }}>Proteína</span><span className="text-right tabular-nums">{plan.plan.macros.protein} g</span>
            <span style={{ color: C.slate }}>Água</span><span className="text-right tabular-nums">{plan.plan.waterMl} ml</span>
            {plan.plan.cardio && (<><span style={{ color: C.slate }}>Cintura/quadril</span><span className="text-right tabular-nums">{plan.plan.cardio.ratio} ({plan.plan.cardio.risk})</span></>)}
          </div>
          {plan.plan.calories.clampedToFloor && <p className="text-[11px] mt-2" style={{ color: C.coral }}>⚠ A meta bateu no piso de segurança — o déficit foi reduzido.</p>}
        </div>
      )}

      <WeightHistory />
    </div>
  );
}

function WeightHistory() {
  const C = useTheme();
  const { logs, update, remove } = useWeightLogs();
  if (logs.length === 0) return null;
  return (
    <div className="rounded-2xl p-4 mt-4" style={{ background: C.card }}>
      <h2 className="text-sm mb-3" style={{ color: C.slate }}>Histórico de peso</h2>
      <ul className="space-y-2">
        {logs.slice(0, 30).map((w) => <WeightRow key={w.id} log={w} onUpdate={update} onRemove={remove} />)}
      </ul>
    </div>
  );
}

function WeightRow({ log, onUpdate, onRemove }: { log: WeightLog; onUpdate: (id: number, c: Partial<WeightLog>) => void; onRemove: (id: number) => void }) {
  const C = useTheme();
  const inputStyle = { background: C.chipBg, color: C.ink };
  const [val, setVal] = useState(String(log.weightKg));
  const commit = () => {
    const n = Number(val);
    if (Number.isFinite(n) && n > 0 && n !== log.weightKg) onUpdate(log.id!, { weightKg: n });
  };
  return (
    <li className="flex items-center justify-between text-sm">
      <span style={{ color: C.slate }}>{log.day}</span>
      <div className="flex items-center gap-2">
        <input type="number" step="0.1" value={val} onChange={(e) => setVal(e.target.value)} onBlur={commit}
          className="w-20 text-right px-2 py-1 rounded-lg outline-none" style={inputStyle} />
        <span className="text-xs" style={{ color: C.slate }}>kg</span>
        <button onClick={() => onRemove(log.id!)} style={{ color: C.slate }}><Trash2 size={14} /></button>
      </div>
    </li>
  );
}
