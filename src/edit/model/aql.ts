// A query's own AQL, read into its parts, and written back with only the changed parts rewritten.

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

export type Section = keyof ExploreParts;
export const SECTIONS: readonly Section[] = ['dimensions', 'measures', 'filters', 'sorts'];

/** Where a section sits in the AQL: the whole `name { … }`, and the text between its braces. */
interface SectionSpan {
  start: number;
  end: number;
  innerStart: number;
  innerEnd: number;
}

/** Where the explore's own body sits, and each section in it. */
interface ExploreLayout {
  bodyStart: number;
  bodyEnd: number;
  sections: Partial<Record<Section, SectionSpan>>;
}

/**
 * The AQL with its `//` and block comments blanked out, quotes respected. Blanked, not removed, so
 * every position in it is the same in the AQL itself.
 */
function blankComments(text: string): string {
  let out = '';
  let quote: string | undefined;
  for (let i = 0; i < text.length; i++) {
    const ch = text[i] ?? '';
    if (quote) {
      out += ch;
      if (ch === '\\' && i + 1 < text.length) out += text[++i];
      else if (ch === quote) quote = undefined;
    } else if (ch === '"' || ch === "'" || ch === '`') {
      quote = ch;
      out += ch;
    } else if (ch === '/' && text[i + 1] === '/') {
      while (i < text.length && text[i] !== '\n') {
        out += ' ';
        i++;
      }
      i--;
    } else if (ch === '/' && text[i + 1] === '*') {
      const end = text.indexOf('*/', i + 2);
      const stop = end < 0 ? text.length : end + 2;
      for (; i < stop; i++) out += text[i] === '\n' ? '\n' : ' ';
      i--;
    } else out += ch;
  }
  return out;
}

/** The position of the `}` closing the `{` at `open`, braces and quotes balanced; -1 if it never closes. */
function closeOf(text: string, open: number): number {
  let depth = 0;
  let quote: string | undefined;
  for (let i = open; i < text.length; i++) {
    const ch = text[i] ?? '';
    if (quote) {
      if (ch === '\\') i++;
      else if (ch === quote) quote = undefined;
    } else if (ch === '"' || ch === "'" || ch === '`') quote = ch;
    else if (ch === '{') depth++;
    else if (ch === '}' && --depth === 0) return i;
  }
  return -1;
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

/** `alias: expression` split at its first top-level colon; a `::` is not one. */
function toEntry(text: string): AqlEntry {
  const match = /^([A-Za-z_]\w*)\s*:(?!:)\s*(.+)$/s.exec(text);
  return match?.[1] && match[2] ? { alias: match[1], expression: match[2] } : { expression: text };
}

function layoutOf(aql: string): { blank: string; layout: ExploreLayout } | undefined {
  const blank = blankComments(aql);
  const at = blank.search(/\bexplore\s*\{/);
  if (at < 0) return undefined;
  const open = blank.indexOf('{', at);
  const close = closeOf(blank, open);
  if (close < 0) return undefined;
  const layout: ExploreLayout = { bodyStart: open + 1, bodyEnd: close, sections: {} };
  // Only the explore's own sections: a `filters` inside a measure's function call is not one.
  let depth = 0;
  for (let i = open + 1; i < close; i++) {
    const ch = blank[i] ?? '';
    if (ch === '{') {
      const name = /(\w+)\s*$/.exec(blank.slice(open + 1, i))?.[1] as Section | undefined;
      const end = closeOf(blank, i);
      if (depth === 0 && name && SECTIONS.includes(name) && end > 0 && !layout.sections[name]) {
        const start = i - (blank.slice(0, i).length - blank.slice(0, i).trimEnd().length) - name.length;
        layout.sections[name] = { start, end: end + 1, innerStart: i + 1, innerEnd: end };
      }
      if (end > 0) i = end;
      else depth++;
    }
  }
  return { blank, layout };
}

/**
 * The sections of the query's top-level `explore { … }`. A query that isn't one reads as undefined,
 * and a section it doesn't have as empty: the panel then says so rather than guess.
 */
export function parseExplore(source: string | undefined): ExploreParts | undefined {
  const read = source ? layoutOf(source) : undefined;
  if (!read) return undefined;
  const parts: ExploreParts = { dimensions: [], measures: [], filters: [], sorts: [] };
  for (const section of SECTIONS) {
    const span = read.layout.sections[section];
    if (!span) continue;
    const entries = splitEntries(read.blank.slice(span.innerStart, span.innerEnd));
    // Filters are conditions, not aliased fields: a colon there is part of the condition.
    parts[section] = entries.map((entry) => (section === 'filters' ? { expression: entry } : toEntry(entry)));
  }
  return parts;
}

const entryText = (entry: AqlEntry) =>
  entry.alias ? `${entry.alias}: ${entry.expression}` : entry.expression;

const sameEntries = (a: AqlEntry[], b: AqlEntry[]) =>
  a.length === b.length && a.every((entry, i) => entryText(entry) === entryText(b[i] as AqlEntry));

/** The indent of the line `at` is on. */
function indentAt(text: string, at: number): string {
  const lineStart = text.lastIndexOf('\n', at - 1) + 1;
  return /^[ \t]*/.exec(text.slice(lineStart))?.[0] ?? '';
}

/** A section's entries in the style it was written in: on one line, or one per line. */
function formatInner(entries: AqlEntry[], original: string, sectionIndent: string): string {
  if (!original.includes('\n')) return ` ${entries.map(entryText).join(', ')} `;
  const firstLine = original.split('\n').find((line, i) => i > 0 && line.trim());
  const inner = firstLine ? (/^[ \t]*/.exec(firstLine)?.[0] ?? `${sectionIndent}  `) : `${sectionIndent}  `;
  return `\n${entries.map((entry) => inner + entryText(entry)).join(',\n')}\n${sectionIndent}`;
}

/**
 * The AQL with `draft`'s sections written in. A section that didn't change keeps its text and its
 * comments; a changed one is rewritten in the style it was written in; a new one goes at the end of
 * the explore, indented like the others; an emptied one is removed with its line.
 */
export function writeExplore(aql: string, draft: ExploreParts): string {
  const read = layoutOf(aql);
  const current = parseExplore(aql);
  if (!read || !current) return aql;
  const { layout } = read;
  // Right to left, so each change leaves the positions before it as they were.
  const edits: { start: number; end: number; text: string }[] = [];
  const spans = Object.values(layout.sections);
  const firstSpan = spans.sort((a, b) => a.start - b.start)[0];
  const multiline = aql.slice(layout.bodyStart, layout.bodyEnd).includes('\n');
  const sectionIndent = firstSpan ? indentAt(aql, firstSpan.start) : multiline ? '  ' : '';

  for (const section of SECTIONS) {
    const next = draft[section];
    if (sameEntries(current[section], next)) continue;
    const span = layout.sections[section];
    if (span && next.length) {
      const inner = formatInner(next, aql.slice(span.innerStart, span.innerEnd), indentAt(aql, span.start));
      edits.push({ start: span.innerStart, end: span.innerEnd, text: inner });
    } else if (span) {
      // The whole line goes when the section is alone on it.
      const lineStart = aql.lastIndexOf('\n', span.start - 1) + 1;
      const alone = !aql.slice(lineStart, span.start).trim();
      const lineEnd = aql.indexOf('\n', span.end);
      const restOfLine = aql.slice(span.end, lineEnd < 0 ? aql.length : lineEnd);
      if (alone && !restOfLine.trim())
        edits.push({ start: lineStart, end: lineEnd < 0 ? aql.length : lineEnd + 1, text: '' });
      else edits.push({ start: span.start, end: span.end, text: '' });
    } else if (next.length) {
      // Written like the sections already there: one-line ones beget a one-line one.
      const sample = firstSpan ? aql.slice(firstSpan.innerStart, firstSpan.innerEnd) : multiline ? '\n' : '';
      const body = `${section} {${formatInner(next, sample, sectionIndent)}}`;
      const before = aql.slice(layout.bodyStart, layout.bodyEnd).trimEnd();
      const at = layout.bodyStart + before.length;
      edits.push({ start: at, end: at, text: multiline ? `\n${sectionIndent}${body}` : ` ${body}` });
    }
  }
  let out = aql;
  for (const edit of edits.sort((a, b) => b.start - a.start)) {
    out = out.slice(0, edit.start) + edit.text + out.slice(edit.end);
  }
  return out;
}
