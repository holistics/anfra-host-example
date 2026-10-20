// A preview: a query's draft run in place of its declared AQL. Nothing is written.

/** One query's draft in place of its declared AQL, in the file the AQL was found in. */
export interface PreviewEdit {
  /** The query's name, for the panel. */
  query: string;
  /** The file under `apps/` that holds the AQL. */
  file: string;
  from: string;
  to: string;
}

/**
 * `to` written as `from` was: inside a template literal, a backtick and `${` are escaped; inside a
 * quoted string, its quote and line breaks are. Written raw where the quote can't be told.
 */
export function encodeLike(source: string, at: number, to: string): string {
  const quote = source[at - 1];
  if (quote === '`') return to.replace(/\\/g, '\\\\').replace(/`/g, '\\`').replace(/\$\{/g, '\\${');
  if (quote === "'" || quote === '"') {
    return to.replace(/\\/g, '\\\\').replace(new RegExp(quote, 'g'), `\\${quote}`).replace(/\n/g, '\\n');
  }
  return to;
}

/** `text` with the one occurrence of `from` replaced by `to`; undefined unless there is exactly one. */
export function replaceOnce(text: string, from: string, to: string): string | undefined {
  const at = text.indexOf(from);
  if (at < 0 || text.indexOf(from, at + from.length) >= 0) return undefined;
  return text.slice(0, at) + encodeLike(text, at, to) + text.slice(at + from.length);
}
