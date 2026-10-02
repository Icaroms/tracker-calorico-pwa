/**
 * avoidRules.ts
 * -------------
 * Camada 1 (regras, offline, grátis) — duas partes da "IA em 3 partes"
 * pedidas pelo usuário:
 *   1. avoidByLimit(): o que evitar HOJE, baseado nos limites (gordura
 *      saturada, sódio) já perto/acima do teto.
 *   2. timingCautions(): o que evitar por HORÁRIO, baseado no que já foi
 *      registrado hoje e a que hora (cafeína à noite, açúcar de manhã).
 *
 * (A 3ª parte, "sugestão de próximo alimento", já existia em
 * mealSuggester.ts — não duplicada aqui.)
 *
 * Regras estáticas, não é IA de verdade — determinístico e auditável, roda
 * 100% local, igual ao resto da Camada 1.
 */
import { NUTRIENT_LABELS, type NutrientProgress, type NutrientKey } from './dailyTotals';

const label = (k: NutrientKey) => NUTRIENT_LABELS[k] ?? k;

export interface AvoidTip { key?: NutrientKey; level: 'warn' | 'alert'; message: string; }

/** Categorias de alimento associadas a cada limite — exemplos concretos, não genéricos. */
const AVOID_CATEGORIES: Partial<Record<NutrientKey, string[]>> = {
  saturatedFat: ['frituras', 'queijos amarelos gordurosos', 'carnes gordas ou processadas'],
  sodium: ['embutidos (presunto, salsicha, linguiça)', 'salgadinhos industrializados', 'temperos prontos e caldo em cubo'],
};

const NEAR_LIMIT_THRESHOLD = 70; // % do limite a partir do qual já vale avisar, não só quando estoura

/** O que evitar hoje, baseado nos limites (direction='max') já perto/acima do teto. */
export function avoidByLimit(progress: NutrientProgress[], kcalConsumed: number, kcalTarget: number): AvoidTip[] {
  const tips: AvoidTip[] = [];
  const maxs = progress.filter((p) => p.direction === 'max' && p.hasData);

  for (const p of maxs) {
    if (p.percent < NEAR_LIMIT_THRESHOLD) continue;
    const cats = AVOID_CATEGORIES[p.key];
    const catText = cats ? ` Ex.: ${cats.join(', ')}.` : '';
    const verb = p.status === 'over' ? 'Já passou do limite de' : 'Está perto do limite de';
    tips.push({
      key: p.key,
      level: p.status === 'over' ? 'alert' : 'warn',
      message: `${verb} ${label(p.key)} hoje (${p.percent}%).${catText}`,
    });
  }

  // Calorias apertadas → evitar "caloria vazia" (não depende de rastrear
  // açúcar, que o app ainda não mede — usa o que já sabemos: kcal restante).
  const remaining = kcalTarget - kcalConsumed;
  if (kcalTarget > 0 && remaining >= 0 && remaining / kcalTarget < 0.15) {
    tips.push({
      level: 'warn',
      message: `Restam só ${Math.round(remaining)} kcal hoje — dá pra evitar refrigerante, doces e frituras, que gastam a caloria rápido sem render muito.`,
    });
  }

  return tips;
}

// ── Evitar por horário ──────────────────────────────────────────────────────

export interface TimedEntry { name: string; hour: number; }
export interface TimingCaution { message: string; }

const norm = (s: string) => s.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();

// Palavras-chave batem no nome do alimento já normalizado (sem acento).
// 'cha, mate'/'cha, preto' (com vírgula) evita falso positivo com chá de
// ervas sem cafeína (ex.: "Chá, erva-doce, infusão" não deve disparar).
const CAFFEINE_KEYWORDS = ['cafe', 'cha, mate', 'cha, preto', 'guarana', 'energetico'];
const MORNING_SUGAR_KEYWORDS = ['refrigerante', 'achocolatado'];

/**
 * Avalia o que já foi registrado hoje (nome + hora real do registro) contra
 * padrões de horário problemáticos. Só dispara pra alimentos DE FATO
 * registrados — não é aviso genérico solto, é sobre o que a pessoa comeu.
 */
export function timingCautions(entries: TimedEntry[]): TimingCaution[] {
  const messages = new Set<string>();

  for (const e of entries) {
    const n = norm(e.name);
    if (e.hour >= 18 && CAFFEINE_KEYWORDS.some((k) => n.includes(k))) {
      messages.add('Cafeína à noite pode atrapalhar o sono — evite café, chá mate/preto, guaraná ou energético a partir do fim da tarde.');
    }
    if (e.hour < 10 && MORNING_SUGAR_KEYWORDS.some((k) => n.includes(k))) {
      messages.add('Açúcar logo de manhã, em jejum, dá um pico de glicose seguido de queda — se for consumir refrigerante ou achocolatado, prefira mais tarde.');
    }
  }

  return [...messages].map((message) => ({ message }));
}
