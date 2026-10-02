/**
 * openFoodFacts.ts
 * ----------------
 * Busca um produto pelo código de barras no Open Food Facts (base aberta,
 * gratuita, sem chave) e mapeia os nutrientes por 100 g para o nosso formato.
 *
 * Requer internet. Muitos produtos têm dados incompletos — preenchemos o que
 * existe; o que falta fica ausente (não zero), igual ao resto do app.
 */
import type { LactoseLevel } from './referenceData';

export interface OffFood {
  barcode: string;
  /** Id estável pro alimento salvo: derivado do código de barras, não do nome (ver offFoodId). */
  id: string;
  name: string;
  brand?: string;
  per100g: Record<string, number>;
  lactoseLevel: LactoseLevel;
}

/**
 * Id do alimento salvo a partir do código de barras. Antes era derivado do
 * NOME do produto — dois produtos com o mesmo nome (ou um alimento próprio
 * do usuário com o mesmo nome) se sobrescreviam, e como os registros
 * antigos apontam pro id, a nutrição do histórico mudava retroativamente.
 */
export const offFoodId = (barcode: string) => `off:${barcode}`;

/** Formato mínimo que usamos da resposta da API — o resto é ignorado. */
export interface OffProduct {
  product_name?: string;
  product_name_pt?: string;
  generic_name?: string;
  brands?: string;
  nutriments?: Record<string, unknown>;
  allergens_tags?: string[];
  ingredients_text?: string;
}

const KJ_PER_KCAL = 4.184;
/** Sal = sódio × 2,5 (convenção usada em rotulagem nutricional). */
const SALT_TO_SODIUM = 1 / 2.5;

const num = (v: unknown): number | undefined =>
  typeof v === 'number' && Number.isFinite(v) ? v : undefined;

/** Mapeia um produto do Open Food Facts para o nosso formato (puro/testável). */
export function mapOffProduct(barcode: string, product: OffProduct): OffFood | null {
  const n = product.nutriments ?? {};
  const per100g: Record<string, number> = {};
  const set = (key: string, val: number | undefined, factor = 1) => {
    if (val != null) per100g[key] = Number((val * factor).toFixed(3));
  };

  // Energia: preferir kcal; se o rótulo só tiver kJ (comum em importados), converter.
  const kcal = num(n['energy-kcal_100g']);
  const kj = num(n['energy-kj_100g']) ?? num(n['energy_100g']); // energy_100g do OFF é em kJ
  set('kcal', kcal ?? (kj != null ? kj / KJ_PER_KCAL : undefined));

  set('protein', num(n['proteins_100g']));
  set('carb', num(n['carbohydrates_100g']));
  set('fat', num(n['fat_100g']));
  set('saturatedFat', num(n['saturated-fat_100g']));

  // OFF guarda minerais/vitaminas em GRAMAS → convertendo pra mg.
  // Sódio: alimento industrializado é a maior fonte — se só tiver sal, deriva.
  const salt = num(n['salt_100g']);
  const sodiumG = num(n['sodium_100g']) ?? (salt != null ? salt * SALT_TO_SODIUM : undefined);
  set('sodium', sodiumG, 1000);
  set('calcium', num(n['calcium_100g']), 1000);
  set('iron', num(n['iron_100g']), 1000);
  set('magnesium', num(n['magnesium_100g']), 1000);
  set('potassium', num(n['potassium_100g']), 1000);
  set('vitaminC', num(n['vitamin-c_100g']), 1000);
  // fiber_100g do OFF é fibra TOTAL — o app rastreia fibra SOLÚVEL. Não
  // mapeado de propósito: seria um número com o significado errado.

  // Sem calorias nem proteína, o produto não serve pra registro — trata como não encontrado.
  if (per100g.kcal == null && per100g.protein == null) return null;

  const name = (product.product_name_pt || product.product_name || product.generic_name || '').trim() || `Produto ${barcode}`;
  const brand = product.brands?.split(',')[0]?.trim() || undefined;

  const milkHint = `${(product.allergens_tags ?? []).join(',')} ${product.ingredients_text ?? ''}`;
  const lactoseLevel: LactoseLevel = /milk|lactose|leite/i.test(milkHint) ? 'moderate' : 'none';

  return { barcode, id: offFoodId(barcode), name, brand, per100g, lactoseLevel };
}

const FIELDS = 'product_name,product_name_pt,generic_name,brands,nutriments,allergens_tags,ingredients_text';
const TIMEOUT_MS = 10_000;

/**
 * Busca o produto. Retorna null se não existe na base (ou existe sem dados
 * úteis). Lança erro se for problema de rede/timeout — a UI diferencia os
 * dois casos ("não encontrado" vs "sem internet").
 */
export async function fetchOffProduct(barcode: string): Promise<OffFood | null> {
  const url = `https://world.openfoodfacts.org/api/v2/product/${encodeURIComponent(barcode)}.json?fields=${FIELDS}`;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
  try {
    const res = await fetch(url, { headers: { Accept: 'application/json' }, signal: controller.signal });
    if (res.status === 404) return null;
    if (!res.ok) throw new Error(`Open Food Facts respondeu ${res.status}`);
    const data = (await res.json()) as { product?: OffProduct };
    return data.product ? mapOffProduct(barcode, data.product) : null;
  } finally {
    clearTimeout(timer);
  }
}
