import { z } from 'zod';

/**
 * Базовые типы «объектов жизни» ядра Life Ledger. Расширяется справочниками из
 * content pack (типы документов региона) без изменения структуры таблиц (ADR 0004).
 */
export const objectTypes = [
  'document',
  'warranty_item',
  'subscription',
  'insurance',
  'property',
  'vehicle',
  'health_record',
  'financial_obligation',
] as const;

export type ObjectType = (typeof objectTypes)[number];

export const objectTypeSchema = z.enum(objectTypes);

export const objectTypeLabels: Record<ObjectType, { ru: string; en: string }> = {
  document: { ru: 'Документ', en: 'Document' },
  warranty_item: { ru: 'Вещь с гарантией', en: 'Warranty item' },
  subscription: { ru: 'Подписка', en: 'Subscription' },
  insurance: { ru: 'Страховка', en: 'Insurance' },
  property: { ru: 'Недвижимость', en: 'Property' },
  vehicle: { ru: 'Транспорт', en: 'Vehicle' },
  health_record: { ru: 'Здоровье', en: 'Health record' },
  financial_obligation: { ru: 'Финансовое обязательство', en: 'Financial obligation' },
};
