import React, { useState, useEffect } from 'react';
import { KeyRound, Download, Upload, FileSpreadsheet, Check, Sun, Moon, MonitorSmartphone } from 'lucide-react';
import { exportAll, importAll, setGoal } from '../lib/db';
import { downloadSpreadsheet } from '../lib/spreadsheetExport';
import { NUTRIENT_LABELS, type NutrientKey } from '../lib/dailyTotals';
import { useGoals } from '../hooks/useTracker';
import { useTheme, useThemeMode, type ThemeMode } from '../theme';
import { getGeminiApiKey, setGeminiApiKey, clearGeminiApiKey } from '../lib/settings';

function downloadText(text: string, filename: string, type: string) {
  const url = URL.createObjectURL(new Blob([text], { type }));
  const a = document.createElement('a');
  a.href = url; a.download = filename; a.click();
  URL.revokeObjectURL(url);
}

const THEME_OPTIONS: { v: ThemeMode; label: string; icon: React.ReactNode }[] = [
  { v: 'light', label: 'Claro', icon: <Sun size={14} /> },
  { v: 'dark', label: 'Escuro', icon: <Moon size={14} /> },
  { v: 'system', label: 'Sistema', icon: <MonitorSmartphone size={14} /> },
];

export default function Settings() {
  const C = useTheme();
  const inputStyle = { background: C.chipBg, color: C.ink };
  const { mode, setMode } = useThemeMode();
  const goals = useGoals();
  const [key, setKey] = useState('');
  const [keySaved, setKeySaved] = useState(false);
  const [restored, setRestored] = useState('');
  const [targets, setTargets] = useState<Record<string, number>>({});
  const [goalsSaved, setGoalsSaved] = useState(false);

  useEffect(() => { setKey(getGeminiApiKey() ?? ''); }, []);
  useEffect(() => {
    const t: Record<string, number> = {};
    goals.forEach((g) => { t[g.key] = g.target; });
    setTargets(t);
  }, [goals]);

  const saveKey = () => { setGeminiApiKey(key); setKeySaved(true); setTimeout(() => setKeySaved(false), 2000); };
  const clearKey = () => { clearGeminiApiKey(); setKey(''); };

  const onExportJson = async () => downloadText(await exportAll(), 'tracker-backup.json', 'application/json');
  const onImport = async (file: File) => {
    await importAll(await file.text());
    setRestored(file.name);
    setTimeout(() => setRestored(''), 3000);
  };

  const saveGoals = async () => {
    for (const g of goals) {
      const t = targets[g.key];
      if (Number.isFinite(t) && t !== g.target) await setGoal({ ...g, target: t });
    }
    setGoalsSaved(true); setTimeout(() => setGoalsSaved(false), 2000);
  };

  return (
    <div style={{ color: C.ink }}>
      {/* Aparência */}
      <div className="rounded-2xl p-4 mb-4" style={{ background: C.card }}>
        <h2 className="text-sm mb-3" style={{ color: C.slate }}>Aparência</h2>
        <div className="flex gap-2">
          {THEME_OPTIONS.map((o) => (
            <button key={o.v} onClick={() => setMode(o.v)}
              className="flex-1 flex items-center justify-center gap-1.5 text-sm py-2 rounded-xl"
              style={{ background: mode === o.v ? C.teal : C.chipBg, color: mode === o.v ? '#fff' : C.ink }}>
              {o.icon} {o.label}
            </button>
          ))}
        </div>
      </div>

      {/* Gemini */}
      <div className="rounded-2xl p-4 mb-4" style={{ background: C.card }}>
        <h2 className="flex items-center gap-2 text-sm mb-3" style={{ color: C.slate }}><KeyRound size={15} /> Análise por IA (Gemini)</h2>
        <input type="password" value={key} onChange={(e) => setKey(e.target.value)} placeholder="Cole sua chave do Google AI Studio"
          className="w-full text-sm px-3 py-2 rounded-lg outline-none" style={inputStyle} />
        <div className="flex gap-2 mt-3">
          <button onClick={saveKey} className="flex-1 text-sm py-2 rounded-xl text-white" style={{ background: keySaved ? C.green : C.teal }}>
            {keySaved ? 'Salvo!' : 'Salvar chave'}
          </button>
          <button onClick={clearKey} className="text-sm py-2 px-4 rounded-xl" style={{ background: C.line, color: C.ink }}>Limpar</button>
        </div>
        <p className="text-[11px] mt-2" style={{ color: C.slate }}>Grátis no aistudio.google.com. Só números anonimizados são enviados — nada de nome ou condição de saúde.</p>
      </div>

      {/* Backup */}
      <div className="rounded-2xl p-4 mb-4" style={{ background: C.card }}>
        <h2 className="text-sm mb-3" style={{ color: C.slate }}>Backup e exportação</h2>
        <div className="space-y-2">
          <button onClick={onExportJson} className="w-full flex items-center gap-2 text-sm py-2 px-3 rounded-xl" style={{ background: C.line, color: C.ink }}>
            <Download size={15} /> Exportar backup (JSON)
          </button>
          <label className="w-full flex items-center gap-2 text-sm py-2 px-3 rounded-xl cursor-pointer" style={{ background: C.line, color: C.ink }}>
            <Upload size={15} /> {restored ? `Restaurado: ${restored}` : 'Restaurar de um backup (JSON)'}
            <input type="file" accept="application/json" className="hidden" onChange={(e) => e.target.files?.[0] && onImport(e.target.files[0])} />
          </label>
          <button onClick={() => downloadSpreadsheet('meu-tracker.xlsx')} className="w-full flex items-center gap-2 text-sm py-2 px-3 rounded-xl" style={{ background: C.line, color: C.ink }}>
            <FileSpreadsheet size={15} /> Exportar planilha (.xlsx)
          </button>
        </div>
        <p className="text-[11px] mt-2" style={{ color: C.slate }}>O JSON restaura o app; a planilha é pra análise ou pra mostrar a um nutricionista.</p>
      </div>

      {/* Metas */}
      <div className="rounded-2xl p-4" style={{ background: C.card }}>
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-sm" style={{ color: C.slate }}>Metas diárias</h2>
          <button onClick={saveGoals} className="flex items-center gap-1 text-xs px-3 py-1.5 rounded-full text-white" style={{ background: goalsSaved ? C.green : C.teal }}>
            {goalsSaved ? <><Check size={12} /> Salvo</> : 'Salvar metas'}
          </button>
        </div>
        <div className="space-y-2">
          {goals.map((g) => (
            <div key={g.key} className="flex items-center justify-between gap-2">
              <span className="text-sm">{NUTRIENT_LABELS[g.key as NutrientKey] ?? g.key}{g.direction === 'max' ? ' (limite)' : ''}</span>
              <div className="flex items-center gap-1">
                <input type="number" value={targets[g.key] ?? ''} onChange={(e) => setTargets((t) => ({ ...t, [g.key]: Number(e.target.value) }))}
                  className="w-20 text-sm text-right px-2 py-1 rounded-lg outline-none" style={inputStyle} />
                <span className="text-xs w-8" style={{ color: C.slate }}>{g.unit}</span>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
