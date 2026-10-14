import { readFileSync } from 'node:fs';
import path from 'node:path';
import { parse } from 'yaml';

/** Where a repo says how its Data Apps are shown, under the apps folder. */
export const metaFile = '_meta.yaml';

/** What the manifest says of one folder or Data App. Every field is optional. */
export interface Meta {
  /** A folder's name, or a Data App's label, in place of the directory's or the `<title>`. */
  name?: string;
  /** A name the page knows (src/lib/icons.ts). */
  icon?: string;
  tags: string[];
  /** A Data App vouched for: it shows a check on its icon. */
  endorsed?: boolean;
  /** A folder starts closed. */
  collapsed?: boolean;
  /** Sorts before the unordered, lowest first. */
  order?: number;
}

export interface MetaFile {
  /** By path relative to the apps folder, as `sales`. */
  folders: Map<string, Meta>;
  /** By path relative to the apps folder, with the `.html`, as `sales/overview.html`. */
  apps: Map<string, Meta>;
}

const warned = new Set<string>();

/** Say a problem once, not on every read of the tree. */
export function warnOnce(message: string) {
  if (warned.has(message)) return;
  warned.add(message);
  console.warn(`${metaFile}: ${message}`);
}

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

/** A key as a path relative to the apps folder: no `./`, no trailing slash. */
const normalize = (key: string) => key.replace(/^(\.\/)+/, '').replace(/\/+$/, '');

type Section = 'folders' | 'apps';

/** The fields that mean something for one kind only. */
const onlyFor = new Map<string, Section>([
  ['endorsed', 'apps'],
  ['collapsed', 'folders'],
]);

function entryMeta(key: string, value: unknown, kind: Section): Meta {
  const meta: Meta = { tags: [] };
  if (!isRecord(value)) {
    warnOnce(`"${key}" should be a mapping; ignored.`);
    return meta;
  }
  for (const [field, v] of Object.entries(value)) {
    const only = onlyFor.get(field);
    if (only && only !== kind) {
      warnOnce(`"${key}": ${field} applies to ${only === 'apps' ? 'Data Apps' : 'folders'} only; ignored.`);
    } else if (field === 'name' || field === 'icon') {
      if (typeof v === 'string' && v.trim()) meta[field] = v.trim();
      else warnOnce(`"${key}": ${field} should be a non-empty string.`);
    } else if (field === 'tags') {
      if (Array.isArray(v) && v.every((t) => typeof t === 'string'))
        meta.tags = v.map((t) => t.trim()).filter(Boolean);
      else warnOnce(`"${key}": tags should be a list of strings.`);
    } else if (field === 'endorsed') {
      if (typeof v === 'boolean') meta.endorsed = v;
      else warnOnce(`"${key}": endorsed should be true or false.`);
    } else if (field === 'collapsed') {
      if (typeof v === 'boolean') meta.collapsed = v;
      else warnOnce(`"${key}": collapsed should be true or false.`);
    } else if (field === 'order') {
      if (typeof v === 'number' && Number.isFinite(v)) meta.order = v;
      else warnOnce(`"${key}": order should be a number.`);
    } else {
      warnOnce(`"${key}": unknown field "${field}".`);
    }
  }
  return meta;
}

function section(root: Record<string, unknown>, name: Section): Map<string, Meta> {
  const result = new Map<string, Meta>();
  const value = root[name];
  if (value === undefined || value === null) return result;
  if (!isRecord(value)) {
    warnOnce(`${name} should be a mapping from path to settings.`);
    return result;
  }
  for (const [key, v] of Object.entries(value)) {
    const rel = normalize(key);
    // `sales` and `sales/` are one folder: the last written would win, unseen.
    if (result.has(rel)) warnOnce(`"${key}" names "${rel}" again under ${name}; the last one wins.`);
    result.set(rel, entryMeta(key, v, name));
  }
  return result;
}

/** The manifest under the apps folder, or an empty one when there is none or it can't be read. */
export function readMeta(appsDir: string): MetaFile {
  const empty: MetaFile = { folders: new Map(), apps: new Map() };
  let text: string;
  try {
    text = readFileSync(path.join(appsDir, metaFile), 'utf8');
  } catch {
    return empty;
  }
  let root: unknown;
  try {
    root = parse(text);
  } catch (err) {
    warnOnce(`not valid YAML: ${(err as Error).message.split('\n')[0]}`);
    return empty;
  }
  if (root === null || root === undefined) return empty;
  if (!isRecord(root)) {
    warnOnce('should be a mapping with `folders` and `apps`.');
    return empty;
  }
  for (const field of Object.keys(root)) {
    if (field !== 'folders' && field !== 'apps') warnOnce(`unknown top-level field "${field}".`);
  }
  return { folders: section(root, 'folders'), apps: section(root, 'apps') };
}
