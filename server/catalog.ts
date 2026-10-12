import { type Dirent, readdirSync, readFileSync } from 'node:fs';
import path from 'node:path';

/** One node of the Data App tree: a definition, or a folder holding some. */
export type Entry =
  | { kind: 'app'; path: string; label: string }
  | { kind: 'folder'; path: string; name: string; children: Entry[] };

const titleRe = /<title[^>]*>([\s\S]*?)<\/title>/i;

const entities: Record<string, string> = { amp: '&', lt: '<', gt: '>', quot: '"', '#39': "'", apos: "'" };

/** A definition's `<title>`, or its file name. */
function labelOf(file: string): string {
  const html = readFileSync(file, 'utf8');
  const title = titleRe.exec(html)?.[1]?.split(/\s+/).filter(Boolean).join(' ');
  if (!title) return path.basename(file);
  return title.replace(/&(amp|lt|gt|quot|#39|apos);/g, (_, name: string) => entities[name] ?? '');
}

function scan(root: string, rel: string): Entry[] {
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
      const children = scan(root, childRel);
      if (children.length > 0) folders.push({ kind: 'folder', path: childRel, name: d.name, children });
    } else if (d.isFile() && d.name.toLowerCase().endsWith('.html')) {
      apps.push({ kind: 'app', path: childRel, label: labelOf(path.join(root, childRel)) });
    }
  }
  // Folders first, then Data Apps, each alphabetical, as a file tree reads.
  return [...folders, ...apps];
}

/** Every Data App definition under the apps folder, as a tree. Paths are relative to it, with their `.html`. */
export function catalog(appsDir: string): Entry[] {
  return scan(appsDir, '');
}
