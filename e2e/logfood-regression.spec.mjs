/**
 * e2e/logfood-regression.spec.mjs
 * --------------------------------
 * Regressão do bug real reportado pelo usuário (§6.5 do HANDOFF): a aba
 * "Registrar" travava com SchemaError porque 'createdAt' não estava
 * indexado em foodEntries. Esse teste existe especificamente pra nunca
 * mais deixar isso voltar sem ninguém perceber.
 *
 * Rodar: node --test e2e/logfood-regression.spec.mjs
 * (precisa do preview server rodando — ver e2e/run.mjs pra orquestração completa)
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { launchBrowser, completeOnboarding, goToTab, installErrorCapture, getErrors } from './helpers.mjs';

test('aba Registrar abre sem SchemaError, mesmo com o dia vazio', async () => {
  const browser = await launchBrowser();
  try {
    const page = await browser.newPage();
    await installErrorCapture(page);
    await completeOnboarding(page);

    await goToTab(page, 'Registrar');

    const errors = await getErrors(page);
    const schemaErrors = errors.filter((e) => /SchemaError/i.test(e));
    assert.deepEqual(schemaErrors, [], `SchemaError voltou: ${schemaErrors.join(' | ')}`);

    const body = await page.innerText('body');
    assert.ok(!body.includes('Algo deu errado nesta tela'), 'ErrorBoundary disparou — algo quebrou a aba Registrar');
    assert.ok(body.includes('Escanear código de barras') && body.includes('Café') && body.includes('Ceia'), 'tela não renderizou o conteúdo esperado (abas de refeição + painéis)');
  } finally {
    await browser.close();
  }
});

test('aba Registrar continua funcionando com dado real (Frequentes populado)', async () => {
  const browser = await launchBrowser();
  try {
    const page = await browser.newPage();
    await installErrorCapture(page);
    await completeOnboarding(page);
    await goToTab(page, 'Registrar');

    // Registra qualquer alimento pelo chip de porção
    await page.fill('input[placeholder]', 'Banana prata');
    await page.waitForTimeout(300);
    const chip = await page.$('text=1 unidade');
    if (chip) await chip.click();
    await page.waitForTimeout(400);

    // Sai e volta — força useFrequentFoods() a rodar orderBy('createdAt') com dado real
    await goToTab(page, 'Hoje');
    await goToTab(page, 'Registrar');

    const errors = await getErrors(page);
    assert.deepEqual(errors, [], `Erros inesperados: ${errors.join(' | ')}`);

    const body = await page.innerText('body');
    assert.ok(body.includes('Frequentes'), 'seção "Frequentes" deveria aparecer com dado real registrado');
  } finally {
    await browser.close();
  }
});
