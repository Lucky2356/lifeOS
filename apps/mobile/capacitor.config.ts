import type { CapacitorConfig } from '@capacitor/cli';

/**
 * Android-оболочка Life OS. Общий UI (apps/app/dist) грузится как webDir; вся логика и все данные —
 * на устройстве (ADR 0006), сервера нет.
 *
 * appId и androidScheme определяют origin, к которому привязана IndexedDB с данными пользователя.
 * Менять их нельзя — данные станут недоступны.
 */
const config: CapacitorConfig = {
  appId: 'com.lifeos.app',
  appName: 'Life OS',
  webDir: '../app/dist',
  server: {
    androidScheme: 'https',
  },
};

export default config;
