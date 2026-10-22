import type { ColumnMeta } from '@holistics/anfra-sdk/common';
import {
  Binary,
  Braces,
  Calendar,
  CalendarClock,
  CircleHelp,
  Hash,
  type LucideIcon,
  Sigma,
  ToggleLeft,
  Type,
} from 'lucide-react';

/** The icon of a column's semantic type. */
export const typeIcon: Record<ColumnMeta['semantic_type'], LucideIcon> = {
  text: Type,
  number: Hash,
  date: Calendar,
  datetime: CalendarClock,
  truefalse: ToggleLeft,
  bit: Binary,
  json: Braces,
  unknown: CircleHelp,
};

/** A column's icon: Sigma for a metric, otherwise its semantic type's. */
export function columnIcon(column: Pick<ColumnMeta, 'isMeasure' | 'semantic_type'>): LucideIcon {
  return column.isMeasure ? Sigma : (typeIcon[column.semantic_type] ?? CircleHelp);
}
