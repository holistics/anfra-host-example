import type { ColumnMeta } from '@holistics/anfra-sdk/common';
import {
  Binary,
  Braces,
  Calendar,
  CalendarClock,
  CircleHelp,
  Hash,
  type LucideIcon,
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
