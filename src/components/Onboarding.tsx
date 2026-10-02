import React, { useState } from 'react';
import { ArrowRight, ArrowLeft, Check } from 'lucide-react';
import { useSaveProfile } from '../hooks/useTracker';
import type { ActivityLevel, Sex } from '../lib/calorieEngine';
import { useTheme } from '../theme';

const inputCls = 'w-full text-sm px-3 py-2 rounded-lg outline-none';

const ACTIVITIES: { v: ActivityLevel; label: string }[] = [
  { v: 'sedentary', label: 'Sedentário' }, { v: 'light', label: 'Leve' },
  { v: 'moderate', label: 'Moderado' }, { v: 'active', label: 'Ativo' }, { v: 'veryActive', label: 'Muito ativo' },
];
const DEFICITS: { v: number; label: string; sub: string }[] = [
  { v: 250, label: 'Suave', sub: '-250 kcal/dia' },
  { v: 400, label: 'Moderado', sub: '-400 kcal/dia' },
  { v: 550, label: 'Acelerado', sub: '-550 kcal/dia' },
];

function Choice({ active, onClick, label, sub }: { active: boolean; onClick: () => void; label: string; sub?: string }) {
  const C = useTheme();
  return (
    <button onClick={onClick} className="px-3 py-2 rounded-xl text-sm text-left"
      style={{ background: active ? C.teal : C.chipBg, color: active ? '#fff' : C.ink, border: `1px solid ${active ? C.teal : C.line}` }}>
      <div>{label}</div>{sub && <div className="text-[11px] opacity-80">{sub}</div>}
    </button>
  );
}

export default function Onboarding({ onDone }: { onDone: () => void }) {
  const C = useTheme();
  const inputStyle = { background: C.chipBg, color: C.ink };
  const save = useSaveProfile();
  const [step, setStep] = useState(0);
  const [f, setF] = useState({
    heightCm: '' as number | '', age: '' as number | '', sex: 'male' as Sex,
    activityLevel: 'moderate' as ActivityLevel, deficit: 400, proteinPerKg: 1.6,
    weightKg: '' as number | '', bodyFatPercent: '' as number | '', waistCm: '' as number | '', hipCm: '' as number | '',
  });
  const set = (k: string, v: unknown) => setF((s) => ({ ...s, [k]: v }));
  const numOrEmpty = (v: string) => (v === '' ? '' : Number(v));
  const num = (v: number | '') => (v === '' ? undefined : Number(v));

  const step1ok = Number(f.heightCm) > 0 && Number(f.age) > 0;
  const step3ok = Number(f.weightKg) > 0;

  const finish = async () => {
    await save(
      { heightCm: Number(f.heightCm), age: Number(f.age), sex: f.sex, activityLevel: f.activityLevel, deficit: f.deficit, proteinPerKg: f.proteinPerKg },
      { weightKg: Number(f.weightKg), bodyFatPercent: num(f.bodyFatPercent), waistCm: num(f.waistCm), hipCm: num(f.hipCm) },
    );
    onDone();
  };

  return (
    <div style={{ background: C.bg, minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}>
      <div className="w-full" style={{ maxWidth: 420 }}>
        <div className="flex gap-1.5 mb-5">
          {[0, 1, 2].map((i) => (
            <div key={i} className="h-1.5 flex-1 rounded-full" style={{ background: i <= step ? C.teal : C.line }} />
          ))}
        </div>

        <div className="rounded-2xl p-5" style={{ background: C.card, color: C.ink }}>
          {step === 0 && (
            <>
              <h1 className="text-xl font-semibold mb-1">Vamos começar</h1>
              <p className="text-sm mb-4" style={{ color: C.slate }}>Seus dados ficam só no seu aparelho e servem pra calcular suas metas.</p>
              <div className="grid grid-cols-2 gap-3 mb-3">
                <label><span className="text-xs" style={{ color: C.slate }}>Altura (cm)</span>
                  <input className={inputCls + ' mt-1'} style={inputStyle} type="number" value={f.heightCm} onChange={(e) => set('heightCm', numOrEmpty(e.target.value))} /></label>
                <label><span className="text-xs" style={{ color: C.slate }}>Idade</span>
                  <input className={inputCls + ' mt-1'} style={inputStyle} type="number" value={f.age} onChange={(e) => set('age', numOrEmpty(e.target.value))} /></label>
              </div>
              <span className="text-xs" style={{ color: C.slate }}>Sexo</span>
              <div className="grid grid-cols-2 gap-2 mt-1 mb-3">
                <Choice active={f.sex === 'male'} onClick={() => set('sex', 'male')} label="Masculino" />
                <Choice active={f.sex === 'female'} onClick={() => set('sex', 'female')} label="Feminino" />
              </div>
              <span className="text-xs" style={{ color: C.slate }}>Nível de atividade</span>
              <div className="flex flex-wrap gap-2 mt-1">
                {ACTIVITIES.map((a) => <Choice key={a.v} active={f.activityLevel === a.v} onClick={() => set('activityLevel', a.v)} label={a.label} />)}
              </div>
            </>
          )}

          {step === 1 && (
            <>
              <h1 className="text-xl font-semibold mb-1">Sua meta</h1>
              <p className="text-sm mb-4" style={{ color: C.slate }}>Qual ritmo de déficit? Dá pra mudar depois em Ajustes.</p>
              <div className="grid gap-2">
                {DEFICITS.map((d) => <Choice key={d.v} active={f.deficit === d.v} onClick={() => set('deficit', d.v)} label={d.label} sub={d.sub} />)}
              </div>
              <label className="block mt-4"><span className="text-xs" style={{ color: C.slate }}>Proteína (g/kg)</span>
                <input className={inputCls + ' mt-1'} style={inputStyle} type="number" step="0.1" value={f.proteinPerKg} onChange={(e) => set('proteinPerKg', Number(e.target.value))} /></label>
            </>
          )}

          {step === 2 && (
            <>
              <h1 className="text-xl font-semibold mb-1">Peso e medidas</h1>
              <p className="text-sm mb-4" style={{ color: C.slate }}>O peso é essencial. As medidas são opcionais — o % de gordura deixa o cálculo mais preciso.</p>
              <div className="grid grid-cols-2 gap-3">
                <label><span className="text-xs" style={{ color: C.slate }}>Peso (kg)*</span>
                  <input className={inputCls + ' mt-1'} style={inputStyle} type="number" step="0.1" value={f.weightKg} onChange={(e) => set('weightKg', numOrEmpty(e.target.value))} /></label>
                <label><span className="text-xs" style={{ color: C.slate }}>% gordura</span>
                  <input className={inputCls + ' mt-1'} style={inputStyle} type="number" step="0.1" value={f.bodyFatPercent} onChange={(e) => set('bodyFatPercent', numOrEmpty(e.target.value))} /></label>
                <label><span className="text-xs" style={{ color: C.slate }}>Cintura (cm)</span>
                  <input className={inputCls + ' mt-1'} style={inputStyle} type="number" value={f.waistCm} onChange={(e) => set('waistCm', numOrEmpty(e.target.value))} /></label>
                <label><span className="text-xs" style={{ color: C.slate }}>Quadril (cm)</span>
                  <input className={inputCls + ' mt-1'} style={inputStyle} type="number" value={f.hipCm} onChange={(e) => set('hipCm', numOrEmpty(e.target.value))} /></label>
              </div>
            </>
          )}

          <div className="flex gap-2 mt-5">
            {step > 0 && (
              <button onClick={() => setStep((s) => s - 1)} className="flex items-center gap-1 text-sm py-2.5 px-4 rounded-xl" style={{ background: C.line, color: C.ink }}>
                <ArrowLeft size={15} /> Voltar
              </button>
            )}
            {step < 2 ? (
              <button onClick={() => setStep((s) => s + 1)} disabled={step === 0 && !step1ok}
                className="flex-1 flex items-center justify-center gap-1 text-sm py-2.5 rounded-xl text-white"
                style={{ background: step === 0 && !step1ok ? C.slate : C.teal }}>
                Continuar <ArrowRight size={15} />
              </button>
            ) : (
              <button onClick={finish} disabled={!step3ok}
                className="flex-1 flex items-center justify-center gap-1 text-sm py-2.5 rounded-xl text-white"
                style={{ background: step3ok ? C.green : C.slate }}>
                <Check size={15} /> Começar a usar
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
