import { daysUntil, lifecycleFor, type LifeObject, type ObjectType } from '@life-os/domain';

/** Иконка (Tabler) для каждого типа объекта. */
export const typeIcons: Record<ObjectType, string> = {
  document: 'ti-id',
  warranty_item: 'ti-shield-check',
  subscription: 'ti-repeat',
  insurance: 'ti-file-invoice',
  property: 'ti-building',
  vehicle: 'ti-car',
  health_record: 'ti-heartbeat',
  financial_obligation: 'ti-building-bank',
};

export interface Pill {
  cls: string;
  label: string;
}

/** Спокойная подача статуса по дедлайну (см. docs/DESIGN.md). */
export function lifecyclePill(o: LifeObject, now: Date = new Date()): Pill {
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
