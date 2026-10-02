/**
 * searchSynonyms.ts
 * -----------------
 * Busca de alimentos — fonte única usada por todas as telas (antes cada uma
 * tinha sua própria cópia da normalização e do filtro).
 *
 * Sinônimos: a TACO usa a grafia oficial em português ("mozarela"), mas as
 * pessoas digitam do jeito que aprenderam ("mussarela", "mozzarella"). Isso
 * NÃO é mapeamento de alimentos parecidos-mas-diferentes (ricota ≠ cottage)
 * — só grafias alternativas do MESMO alimento, senão a busca fica enganosa.
 */
const SYNONYMS: [alt: string, canonical: string][] = [
  ['mussarela', 'mozarela'],
  ['mozzarella', 'mozarela'],
];

/** Minúsculas e sem acento — "Pão Francês" → "pao frances". */
export function normalizeText(s: string): string {
  return s.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
}

/** Expande a query normalizada com sinônimos conhecidos, se houver. */
export function expandSearchTerms(normalizedQuery: string): string[] {
  const terms = [normalizedQuery];
  for (const [alt, canonical] of SYNONYMS) {
    if (normalizedQuery.includes(alt)) terms.push(normalizedQuery.replace(alt, canonical));
  }
  return terms;
}

const words = (s: string) => s.split(/[^a-z0-9]+/).filter(Boolean);

/**
 * Todas as palavras da busca aparecem no nome, em qualquer ordem.
 * Antes a busca procurava a frase inteira como um bloco — como os nomes da
 * TACO têm vírgulas ("Arroz, integral, cozido"), buscar "arroz integral" não
 * achava nada.
 */
export function matchesQuery(name: string, query: string): boolean {
  const n = normalizeText(name);
  return expandSearchTerms(normalizeText(query.trim())).some((variant) => {
    const ws = words(variant);
    return ws.length > 0 && ws.every((w) => n.includes(w));
  });
}

/**
 * Filtra e ordena: nomes que COMEÇAM com a primeira palavra buscada vêm
 * antes (buscar "banana" mostra "Banana, prata" antes de "Bolo de banana").
 * Sem query, devolve os primeiros `limit` itens na ordem original
 * (curados primeiro — ver FOOD_BASE).
 */
export function searchFoods<T extends { name: string }>(items: readonly T[], query: string, limit = 25): T[] {
  const q = query.trim();
  if (!q) return items.slice(0, limit);
  const first = words(normalizeText(q))[0] ?? '';
  return items
    .filter((it) => matchesQuery(it.name, q))
    .map((it, i) => ({ it, i, starts: normalizeText(it.name).startsWith(first) ? 0 : 1 }))
    .sort((a, b) => a.starts - b.starts || a.i - b.i) // estável: mantém a ordem original dentro de cada grupo
    .slice(0, limit)
    .map((x) => x.it);
}
