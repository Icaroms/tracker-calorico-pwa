/**
 * theme.tsx
 * ---------
 * Modo escuro. O app inteiro já seguia um padrão consistente: cada
 * componente define `const C = { ink, card, slate, ... }` com hex fixos e
 * usa via style inline (não Tailwind dark:, não CSS custom properties).
 *
 * Pra não reescrever a forma de estilizar em 14 arquivos, a solução troca
 * SÓ a origem da paleta: `const C = { ink: '#...', ... }` (fixo) vira
 * `const C = useTheme()` (dinâmico, mesma forma de objeto). Cada
 * componente continua igual — `style={{ color: C.ink }}` etc.
 *
 * Preferência salva em localStorage; 'system' acompanha
 * prefers-color-scheme e reage a mudança em tempo real.
 */
import React, { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';

export interface Palette {
  ink: string; bg: string; card: string; slate: string; line: string;
  teal: string; green: string; amber: string; coral: string;
  // Aliases usados em alguns componentes (mesmo valor de green/amber/coral,
  // nomeados por semântica de status em vez de cor) — evita precisar
  // renomear chave por chave em cada arquivo.
  good: string; warn: string; alert: string;
  /** Fundo de input/chip (mais claro que `card` no claro, mais claro que `bg` no escuro). */
  chipBg: string;
  /** Fundos suaves pra badges/avisos (ex.: "+294 kcal de exercício"). */
  tintGreen: string; tintAmber: string; tintTeal: string;
}

const LIGHT: Palette = {
  ink: '#0F2A33', bg: '#EEF3F4', card: '#FFFFFF', slate: '#6B7E84', line: '#DCE5E6',
  teal: '#0E7C7B', green: '#2BA84A', amber: '#E8A33D', coral: '#E0613E',
  good: '#2BA84A', warn: '#E8A33D', alert: '#E0613E',
  chipBg: '#F1F6F6',
  tintGreen: '#E4F1E8', tintAmber: '#FBF0DC', tintTeal: '#EEF2F2',
};

// Não é o claro invertido — mantém a identidade teal da marca (fundo
// teal-carvão profundo, não preto puro), com acentos levemente clareados
// pra manter contraste/legibilidade em fundo escuro.
const DARK: Palette = {
  ink: '#E7F0EF', bg: '#0D1A1C', card: '#142426', slate: '#87A0A3', line: '#22383A',
  teal: '#35BDB0', green: '#3FC26A', amber: '#F0B24E', coral: '#EC7E5E',
  good: '#3FC26A', warn: '#F0B24E', alert: '#EC7E5E',
  chipBg: '#1A2C2E',
  tintGreen: '#15291C', tintAmber: '#2E2311', tintTeal: '#17282A',
};

export type ThemeMode = 'light' | 'dark' | 'system';
const STORAGE_KEY = 'themeMode';

interface ThemeCtxValue {
  palette: Palette;
  mode: ThemeMode;
  resolvedMode: 'light' | 'dark';
  setMode: (m: ThemeMode) => void;
}

export const ThemeContext = createContext<ThemeCtxValue | undefined>(undefined);

function readStoredMode(): ThemeMode {
  if (typeof localStorage === 'undefined') return 'system';
  const v = localStorage.getItem(STORAGE_KEY);
  return v === 'light' || v === 'dark' || v === 'system' ? v : 'system';
}

function systemPrefersDark(): boolean {
  return typeof window !== 'undefined' && !!window.matchMedia?.('(prefers-color-scheme: dark)').matches;
}

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [mode, setModeState] = useState<ThemeMode>(readStoredMode);
  const [systemDark, setSystemDark] = useState(systemPrefersDark);

  useEffect(() => {
    if (typeof window === 'undefined' || !window.matchMedia) return;
    const mq = window.matchMedia('(prefers-color-scheme: dark)');
    const handler = (e: MediaQueryListEvent) => setSystemDark(e.matches);
    mq.addEventListener('change', handler);
    return () => mq.removeEventListener('change', handler);
  }, []);

  const resolvedMode: 'light' | 'dark' = mode === 'system' ? (systemDark ? 'dark' : 'light') : mode;
  const palette = resolvedMode === 'dark' ? DARK : LIGHT;

  const setMode = (m: ThemeMode) => {
    setModeState(m);
    try { localStorage.setItem(STORAGE_KEY, m); } catch { /* localStorage indisponível — segue só em memória */ }
  };

  // Sincroniza o <body> (fora da árvore React) pra não sobrar uma faixa
  // clara/escura ao redor do conteúdo, e evita flash claro→escuro visível.
  useEffect(() => {
    if (typeof document !== 'undefined') document.body.style.background = palette.bg;
  }, [palette.bg]);

  const value = useMemo(() => ({ palette, mode, resolvedMode, setMode }), [palette, mode, resolvedMode]);
  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

/** Uso: `const C = useTheme();` — mesma forma que o antigo `const C = {...}` local. */
export function useTheme(): Palette {
  const ctx = useContext(ThemeContext);
  if (!ctx) throw new Error('useTheme() precisa estar dentro de <ThemeProvider>');
  return ctx.palette;
}

/** Pro seletor de tema em Ajustes (precisa do modo bruto, não só a paleta resolvida). */
export function useThemeMode() {
  const ctx = useContext(ThemeContext);
  if (!ctx) throw new Error('useThemeMode() precisa estar dentro de <ThemeProvider>');
  return { mode: ctx.mode, resolvedMode: ctx.resolvedMode, setMode: ctx.setMode };
}
