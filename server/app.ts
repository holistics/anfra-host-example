import { readFileSync } from 'node:fs';
import path from 'node:path';
import { getConnInfo } from '@hono/node-server/conninfo';
import { serveStatic } from '@hono/node-server/serve-static';
import { type Context, Hono } from 'hono';
import { streamSSE } from 'hono/streaming';
import { coreApi, exportDownload, health } from './anfra.js';
import { catalog, type Entry } from './catalog.js';
import { appsDir, type Config } from './config.js';
import { repoEvents } from './events.js';
import { serveAppFile } from './files.js';
import { mcp } from './mcp.js';

export interface AppOptions {
  config: Config;
  hostVersion: string;
  /** The built page (`vite build`), served in production; in development Vite serves it. */
  pageDir?: string;
}

/**
 * The host's server: the core API (only what Data Apps need), the Data Apps themselves, read from
 * the repo's apps folder, anfra's MCP when asked for, and, in production, the page.
 */
export function createApp({ config, hostVersion, pageDir }: AppOptions) {
  const app = new Hono();
  const apps = appsDir(config);
  const production = config.mode === 'production';

  // Behind a proxy, the client is the address that proxy appended: the last in X-Forwarded-For.
  // Earlier entries come from the client itself, so they can't be trusted.
  const clientOf = (c: Context) =>
    (config.trustProxy && c.req.header('x-forwarded-for')?.split(',').at(-1)?.trim()) ||
    getConnInfo(c).remote.address ||
    'unknown';

  app.route('/api', coreApi(config, clientOf));
  if (config.mcp) app.route('/', mcp(config));

  // An export's file, at the link anfra made for this host's origin.
  app.on(['GET', 'HEAD'], '/exports/download/*', (c) => exportDownload(c, config));

  // The Data App tree. A deployed repo does not change, so production reads it once.
  const tree: Entry[] | undefined = production ? catalog(apps) : undefined;
  app.get('/host/apps', (c) => c.json(tree ?? catalog(apps), 200, { 'Cache-Control': 'no-store' }));

  // A definition, or a file it refers to.
  app.on(['GET', 'HEAD'], '/host/files/*', (c) => {
    const rel = decodeURIComponent(c.req.path.slice('/host/files/'.length));
    return serveAppFile(c, apps, rel, production ? 'short' : 'none');
  });

  // Live reload, in development: what changed in the repo, as server-sent events.
  if (!production) {
    const events = repoEvents(config.repoDir);
    app.get('/host/events', (c) =>
      streamSSE(c, async (stream) => {
        const unsubscribe = events.subscribe((event) => {
          void stream.writeSSE({ data: JSON.stringify(event) });
        });
        stream.onAbort(unsubscribe);
        // Keep the stream open, with a comment now and then so proxies don't close it.
        while (!stream.aborted) {
          await stream.write(': keep-alive\n\n');
          await stream.sleep(25_000);
        }
        unsubscribe();
      }),
    );
  }

  app.get('/health', (c) => health(c, config, hostVersion));
  app.all('/host/*', (c) => c.notFound());

  if (pageDir) {
    const index = readFileSync(path.join(pageDir, 'index.html'), 'utf8');
    // Hashed by Vite, so they never change under the same name.
    app.use(
      '/assets/*',
      serveStatic({
        root: pageDir,
        onFound: (_, c) => {
          c.header('Cache-Control', 'public, max-age=31536000, immutable');
        },
      }),
    );
    // The page itself: `/`, and `/apps/<path>` for each Data App. Anything else is not here.
    const shell = (c: Context) => c.html(index, 200, { 'Cache-Control': 'no-cache' });
    app.get('/', shell);
    app.get('/apps/*', shell);
  }

  return app;
}
