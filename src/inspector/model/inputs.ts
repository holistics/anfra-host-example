// What feeds a query, and what a control feeds: the mappings and cross-filters of the declaration,
// with each source's current value from the snapshot.
import type { InspectedApp } from '@holistics/anfra-sdk/common';
import { controlMappings, crossFilters } from './checks';
import { formatCondition } from './format';

/** One thing that filters a query: a control mapped to it, or a query cross-filtering it. */
export interface QueryInput {
  kind: 'control' | 'crossFilter';
  /** The control or query it comes from; the query itself for a self cross-filter. */
  source: string;
  self: boolean;
  /** The field it filters on, with its aggregation; for a cross-filter, the selected fields. */
  field: string;
  /** What it filters by right now, in words. */
  value: string;
}

/** The field a mapping filters on, with its aggregation. */
const mappingField = (m: ReturnType<typeof controlMappings>[number]) =>
  m.aggregation ? `${m.aggregation}(${m.field})` : m.field;

export function queryInputs(app: InspectedApp, query: string): QueryInput[] {
  const controls: QueryInput[] = controlMappings(app)
    .filter((m) => m.to.name === query)
    .map((m) => {
      const control = app.controls[m.from.name];
      const set = control?.condition.values?.length ? formatCondition(control.condition) : 'not set';
      return {
        kind: 'control',
        source: m.from.name,
        self: false,
        field: mappingField(m),
        value: set,
      };
    });
  const crosses: QueryInput[] = crossFilters(app)
    .filter((c) => c.to.name === query)
    .map((c) => {
      const selection = app.selection?.source === c.from.name ? app.selection : undefined;
      return {
        kind: 'crossFilter',
        source: c.from.name,
        self: c.from.name === query,
        field: selection?.fields.join(', ') || '—',
        value: selection
          ? selection.conditions
              .map((condition) => `${condition.field} ${formatCondition(condition)}`)
              .join('; ') ||
            selection.expression ||
            `${selection.rowCount} rows`
          : 'no selection',
      };
    });
  return [...controls, ...crosses];
}

/** The queries a control is mapped to, with the field each mapping filters on. */
export function controlTargets(app: InspectedApp, control: string) {
  return controlMappings(app)
    .filter((m) => m.from.name === control)
    .map((m) => ({ query: m.to.name, field: mappingField(m) }));
}
