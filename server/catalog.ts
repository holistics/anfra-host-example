import { type Dirent, readdirSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { type Meta, type MetaFile, readMeta, warnOnce } from './meta.js';

/** One node of the Data App tree: a definition, or a folder holding some. */
export type Entry =
  | { kind: 'app'; path: string; label: string; icon?: string; tags: string[] }
  | {
      kind: 'folder';
      path: string;
      name: string;
      icon?: string;
      tags: string[];
      collapsed: boolean;
      children: Entry[];
    };

const titleRe = /<title[^>]*>([\s\S]*?)<\/title>/i;

// The named entities a title or description is likely to hold; numeric ones are all decoded.
const entities: Record<string, string> = {
  amp: '&',
  lt: '<',
  gt: '>',
  quot: '"',
  apos: "'",
  nbsp: '\u00a0',
  ndash: '–',
  mdash: '—',
  hellip: '…',
  lsquo: '‘',
  rsquo: '’',
  ldquo: '“',
  rdquo: '”',
  middot: '·',
  bull: '•',
  copy: '©',
  reg: '®',
  trade: '™',
};

const entityRe = /&(?:#(\d+)|#x([0-9a-f]+)|([a-z]+));/gi;

/** An entity's character, or the entity as written when it names none. */
function decodeEntity(entity: string, dec?: string, hex?: string, name?: string): string {
  if (name) return entities[name] ?? entity;
  const code = dec ? Number.parseInt(dec, 10) : Number.parseInt(hex as string, 16);
  return code > 0 && code <= 0x10ffff ? String.fromCodePoint(code) : entity;
}

/** Text from HTML, as one line: whitespace collapsed, entities decoded. */
export function textOf(html: string): string {
  return html.split(/\s+/).filter(Boolean).join(' ').replace(entityRe, decodeEntity);
}

/** A definition's `<title>`, as text, or none. */
export function titleOf(html: string): string | undefined {
  const raw = titleRe.exec(html)?.[1];
  return raw ? textOf(raw) || undefined : undefined;
}

/** Called with each definition as the tree is read, so a caller needing its HTML reads it once. */
type OnApp = (rel: string, html: string) => void;

interface Scan {
  meta: MetaFile;
  onApp?: OnApp;
  /** Every folder and definition met, to find what the manifest names that isn't there. */
  seen: Set<string>;
}

const noMeta: Meta = { tags: [] };

/** By `order`, the ordered first, lowest first; then as the file tree reads, by name. */
function byOrder(a: { order?: number; name: string }, b: { order?: number; name: string }) {
  if (a.order !== b.order)
    return (a.order ?? Number.POSITIVE_INFINITY) - (b.order ?? Number.POSITIVE_INFINITY) || 0;
  return a.name < b.name ? -1 : a.name > b.name ? 1 : 0;
}

function scan(root: string, rel: string, ctx: Scan): Entry[] {
  let dirents: Dirent[];
  try {
    dirents = readdirSync(path.join(root, rel), { withFileTypes: true });
  } catch {
    return [];
  }
  dirents.sort((a, b) => (a.name < b.name ? -1 : a.name > b.name ? 1 : 0));
  const folders: { order?: number; name: string; entry: Entry }[] = [];
  const apps: { order?: number; name: string; entry: Entry }[] = [];
  for (const d of dirents) {
    if (d.name.startsWith('.')) continue;
    const childRel = rel ? `${rel}/${d.name}` : d.name;
    if (d.isDirectory()) {
      // A folder holding no Data App, at any depth, is left out.
      const children = scan(root, childRel, ctx);
      if (children.length === 0) continue;
      ctx.seen.add(childRel);
      const meta = ctx.meta.folders.get(childRel) ?? noMeta;
      const name = meta.name ?? d.name;
      folders.push({
        order: meta.order,
        name,
        entry: {
          kind: 'folder',
          path: childRel,
          name,
          icon: meta.icon,
          tags: meta.tags,
          collapsed: meta.collapsed ?? false,
          children,
        },
      });
    } else if (d.isFile() && d.name.toLowerCase().endsWith('.html')) {
      const html = readFileSync(path.join(root, childRel), 'utf8');
      ctx.onApp?.(childRel, html);
      ctx.seen.add(childRel);
      const meta = ctx.meta.apps.get(childRel) ?? noMeta;
      // The manifest's name, else the definition's `<title>`, else its file name.
      const label = meta.name ?? titleOf(html) ?? d.name;
      apps.push({
        order: meta.order,
        name: label,
        entry: { kind: 'app', path: childRel, label, icon: meta.icon, tags: meta.tags },
      });
    }
  }
  // Folders first, then Data Apps, each by `order`, then alphabetical, as a file tree reads.
  return [...folders.sort(byOrder), ...apps.sort(byOrder)].map((item) => item.entry);
}

/** Every Data App definition under the apps folder, as a tree. Paths are relative to it, with their `.html`. */
export function catalog(appsDir: string, onApp?: OnApp): Entry[] {
  const ctx: Scan = { meta: readMeta(appsDir), onApp, seen: new Set() };
  const tree = scan(appsDir, '', ctx);
  for (const key of [...ctx.meta.folders.keys(), ...ctx.meta.apps.keys()]) {
    if (!ctx.seen.has(key)) warnOnce(`"${key}" matches no folder or Data App.`);
  }
  return tree;
}
