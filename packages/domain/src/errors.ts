/**
 * Ошибки предметной области несут код, а не готовый текст.
 *
 * Домен ничего не знает ни о языке интерфейса, ни о словаре — и знать не должен: передавать сюда
 * локаль значило бы заразить ею каждую сигнатуру и сделать чистые функции языкозависимыми.
 * Приложение отображает код в ключ сообщения полным `Record`, поэтому новый код без перевода
 * не соберётся.
 *
 * `pickText` тут не контрпример: там двуязычны сами данные, а текст ошибки — не данные.
 */
export const domainErrorCodes = [
  /** Выбранного варианта нет в решении. */
  'option_not_in_decision',
  /** Исход записывается только для принятого решения. */
  'outcome_requires_decided',
  /** Из срока не получается дата. */
  'invalid_deadline',
] as const;

export type DomainErrorCode = (typeof domainErrorCodes)[number];

export class DomainError extends Error {
  constructor(readonly code: DomainErrorCode) {
    // Сообщение — код: его читает разработчик в стеке, человеку текст подбирает приложение.
    super(code);
    this.name = 'DomainError';
  }
}
