/**
 * nutrientSourceMeta.ts
 * ---------------------
 * Dado puro (sem React) que alimenta o badge de "fonte/confiança do
 * nutriente" na UI: label + cor por NutrientSource, e unidade por
 * NutrientKey para exibir "12.3 mg" em vez de só "12.3".
 */
import type { NutrientKey } from './dailyTotals';
import type { NutrientSource } from './mergeFoodData';

export interface SourceMeta {
  label: string;
  short: string;
  color: string;
  bg: string;
  /** Fontes 'deduced' merecem um aviso extra — é estimativa, não medição. */
  isEstimate: boolean;
}

export const SOURCE_META: Record<NutrientSource, SourceMeta> = {
  taco: { label: 'TACO (NEPA/UNICAMP)', short: 'TACO', color: '#0E7C7B', bg: '#E3F2F1', isEstimate: false },
  usda: { label: 'USDA FoodData Central', short: 'USDA', color: '#2B5FA8', bg: '#E7EEF9', isEstimate: false },
  tbca: { label: 'TBCA (USP)', short: 'TBCA', color: '#7A4FA8', bg: '#F0E9F9', isEstimate: false },
  manual: { label: 'Curadoria manual', short: 'Manual', color: '#6B7E84', bg: '#EEF2F2', isEstimate: false },
  deduced: { label: 'Estimado — sem medição direta', short: 'Estimado', color: '#B8720A', bg: '#FBF0DC', isEstimate: true },
};

export const NUTRIENT_UNITS: Record<NutrientKey, string> = {
  kcal: 'kcal', protein: 'g', carb: 'g', fat: 'g', saturatedFat: 'g',
  fiberSoluble: 'g', omega3: 'g', calcium: 'mg', magnesium: 'mg', iron: 'mg',
  potassium: 'mg', sodium: 'mg', selenium: 'mcg', vitaminA: 'mcg', vitaminC: 'mg',
  vitaminB1: 'mg', vitaminB2: 'mg', vitaminB3: 'mg', vitaminB5: 'mg',
  vitaminB6: 'mg', vitaminB7: 'mcg', vitaminB9: 'mcg', vitaminB12: 'mcg',
  vitaminD: 'mcg',
};
