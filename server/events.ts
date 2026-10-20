import { createHash } from 'node:crypto';
import { type FSWatcher, readFileSync, watch } from 'node:fs';
import path from 'node:path';

/** What changed in the repo: Data Apps (paths relative to the apps folder), or the AML. */
export type RepoEvent = { type: 'apps'; paths: string[] } | { type: 'aml' };

const skipped = (part: string) => part.startsWith('.') || part === 'node_modules';

/** What a changed path, relative to the repo, means to live reload: a Data App, the AML, or nothing. */
export function classify(rel: string): { app: string } | { aml: true } | undefined {
  const parts = rel.split(/[\\/]/);
  if (parts.some(skipped)) return undefined;
  if (parts[0] === 'apps') return { app: parts.slice(1).join('/') };
  if (rel.toLowerCase().endsWith('.aml')) return { aml: true };
  return undefined;
}

/** What a Data App's file holds, as a hash, by its path under the apps folder: '' once it's gone. */
export type ContentSeen = Map<string, string>;

const contentOf = (file: string) => {
  try {
    return createHash('sha256').update(readFileSync(file)).digest('hex');
  } catch {
    return '';
  }
};

/**
 * The paths whose content changed since it was last seen, each now seen as it is. The watcher
 * reports one write several times (on macOS: right away, and again seconds later), and the Edit
 * panel's own writes are seen as they are made (`server/edits.ts`): neither reloads an app twice,
 * or at all.
 */
export function changedPaths(appsDir: string, paths: Iterable<string>, seen: ContentSeen): string[] {
  const changed: string[] = [];
  for (const rel of paths) {
    const now = contentOf(path.join(appsDir, ...rel.split('/')));
    if (seen.get(rel) === now) continue;
    seen.set(rel, now);
    changed.push(rel);
  }
  return changed;
}

/**
 * Watch the repo, in development only, and publish what changed, debounced so a burst of saves is
 * one event of each type. Node's recursive watch covers folders created later. It starts with the
 * first subscriber and stops after the last, so a server nobody has open watches nothing.
 */
export function repoEvents(repoDir: string, delayMs = 150, seen: ContentSeen = new Map()) {
  const listeners = new Set<(event: RepoEvent) => void>();
  let watcher: FSWatcher | undefined;
  let timer: NodeJS.Timeout | undefined;
  let apps = new Set<string>();
  let aml = false;

  const flush = () => {
    const events: RepoEvent[] = [];
    const changed = changedPaths(path.join(repoDir, 'apps'), apps, seen);
    if (changed.length > 0) events.push({ type: 'apps', paths: changed.sort() });
    if (aml) events.push({ type: 'aml' });
    apps = new Set();
    aml = false;
    for (const event of events) for (const listener of listeners) listener(event);
  };

  const start = () => {
    watcher = watch(repoDir, { recursive: true }, (_type, filename) => {
      const change = filename && classify(filename.toString());
      if (!change) return;
      if ('aml' in change) aml = true;
      else apps.add(change.app);
      clearTimeout(timer);
      timer = setTimeout(flush, delayMs);
    });
    watcher.on('error', (err) => console.warn('watch:', err.message));
  };

  return {
    subscribe(listener: (event: RepoEvent) => void): () => void {
      listeners.add(listener);
      if (!watcher) start();
      return () => {
        listeners.delete(listener);
        if (listeners.size === 0) {
          watcher?.close();
          watcher = undefined;
          clearTimeout(timer);
        }
      };
    },
  };
}
