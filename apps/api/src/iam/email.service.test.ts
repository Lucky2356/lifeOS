import { describe, it, expect } from 'vitest';
import { escapeHtml } from './email.service';

describe('escapeHtml (защита письма от инъекции разметки)', () => {
  it('экранирует спецсимволы HTML', () => {
    expect(escapeHtml('<script>alert(1)</script>')).toBe('&lt;script&gt;alert(1)&lt;/script&gt;');
    expect(escapeHtml(`Полис "А" & <b>долг</b>`)).toBe('Полис &quot;А&quot; &amp; &lt;b&gt;долг&lt;/b&gt;');
  });

  it('обычный текст не меняется', () => {
    expect(escapeHtml('Загранпаспорт')).toBe('Загранпаспорт');
  });
});
