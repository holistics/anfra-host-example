// Everything this host asks of the Anfra SDK, in one place. A host of your own needs these calls
// and nothing else from the SDK; the rest of this project is UI around them.
//
//   @holistics/anfra-sdk/api      talks to the core API: the datasets, and a Backend for queries
//   @holistics/anfra-sdk/host     the plugin host: mounts a Data App in a sandboxed frame, answers
//                                 its calls over the bridge with the plugins installed, and gives
//                                 the plugins' commands and tabs for this page to draw
//   @holistics/anfra-sdk/plugins  anfra's plugins: queries, exports, lineage, pictures, inspect
import { coreApiBackend, coreClient, loadDatasets } from '@holistics/anfra-sdk/api';
import type { DatasetDescriptor, ThemeInput, User } from '@holistics/anfra-sdk/common';
import { createHost, type Host, type MountedDataApp } from '@holistics/anfra-sdk/host';
import {
  corePlugin,
  exportPlugin,
  inspectPlugin,
  lineagePlugin,
  renderPlugin,
} from '@holistics/anfra-sdk/plugins';
import { askAiPlugin } from '@/askai';
import { copyText } from '@/lib/clipboard';
import { shellPlugin } from '@/lib/shell';
import { allowOriginsHeader } from '../server/entry';

export type { DatasetDescriptor, Rendering } from '@holistics/anfra-sdk/common';
export type { Command, CommandState, Host, MountedDataApp, Panel, Tab } from '@holistics/anfra-sdk/host';

/**
 * The core API, as this host's server lets it through (server/anfra.ts): `core.show`, `core.query`,
 * `core.query.export` and `core.lineage`.
 */
const api = coreClient('/api');

/** Every dataset a Data App may query, from `core.show`: each frame is provisioned with them. */
export async function loadCatalog(): Promise<Record<string, DatasetDescriptor>> {
  const { datasets, diagnostics } = await loadDatasets(api);
  for (const d of diagnostics) console.warn('anfra:', d.message);
  return datasets;
}

/**
 * Who reads the Data Apps. A real host takes this from its own session: who is signed in, their
 * time zone, and what they may do. The permissions are display hints for the app (whether it
 * offers SQL, an export or a picture); what a reader may actually query is decided on the server.
 */
export const reader: User = {
  id: 1,
  name: 'Demo reader',
  email: 'reader@example.com',
  role: 'viewer',
  timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
  permissions: { canViewGeneratedSql: true, canExportData: true },
};

/**
 * A Data App definition, as its author wrote it, and the origins it may load from beyond the SDK's
 * CDNs, which the server sends with it (`allowOriginsHeader`).
 */
export async function definition(path: string): Promise<{ html: string; allowOrigins: string[] }> {
  const file = path.split('/').map(encodeURIComponent).join('/');
  const response = await fetch(`/host/files/${file}`);
  if (!response.ok) throw new Error(`Couldn't read ${path}: the server answered ${response.status}.`);
  return {
    html: await response.text(),
    allowOrigins: (response.headers.get(allowOriginsHeader) ?? '').split(' ').filter(Boolean),
  };
}

/** Each mounted frame's app, for Ask AI's prompt: its label and its definition's file. */
const apps = new WeakMap<HTMLIFrameElement, { label: string; file: string }>();

/** The theme plugin UI follows: the inspect panel's tabs, and the menu, card and modals in the frame. */
let theme: ThemeInput = { scheme: 'light' };

/** Follow the page's theme: every tab and every mounted frame's plugin layer redraw in it. */
export function setPluginTheme(next: ThemeInput) {
  theme = next;
  host?.runtime.setTheme(next);
}

/**
 * The page's plugin host: every plugin anfra has, over the core API through this host's server, and
 * this host's own two. Made again when the datasets are (an AML change), since the Backend resolves
 * fields against them.
 *
 * - `core` runs the app's queries and suggests a filter's values, by `core.query`.
 * - `export` makes a query's whole result a file, by `core.query.export`: the SDK saves it from
 *   this page, by following the link anfra made at this host's origin.
 * - `lineage` traces fields through the repo's catalog (`Anfra.lineage()`), by `core.lineage`, and
 *   adds the panel's Lineage tab.
 * - `render` draws a PNG or PDF of the app in the frame (`Anfra.render()` in the app, the Download
 *   commands here), and has this page save it: installing it is the opt-in, since the app's own code
 *   then chooses a file this host's origin downloads. The SDK lets through only a PNG or a PDF;
 *   install it only for apps you trust with that, as this host does for its own repo.
 * - `inspect` adds the Inspect command and the panel's Overview, Data, Queries, Structure and
 *   Declaration tabs. This page draws the panel around them (src/components/plugin-panel.tsx).
 * - `askai` (src/askai) comments on a part of the app and copies it as a prompt for an agent.
 * - `shell` (src/lib/shell.ts) is this page's own commands, so their shortcuts work in the frame.
 *
 * A Data App sees what is installed as `Anfra.plugins`: leave one out, and apps offer none of it.
 * Its frames load from the SDK's CDNs and the repo's allowed origins alone (`allowOrigins`); made
 * again when those change too.
 */
let host: { datasets: Record<string, DatasetDescriptor>; origins: string; runtime: Host } | undefined;
function hostFor(datasets: Record<string, DatasetDescriptor>, allowOrigins: string[]): Host {
  const origins = allowOrigins.join(' ');
  if (host?.datasets !== datasets || host.origins !== origins) {
    const backend = coreApiBackend(api, { datasets });
    host = {
      datasets,
      origins,
      runtime: createHost({
        plugins: [
          corePlugin(backend),
          exportPlugin(backend),
          lineagePlugin(backend),
          renderPlugin(),
          inspectPlugin(),
          askAiPlugin({ appOf: (mount) => apps.get(mount.frame), copy: copyText }),
          shellPlugin(),
        ],
        allowOrigins,
        theme,
      }),
    };
  }
  return host.runtime;
}

export interface MountOptions {
  container: HTMLElement;
  path: string;
  /** The app's label, for Ask AI's prompt. */
  label: string;
  datasets: Record<string, DatasetDescriptor>;
}

/** A mounted Data App, and the host it runs on: its commands and tabs are the host's. */
export interface Mounted {
  host: Host;
  app: MountedDataApp;
  unmount: () => void;
}

/**
 * Mount a Data App in `container`: a sandboxed frame running its definition, with the SDK, the
 * plugins' frame halves and the datasets provisioned ahead of it. Its calls come back to this page
 * over the bridge, and the plugins answer them (see `hostFor`).
 */
export async function mount(options: MountOptions): Promise<Mounted> {
  const { html, allowOrigins } = await definition(options.path);
  const runtime = hostFor(options.datasets, allowOrigins);
  const app = runtime.mount({
    container: options.container,
    definition: html,
    datasets: options.datasets,
    user: reader,
    title: options.path,
  });
  apps.set(app.frame, { label: options.label, file: `apps/${options.path}` });
  return {
    host: runtime,
    app,
    unmount() {
      apps.delete(app.frame);
      app.unmount();
    },
  };
}
