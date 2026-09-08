import { useId } from 'react';
import { objectFields, sensitivityLabels, type ObjectType, type Sensitivity } from '@life-os/domain';
import { useLocale } from '../lib/i18n';

/**
 * Общие поля карточки объекта: значения, специфичные для типа, и уровень чувствительности.
 * Одни и те же элементы нужны и при создании, и при правке — держим их в одном месте,
 * чтобы формы не разъезжались.
 */

export function SensitivityField({
  value,
  onChange,
}: {
  value: Sensitivity;
  onChange: (next: Sensitivity) => void;
}) {
  const id = useId();
  const locale = useLocale();
  return (
    <div className="field">
      <label htmlFor={id}>Чувствительность</label>
      <select id={id} value={value} onChange={(e) => onChange(e.target.value as Sensitivity)}>
        {(Object.keys(sensitivityLabels) as Sensitivity[]).map((s) => (
          <option key={s} value={s}>
            {sensitivityLabels[s][locale]}
          </option>
        ))}
      </select>
      <div className="page-sub" style={{ fontSize: 12, marginTop: 5 }}>
        Значения выше обычной скрыты в карточке, пока их не откроют.
      </div>
    </div>
  );
}

/** Поля, специфичные для типа объекта. Одинаковы при создании и при правке. */
export function TypeFields({
  type,
  data,
  onChange,
}: {
  type: ObjectType;
  data: Record<string, string>;
  onChange: (key: string, value: string) => void;
}) {
  // Свой префикс id на каждый экземпляр — формы создания и правки не должны конфликтовать.
  const prefix = useId();
  const locale = useLocale();
  return (
    <>
      {objectFields[type].map((spec) => (
        <div className="field" key={spec.key}>
          <label htmlFor={`${prefix}${spec.key}`}>{spec.label[locale]}</label>
          <input
            id={`${prefix}${spec.key}`}
            type={spec.kind}
            value={data[spec.key] ?? ''}
            onChange={(e) => onChange(spec.key, e.target.value)}
            placeholder={spec.placeholder?.[locale]}
          />
        </div>
      ))}
    </>
  );
}
