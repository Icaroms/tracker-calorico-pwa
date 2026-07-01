# Tracker de Déficit Calórico (PWA)

PWA offline-first para déficit calórico e micronutrientes, com base em alimentos
brasileiros (TACO) enriquecida pela USDA. Todos os dados ficam no dispositivo
(IndexedDB) — nada vai pra servidor.

## Funcionalidades

- **Onboarding** na 1ª vez: calcula suas metas a partir de altura/peso/medidas.
- **Cálculo eficiente**: BMR via Mifflin-St Jeor, ou Katch-McArdle quando há % de
  gordura; TDEE, déficit com piso de segurança, água, cintura/quadril, recálculo.
- **Registrar comida**: busca, **porções rápidas** (1 toque), **frequentes**,
  **código de barras** (Open Food Facts), alimento próprio e **receitas/pratos**.
- **Editar/excluir** registros e pesos (hoje e dias passados).
- **Dashboard**: anel de calorias, macros, 12+ micronutrientes, água, peso (SVG).
- **Histórico** dia/semana/mês com gráficos.
- **Análise do dia**: Camada 1 por regras (offline, grátis) + Camada 2 opcional
  via Gemini (só números anonimizados saem do aparelho).
- **Backup/Export**: JSON (restaurar) e .xlsx (analisar/compartilhar).
- **PWA**: instalável, offline, com code-splitting (carregamento ~96KB gzip).

## Estrutura

```
src/
  main.tsx · App.tsx · seed.ts · index.css
  components/  Dashboard, AnalysisPanel, LogFood, CustomFoodForm, RecipeBuilder,
               BarcodeScanner, History, Profile, Settings, Onboarding, WeightSparkline
  hooks/       useTracker, useAnalysis
  lib/         calorieEngine, db, referenceData, recipes, dailyTotals,
               mealSuggester, mergeFoodData, spreadsheetExport,
               nutritionAnalyst, geminiAdapter, openFoodFacts
scripts/buildFoodBase.ts      # gera a base TACO+USDA → JSON
public/                       # ícones do PWA
```

## Rodar

```bash
npm install
npm run dev        # http://localhost:5173
npm run build      # typecheck + build de produção (PWA instalável)
npm run preview    # serve o build (testar offline/instalação)
```

## Análise por IA (opcional)

Pegue uma chave grátis no Google AI Studio e cole em **Ajustes → Análise por IA**.
Sem chave, a análise por regras (offline) funciona normalmente.

## Base de alimentos completa (opcional)

A base inicial tem poucos itens. Para a TACO completa:
1. Baixe a TACO em Excel (NEPA/UNICAMP) e salve como `taco.xlsx`.
2. (Opcional) `export USDA_API_KEY=xxxx` para vit. D, B12, selênio, ômega-3.
3. `npm run build:foods`.

## Notas de saúde

Metas iniciais são placeholders — personalize em Ajustes. A recomendação de
jejum vem conservadora (cautela) por padrão. Valide com profissional.
