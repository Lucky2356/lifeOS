import { mergeConfig, defineConfig } from 'vitest/config';
import viteConfig from './vite.config';

// Тесты веба: переиспользуем алиасы из vite.config (напр. @life-os/domain), окружение jsdom
// (нужны window/localStorage/fetch-стабы для клиентской логики авторизации и офлайн-очереди).
export default mergeConfig(
  viteConfig,
  defineConfig({
    test: {
      environment: 'jsdom',
      include: ['src/**/*.test.{ts,tsx}'],
    },
  }),
);
