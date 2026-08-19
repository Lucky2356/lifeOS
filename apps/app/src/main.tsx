import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
// Шрифты и иконки бандлятся в сборку, а не грузятся с CDN: приложение работает без сети и
// ничего о себе не сообщает наружу. Inter покрывает кириллицу тела; Fraunces — акцентные заголовки.
import '@fontsource/fraunces/400.css';
import '@fontsource/fraunces/500.css';
import '@fontsource/inter/400.css';
import '@fontsource/inter/500.css';
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
