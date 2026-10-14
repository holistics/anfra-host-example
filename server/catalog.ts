import { type Dirent, readdirSync, readFileSync } from 'node:fs';
import path from 'node:path';
import type { AppPrompt, Entry } from './entry.js';
import { type Meta, type MetaFile, readMeta, startRead, warnOnce } from './meta.js';

export type { Entry };

const titleRe = /<title[^>]*>([\s\S]*?)<\/title>/i;
const metadataRe = /<script\b[^>]*\sid\s*=\s*["']?data-app-metadata["']?[^>]*>([\s\S]*?)<\/script>/i;

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

/** The prompt that made a definition, from its `data-app-metadata` script, or none. */
export function promptOf(html: string, rel: string): AppPrompt | undefined {
  const raw = metadataRe.exec(html)?.[1];
  if (raw === undefined) return undefined;
  let data: unknown;
  try {
    data = JSON.parse(raw);
  } catch {
    warnOnce(`"${rel}": its data-app-metadata isn't valid JSON; ignored.`);
    return undefined;
  }
  if (typeof data !== 'object' || data === null) return undefined;
  const fields = data as Record<string, unknown>;
  const text = (key: string) =>
    typeof fields[key] === 'string' && fields[key].trim() ? fields[key] : undefined;
  const prompt = text('prompt');
  if (!prompt) return undefined;
  return {
    prompt,
    model: text('model'),
    effort: text('effort'),
    createdAt: text('createdAt'),
    updatedAt: text('updatedAt'),
  };
}

/**
 * Called with each definition as the tree is read, so a caller needing its HTML reads it once.
 * `name` is the manifest's, if it gives one.
 */
type OnApp = (rel: string, html: string, name: string | undefined) => void;

interface Scan {
  meta: MetaFile;
  onApp?: OnApp;
  /** Every folder met, shown or not, to find what the manifest names that isn't there. */
  folders: Set<string>;
  /** Every definition met. */
  apps: Set<string>;
}

const noMeta: Meta = { tags: [] };

/** By `order`, the ordered first, lowest first. A stable sort keeps the rest as they came: by file name. */
function byOrder(a: { order?: number }, b: { order?: number }) {
  // Infinity - Infinity is NaN, when neither has an order.
  return (a.order ?? Number.POSITIVE_INFINITY) - (b.order ?? Number.POSITIVE_INFINITY) || 0;
}

function scan(root: string, rel: string, ctx: Scan): Entry[] {
  let dirents: Dirent[];
  try {
    dirents = readdirSync(path.join(root, rel), { withFileTypes: true });
  } catch {
    return [];
  }
  dirents.sort((a, b) => (a.name < b.name ? -1 : a.name > b.name ? 1 : 0));
  const folders: { order?: number; entry: Entry }[] = [];
  const apps: { order?: number; entry: Entry }[] = [];
  for (const d of dirents) {
    if (d.name.startsWith('.')) continue;
    const childRel = rel ? `${rel}/${d.name}` : d.name;
    if (d.isDirectory()) {
      // A folder holding no Data App, at any depth, is left out.
      const children = scan(root, childRel, ctx);
      ctx.folders.add(childRel);
      if (children.length === 0) {
        if (ctx.meta.folders.has(childRel)) warnOnce(`"${childRel}" holds no Data App, so it isn't shown.`);
        continue;
      }
      const meta = ctx.meta.folders.get(childRel) ?? noMeta;
      const name = meta.name ?? d.name;
      folders.push({
        order: meta.order,
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
      ctx.apps.add(childRel);
      const meta = ctx.meta.apps.get(childRel) ?? noMeta;
      ctx.onApp?.(childRel, html, meta.name);
      // The manifest's name, else the definition's `<title>`, else its file name.
      const label = meta.name ?? titleOf(html) ?? d.name;
      apps.push({
        order: meta.order,
        entry: {
          kind: 'app',
          path: childRel,
          label,
          icon: meta.icon,
          tags: meta.tags,
          endorsed: meta.endorsed ?? false,
          prompt: promptOf(html, childRel),
        },
      });
    }
  }
  // Folders first, then Data Apps, each by `order`, then by file name, as a file tree reads.
  return [...folders.sort(byOrder), ...apps.sort(byOrder)].map((item) => item.entry);
}

/** Every Data App definition under the apps folder, as a tree. Paths are relative to it, with their `.html`. */
export function catalog(appsDir: string, onApp?: OnApp): Entry[] {
  startRead();
  const ctx: Scan = { meta: readMeta(appsDir), onApp, folders: new Set(), apps: new Set() };
  const tree = scan(appsDir, '', ctx);
  // Each section checked against its own kind, so a key under the wrong one is said, not ignored.
  for (const key of ctx.meta.folders.keys()) {
    if (ctx.folders.has(key)) continue;
    warnOnce(
      ctx.apps.has(key)
        ? `"${key}" is a Data App; move it under apps.`
        : `"${key}" under folders matches no folder.`,
    );
  }
  for (const key of ctx.meta.apps.keys()) {
    if (ctx.apps.has(key)) continue;
    warnOnce(
      ctx.folders.has(key)
        ? `"${key}" is a folder; move it under folders.`
        : `"${key}" under apps matches no Data App.`,
    );
  }
  return tree;
}
