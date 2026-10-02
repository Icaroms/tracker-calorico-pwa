/**
 * e2e/food-camera.spec.mjs
 * -------------------------
 * Fluxo completo de "reconhecer alimento por foto": câmera (simulada via
 * flag do Chromium — sem depender de hardware real), captura, chamada ao
 * Gemini Vision (interceptada — este sandbox não tem acesso de rede pra
 * generativelanguage.googleapis.com, então mocka a resposta no formato
 * real da API), seleção do alimento real na base, e registro.
 *
 * Confirma o ponto mais importante do design: a nutrição logada vem da
 * busca real (TACO), nunca de um valor inventado pela IA — só o nome
 * sugerido e o peso estimado vêm do Gemini.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { chromium } from 'playwright';
import { existsSync } from 'node:fs';
import { completeOnboarding, goToTab, installErrorCapture, getErrors, BASE_URL } from './helpers.mjs';

const CANDIDATE_PATHS = [
  process.env.PLAYWRIGHT_CHROMIUM_PATH,
  '/opt/pw-browsers/chromium-1194/chrome-linux/chrome',
].filter(Boolean);
const chromiumPath = CANDIDATE_PATHS.find((p) => existsSync(p));

test('reconhece por foto (mock), escolhe o alimento real e registra', async () => {
  const browser = await chromium.launch({
    executablePath: chromiumPath,
    args: [
      '--no-sandbox',
      '--use-fake-device-for-media-stream', // simula uma câmera (padrão de cores), sem hardware real
      '--use-fake-ui-for-media-stream', // auto-aprova o prompt de permissão de câmera
    ],
  });
  try {
    const page = await browser.newPage();
    await installErrorCapture(page);

    // Intercepta a chamada ao Gemini Vision — mocka no formato real da API
    // (data.candidates[0].content.parts[].text com o JSON esperado dentro).
    // Padrão sem barras ao redor do domínio: com elas o glob do Playwright
    // não casava a URL de verdade (:generateContent no final confundia).
    await page.route('**generativelanguage.googleapis.com**', async (route) => {
      const mockResult = { foodName: 'banana', estimatedAmount: 120, unit: 'g', confidence: 'media', notes: null, notFood: false };
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ candidates: [{ content: { parts: [{ text: JSON.stringify(mockResult) }] }, finishReason: 'STOP' }] }),
      });
    });

    await completeOnboarding(page);

    // Configura a chave do Gemini (simula o que o usuário faria em Ajustes)
    await page.evaluate(() => localStorage.setItem('geminiApiKey', 'chave-de-teste-fake'));

    await goToTab(page, 'Registrar');
    await page.click('text=Reconhecer alimento por foto');
    await page.waitForTimeout(300);

    await page.click('button:has-text("Tirar foto do alimento")');
    await page.waitForTimeout(800); // câmera fake "liga"

    await page.click('button:has-text("Capturar")');
    await page.waitForTimeout(800); // chamada mockada resolve

    const body = await page.innerText('body');
    assert.match(body, /Parece: banana/i, 'não mostrou o alimento reconhecido (mockado)');
    assert.match(body, /[Ee]stimativa/i, 'não mostrou o aviso de que é estimativa');

    // Busca pré-preenchida com "banana" deve achar itens reais da base.
    // "Banana prata" também aparece na lista geral de busca do LogFood (sem
    // relação com a câmera) — pega a última ocorrência, que é a do painel
    // de resultados da câmera (renderizado depois no DOM).
    const candidates = await page.$$('button:has-text("Banana prata")');
    assert.ok(candidates.length > 0, 'nenhuma banana real da base apareceu nos resultados');
    await candidates[candidates.length - 1].click();
    await page.waitForTimeout(300);

    await page.click('button:has-text("Adicionar")');
    await page.waitForTimeout(600);

    // Confirma que entrou de verdade no registro do dia, com a nutrição REAL
    // (o resumo "Hoje" dentro da própria tela Registrar lista as entradas).
    const afterAdd = await page.innerText('body');
    assert.match(afterAdd, /Banana/i, 'a entrada registrada não apareceu no resumo do dia');

    const errors = await getErrors(page);
    assert.deepEqual(errors, [], `Erros inesperados: ${errors.join(' | ')}`);
  } finally {
    await browser.close();
  }
});

test('mensagem clara quando não tem chave do Gemini configurada', async () => {
  const browser = await chromium.launch({ executablePath: chromiumPath, args: ['--no-sandbox'] });
  try {
    const page = await browser.newPage();
    await installErrorCapture(page);
    await completeOnboarding(page);
    await goToTab(page, 'Registrar');

    const body = await page.innerText('body');
    assert.match(body, /Precisa de uma chave do Gemini/i, 'não mostrou aviso de chave ausente');

    const errors = await getErrors(page);
    assert.deepEqual(errors, [], `Erros inesperados: ${errors.join(' | ')}`);
  } finally {
    await browser.close();
  }
});
