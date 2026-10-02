import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';

export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['favicon.svg'],
      manifest: {
        name: 'Tracker de Déficit Calórico',
        short_name: 'Tracker',
        description: 'Déficit calórico e micronutrientes, offline, no seu dispositivo.',
        theme_color: '#0E7C7B',
        background_color: '#EEF3F4',
        display: 'standalone',
        start_url: '/',
        icons: [
          { src: 'pwa-192.png', sizes: '192x192', type: 'image/png' },
          { src: 'pwa-512.png', sizes: '512x512', type: 'image/png' },
          { src: 'pwa-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
        ],
      },
      workbox: {
        // precache do app shell + a base de alimentos estática → roda offline
        globPatterns: ['**/*.{js,css,html,svg,png,woff2,json}'],
        // assume controle na hora e limpa cache velho — evita referenciar
        // um chunk antigo (ex.: das abas lazy) que já não existe mais
        skipWaiting: true,
        clientsClaim: true,
        cleanupOutdatedCaches: true,
      },
    }),
  ],
  build: {
    rollupOptions: {
      output: {
        manualChunks: {
          // ~590 alimentos da TACO num chunk isolado: muda raríssimo (só
          // quando alguém roda npm run build:foods de novo), então fica em
          // cache do navegador mesmo quando o código do app é atualizado.
          // Não é lazy-load real (ainda baixa no primeiro load — foodById
          // é usado de forma síncrona em vários lugares), mas evita
          // rebaixar ~250KB de dados a cada deploy de código sem tocar
          // nesse resolvedor síncrono.
          'taco-food-base': ['./src/lib/tacoFoodBase.generated.ts'],
        },
      },
    },
  },
  test: {
    environment: 'node',
    // fake-indexeddb: só os testes que tocam db.ts (Dexie) precisam disso —
    // a maioria dos testes é lógica pura e nem usa. Setup global é mais
    // simples que configurar por arquivo, e o custo é desprezível.
    setupFiles: ['./src/test/setup.ts'],
    // Testes rodam no fuso de Manaus (UTC−4), onde o app é usado de verdade.
    // Em UTC (padrão de CI) bugs de "dia errado" ficam invisíveis — foi assim
    // que o bug do toISOString() passou despercebido. Configurado aqui (e
    // não via `TZ=... vitest` no package.json) porque essa sintaxe não
    // funciona no cmd do Windows.
    env: { TZ: 'America/Manaus' },
    // e2e/*.spec.mjs usa node:test (não vitest) e precisa do preview server
    // no ar — roda via `npm run test:e2e`, não `npm test`. Sem isso o
    // Vitest tenta executá-los também (mesmo padrão *.spec.*) e falha.
    exclude: ['**/node_modules/**', 'e2e/**'],
  },
});
