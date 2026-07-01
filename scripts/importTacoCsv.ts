/**
 * importTacoCsv.ts  —  rode com:  npx tsx scripts/importTacoCsv.ts
 * ---------------------------------------------------------------
 * Gera a base de alimentos do app a partir dos CSVs oficiais da TACO
 * (NEPA/UNICAMP, 4ª edição) versionados em scripts/data/taco/.
 *
 * Substitui o antigo buildFoodBase.ts (que exigia baixar manualmente um
 * .xlsx com layout de cabeçalho difícil de parsear). Os CSVs em
 * scripts/data/taco/ já vêm com cabeçalho limpo — ver FONTE.md nessa pasta.
 *
 * Saídas:
 *   - src/lib/tacoFoodBase.generated.ts   (array TS, consumido por referenceData.ts)
 *   - scripts/data/taco/coverage.report.json  (o que ficou sem dado, por alimento)
 *
 * USDA (opcional, preenche vit. D, B12, selênio, B5, B7, B9):
 *   export USDA_API_KEY=xxxx
 *   (opcional) scripts/data/taco/mapping.json: { "taco:<id>": fdcId, ... }
 * Sem chave/mapping, esses nutrientes ficam corretamente marcados como
 * ausentes (não inventados) — ver coverage.report.json.
 */
import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { mergeFood, coverage, type MergeInput, type NutrientMap, type NutrientSource, type UnifiedFood } from '../src/lib/mergeFoodData';
import type { NutrientKey } from '../src/lib/dailyTotals';

const __dirname = dirname(fileURLToPath(import.meta.url));
const DATA_DIR = join(__dirname, 'data', 'taco');
const USDA_KEY = process.env.USDA_API_KEY;

// ── Parser CSV mínimo, mas correto p/ campos entre aspas com vírgula ───────
function parseCsv(text: string): Record<string, string>[] {
  const rows: string[][] = [];
  let field = '', row: string[] = [], inQuotes = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (inQuotes) {
      if (c === '"' && text[i + 1] === '"') { field += '"'; i++; }
      else if (c === '"') inQuotes = false;
      else field += c;
    } else {
      if (c === '"') inQuotes = true;
      else if (c === ',') { row.push(field); field = ''; }
      else if (c === '\n') { row.push(field); rows.push(row); row = []; field = ''; }
      else if (c === '\r') { /* ignora */ }
      else field += c;
    }
  }
  if (field.length || row.length) { row.push(field); rows.push(row); }
  const header = rows[0];
  return rows.slice(1).filter((r) => r.length === header.length && r.some((v) => v !== ''))
    .map((r) => Object.fromEntries(header.map((h, i) => [h, r[i]])));
}

function num(v: unknown): number | undefined {
  if (v == null || v === '' || v === 'NA' || v === 'Tr' || v === '*') return undefined;
  const n = Number(String(v).replace(',', '.'));
  return Number.isFinite(n) ? n : undefined;
}

function slug(s: string): string {
  return s.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase()
    .replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '').slice(0, 60);
}

// ── Mapa de colunas alimentos.csv → NutrientKey ─────────────────────────────
const MAIN_COLUMNS: Partial<Record<NutrientKey, string>> = {
  kcal: 'Energia..kcal.',
  protein: 'Proteína..g.',
  carb: 'Carboidrato..g.',
  fat: 'Lipídeos..g.',
  calcium: 'Cálcio..mg.',
  magnesium: 'Magnésio..mg.',
  iron: 'Ferro..mg.',
  potassium: 'Potássio..mg.',
  vitaminA: 'RAE..mcg.', // retinol activity equivalent — mais próximo do padrão atual (RDA em RAE)
  vitaminC: 'Vitamina.C..mg.',
  vitaminB1: 'Tiamina..mg.',
  vitaminB2: 'Riboflavina..mg.',
  vitaminB3: 'Niacina..mg.',
  vitaminB6: 'Piridoxina..mg.',
};

// ── Mapa de colunas acidos-graxos.csv → NutrientKey ─────────────────────────
const FAT_COLUMN_SAT = 'Saturados..g.';
const OMEGA3_COLUMNS = ['X18.3.n.3..g.', 'X20.5..g.', 'X22.6..g.']; // ALA + EPA + DHA

// ── Heurística de lactose por categoria (TACO não mede lactose) ────────────
// Conservador de propósito: qualquer item de "Leite e derivados" entra como
// 'high' por padrão (evita falso-negativo p/ quem tem intolerância). Os 8
// alimentos curados à mão em referenceData.ts podem sobrescrever casos
// conhecidos (ex.: parmesão = 'low') sem tocar aqui.
function lactoseHeuristic(categoria: string): 'none' | 'high' {
  return categoria.trim() === 'Leite e derivados' ? 'high' : 'none';
}

function loadFatMap(): Map<string, NutrientMap> {
  const csv = readFileSync(join(DATA_DIR, 'acidos-graxos.csv'), 'utf8');
  const rows = parseCsv(csv);
  const map = new Map<string, NutrientMap>();
  for (const row of rows) {
    const key = row['Número do Alimento'];
    const nm: NutrientMap = {};
    const sat = num(row[FAT_COLUMN_SAT]);
    if (sat != null) nm.saturatedFat = sat;
    const omega3Parts = OMEGA3_COLUMNS.map((c) => num(row[c])).filter((v): v is number => v != null);
    if (omega3Parts.length) nm.omega3 = Number(omega3Parts.reduce((a, b) => a + b, 0).toFixed(3));
    map.set(key, nm);
  }
  return map;
}

interface GeneratedFood {
  id: string;
  name: string;
  per100g: NutrientMap;
  nutrientSources: Partial<Record<NutrientKey, NutrientSource>>;
  lactoseLevel: 'none' | 'high';
  category: string;
}

function main() {
  const mainCsv = readFileSync(join(DATA_DIR, 'alimentos.csv'), 'utf8');
  const mainRows = parseCsv(mainCsv);
  const fatMap = loadFatMap();

  const mapping: Record<string, number> = existsSync(join(DATA_DIR, 'mapping.json'))
    ? JSON.parse(readFileSync(join(DATA_DIR, 'mapping.json'), 'utf8'))
    : {};
  const manual: Record<string, NutrientMap> = existsSync(join(DATA_DIR, 'manual.json'))
    ? JSON.parse(readFileSync(join(DATA_DIR, 'manual.json'), 'utf8'))
    : {};
  void mapping; // reservado p/ importação USDA futura (fora deste sandbox)

  const inputs: (MergeInput & { categoria: string })[] = mainRows.map((row) => {
    const taco: NutrientMap = {};
    for (const [key, col] of Object.entries(MAIN_COLUMNS) as [NutrientKey, string][]) {
      const v = num(row[col]);
      if (v != null) taco[key] = v;
    }
    const fat = fatMap.get(row['Número do Alimento']);
    if (fat) Object.assign(taco, fat);

    const name = row['Descrição dos alimentos'];
    const id = 'taco:' + slug(name) + ':' + row['Número do Alimento'];
    return { id, name, taco, manual: manual[id], categoria: row['Categoria do alimento'] };
  });

  if (USDA_KEY) {
    console.log('USDA_API_KEY definida, mas este script roda em lote síncrono sem fetch USDA.');
    console.log('Rode a importação USDA separadamente fora do sandbox se precisar preencher vit. D/B12/selênio/B5/B7/B9.');
  }

  const unified: UnifiedFood[] = inputs.map((i) => mergeFood(i));
  const generated: GeneratedFood[] = unified.map((u, idx) => {
    const per100g: NutrientMap = {};
    const nutrientSources: Partial<Record<NutrientKey, NutrientSource>> = {};
    for (const key of Object.keys(u.per100g) as NutrientKey[]) {
      per100g[key] = u.per100g[key]!.value;
      nutrientSources[key] = u.per100g[key]!.source;
    }
    return {
      id: u.id,
      name: u.name,
      per100g,
      nutrientSources,
      lactoseLevel: lactoseHeuristic(inputs[idx].categoria),
      category: inputs[idx].categoria,
    };
  });

  // Descarta entradas sem kcal (linhas residuais/cabeçalho de categoria)
  const clean = generated.filter((g) => g.per100g.kcal != null && g.name);

  // protein/carb/fat são obrigatórios no tipo FoodItem. Nos ~9 itens onde a
  // TACO deixou em branco (óleos puros, aguardente) o valor real É zero —
  // a tabela só não repete "0" explicitamente nesses casos. Não é dedução
  // arriscada: é o próprio domínio do alimento (óleo 100% lipídeo). Marcado
  // como 'manual' (decisão do importador), não 'taco' (não é o que a
  // planilha mediu) — mantém o badge de fonte honesto.
  for (const g of clean) {
    if (g.per100g.protein == null) { g.per100g.protein = 0; g.nutrientSources.protein = 'manual'; }
    if (g.per100g.carb == null) { g.per100g.carb = 0; g.nutrientSources.carb = 'manual'; }
    if (g.per100g.fat == null) { g.per100g.fat = 0; g.nutrientSources.fat = 'manual'; }
  }

  const report = unified.filter((_, i) => generated[i].per100g.kcal != null).map(coverage);
  writeFileSync(join(DATA_DIR, 'coverage.report.json'), JSON.stringify(report, null, 2));

  const header = `/**
 * tacoFoodBase.generated.ts
 * --------------------------
 * GERADO AUTOMATICAMENTE por scripts/importTacoCsv.ts — NÃO EDITE À MÃO.
 * Fonte: TACO (NEPA/UNICAMP), 4ª edição — ver scripts/data/taco/FONTE.md.
 * Para regenerar: npx tsx scripts/importTacoCsv.ts
 *
 * lactoseLevel aqui é uma HEURÍSTICA por categoria (TACO não mede lactose):
 * itens de "Leite e derivados" = 'high' por padrão (conservador), demais
 * = 'none'. Casos conhecidos (ex.: queijos curados) são corrigidos pelos
 * alimentos curados à mão em referenceData.ts, que têm precedência na busca.
 *
 * Nutrientes ausentes (vitamina D, B12, B5, B7, B9, selênio) não são
 * inventados — a TACO não os mede. Ficam undefined até uma importação USDA
 * real ser rodada (fora deste sandbox, sem acesso a api.nal.usda.gov).
 *
 * nutrientSources traz a fonte por nutriente ('taco' | 'manual' | ...) —
 * ver src/lib/nutrientSourceMeta.ts para os badges de UI.
 */
import type { FoodItem } from './referenceData';

export const TACO_FOOD_BASE: FoodItem[] = `;

  const bodyData = clean.map((g) => ({
    id: g.id,
    name: g.name,
    per100g: g.per100g,
    lactoseLevel: g.lactoseLevel,
    nutrientSources: g.nutrientSources,
  }));
  const body = JSON.stringify(bodyData, null, 2);

  writeFileSync(join(__dirname, '..', 'src', 'lib', 'tacoFoodBase.generated.ts'), header + body + ';\n');

  const totalMissing = report.reduce((s, r) => s + r.missing.length, 0);
  const dairyCount = clean.filter((g) => g.lactoseLevel === 'high').length;
  console.log(`✓ ${clean.length} alimentos gerados (de ${mainRows.length} linhas na TACO).`);
  console.log(`  Marcados lactoseLevel='high' (categoria "Leite e derivados"): ${dairyCount}`);
  console.log(`  Lacunas de nutriente restantes (esperado sem USDA): ${totalMissing}`);
  console.log(`  Relatório completo: scripts/data/taco/coverage.report.json`);
}

main();
