// What the page asks this host's own server (server/app.ts), apart from the core API.

/** One node of the Data App tree. Paths are relative to the apps folder, with their `.html`. */
export type Entry =
  | { kind: 'app'; path: string; label: string }
  | { kind: 'folder'; path: string; name: string; children: Entry[] };

export async function catalog(): Promise<Entry[]> {
  const response = await fetch('/host/apps');
  if (!response.ok) throw new Error(`The server answered ${response.status}.`);
  return response.json();
}

/** What changed in the repo, in development: Data Apps (their paths), or the AML. */
export type RepoEvent = { type: 'apps'; paths: string[] } | { type: 'aml' };

/** Follow the repo's changes; only the development server sends them. Returns a stop function. */
export function onRepoEvent(listener: (event: RepoEvent) => void): () => void {
  const source = new EventSource('/host/events');
  source.addEventListener('message', (event) => listener(JSON.parse(event.data)));
  return () => source.close();
}

/** A Data App's page: `/apps/<path without .html>`. */
export function urlOf(path: string): string {
  return `/apps/${path
    .replace(/\.html$/i, '')
    .split('/')
    .map(encodeURIComponent)
    .join('/')}`;
}

/** The Data App a page shows, or none (`/`). */
export function pathOf(pathname: string): string | undefined {
  if (!pathname.startsWith('/apps/')) return undefined;
  const rest = pathname.slice('/apps/'.length).replace(/\/+$/, '');
  return rest ? `${rest.split('/').map(decodeURIComponent).join('/')}.html` : undefined;
}

export function findApp(entries: Entry[], path: string): Extract<Entry, { kind: 'app' }> | undefined {
  for (const entry of entries) {
    if (entry.kind === 'app' && entry.path === path) return entry;
    if (entry.kind === 'folder') {
      const found = findApp(entry.children, path);
      if (found) return found;
    }
  }
  return undefined;
}

/** The versions serving, from `/health`: this host's, and anfra's, or null while anfra does not answer. */
export type Health = { host: string; anfra: string | null };

export async function health(): Promise<Health> {
  // 503 still carries the body: anfra is down, the host is not.
  const response = await fetch('/health');
  return response.json();
}
