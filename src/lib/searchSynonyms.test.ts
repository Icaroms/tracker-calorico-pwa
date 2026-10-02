import { describe, it, expect } from 'vitest';
import { expandSearchTerms } from './searchSynonyms';

describe('expandSearchTerms', () => {
  it('sempre inclui a query original', () => {
    expect(expandSearchTerms('banana')).toContain('banana');
  });
  it('"mussarela" também tenta "mozarela" (grafia oficial da TACO)', () => {
    expect(expandSearchTerms('queijo mussarela')).toContain('queijo mozarela');
  });
  it('"mozzarella" (grafia italiana) também tenta "mozarela"', () => {
    expect(expandSearchTerms('mozzarella')).toContain('mozarela');
  });
  it('query sem sinônimo conhecido não ganha termo extra', () => {
    expect(expandSearchTerms('banana')).toEqual(['banana']);
  });
});

import { matchesQuery, searchFoods, normalizeText } from './searchSynonyms';

describe('normalizeText', () => {
  it('remove acento e passa pra minúsculas', () => {
    expect(normalizeText('Pão Francês')).toBe('pao frances');
  });
});

describe('matchesQuery — busca por palavras', () => {
  it('acha nome da TACO com vírgula ("arroz integral" → "Arroz, integral, cozido")', () => {
    expect(matchesQuery('Arroz, integral, cozido', 'arroz integral')).toBe(true);
  });
  it('ordem das palavras não importa', () => {
    expect(matchesQuery('Arroz, integral, cozido', 'integral arroz')).toBe(true);
  });
  it('todas as palavras precisam aparecer', () => {
    expect(matchesQuery('Arroz, integral, cozido', 'arroz frito')).toBe(false);
  });
  it('sinônimo continua funcionando ("mussarela" → "Queijo, mozarela")', () => {
    expect(matchesQuery('Queijo, mozarela', 'queijo mussarela')).toBe(true);
  });
  it('acento na busca não atrapalha ("pao frances")', () => {
    expect(matchesQuery('Pão, trigo, francês', 'pao frances')).toBe(true);
  });
  it('busca vazia ou só espaço não casa com nada', () => {
    expect(matchesQuery('Banana', '   ')).toBe(false);
  });
});

describe('searchFoods — ordenação', () => {
  const items = [{ name: 'Bolo de banana' }, { name: 'Banana, prata, crua' }, { name: 'Vitamina de banana' }, { name: 'Banana, nanica, crua' }];
  it('quem começa com o termo vem primeiro, mantendo a ordem original entre eles', () => {
    expect(searchFoods(items, 'banana').map((x) => x.name)).toEqual([
      'Banana, prata, crua', 'Banana, nanica, crua', 'Bolo de banana', 'Vitamina de banana',
    ]);
  });
  it('sem busca devolve a lista original limitada', () => {
    expect(searchFoods(items, '', 2)).toHaveLength(2);
  });
});
