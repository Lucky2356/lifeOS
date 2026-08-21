import { useId } from 'react';
import { objectFields, type ObjectType, type Sensitivity } from '@life-os/domain';

/**
 * Общие поля карточки объекта: значения, специфичные для типа, и уровень чувствительности.
 * Одни и те же элементы нужны и при создании, и при правке — держим их в одном месте,
 * чтобы формы не разъезжались.
 */

export const sensitivityLabels: Record<Sensitivity, string> = {
  normal: 'Обычная',
  sensitive: 'Чувствительная',
  high: 'Повышенная',
};

export function SensitivityField({
  value,
  onChange,
}: {
  value: Sensitivity;
  onChange: (next: Sensitivity) => void;
}) {
  const id = useId();
  return (
    <div className="field">
      <label htmlFor={id}>Чувствительность</label>
      <select id={id} value={value} onChange={(e) => onChange(e.target.value as Sensitivity)}>
        {(Object.keys(sensitivityLabels) as Sensitivity[]).map((s) => (
          <option key={s} value={s}>
            {sensitivityLabels[s]}
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
  return (
    <>
      {objectFields[type].map((spec) => (
        <div className="field" key={spec.key}>
          <label htmlFor={`${prefix}${spec.key}`}>{spec.label.ru}</label>
          <input
            id={`${prefix}${spec.key}`}
            type={spec.kind === 'number' ? 'number' : spec.kind === 'date' ? 'date' : 'text'}
            value={data[spec.key] ?? ''}
            onChange={(e) => onChange(spec.key, e.target.value)}
            placeholder={spec.placeholder}
          />
        </div>
      ))}
    </>
  );
}
