/**
 * seed.ts
 * -------
 * Popula apenas dados NÃO pessoais (metas padrão + receita de exemplo),
 * de forma idempotente. O perfil e o peso agora vêm do ONBOARDING, não daqui.
 */
import { db } from './lib/db';

export async function seedDefaults(): Promise<void> {
  // Metas padrão (placeholders — o usuário personaliza em Ajustes). 'max' = limite.
  if ((await db.goals.count()) === 0) {
    await db.goals.bulkPut([
      { key: 'protein', target: 128, unit: 'g', direction: 'min' },
      { key: 'fiberSoluble', target: 25, unit: 'g', direction: 'min' },
      { key: 'omega3', target: 1.6, unit: 'g', direction: 'min' },
      { key: 'calcium', target: 1000, unit: 'mg', direction: 'min' },
      { key: 'magnesium', target: 400, unit: 'mg', direction: 'min' },
      { key: 'iron', target: 14, unit: 'mg', direction: 'min' },
      { key: 'potassium', target: 3500, unit: 'mg', direction: 'min' },
      { key: 'selenium', target: 55, unit: 'mcg', direction: 'min' },
      { key: 'vitaminA', target: 900, unit: 'mcg', direction: 'min' },
      { key: 'vitaminC', target: 90, unit: 'mg', direction: 'min' },
      { key: 'vitaminB12', target: 2.4, unit: 'mcg', direction: 'min' },
      { key: 'vitaminD', target: 15, unit: 'mcg', direction: 'min' },
      { key: 'saturatedFat', target: 20, unit: 'g', direction: 'max' },
    ]);
  }

  if (!(await db.recipes.get('recipe:almoco-padrao'))) {
    await db.recipes.put({
      id: 'recipe:almoco-padrao',
      name: 'Almoço padrão (frango, feijão, couve)',
      ingredients: [
        { foodId: 'frango-peito', grams: 150 },
        { foodId: 'feijao-carioca', grams: 150 },
        { foodId: 'couve', grams: 80 },
      ],
    });
  }
}
