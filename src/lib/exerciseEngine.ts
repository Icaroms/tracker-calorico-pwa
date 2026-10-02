/**
 * exerciseEngine.ts
 * ------------------
 * Gasto calórico por exercício via MET (Metabolic Equivalent of Task) —
 * fórmula padrão da fisiologia do exercício (ACSM):
 *
 *   kcal = MET × 3.5 × peso(kg) × minutos / 200
 *
 * (equivalente a MET × peso(kg) × horas, com o fator de correção 3.5/200
 * que vem da definição de 1 MET = 3.5 mL O2/kg/min ≈ 1 kcal/kg/h)
 *
 * Valores de MET vêm do Compendium of Physical Activities (Ainsworth et
 * al.), a referência acadêmica padrão da área — não são medição própria
 * nem "chute", mas também não são específicos da pessoa: MET é uma média
 * populacional, então o kcal calculado é uma ESTIMATIVA, igual a qualquer
 * app de fitness. Isso é dito explicitamente na UI.
 */

export interface Exercise {
  id: string;
  name: string;
  met: number;
  /** Fonte do MET — sempre 'compendium' aqui, mas deixa explícito e auditável. */
  source: 'compendium';
}

/**
 * Base de exercícios. Cobre os 2 pedidos originalmente (remador, funcional)
 * mais um conjunto amplo de esportes, academia, casa e luta (ampliação
 * pedida depois). MET de "esforço moderado"/"casual" por padrão quando a
 * atividade permite faixa de intensidade.
 *
 * Fontes específicas da ampliação (todas Compendium of Physical
 * Activities, cruzadas em mais de uma fonte secundária antes de codar):
 * futebol casual=7.0, basquete=8.0, vôlei=8.0 (competitivo quadra/praia),
 * pilates=6.8, elíptico=5.0, escada=8.0, calistenia vigorosa=7.5,
 * alongamento leve=2.5, artes marciais ritmo moderado=10.3 (judô/jiu-
 * jitsu/karatê/kickboxing/taekwondo/muay thai — todas na mesma faixa de
 * MET no Compendium), ciclismo vigoroso=10.0, natação vigorosa=10.0.
 */
export const EXERCISE_BASE: Exercise[] = [
  { id: 'remador', name: 'Remador (ergômetro/magnético), esforço moderado', met: 7.0, source: 'compendium' },
  { id: 'funcional', name: 'Treino funcional / circuito, esforço vigoroso', met: 8.0, source: 'compendium' },
  { id: 'musculacao-moderada', name: 'Musculação, esforço moderado', met: 5.0, source: 'compendium' },
  { id: 'musculacao-vigorosa', name: 'Musculação, esforço vigoroso', met: 6.0, source: 'compendium' },
  { id: 'caminhada-moderada', name: 'Caminhada, ritmo moderado (~5 km/h)', met: 3.5, source: 'compendium' },
  { id: 'caminhada-rapida', name: 'Caminhada rápida (~6,5 km/h)', met: 4.3, source: 'compendium' },
  { id: 'corrida-8', name: 'Corrida, ~8 km/h', met: 8.3, source: 'compendium' },
  { id: 'corrida-10', name: 'Corrida, ~10 km/h', met: 9.8, source: 'compendium' },
  { id: 'ciclismo-moderado', name: 'Ciclismo, ritmo moderado', met: 6.8, source: 'compendium' },
  { id: 'ciclismo-vigoroso', name: 'Ciclismo, ritmo vigoroso (>22 km/h)', met: 10.0, source: 'compendium' },
  { id: 'natacao-moderada', name: 'Natação, ritmo moderado', met: 6.0, source: 'compendium' },
  { id: 'natacao-vigorosa', name: 'Natação, ritmo vigoroso (raias)', met: 10.0, source: 'compendium' },
  { id: 'pular-corda', name: 'Pular corda', met: 11.0, source: 'compendium' },
  { id: 'hiit', name: 'HIIT (intervalado de alta intensidade)', met: 8.0, source: 'compendium' },
  { id: 'yoga', name: 'Yoga', met: 2.5, source: 'compendium' },
  { id: 'danca-aerobica', name: 'Dança aeróbica', met: 6.5, source: 'compendium' },
  // Esportes (jogo recreativo/casual, não competição de alto rendimento)
  { id: 'futebol', name: 'Futebol / futebol society, casual', met: 7.0, source: 'compendium' },
  { id: 'basquete', name: 'Basquete, jogo', met: 8.0, source: 'compendium' },
  { id: 'volei', name: 'Vôlei (quadra ou praia)', met: 8.0, source: 'compendium' },
  // Academia
  { id: 'pilates', name: 'Pilates', met: 6.8, source: 'compendium' },
  { id: 'eliptico', name: 'Elíptico', met: 5.0, source: 'compendium' },
  { id: 'escada', name: 'Escada (step/stairmaster)', met: 8.0, source: 'compendium' },
  // Casa
  { id: 'calistenia', name: 'Calistenia (flexão, abdominal, barra), esforço vigoroso', met: 7.5, source: 'compendium' },
  { id: 'alongamento', name: 'Alongamento leve', met: 2.5, source: 'compendium' },
  // Luta
  { id: 'luta-artes-marciais', name: 'Artes marciais / luta, ritmo moderado (judô, jiu-jitsu, karatê, kickboxing, taekwondo, muay thai)', met: 10.3, source: 'compendium' },
];

export const exerciseById = (id: string): Exercise | undefined => EXERCISE_BASE.find((e) => e.id === id);

/** kcal gasto = MET × 3.5 × peso(kg) × minutos / 200 (fórmula ACSM). */
export function kcalBurned(met: number, weightKg: number, minutes: number): number {
  if (met <= 0 || weightKg <= 0 || minutes <= 0) return 0;
  return Math.round((met * 3.5 * weightKg * minutes) / 200);
}
