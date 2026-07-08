import type { CapacitorConfig } from '@capacitor/cli';

/**
 * Android-оболочка Life OS. Тот же PWA (apps/web/dist) грузится как webDir; вся логика — в веб-слое.
 * API-адрес задаётся при сборке через VITE_API_BASE (по умолчанию для эмулятора — 10.0.2.2 = хост).
 * cleartext разрешён, чтобы обращаться к локальному http-бэкенду при самостоятельном хостинге.
 */
const config: CapacitorConfig = {
  appId: 'com.lifeos.app',
  appName: 'Life OS',
  webDir: '../web/dist',
  server: {
    androidScheme: 'https',
    cleartext: true,
  },
};

export default config;
