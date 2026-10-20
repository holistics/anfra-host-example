// Where a query's AQL is written in the app's source, which decides how an edit to it can be saved.

/** One file of the app's source: its path under `apps/`, and its text. */
export interface SourceFile {
  file: string;
  text: string;
}

export type Tier = 1 | 2 | 3 | 4;

export interface TierResult {
  tier: Tier;
  /** Why, in words. */
  reason: string;
  /** The file the edit would be saved into, for tiers 1 and 2. */
  file?: string;
}

const MANIFEST = /<script[^>]*\bid=["']anfra-queries["'][^>]*>([\s\S]*?)<\/script>/i;

/** The query names a file's manifest declares, or none. A manifest that isn't JSON declares none. */
function manifestNames(text: string): string[] {
  const body = MANIFEST.exec(text)?.[1];
  if (!body) return [];
  try {
    const parsed: unknown = JSON.parse(body);
    return parsed && typeof parsed === 'object' ? Object.keys(parsed) : [];
  } catch {
    return [];
  }
}

function occurrences(text: string, needle: string): number {
  let count = 0;
  for (let at = text.indexOf(needle); at >= 0; at = text.indexOf(needle, at + needle.length)) count++;
  return count;
}

/**
 * How the host can find a query in the source: by its manifest (1), by its AQL written once as is
 * (2), not at all but alone with its AQL (3), or not at all and sharing its AQL with another query,
 * so not even a request can tell it apart (4).
 */
export function tierOf(
  name: string,
  aql: string,
  sources: SourceFile[],
  /** Every query's declared AQL in the frame, by name: to tell whether another shares this one. */
  declared: Record<string, string>,
): TierResult {
  const manifest = sources.find((source) => manifestNames(source.text).includes(name));
  if (manifest)
    return { tier: 1, reason: `Declared in the query manifest in ${manifest.file}.`, file: manifest.file };
  const found = aql.trim()
    ? sources.map((source) => ({ file: source.file, count: occurrences(source.text, aql) }))
    : [];
  const total = found.reduce((n, f) => n + f.count, 0);
  if (total === 1) {
    const file = found.find((f) => f.count === 1)?.file;
    return { tier: 2, reason: `Its AQL is written once, as is, in ${file}.`, file };
  }
  const twin = Object.entries(declared).find(([other, text]) => other !== name && text === aql)?.[0];
  if (twin) return { tier: 4, reason: `It declares the same AQL as ${twin}, so it can't be told apart.` };
  return {
    tier: 3,
    reason:
      total > 1
        ? `Its AQL is written ${total} times in the source, so the host can't tell which is this query's.`
        : 'Its AQL is built while the app runs, so it is not in the source as written.',
  };
}

/** `<script src>` paths a definition loads from its own folder, resolved against it. Remote ones are left out. */
export function localScripts(html: string, dir: string): string[] {
  const paths: string[] = [];
  for (const match of html.matchAll(/<script\b[^>]*\bsrc=["']([^"']+)["']/gi)) {
    const src = match[1] ?? '';
    if (/^([a-z]+:)?\/\//i.test(src) || src.startsWith('/') || src.startsWith('data:')) continue;
    const parts = [...(dir ? dir.split('/') : []), ...(src.split('?')[0] ?? '').split('/')];
    const resolved: string[] = [];
    for (const part of parts) {
      if (part === '..') resolved.pop();
      else if (part && part !== '.') resolved.push(part);
    }
    paths.push(resolved.join('/'));
  }
  return paths;
}

/** The app's definition and its local scripts, read through the host as the frame reads them. */
export async function loadSources(path: string): Promise<SourceFile[]> {
  const read = async (file: string) => {
    const url = `/host/files/${file.split('/').map(encodeURIComponent).join('/')}`;
    const response = await fetch(url);
    if (!response.ok) throw new Error(`Couldn't read ${file}: the server answered ${response.status}.`);
    return { file, text: await response.text() };
  };
  const definition = await read(path);
  const dir = path.includes('/') ? path.slice(0, path.lastIndexOf('/')) : '';
  const scripts = await Promise.all(
    localScripts(definition.text, dir).map((file) => read(file).catch(() => undefined)),
  );
  return [definition, ...scripts.filter((s): s is SourceFile => !!s)];
}
