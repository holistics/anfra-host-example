import path from 'node:path';

/** What the host's server is told by its environment. */
export interface Config {
  /** Development (live reload, nothing cached) or production (read once, cached). */
  mode: 'development' | 'production';
  /** Where this server listens. */
  port: number;
  hostname: string;
  /** The anfra server answering the core API: `anfra serve --no-apps`, never on the public internet. */
  anfraUrl: string;
  /** The Data Folder anfra serves. Definitions are its `apps/**\/*.html`, read from disk by this server. */
  repoDir: string;
  /** Requests a minute one client may send to `core.query`. */
  queryRateLimit: number;
  /** Take the client's address from `X-Forwarded-For`, as the one proxy in front of this server appends it. */
  trustProxy: boolean;
  /** Pass anfra's MCP endpoint through at `/mcp`, with the export files it links to. */
  mcp: boolean;
}

export function loadConfig(env: NodeJS.ProcessEnv = process.env): Config {
  const repoDir = path.resolve(env.ANFRA_REPO ?? '../demo-data');
  return {
    mode: env.NODE_ENV === 'production' ? 'production' : 'development',
    port: Number(env.PORT ?? 8787),
    hostname: env.HOSTNAME ?? '127.0.0.1',
    anfraUrl: (env.ANFRA_URL ?? 'http://127.0.0.1:7878').replace(/\/+$/, ''),
    repoDir,
    queryRateLimit: Number(env.QUERY_RATE_LIMIT ?? 120),
    trustProxy: env.TRUST_PROXY === '1',
    mcp: env.MCP === '1',
  };
}

export const appsDir = (config: Config) => path.join(config.repoDir, 'apps');
