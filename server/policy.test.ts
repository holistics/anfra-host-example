import assert from 'node:assert/strict';
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { after, before, describe, mock, test } from 'node:test';
import { createApp } from './app.js';
import { loadConfig } from './config.js';
import { allowOriginsHeader } from './entry.js';
import { isOrigin, readAllowOrigins } from './policy.js';

describe('isOrigin', () => {
  test('takes https://<host>[:<port>] alone', () => {
    for (const origin of ['https://cdn.example.com', 'https://example.com:8443'])
      assert.ok(isOrigin(origin), origin);
    for (const origin of [
      'http://cdn.example.com',
      'https://cdn.example.com/',
      'https://cdn.example.com/lib',
      'https://*.example.com',
      'https://example.com:443',
      'https://Example.com',
      'https://a.com https://b.com',
      'cdn.example.com',
      42,
    ])
      assert.ok(!isOrigin(origin), String(origin));
  });
});

describe('readAllowOrigins', () => {
  let dir: string;
  const warnings: string[] = [];
  const write = (yaml: string) => {
    mkdirSync(path.join(dir, '.anfra'), { recursive: true });
    writeFileSync(path.join(dir, '.anfra', 'config.yml'), yaml);
  };

  before(() => {
    dir = mkdtempSync(path.join(tmpdir(), 'host-policy-'));
    mock.method(console, 'warn', (message: string) => warnings.push(message));
  });
  after(() => {
    mock.restoreAll();
    rmSync(dir, { recursive: true, force: true });
  });

  test('none without a config', () => {
    assert.deepEqual(readAllowOrigins(dir), []);
  });

  test("the config's apps.allow_origins, leaving out and saying what isn't an origin", () => {
    write('apps:\n  allow_origins:\n    - https://cdn.example.com\n    - https://cdn.example.com/lib\n');
    assert.deepEqual(readAllowOrigins(dir), ['https://cdn.example.com']);
    assert.match(warnings.at(-1) ?? '', /"https:\/\/cdn.example.com\/lib" is not an origin/);
  });

  test('none, and said, when allow_origins is not a list', () => {
    write('apps:\n  allow_origins: https://cdn.example.com\n');
    assert.deepEqual(readAllowOrigins(dir), []);
    assert.match(warnings.at(-1) ?? '', /should be a list/);
  });

  test('none when apps says nothing of origins', () => {
    write('data_sources: []\n');
    assert.deepEqual(readAllowOrigins(dir), []);
  });

  test('sent with each definition, read again in development', async () => {
    mkdirSync(path.join(dir, 'apps'), { recursive: true });
    writeFileSync(path.join(dir, 'apps', 'a.html'), '<title>a</title>');
    writeFileSync(path.join(dir, 'apps', 'a.jpg'), 'jpg');
    const app = createApp({ config: loadConfig({ ANFRA_REPO: dir }), hostVersion: 'test' });
    const sent = async (file: string) =>
      (await app.request(`/host/files/${file}`)).headers.get(allowOriginsHeader);
    write('apps:\n  allow_origins: [https://a.example.com, https://b.example.com]\n');
    assert.equal(await sent('a.html'), 'https://a.example.com https://b.example.com');
    write('apps:\n  allow_origins: [https://c.example.com]\n');
    assert.equal(await sent('a.html'), 'https://c.example.com');
    assert.equal(await sent('a.jpg'), null);
  });
});
