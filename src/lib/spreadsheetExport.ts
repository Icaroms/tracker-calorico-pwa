/**
 * spreadsheetExport.ts
 * --------------------
 * Exporta os dados do usuário para .xlsx (uma aba por tabela), no navegador.
 *
 * O SheetJS é pesado, então é carregado SOB DEMANDA (import dinâmico) — só
 * entra no bundle quando o usuário realmente exporta. buildWorkbook recebe o
 * módulo XLSX por parâmetro (puro/testável).
 */
import type { WorkBook } from 'xlsx';
import { db } from './db';

type XLSXModule = typeof import('xlsx');
async function loadXlsx(): Promise<XLSXModule> {
  return import('xlsx');
}

export interface ExportDump {
  weightLogs?: object[];
  foodEntries?: object[];
  planSnapshots?: object[];
  dayMeta?: object[];
  recipes?: Array<{ id: string; name: string; ingredients: unknown[]; yieldGrams?: number }>;
  goals?: object[];
}

export function buildWorkbook(XLSX: XLSXModule, dump: ExportDump): WorkBook {
  const wb = XLSX.utils.book_new();
  const add = (name: string, rows: object[] = []) =>
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(rows as any[]), name);

  add('Peso', dump.weightLogs);
  add('Refeicoes', dump.foodEntries);
  add('Planos', dump.planSnapshots);
  add('Dia', dump.dayMeta);
  add('Metas', dump.goals);
  add('Receitas', (dump.recipes ?? []).map((r) => ({
    id: r.id, nome: r.name, rendimento_g: r.yieldGrams ?? '', ingredientes: JSON.stringify(r.ingredients),
  })));
  return wb;
}

export async function downloadSpreadsheet(filename = 'tracker.xlsx'): Promise<void> {
  const XLSX = await loadXlsx();
  const dump: ExportDump = {
    weightLogs: await db.weightLogs.toArray(),
    foodEntries: await db.foodEntries.toArray(),
    planSnapshots: await db.planSnapshots.toArray(),
    dayMeta: await db.dayMeta.toArray(),
    recipes: await db.recipes.toArray(),
    goals: await db.goals.toArray(),
  };
  XLSX.writeFile(buildWorkbook(XLSX, dump), filename);
}

export async function toCsv(rows: object[]): Promise<string> {
  const XLSX = await loadXlsx();
  return XLSX.utils.sheet_to_csv(XLSX.utils.json_to_sheet(rows as any[]));
}
