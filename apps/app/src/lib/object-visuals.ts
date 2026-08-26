import { daysUntil, lifecycleFor, type LifeObject, type ObjectType } from '@life-os/domain';

/** Имя иконки для каждого типа объекта (см. components/Icon.tsx). */
export const typeIcons: Record<ObjectType, string> = {
  document: 'id',
  warranty_item: 'shield-check',
  subscription: 'repeat',
  insurance: 'file-invoice',
  property: 'building',
  vehicle: 'car',
  health_record: 'heartbeat',
  financial_obligation: 'building-bank',
};

export interface Pill {
  cls: string;
  label: string;
}

/** Спокойная подача статуса по дедлайну (см. docs/DESIGN.md). */
export function lifecyclePill(o: LifeObject, now: Date = new Date()): Pill {
  // Архивное не кричит о сроках: объект убран сознательно, «просрочено» здесь было бы ложной тревогой.
  if (o.status === 'archived') return { cls: 'pill-none', label: 'в архиве' };

  const state = lifecycleFor(o.validUntil, now);
  const days = daysUntil(o.validUntil, now);
  switch (state) {
    case 'overdue':
      return {
        cls: 'pill-overdue',
        label: days !== null ? `просрочено ${Math.abs(days)} дн.` : 'просрочено',
      };
    case 'due_soon':
      return { cls: 'pill-due', label: days !== null ? `через ${days} дн.` : 'скоро' };
    case 'ok':
      return { cls: 'pill-ok', label: 'действует' };
    default:
      return { cls: 'pill-none', label: 'без срока' };
  }
}
