import assert from 'node:assert/strict';
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { afterEach, beforeEach, describe, test } from 'node:test';
import { createApp } from './app.js';
import { loadConfig } from './config.js';
import { readHistory, replaceOnce, revertEdit, saveEdit, sha256 } from './edits.js';

const BEFORE = 'explore { measures { revenue: revenue } }';
const AFTER = 'explore { measures { revenue: net_revenue } }';

describe('edits', () => {
  let dir: string;
  let apps: string;
  const html = () => readFileSync(path.join(apps, 'dashboards/overview.html'), 'utf8');

  beforeEach(() => {
    dir = mkdtempSync(path.join(tmpdir(), 'host-edits-'));
    apps = path.join(dir, 'apps');
    mkdirSync(path.join(apps, 'dashboards'), { recursive: true });
    writeFileSync(path.join(apps, 'dashboards/overview.html'), `<script>const q = \`${BEFORE}\`;</script>`);
  });
  afterEach(() => rmSync(dir, { recursive: true, force: true }));

  const save = (over: Partial<Parameters<typeof saveEdit>[2]> = {}) =>
    saveEdit(apps, 'dashboards/overview.html', {
      query: 'kpis',
      file: 'dashboards/overview.html',
      before: BEFORE,
      after: AFTER,
      hash: sha256(html()),
      ...over,
    });

  test('a save writes the file in place and keeps a record beside it', () => {
    const result = save();
    assert.ok(result.ok);
    assert.equal(html(), `<script>const q = \`${AFTER}\`;</script>`);
    assert.equal(result.hash, sha256(html()));
    const history = readHistory(apps, 'dashboards/overview.html');
    assert.deepEqual(
      history?.map((r) => [r.kind, r.query, r.after]),
      [['save', 'kpis', AFTER]],
    );
  });

  test('a file changed since the panel read it is refused, and left alone', () => {
    const result = save({ hash: sha256('something else') });
    assert.equal(result.ok, false);
    assert.equal(!result.ok && result.status, 409);
    assert.match(html(), /revenue: revenue/);
    assert.deepEqual(readHistory(apps, 'dashboards/overview.html'), []);
  });

  test('AQL not in the file exactly once is refused', () => {
    assert.equal(save({ before: 'explore { nothing }' }).ok, false);
  });

  test('a revert puts the AQL back, once', () => {
    const saved = save();
    assert.ok(saved.ok);
    const reverted = revertEdit(apps, 'dashboards/overview.html', saved.record.id);
    assert.ok(reverted.ok);
    assert.match(html(), /revenue: revenue/);
    assert.equal(revertEdit(apps, 'dashboards/overview.html', saved.record.id).ok, false);
  });

  test("a revert that a later save replaced can't be done alone", () => {
    const first = save();
    assert.ok(first.ok);
    const later = 'explore { measures { revenue: aov } }';
    assert.ok(save({ before: AFTER, after: later }).ok);
    const reverted = revertEdit(apps, 'dashboards/overview.html', first.record.id);
    assert.equal(!reverted.ok && reverted.status, 409);
    assert.match(html(), /revenue: aov/);
  });

  test('a path outside the apps folder is not an app', () => {
    assert.equal(readHistory(apps, '../outside.html'), undefined);
  });

  test('a replacement is escaped as the string it lands in', () => {
    // biome-ignore lint/suspicious/noTemplateCurlyInString: AQL text with a placeholder in it, on purpose
    assert.equal(replaceOnce('q = `a`', 'a', 'b`${x}'), 'q = `b\\`\\${x}`');
    assert.equal(replaceOnce('a a', 'a', 'b'), undefined);
  });

  test('the routes are served only with EDIT=1', async () => {
    const off = createApp({ config: loadConfig({ ANFRA_REPO: dir }), hostVersion: 'test' });
    assert.equal((await off.request('/host/edits/dashboards/overview.html')).status, 404);
    const on = createApp({ config: loadConfig({ ANFRA_REPO: dir, EDIT: '1' }), hostVersion: 'test' });
    const res = await on.request('/host/edits/dashboards/overview.html', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        action: 'save',
        query: 'kpis',
        file: 'dashboards/overview.html',
        before: BEFORE,
        after: AFTER,
        hash: sha256(html()),
      }),
    });
    assert.equal(res.status, 200);
    assert.equal(
      ((await (await on.request('/host/edits/dashboards/overview.html')).json()) as { edits: unknown[] })
        .edits.length,
      1,
    );
  });
});

describe('live reload after a write', () => {
  test('a file is news once per change of content, and never after the panel wrote it', async () => {
    const { changedPaths } = await import('./events.js');
    const dir = mkdtempSync(path.join(tmpdir(), 'host-seen-'));
    const apps = path.join(dir, 'apps');
    mkdirSync(apps, { recursive: true });
    const file = path.join(apps, 'a.html');
    writeFileSync(file, 'one');
    const seen = new Map<string, string>();
    assert.deepEqual(changedPaths(apps, ['a.html'], seen), ['a.html']);
    // The watcher's echo of the same write.
    assert.deepEqual(changedPaths(apps, ['a.html'], seen), []);
    // The panel writes, and says so first.
    seen.set('a.html', sha256('two'));
    writeFileSync(file, 'two');
    assert.deepEqual(changedPaths(apps, ['a.html'], seen), []);
    // Someone else edits it.
    writeFileSync(file, 'three');
    assert.deepEqual(changedPaths(apps, ['a.html'], seen), ['a.html']);
    rmSync(dir, { recursive: true, force: true });
  });
});
