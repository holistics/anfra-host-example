import type { Context } from 'hono';
import { textOf, titleOf } from './catalog.js';
import type { Config } from './config.js';

/**
 * What a link to a page shows where it is shared (Slack, social sites, chat apps). Their crawlers
 * run no script, so the page's tags are written into the HTML the server sends.
 */
export interface Preview {
  title: string;
  description: string;
  /** Absolute, or relative to the definition. */
  image?: string;
}

const site = 'Data Apps';
const siteDescription = 'Interactive Data Apps, built on anfra with coding agents.';
/** In public/, so Vite copies it into the built page. 1200x630, as Open Graph sites crop to. */
export const defaultImage = '/og-image.png';

// A `>` inside a quoted value does not end the tag.
const metaRe = /<meta\b(?:[^>"']|"[^"]*"|'[^']*')*>/gi;
const attrRe = /([a-z:-]+)\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s"'>]+))/gi;

/** A definition's `<meta>` tags, by name or property, each as text; the first of a name wins. */
function metaOf(html: string): Map<string, string> {
  const end = html.search(/<\/head>/i);
  const head = end < 0 ? html : html.slice(0, end);
  const found = new Map<string, string>();
  for (const [tag] of head.matchAll(metaRe)) {
    const attrs = new Map<string, string>();
    for (const m of tag.matchAll(attrRe))
      attrs.set((m[1] as string).toLowerCase(), m[2] ?? m[3] ?? m[4] ?? '');
    const key = (attrs.get('property') ?? attrs.get('name'))?.toLowerCase();
    const content = textOf(attrs.get('content') ?? '');
    if (key && content && !found.has(key)) found.set(key, content);
  }
  return found;
}

/**
 * A Data App's preview, from its definition: its `og:title`, written for sharing, else the manifest's
 * `name` (as the sidebar shows it), else its `<title>`; its `og:description` or `description`; its `og:image`.
 */
export function appPreview(rel: string, html: string, name?: string): Preview {
  const meta = metaOf(html);
  return {
    title: meta.get('og:title') ?? name ?? titleOf(html) ?? (rel.split('/').at(-1) as string),
    description: meta.get('og:description') ?? meta.get('description') ?? siteDescription,
    image: meta.get('og:image'),
  };
}

/** Where readers reach this host: ANFRA_SITE_URL, else the request's origin, as the proxy saw it. */
function originOf(c: Context, config: Config): string {
  if (config.siteUrl) return config.siteUrl;
  const url = new URL(c.req.url);
  const proto = config.trustProxy && c.req.header('x-forwarded-proto')?.split(',').at(-1)?.trim();
  return proto === 'http' || proto === 'https' ? `${proto}://${url.host}` : url.origin;
}

const encodePath = (rel: string) => rel.split('/').map(encodeURIComponent).join('/');

/** An author's image as an absolute URL, relative to their definition; none if it is no URL at all. */
function imageOf(image: string | undefined, definitionUrl: string): string | undefined {
  if (!image) return undefined;
  try {
    return new URL(image, definitionUrl).href;
  } catch {
    return undefined;
  }
}

const escapeHtml = (s: string) => s.replace(/[&<>"']/g, (ch) => `&#${ch.charCodeAt(0)};`);

/**
 * The page's index.html with a preview's tags in its head, in place of its `<title>`. `rel` is the
 * Data App's definition, for an image named relative to it; none for the home page.
 */
export function withPreview(
  index: string,
  c: Context,
  config: Config,
  preview?: Preview,
  rel?: string,
): string {
  const origin = originOf(c, config);
  const image =
    imageOf(preview?.image, `${origin}/host/files/${encodePath(rel ?? '')}`) ?? origin + defaultImage;
  const title = preview?.title ?? site;
  const tags: [string, string, string][] = [
    ['name', 'description', preview?.description ?? siteDescription],
    ['property', 'og:type', 'website'],
    ['property', 'og:site_name', site],
    ['property', 'og:title', title],
    ['property', 'og:description', preview?.description ?? siteDescription],
    // The path as requested: `c.req.path` is decoded, and a space would break the link.
    ['property', 'og:url', origin + new URL(c.req.url).pathname],
    ['property', 'og:image', image],
    ['name', 'twitter:card', 'summary_large_image'],
  ];
  const head = [
    `<title>${escapeHtml(preview ? `${title} · ${site}` : site)}</title>`,
    ...tags.map(([attr, key, value]) => `<meta ${attr}="${key}" content="${escapeHtml(value)}" />`),
  ].join('\n    ');
  // A function, so a `$` in a title is not read as a replacement pattern.
  return /<title>[\s\S]*?<\/title>/i.test(index)
    ? index.replace(/<title>[\s\S]*?<\/title>/i, () => head)
    : index.replace(/<\/head>/i, () => `  ${head}\n  </head>`);
}
