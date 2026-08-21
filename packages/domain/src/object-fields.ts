import type { ObjectType } from './object-types';
import type { Sensitivity } from './life-object';

/**
 * Что именно записывают в объект каждого типа. Ядро Life Ledger хранит эти значения в свободном
 * `data`, а каталог ниже говорит интерфейсу, какие поля показать: без него реестр вырождается в
 * список названий, где номер паспорта и сумму кредита записать некуда.
 *
 * Каталог — часть предметной области, а не интерфейса: он же определяет, что попадёт в резервную
 * копию и что имеет смысл маскировать.
 */

export type FieldKind = 'text' | 'number' | 'date';

export interface ObjectFieldSpec {
  /** Ключ в `data`. Менять нельзя — по нему лежат уже сохранённые значения. */
  key: string;
  label: { ru: string; en: string };
  kind: FieldKind;
  placeholder?: string;
}

const f = (
  key: string,
  ru: string,
  en: string,
  kind: FieldKind = 'text',
  placeholder?: string,
): ObjectFieldSpec => ({ key, label: { ru, en }, kind, placeholder });

export const objectFields: Record<ObjectType, ObjectFieldSpec[]> = {
  document: [f('number', 'Серия и номер', 'Number'), f('issuedBy', 'Кем выдан', 'Issued by')],
  warranty_item: [
    f('model', 'Марка и модель', 'Make and model'),
    f('serial', 'Серийный номер', 'Serial number'),
    f('seller', 'Где куплено', 'Seller'),
    f('price', 'Стоимость', 'Price', 'number'),
  ],
  subscription: [
    f('price', 'Стоимость', 'Price', 'number'),
    f('period', 'Периодичность', 'Billing period', 'text', 'ежемесячно'),
    f('account', 'Аккаунт', 'Account'),
  ],
  insurance: [
    f('policyNumber', 'Номер полиса', 'Policy number'),
    f('company', 'Страховая компания', 'Insurer'),
    f('coverage', 'Страховая сумма', 'Coverage', 'number'),
    f('phone', 'Телефон поддержки', 'Support phone'),
  ],
  property: [
    f('address', 'Адрес', 'Address'),
    f('area', 'Площадь, м²', 'Area, m²', 'number'),
    f('cadastral', 'Кадастровый номер', 'Cadastral number'),
  ],
  vehicle: [
    f('plate', 'Госномер', 'Plate'),
    f('model', 'Марка и модель', 'Make and model'),
    f('vin', 'VIN', 'VIN'),
    f('year', 'Год выпуска', 'Year', 'number'),
  ],
  health_record: [
    f('doctor', 'Врач или клиника', 'Doctor or clinic'),
    f('details', 'Диагноз, назначение', 'Diagnosis, prescription'),
    f('phone', 'Телефон', 'Phone'),
  ],
  financial_obligation: [
    f('creditor', 'Кому', 'Creditor'),
    f('amount', 'Сумма', 'Amount', 'number'),
    f('payment', 'Ежемесячный платёж', 'Monthly payment', 'number'),
    f('rate', 'Ставка, %', 'Rate, %', 'number'),
  ],
};

/**
 * Разумная чувствительность по умолчанию для типа. Пользователь может изменить её вручную;
 * смысл в том, чтобы медкарта и документы не оказывались открытыми по недосмотру.
 */
export function defaultSensitivityFor(type: ObjectType): Sensitivity {
  if (type === 'health_record') return 'high';
  if (type === 'document' || type === 'insurance' || type === 'financial_obligation') {
    return 'sensitive';
  }
  return 'normal';
}

/** Подпись поля по ключу — чтобы показать уже сохранённые данные, в том числе из старых версий. */
export function fieldLabel(type: ObjectType, key: string, locale: 'ru' | 'en' = 'ru'): string {
  return objectFields[type].find((spec) => spec.key === key)?.label[locale] ?? key;
}
