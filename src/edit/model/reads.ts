// Whether the page's own code reads a column: what decides if an edit shows, or leaves a gap.
import type { SourceFile } from './tier';

const escapeRe = (text: string) => text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

/**
 * The app's code with every query's AQL taken out, so a column named in a query isn't read as the
 * code using it. What is left is what draws the page.
 */
export function codeOf(sources: SourceFile[], aqls: string[]): string {
  const texts = [...new Set(aqls.filter((aql) => aql.trim()))].sort((a, b) => b.length - a.length);
  return sources
    .map((source) => texts.reduce((code, aql) => code.split(aql).join(''), source.text))
    .join('\n');
}

/**
 * Whether the code reads `alias` off a result row, the ways a Data App does: `r.units`, `row['units']`,
 * or `{ units }` taken apart. A guess, from the text. A bare `'units'` doesn't count: it is as often a
 * block id or a label (`data-anfra-block="aov"`) as a key.
 */
export function readsColumn(code: string, alias: string): boolean {
  const name = escapeRe(alias);
  return [
    new RegExp(`\\.${name}(?![\\w$])`),
    new RegExp(`\\[\\s*['"\`]${name}['"\`]\\s*\\]`),
    new RegExp(`[{,]\\s*${name}\\s*[,}:=]`),
  ].some((re) => re.test(code));
}
