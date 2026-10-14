// What feeds a query, and what a control feeds: the mappings and cross-filters of the declaration,
// with each source's current value from the snapshot.
import type { InspectedApp } from '@holistics/anfra-sdk/common';
import { controlMappings, crossFilters } from './checks';
import { formatCondition } from './format';

/** One thing that filters a query: its own `filters` block, a control mapped to it, or a query cross-filtering it. */
export interface QueryInput {
  kind: 'declared' | 'control' | 'crossFilter';
  /** The control or query it comes from; the query itself for a self cross-filter. */
  source: string;
  self: boolean;
  /** The field it filters on, with its aggregation; for a cross-filter, the selected fields. */
  field: string;
  /** What the query was last run with, in words: the applied value, not the one being edited. */
  value: string;
  /** The changed value not yet applied, in words, when it differs from `value`. */
  pending?: string;
}

type Selection = NonNullable<InspectedApp['appliedSelection']>;

/** The field a mapping filters on, with its aggregation. */
const mappingField = (m: ReturnType<typeof controlMappings>[number]) =>
  m.aggregation ? `${m.aggregation}(${m.field})` : m.field;

const conditionText = (condition: InspectedApp['controls'][string]['condition'] | undefined) =>
  condition?.values?.length ? formatCondition(condition) : 'not set';

const selectionText = (selection: Selection | undefined) =>
  selection
    ? selection.conditions
        .map((condition) => `${condition.field} ${formatCondition(condition)}`)
        .join('; ') ||
      selection.expression ||
      `${selection.rowCount} rows`
    : 'no selection';

export function queryInputs(app: InspectedApp, query: string): QueryInput[] {
  const controls: QueryInput[] = controlMappings(app)
    .filter((m) => m.to.name === query)
    .map((m) => {
      const control = app.controls[m.from.name];
      const value = conditionText(control?.appliedCondition);
      const current = conditionText(control?.condition);
      return {
        kind: 'control',
        source: m.from.name,
        self: false,
        field: mappingField(m),
        value,
        pending: control?.isDirty && current !== value ? current : undefined,
      };
    });
  const crosses: QueryInput[] = crossFilters(app)
    .filter((c) => c.to.name === query)
    .map((c) => {
      const from = (selection: Selection | undefined) =>
        selection?.source === c.from.name ? selection : undefined;
      const applied = from(app.appliedSelection);
      const current = from(app.selection);
      const value = selectionText(applied);
      const next = selectionText(current);
      return {
        kind: 'crossFilter',
        source: c.from.name,
        self: c.from.name === query,
        field: (applied ?? current)?.fields.join(', ') || '—',
        value,
        pending: next !== value ? next : undefined,
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

/** The text of the `{ … }` block opening at `open`, braces and quotes balanced; undefined if it never closes. */
function blockAt(text: string, open: number): string | undefined {
  let depth = 0;
  let quote: string | undefined;
  for (let i = open; i < text.length; i++) {
    const ch = text[i] ?? '';
    if (quote) {
      if (ch === '\\') i++;
      else if (ch === quote) quote = undefined;
    } else if (ch === '"' || ch === "'" || ch === '`') quote = ch;
    else if (ch === '{') depth++;
    else if (ch === '}' && --depth === 0) return text.slice(open + 1, i);
  }
  return undefined;
}

/** Splits at newlines and `;` outside brackets and quotes, so a condition may span lines. */
function splitEntries(block: string): string[] {
  const entries: string[] = [];
  let depth = 0;
  let quote: string | undefined;
  let current = '';
  for (let i = 0; i < block.length; i++) {
    const ch = block[i] ?? '';
    if (quote) {
      if (ch === '\\') current += block[i++] ?? '';
      else if (ch === quote) quote = undefined;
    } else if (ch === '"' || ch === "'" || ch === '`') quote = ch;
    else if ('({['.includes(ch)) depth++;
    else if (')}]'.includes(ch)) depth--;
    else if ((ch === ';' || ch === '\n') && depth <= 0) {
      entries.push(current);
      current = '';
      continue;
    }
    current += ch;
  }
  entries.push(current);
  return entries.map((entry) => entry.trim()).filter(Boolean);
}

const CONDITION = /^(.*?)\s+(==|!=|>=|<=|>|<|not in|in|is not|is|like|not like|matches|not matches)\s+(.+)$/s;

/**
 * The filters a query's own AQL declares: each entry of its `filters { … }` block, as the field
 * it filters and the condition on it. An entry that isn't `field operator value` keeps its whole
 * text as the field.
 */
export function declaredFilters(aql: string | undefined): QueryInput[] {
  const at = aql?.search(/\bfilters\s*\{/);
  if (!aql || at === undefined || at < 0) return [];
  const block = blockAt(aql, aql.indexOf('{', at));
  if (block === undefined) return [];
  return splitEntries(block).map((entry) => {
    const text = entry.replace(/\s+/g, ' ');
    const match = CONDITION.exec(text);
    return {
      kind: 'declared',
      source: 'query',
      self: true,
      field: match?.[1] ?? text,
      value: match ? `${match[2]} ${match[3]}` : '—',
    };
  });
}
