/**
 * openFoodFacts.ts
 * ----------------
 * Busca um produto pelo código de barras no Open Food Facts (base aberta,
 * gratuita, sem chave) e mapeia os nutrientes por 100 g para o nosso formato.
 *
 * Requer internet. Muitos produtos têm dados incompletos — preenchemos o que
 * existe; o que falta fica ausente (não zero).
 */
import type { LactoseLevel } from './referenceData';

export interface OffFood {
  barcode: string;
  name: string;
  per100g: Record<string, number>;
  lactoseLevel: LactoseLevel;
}

/** Mapeia um produto do Open Food Facts para o nosso formato (puro/testável). */
export function mapOffProduct(barcode: string, product: any): OffFood | null {
  const n = product?.nutriments ?? {};
  const per100g: Record<string, number> = {};
  const setIf = (key: string, val: unknown, factor = 1) => {
    if (typeof val === 'number' && Number.isFinite(val)) per100g[key] = Number((val * factor).toFixed(3));
  };

  setIf('kcal', n['energy-kcal_100g']);
  setIf('protein', n['proteins_100g']);
  setIf('carb', n['carbohydrates_100g']);
  setIf('fat', n['fat_100g']);
  setIf('saturatedFat', n['saturated-fat_100g']);
  // minerais/vitaminas vêm em gramas no OFF → convertendo p/ mg
  setIf('calcium', n['calcium_100g'], 1000);
  setIf('iron', n['iron_100g'], 1000);
  setIf('magnesium', n['magnesium_100g'], 1000);
  setIf('potassium', n['potassium_100g'], 1000);
  setIf('vitaminC', n['vitamin-c_100g'], 1000);

  // sem nenhum dado útil → trata como não encontrado
  if (per100g.kcal == null && per100g.protein == null) return null;

  const name = product.product_name_pt || product.product_name || product.generic_name || `Produto ${barcode}`;

  const milkHint = `${(product.allergens_tags ?? []).join(',')} ${product.ingredients_text ?? ''}`;
  const lactoseLevel: LactoseLevel = /milk|lactose|leite/i.test(milkHint) ? 'moderate' : 'none';

  return { barcode, name, per100g, lactoseLevel };
}

const FIELDS = 'product_name,product_name_pt,generic_name,nutriments,allergens_tags,ingredients_text';

export async function fetchOffProduct(barcode: string): Promise<OffFood | null> {
  const url = `https://world.openfoodfacts.org/api/v2/product/${encodeURIComponent(barcode)}.json?fields=${FIELDS}`;
  const res = await fetch(url, { headers: { Accept: 'application/json' } });
  if (!res.ok) return null;
  const data = await res.json();
  if (!data?.product) return null;
  return mapOffProduct(barcode, data.product);
}
