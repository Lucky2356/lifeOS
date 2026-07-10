import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  define: {
    __APP_VERSION__: JSON.stringify(process.env.APP_VERSION ?? 'dev'),
  },
  resolve: {
    alias: {
      // Бандлер (Vite/Rollup) компилирует TS-исходник доменного пакета напрямую —
      // корректные named-экспорты; NestJS при этом потребляет собранный dist (CJS).
      '@life-os/domain': fileURLToPath(new URL('../../packages/domain/src/index.ts', import.meta.url)),
      // Контент-пак РФ бандлится в клиент — чтобы Навигатор работал офлайн/локально без сервера.
      '@content-pack-ru': fileURLToPath(new URL('../../content-packs/ru/pack.json', import.meta.url)),
    },
  },
  server: {
    port: 5173,
    // Разрешаем dev-серверу читать общий контент-пак из корня репозитория.
    fs: { allow: [fileURLToPath(new URL('../..', import.meta.url))] },
    proxy: {
      '/api': {
        target: process.env.VITE_API_TARGET ?? 'http://localhost:3011',
        changeOrigin: true,
      },
    },
  },
});
