/**
 * e2e/helpers.mjs
 * ---------------
 * Compartilhado entre os specs E2E. Usa `playwright` (biblioteca, já é
 * devDependency) diretamente — sem `@playwright/test`, pra não precisar
 * instalar/depender de mais nada.
 *
 * QUIRK DO AMBIENTE: `npx playwright install chromium` falha por rede
 * restrita em alguns ambientes de CI/sandbox. Se isso acontecer, tenta
 * achar um Chromium já presente no sistema (ex.: cache do Puppeteer, ou um
 * Chromium pré-instalado pelo provedor do ambiente) antes de desistir.
 * Configurável via PLAYWRIGHT_CHROMIUM_PATH se o caminho for outro.
 */
import { chromium } from 'playwright';
import { existsSync } from 'node:fs';

const CANDIDATE_PATHS = [
  process.env.PLAYWRIGHT_CHROMIUM_PATH,
  '/opt/pw-browsers/chromium-1194/chrome-linux/chrome', // presente neste sandbox
  process.env.HOME + '/.cache/puppeteer/chrome/linux-131.0.6778.204/chrome-linux64/chrome',
].filter(Boolean);

function findChromiumPath() {
  for (const p of CANDIDATE_PATHS) {
    if (existsSync(p)) return p;
  }
  return undefined; // deixa o Playwright tentar o padrão dele
}

export async function launchBrowser() {
  const executablePath = findChromiumPath();
  return chromium.launch({
    executablePath,
    args: ['--no-sandbox'],
  });
}

export const BASE_URL = process.env.E2E_BASE_URL || 'http://localhost:4173';

/** Instala um hook que captura erro real do app (não a representação minificada do console.error). */
export async function installErrorCapture(page) {
  await page.addInitScript(() => {
    window.__e2eErrors = [];
    const orig = console.error;
    console.error = (...args) => {
      try {
        window.__e2eErrors.push(args.map((a) => (a instanceof Error ? `${a.name}: ${a.message}` : String(a))).join(' | '));
      } catch { /* noop */ }
      orig.apply(console, args);
    };
    window.addEventListener('error', (e) => window.__e2eErrors.push('window.error: ' + e.message));
  });
}

export async function getErrors(page) {
  return page.evaluate(() => window.__e2eErrors || []);
}

/** Passa pelo onboarding (1ª execução) se ele aparecer — idempotente. */
export async function completeOnboarding(page, { heightCm = 175, age = 25, weightKg = 80 } = {}) {
  await page.goto(BASE_URL, { waitUntil: 'networkidle' });
  await page.waitForTimeout(400);
  if (await page.$('text=Vamos começar')) {
    await page.fill('input[type="number"] >> nth=0', String(heightCm));
    await page.fill('input[type="number"] >> nth=1', String(age));
    await page.click('text=Masculino');
    await page.click('text=Moderado');
    await page.click('text=Continuar');
    await page.waitForTimeout(300);
    await page.click('text=Continuar');
    await page.waitForTimeout(300);
    await page.fill('input[type="number"] >> nth=0', String(weightKg));
    await page.click('text=Começar a usar');
    await page.waitForTimeout(800);
  }
}

/** Aba "Registrar" está sempre no <nav> — evita colidir com textos iguais em outro lugar da tela. */
export async function goToTab(page, label) {
  await page.click(`nav >> text=${label}`);
  await page.waitForTimeout(400);
}
