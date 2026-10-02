/**
 * e2e/exercise-logging.spec.mjs
 * ------------------------------
 * Confirma o fluxo de registro de exercício ponta a ponta: cálculo de kcal
 * exibido antes de confirmar, persistência, e ajuste da meta do dia no
 * Dashboard (ver §6.9 do HANDOFF).
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { launchBrowser, completeOnboarding, goToTab, installErrorCapture, getErrors } from './helpers.mjs';

test('registrar remador 30min com 80kg calcula e persiste 294 kcal', async () => {
  const browser = await launchBrowser();
  try {
    const page = await browser.newPage();
    await installErrorCapture(page);
    await completeOnboarding(page, { weightKg: 80 });
    await goToTab(page, 'Registrar');

    await page.click('text=Registrar exercício');
    await page.waitForTimeout(300);

    const minutesInput = await page.$('input[type="number"]');
    await minutesInput.fill('30');
    await page.waitForTimeout(300);

    const preview = await page.innerText('body');
    const match = preview.match(/≈\s*(\d+)\s*kcal/);
    assert.ok(match, 'preview de kcal não apareceu');
    assert.equal(match[1], '294', `esperado 294 kcal (MET 7.0 × 80kg × 30min), veio ${match[1]}`);

    // botão de submit tem texto EXATO "Registrar" — existem outros elementos
    // com esse texto (aba de navegação, cabeçalho do painel), por isso o
    // seletor pega só o primeiro match exato, que é o botão de confirmar.
    await page.click('button:text-is("Registrar") >> nth=0');
    await page.waitForTimeout(500);

    const afterLog = await page.innerText('body');
    assert.ok(afterLog.includes('294 kcal hoje'), 'exercício não persistiu (painel deveria mostrar "294 kcal hoje")');

    await goToTab(page, 'Hoje');
    const dashboard = await page.innerText('body');
    assert.ok(dashboard.includes('+294 kcal de exercício'), 'Dashboard não mostrou o kcal de exercício somado à meta');

    const errors = await getErrors(page);
    assert.deepEqual(errors, [], `Erros inesperados: ${errors.join(' | ')}`);
  } finally {
    await browser.close();
  }
});
