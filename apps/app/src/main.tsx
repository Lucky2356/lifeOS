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
// По-английски намеренно: сюда попадают только при сломанной сборке без #root в index.html,
// и читает это разработчик рядом с английским стеком, а не пользователь.
if (!root) throw new Error('Life OS: #root element is missing');

createRoot(root).render(
  <StrictMode>
    <ErrorBoundary>
      <App />
    </ErrorBoundary>
  </StrictMode>,
);
