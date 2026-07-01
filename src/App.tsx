import React, { useEffect, useState, lazy, Suspense } from 'react';
import { Home, PlusCircle, BarChart3, User, Settings as SettingsIcon } from 'lucide-react';
import Dashboard from './components/Dashboard';
import AnalysisPanel from './components/AnalysisPanel';
import LogFood from './components/LogFood'; // crítica/primária: NÃO fica em lazy
const History = lazy(() => import('./components/History'));
const Profile = lazy(() => import('./components/Profile'));
const Settings = lazy(() => import('./components/Settings'));
import ErrorBoundary from './components/ErrorBoundary';
import { useDashboardData, useLogFood } from './hooks/useTracker';
import { useDailyAnalysis } from './hooks/useAnalysis';
import { seedDefaults } from './seed';
import Onboarding from './components/Onboarding';
import { db } from './lib/db';
import { downloadSpreadsheet } from './lib/spreadsheetExport';
import type { MealOption } from './lib/mealSuggester';
import type { AnalysisInput } from './lib/nutritionAnalyst';

const C = { ink: '#0F2A33', card: '#FFFFFF', slate: '#6B7E84', teal: '#0E7C7B', line: '#DCE5E6' };

type Tab = 'hoje' | 'registrar' | 'historico' | 'perfil' | 'ajustes';
const TABS: { id: Tab; label: string; icon: React.ReactNode }[] = [
  { id: 'hoje', label: 'Hoje', icon: <Home size={18} /> },
  { id: 'registrar', label: 'Registrar', icon: <PlusCircle size={18} /> },
  { id: 'historico', label: 'Histórico', icon: <BarChart3 size={18} /> },
  { id: 'perfil', label: 'Perfil', icon: <User size={18} /> },
  { id: 'ajustes', label: 'Ajustes', icon: <SettingsIcon size={18} /> },
];

function Today() {
  const data = useDashboardData({ pangastrite: true, maxLactose: 'low' });
  const logFood = useLogFood();
  const geminiApiKey = typeof localStorage !== 'undefined' ? localStorage.getItem('geminiApiKey') ?? undefined : undefined;

  const analysisInput: AnalysisInput | undefined = data.plan
    ? { progress: data.progress, kcalConsumed: data.kcalConsumed, kcalTarget: data.plan.calories.target, fastingAdvice: data.fasting.advice as 'ok' | 'cautela' | 'evitar' }
    : undefined;
  const analysis = useDailyAnalysis(analysisInput, { geminiApiKey });

  const onPick = (s: MealOption) => s.foods.forEach((f) => logFood(f.id, 'almoco', f.grams));

  if (!data.ready || !data.plan) return <div style={{ padding: 24, color: C.slate }}>Carregando…</div>;
  return (
    <>
      <Dashboard
        plan={data.plan} kcalConsumed={data.kcalConsumed} progress={data.progress}
        waterMl={data.waterMl} onAddWater={data.addWater} weight={data.weight}
        suggestions={data.suggestions} fasting={data.fasting} recalcRecommended={data.recalcRecommended}
        onPickSuggestion={onPick} onExportXlsx={() => downloadSpreadsheet('meu-tracker.xlsx')}
      />
      {analysis && <AnalysisPanel analysis={analysis} hasKey={!!geminiApiKey} />}
    </>
  );
}

export default function App() {
  const [profileExists, setProfileExists] = useState<boolean | null>(null);
  const [tab, setTab] = useState<Tab>('hoje');
  useEffect(() => {
    (async () => {
      await seedDefaults();
      setProfileExists(!!(await db.profile.get(1)));
    })().catch(console.error);
  }, []);

  if (profileExists === null) return <div style={{ padding: 24, fontFamily: 'system-ui' }}>Carregando…</div>;
  if (!profileExists) return <Onboarding onDone={() => setProfileExists(true)} />;

  return (
    <div style={{ maxWidth: 900, margin: '0 auto', padding: 16, paddingBottom: 88 }}>
      <ErrorBoundary>
        <Suspense fallback={<div style={{ padding: 24, color: '#6B7E84' }}>Carregando…</div>}>
          {tab === 'hoje' && <Today />}
          {tab === 'registrar' && <LogFood />}
          {tab === 'historico' && <History />}
          {tab === 'perfil' && <Profile />}
          {tab === 'ajustes' && <Settings />}
        </Suspense>
      </ErrorBoundary>

      {/* Barra de navegação fixa */}
      <nav style={{ background: C.card, borderTop: `1px solid ${C.line}` }}
        className="fixed bottom-0 left-0 right-0 flex justify-around py-2">
        {TABS.map((t) => (
          <button key={t.id} onClick={() => setTab(t.id)} className="flex flex-col items-center gap-0.5 px-4 py-1"
            style={{ color: tab === t.id ? C.teal : C.slate }}>
            {t.icon}<span className="text-[11px]">{t.label}</span>
          </button>
        ))}
      </nav>
    </div>
  );
}
