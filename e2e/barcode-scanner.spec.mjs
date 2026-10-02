/**
 * e2e/barcode-scanner.spec.mjs
 * -----------------------------
 * Leitor de código de barras ponta a ponta, pelo caminho do ZXing.
 *
 * A "câmera" é um vídeo com um EAN-13 de verdade (e2e/fixtures/ean13.mjpeg,
 * gerado por make-barcode-video.py). O Chromium sem interface do Linux NÃO
 * tem a API nativa BarcodeDetector — a mesma situação do iPhone, Firefox e
 * Chrome do Windows — então este teste exercita justamente o fallback que
 * a maioria dos usuários vai usar.
 *
 * Open Food Facts é interceptado (sem rede pra ele no CI/sandbox).
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { chromium } from 'playwright';
import { existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { completeOnboarding, goToTab, installErrorCapture, getErrors } from './helpers.mjs';

const here = dirname(fileURLToPath(import.meta.url));
const VIDEO = join(here, 'fixtures', 'ean13.mjpeg');
const CODE = '4006381333931';
const chromiumPath = [process.env.PLAYWRIGHT_CHROMIUM_PATH, '/opt/pw-browsers/chromium-1194/chrome-linux/chrome']
  .filter(Boolean).find((p) => existsSync(p));

async function launchWithFakeCamera() {
  return chromium.launch({
    executablePath: chromiumPath,
    args: [
      '--no-sandbox',
      '--use-fake-device-for-media-stream',
      '--use-fake-ui-for-media-stream',
      `--use-file-for-fake-video-capture=${VIDEO}`,
    ],
  });
}

function mockOpenFoodFacts(page, calls) {
  return page.route('**world.openfoodfacts.org**', async (route) => {
    calls.push(route.request().url());
    await route.fulfill({
      status: 200, contentType: 'application/json',
      body: JSON.stringify({ product: {
        product_name: 'Biscoito Teste', brands: 'Marca X',
        nutriments: { 'energy-kcal_100g': 480, proteins_100g: 6, salt_100g: 1.5 },
      } }),
    });
  });
}

test('lê EAN-13 pela câmera (ZXing), busca o produto, registra — e depois funciona offline', async () => {
  const browser = await launchWithFakeCamera();
  try {
    const page = await browser.newPage();
    await installErrorCapture(page);
    const calls = [];
    await mockOpenFoodFacts(page, calls);

    await completeOnboarding(page);
    const hasNative = await page.evaluate(() => 'BarcodeDetector' in window);
    assert.equal(hasNative, false, 'este teste precisa rodar SEM a API nativa pra exercitar o ZXing');

    await goToTab(page, 'Registrar');
    await page.click('text=Escanear código de barras');
    await page.click('button:has-text("Escanear com a câmera")');

    // ZXing é baixado sob demanda + lê o vídeo: dá até 15s
    await page.waitForSelector('text=Biscoito Teste', { timeout: 15000 });
    assert.ok(calls.some((u) => u.includes(CODE)), `deveria ter buscado o código ${CODE} no Open Food Facts`);

    const body = await page.innerText('body');
    assert.match(body, /600mg sódio/, 'sódio derivado do sal (1,5g sal → 600mg sódio) deveria aparecer');

    await page.click('button:has-text("Adicionar ao dia")');
    await page.waitForSelector('text=Adicionado');

    // Segunda leitura do mesmo produto SEM internet: tem que vir do aparelho.
    await page.unroute('**world.openfoodfacts.org**');
    await page.route('**world.openfoodfacts.org**', (route) => route.abort('internetdisconnected'));
    await page.waitForTimeout(2000); // painel volta ao estado inicial
    await page.fill('input[placeholder="Ou digite o código (EAN)"]', CODE);
    await page.click('button:has-text("Buscar")');
    await page.waitForSelector('text=Já escaneado antes', { timeout: 5000 });

    const errors = await getErrors(page);
    assert.deepEqual(errors, [], `Erros inesperados: ${errors.join(' | ')}`);
  } finally {
    await browser.close();
  }
});

test('código digitado com dígito errado é recusado antes de buscar', async () => {
  const browser = await launchWithFakeCamera();
  try {
    const page = await browser.newPage();
    const calls = [];
    await mockOpenFoodFacts(page, calls);
    await completeOnboarding(page);
    await goToTab(page, 'Registrar');
    await page.click('text=Escanear código de barras');
    await page.fill('input[placeholder="Ou digite o código (EAN)"]', '4006381333932'); // último dígito trocado
    await page.click('button:has-text("Buscar")');
    await page.waitForSelector('text=inválido');
    assert.equal(calls.length, 0, 'não deveria chamar a API com código inválido');
  } finally {
    await browser.close();
  }
});
