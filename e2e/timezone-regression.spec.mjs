/**
 * e2e/timezone-regression.spec.mjs
 * ---------------------------------
 * Regressão do bug de fuso horário: o app calculava "hoje" com
 * toISOString() (UTC). Em Manaus (UTC−4), a partir das 20h o app achava
 * que já era o dia seguinte — então o que a pessoa comeu de manhã/tarde
 * SUMIA da tela "Hoje" à noite, e reaparecia misturado no dia errado.
 *
 * O navegador do teste roda com timezoneId 'America/Manaus' — sem isso
 * (navegador em UTC), o bug é invisível.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { launchBrowser, completeOnboarding, goToTab, installErrorCapture, getErrors } from './helpers.mjs';

test('refeição registrada às 15h continua em "Hoje" às 21h (Manaus)', async () => {
  const browser = await launchBrowser();
  try {
    const context = await browser.newContext({ timezoneId: 'America/Manaus' });
    const page = await context.newPage();
    await installErrorCapture(page);

    // 15h em Manaus = 19h UTC (ainda o mesmo dia nos dois fusos)
    const tarde = new Date('2026-10-02T19:00:00Z');
    await page.clock.install({ time: tarde });

    await completeOnboarding(page);
    await goToTab(page, 'Registrar');
    await page.fill('input[placeholder]', 'Banana prata');
    await page.waitForTimeout(300);
    await page.click('text=1 unidade');
    await page.waitForTimeout(400);

    // Avança pra 21h em Manaus = 01h UTC do dia SEGUINTE — onde o bug aparecia
    await page.clock.fastForward('06:00:00');
    await page.reload({ waitUntil: 'networkidle' });
    await page.waitForTimeout(500);

    await goToTab(page, 'Registrar');
    const body = await page.innerText('body');
    // A seção "Hoje" no fim da tela Registrar lista as entradas do dia.
    // Com o bug, ela mostrava "Nada registrado ainda" às 21h.
    assert.ok(!body.includes('Nada registrado ainda'), 'a refeição da tarde sumiu do dia às 21h — bug de fuso voltou');
    // Total do dia no resumo "Hoje": banana prata 1 unidade (90g × 98kcal/100g) ≈ 88 kcal.
    // "Banana prata" sozinho não serve de prova — também aparece na lista de busca.
    assert.doesNotMatch(body, /Hoje\s*\n\s*0 kcal/, 'total do dia zerado às 21h — bug de fuso voltou');

    const errors = await getErrors(page);
    assert.deepEqual(errors, [], `Erros inesperados: ${errors.join(' | ')}`);
  } finally {
    await browser.close();
  }
});
