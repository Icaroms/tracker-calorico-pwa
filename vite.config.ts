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
});
