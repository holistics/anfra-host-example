import { type Dirent, readdirSync, readFileSync } from 'node:fs';
import path from 'node:path';

/** One node of the Data App tree: a definition, or a folder holding some. */
export type Entry =
  | { kind: 'app'; path: string; label: string }
  | { kind: 'folder'; path: string; name: string; children: Entry[] };

const titleRe = /<title[^>]*>([\s\S]*?)<\/title>/i;

const entities: Record<string, string> = { amp: '&', lt: '<', gt: '>', quot: '"', '#39': "'", apos: "'" };

/** Text from HTML, as one line: whitespace collapsed, the common entities decoded. */
export function textOf(html: string): string {
  return html
    .split(/\s+/)
    .filter(Boolean)
    .join(' ')
    .replace(/&(amp|lt|gt|quot|#39|apos);/g, (_, name: string) => entities[name] ?? '');
}

/** A definition's `<title>`, as text, or none. */
export function titleOf(html: string): string | undefined {
  const raw = titleRe.exec(html)?.[1];
  return raw ? textOf(raw) || undefined : undefined;
}

/** Called with each definition as the tree is read, so a caller needing its HTML reads it once. */
type OnApp = (rel: string, html: string) => void;

function scan(root: string, rel: string, onApp?: OnApp): Entry[] {
  let dirents: Dirent[];
  try {
    dirents = readdirSync(path.join(root, rel), { withFileTypes: true });
  } catch {
    return [];
  }
  dirents.sort((a, b) => (a.name < b.name ? -1 : a.name > b.name ? 1 : 0));
  const folders: Entry[] = [];
  const apps: Entry[] = [];
  for (const d of dirents) {
    if (d.name.startsWith('.')) continue;
    const childRel = rel ? `${rel}/${d.name}` : d.name;
    if (d.isDirectory()) {
      // A folder holding no Data App, at any depth, is left out.
      const children = scan(root, childRel, onApp);
      if (children.length > 0) folders.push({ kind: 'folder', path: childRel, name: d.name, children });
    } else if (d.isFile() && d.name.toLowerCase().endsWith('.html')) {
      const html = readFileSync(path.join(root, childRel), 'utf8');
      onApp?.(childRel, html);
      // A definition's `<title>`, or its file name.
      apps.push({ kind: 'app', path: childRel, label: titleOf(html) ?? d.name });
    }
  }
  // Folders first, then Data Apps, each alphabetical, as a file tree reads.
  return [...folders, ...apps];
}

/** Every Data App definition under the apps folder, as a tree. Paths are relative to it, with their `.html`. */
export function catalog(appsDir: string, onApp?: OnApp): Entry[] {
  return scan(appsDir, '', onApp);
}
