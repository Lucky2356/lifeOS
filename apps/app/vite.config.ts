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
      // Бандлер компилирует TS-исходник доменного пакета напрямую — корректные named-экспорты.
      '@life-os/domain': fileURLToPath(new URL('../../packages/domain/src/index.ts', import.meta.url)),
      // Контент-пак РФ бандлится в приложение — Навигатор работает без сети (ADR 0004).
      '@content-pack-ru': fileURLToPath(new URL('../../content-packs/ru/pack.json', import.meta.url)),
    },
  },
  server: {
    port: 5173,
    // Разрешаем dev-серверу читать общий контент-пак из корня репозитория.
    fs: { allow: [fileURLToPath(new URL('../..', import.meta.url))] },
  },
});
