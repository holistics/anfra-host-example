// A query's own AQL, read into its parts: what the panel lists, and later what it rewrites.

/** One entry of a section: `alias: expression`, or the whole text when it has no alias. */
export interface AqlEntry {
  alias?: string;
  expression: string;
}

/** The sections of an `explore { … }`, each in the order written. */
export interface ExploreParts {
  dimensions: AqlEntry[];
  measures: AqlEntry[];
  filters: AqlEntry[];
  sorts: AqlEntry[];
}

const SECTIONS = ['dimensions', 'measures', 'filters', 'sorts'] as const;

/** The AQL without its `//` and block comments, quotes respected. */
function withoutComments(text: string): string {
  let out = '';
  let quote: string | undefined;
  for (let i = 0; i < text.length; i++) {
    const ch = text[i] ?? '';
    if (quote) {
      out += ch;
      if (ch === '\\') out += text[++i] ?? '';
      else if (ch === quote) quote = undefined;
    } else if (ch === '"' || ch === "'" || ch === '`') {
      quote = ch;
      out += ch;
    } else if (ch === '/' && text[i + 1] === '/') {
      while (i < text.length && text[i] !== '\n') i++;
      i--;
    } else if (ch === '/' && text[i + 1] === '*') {
      const end = text.indexOf('*/', i + 2);
      i = end < 0 ? text.length : end + 1;
      out += ' ';
    } else out += ch;
  }
  return out;
}

/** The text inside the `{ … }` opening at `open`, braces and quotes balanced; undefined if it never closes. */
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

/** Splits at commas, newlines and `;` outside brackets and quotes. */
function splitEntries(block: string): string[] {
  const entries: string[] = [];
  let depth = 0;
  let quote: string | undefined;
  let current = '';
  for (let i = 0; i < block.length; i++) {
    const ch = block[i] ?? '';
    if (quote) {
      if (ch === '\\') {
        current += ch + (block[++i] ?? '');
        continue;
      }
      if (ch === quote) quote = undefined;
    } else if (ch === '"' || ch === "'" || ch === '`') quote = ch;
    else if ('({['.includes(ch)) depth++;
    else if (')}]'.includes(ch)) depth--;
    else if ((ch === ',' || ch === ';' || ch === '\n') && depth <= 0) {
      entries.push(current);
      current = '';
      continue;
    }
    current += ch;
  }
  entries.push(current);
  return entries.map((entry) => entry.trim().replace(/\s+/g, ' ')).filter(Boolean);
}

/** `alias: expression` split at its first top-level colon; a `::` or a colon in quotes is not one. */
function toEntry(text: string): AqlEntry {
  const match = /^([A-Za-z_][\w]*)\s*:(?!:)\s*(.+)$/s.exec(text);
  return match?.[1] && match[2] ? { alias: match[1], expression: match[2] } : { expression: text };
}

/**
 * The sections of the query's top-level `explore { … }`. A query that isn't one, or a section it
 * doesn't have, reads as empty: the panel then says so rather than guess.
 */
export function parseExplore(source: string | undefined): ExploreParts | undefined {
  const aql = source && withoutComments(source);
  const at = aql?.search(/\bexplore\s*\{/);
  if (!aql || at === undefined || at < 0) return undefined;
  const body = blockAt(aql, aql.indexOf('{', at));
  if (body === undefined) return undefined;
  const parts: ExploreParts = { dimensions: [], measures: [], filters: [], sorts: [] };
  for (const section of SECTIONS) {
    const found = new RegExp(`\\b${section}\\s*\\{`).exec(body);
    if (!found) continue;
    const block = blockAt(body, body.indexOf('{', found.index));
    if (block === undefined) continue;
    // Filters are conditions, not aliased fields: a colon there is part of the condition.
    parts[section] = splitEntries(block).map((entry) =>
      section === 'filters' ? { expression: entry } : toEntry(entry),
    );
  }
  return parts;
}
