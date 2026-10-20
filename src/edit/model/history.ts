// The app's saved edits, as the host's server keeps them (server/edits.ts), and the calls that make them.

/** One saved edit, or the revert of one. */
export interface EditRecord {
  id: string;
  kind: 'save' | 'revert';
  query: string;
  /** The file it changed, under `apps/`. */
  file: string;
  before: string;
  after: string;
  /** ISO time. */
  at: string;
  /** The save a revert undid. */
  of?: string;
}

const url = (app: string) => `/host/edits/${app.split('/').map(encodeURIComponent).join('/')}`;

/** The app's saved edits, oldest first; undefined when the host doesn't edit (no `EDIT=1`). */
export async function loadHistory(app: string): Promise<EditRecord[] | undefined> {
  const response = await fetch(url(app));
  if (response.status === 404) return undefined;
  if (!response.ok) throw new Error(`Reading the edit history answered ${response.status}.`);
  return ((await response.json()) as { edits: EditRecord[] }).edits;
}

async function post(app: string, body: unknown): Promise<EditRecord> {
  const response = await fetch(url(app), {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
  });
  const json = (await response.json().catch(() => ({}))) as {
    record?: EditRecord;
    error?: { message?: string };
  };
  if (!response.ok || !json.record)
    throw new Error(json.error?.message ?? `Saving answered ${response.status}.`);
  return json.record;
}

/** The SHA-256 of a file's text as the panel read it: the server refuses a save if the file changed since. */
export async function hashOf(text: string): Promise<string> {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(text));
  return [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, '0')).join('');
}

export const saveEdit = (
  app: string,
  edit: { query: string; file: string; before: string; after: string; hash: string },
) => post(app, { action: 'save', ...edit });

export const revertEdit = (app: string, id: string) => post(app, { action: 'revert', id });
