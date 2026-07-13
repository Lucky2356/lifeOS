import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
// Иконки Tabler самохостятся (бандлятся Vite), а не грузятся с CDN: работает офлайн/в локальном
// режиме и не блокируется CSP (font-src/style-src 'self') в проде.
import '@tabler/icons-webfont/dist/tabler-icons.min.css';
import './styles/app.css';
import { App } from './App';

const root = document.getElementById('root');
if (!root) throw new Error('Не найден #root');

createRoot(root).render(
  <StrictMode>
    <App />
  </StrictMode>,
);

if (import.meta.env.PROD && 'serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    void navigator.serviceWorker.register('/sw.js').then((reg) => {
      // Мгновенное автообновление: когда новый SW берёт управление — перезагружаем.
      let refreshing = false;
      navigator.serviceWorker.addEventListener('controllerchange', () => {
        if (refreshing) return;
        refreshing = true;
        window.location.reload();
      });
      reg.addEventListener('updatefound', () => {
        const next = reg.installing;
        if (!next) return;
        next.addEventListener('statechange', () => {
          if (next.state === 'installed' && navigator.serviceWorker.controller) {
            next.postMessage({ type: 'SKIP_WAITING' });
          }
        });
      });
      // Периодически проверяем наличие нового релиза.
      const check = () => {
        void reg.update();
      };
      setInterval(check, 60_000);
      window.addEventListener('focus', check);
    });
  });
}
