// The Edit panel's writes: a query's AQL saved into the file it is written in, and put back again.
// Only with EDIT=1 (config.edit), for a host on the author's own machine (src/edit/SPEC.md).
import { createHash, randomUUID } from 'node:crypto';
import { existsSync, readFileSync, renameSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { appFile } from './files.js';

/** One saved edit, or the revert of one, as the history file keeps it. */
export interface EditRecord {
  id: string;
  kind: 'save' | 'revert';
  /** The query it changed. */
  query: string;
  /** The file it changed, under the apps folder. */
  file: string;
  /** The AQL as the file had it, and as it has it after. */
  before: string;
  after: string;
  /** ISO time. */
  at: string;
  /** The save a revert undid. */
  of?: string;
}

/** What the panel asks to save: the AQL it read in `file`, the AQL to put there, and the file's hash as it read it. */
export interface SaveRequest {
  query: string;
  file: string;
  before: string;
  after: string;
  hash: string;
}

export type EditResult =
  | { ok: true; record: EditRecord; hash: string }
  | { ok: false; status: 404 | 409 | 422; message: string };

export const sha256 = (text: string) => createHash('sha256').update(text).digest('hex');

/**
 * `to` written as the text it replaces was: inside a template literal, a backtick and `${` are
 * escaped; inside a quoted string, its quote and line breaks are. Raw where the quote can't be told.
 */
export function encodeLike(source: string, at: number, to: string): string {
  const quote = source[at - 1];
  if (quote === '`') return to.replace(/\\/g, '\\\\').replace(/`/g, '\\`').replace(/\$\{/g, '\\${');
  if (quote === "'" || quote === '"') {
    return to.replace(/\\/g, '\\\\').replace(new RegExp(quote, 'g'), `\\${quote}`).replace(/\n/g, '\\n');
  }
  return to;
}

/** `text` with its one occurrence of `from` replaced by `to`; undefined unless there is exactly one. */
export function replaceOnce(text: string, from: string, to: string): string | undefined {
  const at = text.indexOf(from);
  if (!from || at < 0 || text.indexOf(from, at + from.length) >= 0) return undefined;
  return text.slice(0, at) + encodeLike(text, at, to) + text.slice(at + from.length);
}

/** The history file of the app at `app`: `sales/overview.html` keeps `sales/overview.edits.json`. */
function historyPath(appsDir: string, app: string): string | undefined {
  if (!/\.html$/i.test(app)) return undefined;
  const found = appFile(appsDir, app);
  return found?.file.replace(/\.html$/i, '.edits.json');
}

/** The app's saved edits, oldest first; none when it has no history file. */
export function readHistory(appsDir: string, app: string): EditRecord[] | undefined {
  const file = historyPath(appsDir, app);
  if (!file) return undefined;
  if (!existsSync(file)) return [];
  try {
    const parsed = JSON.parse(readFileSync(file, 'utf8')) as { edits?: EditRecord[] };
    return Array.isArray(parsed.edits) ? parsed.edits : [];
  } catch {
    return [];
  }
}

/** Write through a temporary file and a rename, so a reader never sees half a file. */
function writeAtomic(file: string, text: string) {
  const tmp = path.join(path.dirname(file), `.${path.basename(file)}.${process.pid}.tmp`);
  writeFileSync(tmp, text);
  renameSync(tmp, file);
}

function append(appsDir: string, app: string, record: EditRecord) {
  const file = historyPath(appsDir, app) as string;
  const edits = [...(readHistory(appsDir, app) ?? []), record];
  writeAtomic(file, `${JSON.stringify({ app, edits }, null, 2)}\n`);
}

/** Replace `from` with `to` in a file under the apps folder, if its hash is as expected and `from` is there once. */
function rewrite(
  appsDir: string,
  rel: string,
  from: string,
  to: string,
  hash?: string,
): { ok: true; hash: string } | { ok: false; status: 404 | 409; message: string } {
  const found = appFile(appsDir, rel);
  if (!found) return { ok: false, status: 404, message: `No file at ${rel}.` };
  const text = readFileSync(found.file, 'utf8');
  if (hash !== undefined && sha256(text) !== hash) {
    return {
      ok: false,
      status: 409,
      message: `${rel} changed since the panel read it. Reload and edit again.`,
    };
  }
  const next = replaceOnce(text, from, to);
  if (next === undefined) {
    return {
      ok: false,
      status: 409,
      message: `The AQL isn't in ${rel} exactly once as it was, so it can't be changed safely.`,
    };
  }
  writeAtomic(found.file, next);
  const written = readFileSync(found.file, 'utf8');
  if (written !== next)
    return { ok: false, status: 409, message: `${rel} changed while it was being written.` };
  return { ok: true, hash: sha256(written) };
}

/** Save an edit into the file the query is written in, and keep it in the app's history. */
export function saveEdit(appsDir: string, app: string, request: SaveRequest): EditResult {
  if (!historyPath(appsDir, app)) return { ok: false, status: 404, message: `No Data App at ${app}.` };
  if (!request.after.trim() || request.after === request.before) {
    return { ok: false, status: 422, message: 'Nothing to save.' };
  }
  const written = rewrite(appsDir, request.file, request.before, request.after, request.hash);
  if (!written.ok) return written;
  const record: EditRecord = {
    id: randomUUID(),
    kind: 'save',
    query: request.query,
    file: request.file,
    before: request.before,
    after: request.after,
    at: new Date().toISOString(),
  };
  append(appsDir, app, record);
  return { ok: true, record, hash: written.hash };
}

/**
 * Undo one saved edit: its AQL goes back to what it was, if what it saved is still in the file once.
 * An edit made after it on the same query has replaced that text, so it can't be undone alone.
 */
export function revertEdit(appsDir: string, app: string, id: string): EditResult {
  const history = readHistory(appsDir, app);
  const target = history?.find((r) => r.id === id && r.kind === 'save');
  if (!history || !target) return { ok: false, status: 404, message: 'No such saved edit.' };
  if (history.some((r) => r.kind === 'revert' && r.of === id)) {
    return { ok: false, status: 409, message: 'That edit is already reverted.' };
  }
  const written = rewrite(appsDir, target.file, target.after, target.before);
  if (!written.ok) {
    return written.status === 409
      ? {
          ok: false,
          status: 409,
          message: 'A later change replaced this edit, so it can’t be reverted on its own.',
        }
      : written;
  }
  const record: EditRecord = {
    id: randomUUID(),
    kind: 'revert',
    of: id,
    query: target.query,
    file: target.file,
    before: target.after,
    after: target.before,
    at: new Date().toISOString(),
  };
  append(appsDir, app, record);
  return { ok: true, record, hash: written.hash };
}
