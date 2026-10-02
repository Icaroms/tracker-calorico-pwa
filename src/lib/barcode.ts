/**
 * barcode.ts
 * ----------
 * Leitura de código de barras de embalagem (EAN-13, EAN-8, UPC-A) pela
 * câmera, funcionando em qualquer navegador moderno.
 *
 * Por que duas estratégias:
 * - `BarcodeDetector` (API nativa do navegador) é rápida e leve, mas só
 *   existe no Chrome do Android e em alguns Macs. NÃO existe no Safari
 *   (iPhone), no Firefox nem no Chrome do Windows.
 * - ZXing (biblioteca JS) funciona em todos, mas pesa — por isso só é
 *   baixada (import dinâmico) quando a API nativa não existe. Quem tem a
 *   nativa nunca paga o custo.
 *
 * Por que validar o dígito verificador: leitura pela câmera às vezes erra
 * um dígito (foco, reflexo). Todo código EAN/UPC tem um dígito de controle
 * — se não bate, a leitura está errada, e o app ignora em vez de buscar um
 * produto que não tem nada a ver.
 *
 * UPC-E (8 dígitos comprimidos) não é aceito de propósito: o dígito
 * verificador dele é calculado sobre o código expandido, então a mesma
 * validação não serve. Produtos vendidos no Brasil usam EAN-13 na prática.
 */

/** Valida o dígito verificador GTIN (EAN-8, UPC-A, EAN-13). Aceita só dígitos. */
export function isValidGtin(code: string): boolean {
  if (!/^\d+$/.test(code)) return false;
  if (![8, 12, 13].includes(code.length)) return false;
  const digits = code.split('').map(Number);
  const check = digits.pop()!;
  // Da direita pra esquerda (sem o dígito de controle): pesos 3,1,3,1...
  const sum = digits.reverse().reduce((acc, d, i) => acc + d * (i % 2 === 0 ? 3 : 1), 0);
  return (10 - (sum % 10)) % 10 === check;
}

/** Remove espaços/traços que a pessoa digita ou copia junto com o código. */
export function cleanBarcode(raw: string): string {
  return raw.replace(/[\s-]/g, '');
}

export type ScannerEngine = 'native' | 'zxing';

export interface ScannerHandle {
  stop: () => void;
  engine: ScannerEngine;
}

const NATIVE_FORMATS = ['ean_13', 'ean_8', 'upc_a'];

interface NativeDetector { detect: (src: HTMLVideoElement) => Promise<Array<{ rawValue: string }>>; }
interface NativeDetectorCtor {
  new (opts: { formats: string[] }): NativeDetector;
  getSupportedFormats?: () => Promise<string[]>;
}

async function nativeDetectorIfUsable(): Promise<NativeDetectorCtor | null> {
  const Ctor = (globalThis as { BarcodeDetector?: NativeDetectorCtor }).BarcodeDetector;
  if (!Ctor) return null;
  try {
    // Alguns navegadores expõem a classe mas sem suporte a EAN — checa antes.
    const supported = (await Ctor.getSupportedFormats?.()) ?? NATIVE_FORMATS;
    return supported.includes('ean_13') ? Ctor : null;
  } catch {
    return null;
  }
}

/**
 * Liga a leitura contínua num <video> que já está tocando o stream da câmera.
 * Chama `onCode` UMA vez com o primeiro código válido (dígito verificador ok)
 * e para sozinho. Devolve um handle pra parar antes disso (ex.: usuário
 * cancelou).
 */
export async function startBarcodeScan(
  video: HTMLVideoElement,
  stream: MediaStream,
  onCode: (code: string) => void,
): Promise<ScannerHandle> {
  let done = false;
  const accept = (raw: string) => {
    const code = cleanBarcode(raw);
    if (done || !isValidGtin(code)) return false;
    done = true;
    onCode(code);
    return true;
  };

  const Native = await nativeDetectorIfUsable();
  if (Native) {
    const detector = new Native({ formats: NATIVE_FORMATS });
    let raf = 0;
    const tick = async () => {
      if (done) return;
      try {
        const found = await detector.detect(video);
        for (const f of found) if (accept(f.rawValue)) return;
      } catch { /* frame sem leitura — segue tentando */ }
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return { engine: 'native', stop: () => { done = true; cancelAnimationFrame(raf); } };
  }

  // Fallback: ZXing, baixado só agora (import dinâmico → chunk separado).
  const [{ BrowserMultiFormatOneDReader }, { DecodeHintType, BarcodeFormat }] = await Promise.all([
    import('@zxing/browser'),
    import('@zxing/library'),
  ]);
  const hints = new Map();
  hints.set(DecodeHintType.POSSIBLE_FORMATS, [BarcodeFormat.EAN_13, BarcodeFormat.EAN_8, BarcodeFormat.UPC_A]);
  const reader = new BrowserMultiFormatOneDReader(hints);
  // `controls` só existe depois que decodeFromStream resolve — se o ZXing já
  // ler um código na primeira imagem, o callback roda antes disso. Por isso
  // `let` + checagem, e um stop de segurança logo após o await.
  let controls: { stop: () => void } | undefined;
  controls = await reader.decodeFromStream(stream, video, (result) => {
    if (result && accept(result.getText())) controls?.stop();
  });
  if (done) controls.stop();
  return { engine: 'zxing', stop: () => { done = true; controls?.stop(); } };
}
