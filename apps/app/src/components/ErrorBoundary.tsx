import { Component, type ErrorInfo, type ReactNode } from 'react';
import { t } from '../lib/i18n';

/**
 * Последняя линия обороны интерфейса. Всё приложение стоит на IndexedDB, и если хранилище
 * недоступно (приватный режим, повреждённая база, нет места), без этого экрана человек видел бы
 * белый лист или вечное «Загрузка…» — без единой подсказки, что делать.
 *
 * Экран намеренно не предлагает «очистить данные»: при сбое чтения они могут быть целы, и стирать
 * единственную копию по совету приложения — худшее, что можно посоветовать.
 *
 * Классовый компонент, хуков здесь нет: берёт окружающий `t`. На смену языка он не перерисуется,
 * но к этому моменту приложение уже упало — перерисовывать нечего.
 */
export class ErrorBoundary extends Component<{ children: ReactNode }, { error: Error | null }> {
  override state: { error: Error | null } = { error: null };

  static getDerivedStateFromError(error: Error) {
    return { error };
  }

  override componentDidCatch(error: Error, info: ErrorInfo) {
    // По-английски намеренно: это диагностика в консоли рядом с английским стеком.
    console.error('Life OS: interface crash', error, info.componentStack);
  }

  override render() {
    const { error } = this.state;
    if (!error) return this.props.children;

    return (
      <main className="main" role="alert">
        <div className="serif page-title" style={{ marginBottom: 8 }}>
          {t('error.title')}
        </div>
        <div className="page-sub" style={{ maxWidth: 520, marginBottom: 18 }}>
          {t('error.body')}
        </div>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          <button className="btn btn-primary" onClick={() => window.location.reload()}>
            {t('error.restart')}
          </button>
        </div>
        <details style={{ marginTop: 22 }}>
          <summary className="page-sub" style={{ cursor: 'pointer' }}>
            {t('error.details')}
          </summary>
          <pre
            style={{
              fontSize: 12,
              color: 'var(--ink-3)',
              whiteSpace: 'pre-wrap',
              wordBreak: 'break-word',
              marginTop: 8,
            }}
          >
            {error.message}
          </pre>
        </details>
      </main>
    );
  }
}
