import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
// Шрифты бандлятся в сборку, а не грузятся с CDN: приложение работает без сети и ничего о себе
// не сообщает наружу. Inter покрывает кириллицу тела; Fraunces — акцентные заголовки.
// Иконки — инлайновые SVG (components/Icon.tsx), веб-шрифта иконок больше нет.
import '@fontsource/fraunces/400.css';
import '@fontsource/fraunces/500.css';
import '@fontsource/inter/400.css';
import '@fontsource/inter/500.css';
import './styles/app.css';
import { App } from './App';
import { ErrorBoundary } from './components/ErrorBoundary';

const root = document.getElementById('root');
if (!root) throw new Error('Не найден #root');

createRoot(root).render(
  <StrictMode>
    <ErrorBoundary>
      <App />
    </ErrorBoundary>
  </StrictMode>,
);
