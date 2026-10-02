import { describe, it, expect } from 'vitest';
import { isValidGtin, cleanBarcode } from './barcode';

describe('isValidGtin — dígito verificador', () => {
  it('aceita EAN-13 válido', () => expect(isValidGtin('4006381333931')).toBe(true));
  it('aceita EAN-8 válido', () => expect(isValidGtin('96385074')).toBe(true));
  it('aceita UPC-A válido (12 dígitos)', () => expect(isValidGtin('036000291452')).toBe(true));

  it('rejeita EAN-13 com 1 dígito trocado (leitura errada da câmera)', () => {
    expect(isValidGtin('4006381333932')).toBe(false);
    expect(isValidGtin('4006381233931')).toBe(false);
  });
  it('rejeita tamanho que não é 8, 12 nem 13', () => {
    expect(isValidGtin('12345')).toBe(false);
    expect(isValidGtin('40063813339310')).toBe(false);
  });
  it('rejeita letras e vazio', () => {
    expect(isValidGtin('400638133393A')).toBe(false);
    expect(isValidGtin('')).toBe(false);
  });
  it('dígito verificador 0 (caso de borda do módulo 10)', () => {
    // 789100001001 + dígito: soma ponderada múltipla de 10 → check = 0
    const base = '789100001001';
    const digits = base.split('').map(Number).reverse();
    const sum = digits.reduce((a, d, i) => a + d * (i % 2 === 0 ? 3 : 1), 0);
    const check = (10 - (sum % 10)) % 10;
    expect(isValidGtin(base + check)).toBe(true);
  });
});

describe('cleanBarcode', () => {
  it('remove espaços e traços digitados junto', () => {
    expect(cleanBarcode(' 400 6381-333931 ')).toBe('4006381333931');
  });
});
