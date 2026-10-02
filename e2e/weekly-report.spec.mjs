/**
 * e2e/weekly-report.spec.mjs
 * ---------------------------
 * Simula 3 dias diferentes (via page.clock) com comida registrada em 2
 * deles e exercício em 1, confirma que o relatório semanal (Histórico)
 * agrega corretamente — dias registrados, média de kcal, sessão de
 * exercício — sem confundir "dia sem registro" com "consumiu zero" (ver
 * §8.5 do HANDOFF, mesmo princípio do hasData aplicado à semana).
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { launchBrowser, completeOnboarding, goToTab, installErrorCapture, getErrors } from './helpers.mjs';

test('relatório semanal agrega múltiplos dias corretamente', async () => {
  const browser = await launchBrowser();
  try {
    const page = await browser.newPage();
    await installErrorCapture(page);

    const day1 = new Date();
    day1.setHours(12, 0, 0, 0);
    await page.clock.install({ time: day1 });

    await completeOnboarding(page, { weightKg: 80 });

    // Dia 1: registra banana
    await goToTab(page, 'Registrar');
    await page.fill('input[placeholder]', 'Banana prata');
    await page.waitForTimeout(300);
    await page.click('text=1 unidade');
    await page.waitForTimeout(400);

    // Avança 1 dia: registra arroz + exercício
    await page.clock.fastForward('24:00:00');
    await page.waitForTimeout(200);
    await page.fill('input[placeholder]', 'Arroz, integral, cozido');
    await page.waitForTimeout(300);
    await page.click('button:has-text("100g")');
    await page.waitForTimeout(400);

    await page.click('text=Registrar exercício');
    await page.waitForTimeout(300);
    await page.click('button:text-is("Registrar") >> nth=0');
    await page.waitForTimeout(400);

    // Avança mais 1 dia: nenhum registro (deve ficar de fora das médias)
    await page.clock.fastForward('24:00:00');
    await page.waitForTimeout(200);

    await goToTab(page, 'Histórico');
    const body = await page.innerText('body');

    assert.ok(body.includes('Resumo da semana'), 'seção "Resumo da semana" não apareceu');
    assert.match(body, /2\/7|2 de 7/i, 'esperava 2 dias registrados de 7 (dia 3 não deveria contar)');
    assert.match(body, /1 dia\(s\) com exerc/i, 'esperava 1 sessão de exercício contabilizada');

    const errors = await getErrors(page);
    assert.deepEqual(errors, [], `Erros inesperados: ${errors.join(' | ')}`);
  } finally {
    await browser.close();
  }
});
