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
