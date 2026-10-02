/**
 * searchSynonyms.ts
 * -----------------
 * A TACO usa a grafia oficial em português ("mozarela"), mas as pessoas
 * digitam do jeito que aprenderam ("mussarela", "mozzarella"). Isso NÃO é
 * mapeamento de alimentos parecidos-mas-diferentes (ricota ≠ cottage, por
 * exemplo) — só grafias alternativas do MESMO alimento, senão a busca fica
 * enganosa (implica equivalência que não existe).
 */
const SYNONYMS: [alt: string, canonical: string][] = [
  ['mussarela', 'mozarela'],
  ['mozzarella', 'mozarela'],
];

/** Expande a query normalizada com sinônimos conhecidos, se houver. */
export function expandSearchTerms(normalizedQuery: string): string[] {
  const terms = [normalizedQuery];
  for (const [alt, canonical] of SYNONYMS) {
    if (normalizedQuery.includes(alt)) terms.push(normalizedQuery.replace(alt, canonical));
  }
  return terms;
}
