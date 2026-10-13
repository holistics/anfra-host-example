// Everything this host asks of the Anfra SDK, in one place. A host of your own needs these calls
// and nothing else from the SDK; the rest of this project is UI around them.
//
//   @holistics/anfra-sdk/api   talks to the core API: the datasets, and a Backend for queries
//   @holistics/anfra-sdk/host  mounts a Data App in a sandboxed frame and answers it over the bridge
import { coreApiBackend, coreClient, loadDatasets } from '@holistics/anfra-sdk/api';
import type {
  DatasetDescriptor,
  InspectedApp,
  InspectedStructure,
  LocateTarget,
  Rendering,
  RenderRequest,
  User,
} from '@holistics/anfra-sdk/common';
import { mountDataApp } from '@holistics/anfra-sdk/host';

export type {
  DatasetDescriptor,
  InspectedApp,
  InspectedStructure,
  LocateTarget,
  RenderFormat,
  Rendering,
  RenderRequest,
  StructureNode,
} from '@holistics/anfra-sdk/common';

/**
 * The core API, as this host's server lets it through (server/anfra.ts): `core.show`, `core.query`
 * and `core.query.export`.
 */
const api = coreClient('/api');

/** Every dataset a Data App may query, from `core.show`. Each frame is provisioned with them. */
export async function datasets(): Promise<Record<string, DatasetDescriptor>> {
  const loaded = await loadDatasets(api);
  for (const d of loaded.diagnostics) console.warn('anfra:', d.message);
  return loaded.datasets;
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

/** A Data App definition, as its author wrote it, and where its relative URLs resolve. */
export async function definition(path: string): Promise<{ html: string; baseHref: string }> {
  const file = path.split('/').map(encodeURIComponent).join('/');
  const response = await fetch(`/host/files/${file}`);
  if (!response.ok) throw new Error(`Couldn't read ${path}: the server answered ${response.status}.`);
  const dir = file.includes('/') ? file.slice(0, file.lastIndexOf('/') + 1) : '';
  // Absolute: the frame's document is a srcdoc, so a relative base would resolve against nothing useful.
  return { html: await response.text(), baseHref: `${window.location.origin}/host/files/${dir}` };
}

export interface MountOptions {
  container: HTMLElement;
  path: string;
  datasets: Record<string, DatasetDescriptor>;
  /** The frame's inspection snapshots, while inspecting: its apps, and the structure its markup declares. */
  onInspect: (apps: InspectedApp[], structure: InspectedStructure) => void;
  /** In pick mode, the node the reader pointed at (its key), or null when they left the mode. */
  onPick: (node: string | null) => void;
}

/** What the page does with a mounted Data App. */
export interface DataApp {
  frame: HTMLIFrameElement;
  setInspecting: (open: boolean) => void;
  setPicking: (on: boolean) => void;
  highlight: (node: string | null) => void;
  locate: (target: LocateTarget) => void;
  /**
   * Save a PNG or PDF of the app, or of one block or container, once its running queries settle.
   * Resolves with what was saved; `omitted` lists the images left blank, since their servers send
   * no CORS headers.
   */
  render: (request: RenderRequest) => Promise<Rendering>;
  unmount: () => void;
}

/**
 * Mount a Data App in `container`: a sandboxed frame running its definition, with the SDK and the
 * datasets provisioned ahead of it. Its queries come back to this page over the bridge, and are
 * answered by `core.query` through this host's server. Its exports too, by `core.query.export`: the
 * SDK saves the file from this page, by following the link anfra made at this host's origin.
 *
 * Rendering (a PNG or PDF of the app, `Anfra.render()` in the app, `render()` here) is off unless
 * turned on: the frame draws the picture and this page saves it, so the app's own code chooses a
 * file this host's origin downloads. The SDK lets through only a PNG or a PDF; turn it on only for
 * apps you trust with that, as this host does for its own repo.
 */
export async function mount(options: MountOptions): Promise<DataApp> {
  const { html, baseHref } = await definition(options.path);
  return mountDataApp({
    container: options.container,
    definition: html,
    baseHref,
    datasets: options.datasets,
    user: reader,
    backend: coreApiBackend(api, { datasets: options.datasets }),
    onInspect: options.onInspect,
    onPick: options.onPick,
    render: true,
    title: options.path,
  });
}
