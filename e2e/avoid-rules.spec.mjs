/**
 * e2e/avoid-rules.spec.mjs
 * -------------------------
 * Partes 2 e 3 da "IA em 3 partes" (ver §6.8 do HANDOFF): evitar por
 * limite (sódio/gordura saturada perto do teto) e evitar por horário
 * (cafeína à noite). Usa page.clock pra simular horário sem depender do
 * relógio real da máquina que roda o teste.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { launchBrowser, completeOnboarding, goToTab, installErrorCapture, getErrors } from './helpers.mjs';

test('sódio perto do limite + café à noite disparam as 2 seções de aviso', async () => {
  const browser = await launchBrowser();
  try {
    const page = await browser.newPage();
    await installErrorCapture(page);

    const night = new Date();
    night.setHours(21, 0, 0, 0);
    await page.clock.install({ time: night });

    await completeOnboarding(page);
    await goToTab(page, 'Registrar');

    // Café (cafeína à noite)
    await page.fill('input[placeholder]', 'Café, infusão');
    await page.waitForTimeout(300);
    await page.click('button:has-text("100g")');
    await page.waitForTimeout(400);

    // Queijo coalho 2× (sódio ~1700mg, 85% do limite de 2000mg)
    for (let i = 0; i < 2; i++) {
      await page.fill('input[placeholder]', 'Queijo coalho');
      await page.waitForTimeout(300);
      await page.click('text=espetinho (100g)');
      await page.waitForTimeout(400);
    }

    await goToTab(page, 'Hoje');
    const body = await page.innerText('body');

    assert.ok(body.includes('Evitar hoje'), 'seção "Evitar hoje" não apareceu');
    assert.match(body, /sódio/i, 'aviso de sódio não apareceu na seção "Evitar hoje"');
    assert.ok(body.includes('Atenção ao horário'), 'seção "Atenção ao horário" não apareceu');
    assert.match(body, /cafeína/i, 'aviso de cafeína à noite não apareceu');

    const errors = await getErrors(page);
    assert.deepEqual(errors, [], `Erros inesperados: ${errors.join(' | ')}`);
  } finally {
    await browser.close();
  }
});

test('dia vazio não mostra nenhuma seção de aviso (sem falso positivo)', async () => {
  const browser = await launchBrowser();
  try {
    const page = await browser.newPage();
    await installErrorCapture(page);
    await completeOnboarding(page);

    const body = await page.innerText('body');
    assert.ok(!body.includes('Evitar hoje'), '"Evitar hoje" não deveria aparecer num dia vazio');
    assert.ok(!body.includes('Atenção ao horário'), '"Atenção ao horário" não deveria aparecer num dia vazio');
  } finally {
    await browser.close();
  }
});
