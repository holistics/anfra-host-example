// What the panel does to a query's parts: add and remove fields, swap a measure, filters and sorts.
// Every change returns new parts; `writeExplore` turns them back into AQL.
import type { AqlEntry, ExploreParts } from './aql';
import type { FieldOption } from './fields';

const escapeRe = (text: string) => text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

/** Whether an expression names `ref` as a whole name: `orders.created_at`, not `orders.created_at_utc`. */
export function mentions(expression: string, ref: string): boolean {
  return new RegExp(`(^|[^\\w.])${escapeRe(ref)}(?![\\w])`).test(expression);
}

/** Every alias the query's dimensions and measures use. */
export const aliasesOf = (parts: ExploreParts) =>
  [...parts.dimensions, ...parts.measures].map((entry) => entry.alias).filter((a): a is string => !!a);

/** A new alias for `ref`: its last name, made unique among `taken` with a number. */
export function aliasFor(ref: string, taken: string[]): string {
  const base = (ref.split('.').pop() ?? ref).replace(/\W/g, '_').replace(/^(\d)/, '_$1') || 'field';
  let alias = base;
  for (let n = 2; taken.includes(alias); n++) alias = `${base}_${n}`;
  return alias;
}

/** Ticked: a metric becomes a measure, a field a dimension, each under a new alias. */
export function addField(parts: ExploreParts, option: FieldOption): ExploreParts {
  const entry: AqlEntry = { alias: aliasFor(option.ref, aliasesOf(parts)), expression: option.ref };
  return option.kind === 'metric'
    ? { ...parts, measures: [...parts.measures, entry] }
    : { ...parts, dimensions: [...parts.dimensions, entry] };
}

/**
 * Unticked: every measure that is `ref` itself, and every dimension built on it (`date_trunc(ref, …)`
 * too). A sort on a removed alias goes with it, since it would no longer name a column.
 */
export function removeField(parts: ExploreParts, ref: string): ExploreParts {
  const dimensions = parts.dimensions.filter((entry) => !mentions(entry.expression, ref));
  const measures = parts.measures.filter((entry) => entry.expression !== ref);
  const kept = aliasesOf({ ...parts, dimensions, measures });
  const removed = aliasesOf(parts).filter((alias) => !kept.includes(alias));
  const sorts = parts.sorts.filter((entry) => !removed.some((alias) => mentions(entry.expression, alias)));
  return { ...parts, dimensions, measures, sorts };
}

/** A measure given another metric, under the same alias: the page's code reads it by that alias. */
export function swapMeasure(parts: ExploreParts, alias: string, ref: string): ExploreParts {
  return {
    ...parts,
    measures: parts.measures.map((entry) => (entry.alias === alias ? { alias, expression: ref } : entry)),
  };
}

/** The operators the panel offers, as AQL writes them. `contains` is a `like` with wildcards. */
export const OPERATORS = [
  { value: '==', label: 'is' },
  { value: '!=', label: 'is not' },
  { value: 'contains', label: 'contains' },
  { value: '>', label: 'greater than' },
  { value: '>=', label: 'at least' },
  { value: '<', label: 'less than' },
  { value: '<=', label: 'at most' },
] as const;
export type FilterOperator = (typeof OPERATORS)[number]['value'];

const NUMBER_TYPES = /^(number|integer|int|float|double|decimal)$/i;
const DATE_TYPES = /^(date|datetime|timestamp)$/i;

/** A value as an AQL literal for a field of `type`: `3`, `@2024-01-01`, `true`, or `'text'`. */
export function literal(type: string, value: string): string {
  const text = value.trim();
  if (NUMBER_TYPES.test(type) && text !== '' && Number.isFinite(Number(text))) return text;
  if (DATE_TYPES.test(type) && /^\d{4}-\d{2}-\d{2}/.test(text)) return `@${text}`;
  if (/^(truefalse|boolean|bool)$/i.test(type) && /^(true|false)$/i.test(text)) return text.toLowerCase();
  return `'${text.replace(/\\/g, '\\\\').replace(/'/g, "\\'")}'`;
}

/** One condition on a field, as AQL: `orders.status == 'completed'`. */
export function conditionText(field: string, type: string, operator: FilterOperator, value: string): string {
  if (operator === 'contains') return `${field} like ${literal('text', `%${value.trim()}%`)}`;
  return `${field} ${operator} ${literal(type, value)}`;
}

export const addFilter = (parts: ExploreParts, expression: string): ExploreParts => ({
  ...parts,
  filters: [...parts.filters, { expression }],
});

export const removeAt = (parts: ExploreParts, section: 'filters' | 'sorts', index: number): ExploreParts => ({
  ...parts,
  [section]: parts[section].filter((_, i) => i !== index),
});

/** The sorts as `{ alias, direction }`, read from `period asc`. */
export function sortsOf(parts: ExploreParts): { alias: string; direction: 'asc' | 'desc' }[] {
  return parts.sorts.map((entry) => {
    const [alias = '', direction] = entry.expression.split(/\s+/);
    return { alias, direction: direction?.toLowerCase() === 'desc' ? 'desc' : 'asc' };
  });
}

export const setSorts = (
  parts: ExploreParts,
  sorts: { alias: string; direction: 'asc' | 'desc' }[],
): ExploreParts => ({
  ...parts,
  sorts: sorts.map((sort) => ({ expression: `${sort.alias} ${sort.direction}` })),
});

/** One dimension or measure taken out by its alias, with any sort on it. */
export function removeAlias(parts: ExploreParts, alias: string): ExploreParts {
  const keep = (entry: AqlEntry) => entry.alias !== alias;
  return {
    ...parts,
    dimensions: parts.dimensions.filter(keep),
    measures: parts.measures.filter(keep),
    sorts: parts.sorts.filter((entry) => !mentions(entry.expression, alias)),
  };
}

/** Whether the parts use a field: a metric as a measure of its own, a field in any dimension. */
export function uses(parts: ExploreParts, option: FieldOption): boolean {
  return option.kind === 'metric'
    ? parts.measures.some((entry) => entry.expression === option.ref)
    : parts.dimensions.some((entry) => mentions(entry.expression, option.ref));
}

/** A measure written as a bare metric or `model.field`; anything else is the query's own expression. */
export const isBareRef = (expression: string) => /^[A-Za-z_]\w*(\.[A-Za-z_]\w*)?$/.test(expression);

/**
 * A field put in where another was taken out, in the same section, takes the old one's name. The
 * page's code reads columns by name, so unticking `revenue` and ticking `net_revenue`, in either
 * order, swaps the measure rather than renaming the column. Names the base never had stay new.
 */
export function keepAliases(base: ExploreParts, draft: ExploreParts): ExploreParts {
  const baseAliases = aliasesOf(base);
  const next = { ...draft };
  for (const section of ['dimensions', 'measures'] as const) {
    const present = aliasesOf(next);
    const freed = base[section].map((e) => e.alias).filter((a): a is string => !!a && !present.includes(a));
    let i = 0;
    next[section] = next[section].map((entry) => {
      if (!entry.alias || baseAliases.includes(entry.alias) || i >= freed.length) return entry;
      const alias = freed[i++] as string;
      next.sorts = next.sorts.map((sort) =>
        mentions(sort.expression, entry.alias as string)
          ? { expression: sort.expression.replace(entry.alias as string, alias) }
          : sort,
      );
      // A sort the base had on that name comes back with it: unticking took it out.
      for (const sort of base.sorts) {
        if (mentions(sort.expression, alias) && !next.sorts.some((s) => s.expression === sort.expression)) {
          next.sorts = [...next.sorts, sort];
        }
      }
      return { ...entry, alias };
    });
  }
  return next;
}
