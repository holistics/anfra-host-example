import { readFileSync } from 'node:fs';
import path from 'node:path';
import { parse } from 'yaml';

/** The repo's anfra config, as `anfra serve` reads it: `apps.allow_origins` is what this host takes from it. */
export const configFile = path.join('.anfra', 'config.yml');

/** Problems already said, so a development server reading the file on every mount says each once. */
const said = new Set<string>();
function warn(message: string) {
  if (said.has(message)) return;
  said.add(message);
  console.warn(`${configFile}: ${message}`);
}

/**
 * An origin the SDK takes: `https://` with a host and nothing after it, as `URL` writes it. The SDK
 * refuses any other, and every Data App with it, so one is left out here and said instead.
 */
export function isOrigin(value: unknown): value is string {
  if (typeof value !== 'string' || !URL.canParse(value)) return false;
  const url = new URL(value);
  return url.protocol === 'https:' && url.origin === value && !url.host.includes('*');
}

/** The repo's allowed origins: none when it has no config or the config names none. */
export function readAllowOrigins(repoDir: string): string[] {
  let text: string;
  try {
    text = readFileSync(path.join(repoDir, configFile), 'utf8');
  } catch (err) {
    if ((err as NodeJS.ErrnoException).code !== 'ENOENT') warn(`can't read it: ${(err as Error).message}`);
    return [];
  }
  let root: unknown;
  try {
    root = parse(text);
  } catch (err) {
    warn(`not valid YAML: ${(err as Error).message.split('\n')[0]}`);
    return [];
  }
  const list = (root as { apps?: { allow_origins?: unknown } } | null)?.apps?.allow_origins;
  if (list === undefined || list === null) return [];
  if (!Array.isArray(list)) {
    warn('apps.allow_origins should be a list of origins; ignored.');
    return [];
  }
  const allowOrigins: string[] = [];
  for (const origin of list) {
    if (isOrigin(origin)) allowOrigins.push(origin);
    else
      warn(
        `apps.allow_origins: ${JSON.stringify(origin)} is not an origin: write https://<host>[:<port>], with no path, wildcard or trailing slash; ignored.`,
      );
  }
  return allowOrigins;
}
