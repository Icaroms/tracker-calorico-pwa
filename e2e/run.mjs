#!/usr/bin/env node
/**
 * e2e/run.mjs
 * -----------
 * Builda o app, sobe `vite preview` numa porta fixa, espera responder,
 * roda todos os specs E2E via `node --test`, e derruba o server no final
 * (sucesso ou falha). Um comando só: `npm run test:e2e`.
 */
import { spawn } from 'node:child_process';
import { setTimeout as sleep } from 'node:timers/promises';

const PORT = process.env.E2E_PORT || '4199';
process.env.E2E_BASE_URL = `http://localhost:${PORT}`;

function run(cmd, args, opts = {}) {
  return new Promise((resolve, reject) => {
    const p = spawn(cmd, args, { stdio: 'inherit', ...opts });
    p.on('exit', (code) => (code === 0 ? resolve() : reject(new Error(`${cmd} saiu com código ${code}`))));
  });
}

async function waitForServer(url, timeoutMs = 15000) {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    try {
      const res = await fetch(url);
      if (res.ok) return;
    } catch { /* ainda não subiu */ }
    await sleep(300);
  }
  throw new Error(`Servidor não respondeu em ${url} depois de ${timeoutMs}ms`);
}

async function main() {
  console.log('▶ Build de produção...');
  await run('npm', ['run', 'build']);

  console.log(`▶ Subindo preview na porta ${PORT}...`);
  const preview = spawn('npx', ['vite', 'preview', '--port', PORT, '--host'], {
    stdio: ['ignore', 'pipe', 'pipe'],
    detached: true,
  });
  preview.stdout.on('data', () => {});
  preview.stderr.on('data', (d) => process.stderr.write(d));

  try {
    await waitForServer(`http://localhost:${PORT}`);
    console.log('▶ Rodando specs E2E...');
    await run('sh', ['-c', 'node --test e2e/*.spec.mjs']);
    console.log('✓ E2E passou.');
  } finally {
    // mata o grupo de processos (detached) — vite preview solta subprocessos
    try { process.kill(-preview.pid, 'SIGTERM'); } catch { /* já morto */ }
  }
}

main().catch((err) => {
  console.error('✗ E2E falhou:', err.message);
  process.exit(1);
});
