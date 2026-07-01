# Fonte dos dados

Tabela Brasileira de Composição de Alimentos (TACO), 4ª edição (2011),
NEPA/UNICAMP.

Arquivos originais em Excel: https://www.nepa.unicamp.br/taco/tabela.php
(bloqueado pela rede do sandbox de build; os CSVs abaixo foram obtidos do
repositório público que reempacota os mesmos dados oficiais em formato
CSV limpo, compatível com R/Python):
https://github.com/machine-learning-mocha/taco (pasta `formatados/`)

- `alimentos.csv`: 597 alimentos, macronutrientes + minerais + vitaminas A/C/B1/B2/B3/B6
- `acidos-graxos.csv`: gordura saturada + ácidos graxos individuais (usado para somar ômega-3: ALA+EPA+DHA)

Licença: dados públicos do NEPA/UNICAMP, citação obrigatória em uso
acadêmico: TACO - Tabela Brasileira de Composição de Alimentos. 4ª ed.
Campinas: NEPA-UNICAMP, 2011.

**Gaps conhecidos**: TACO não mede vitamina D, B12, B5, B7, B9 nem selênio.
Esses nutrientes seguem ausentes (não zerados, não inventados) até a
importação USDA ser rodada com uma chave de API real (fora deste sandbox,
que não tem acesso a api.nal.usda.gov).
