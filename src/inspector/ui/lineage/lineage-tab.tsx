import type { InspectedApp, InspectedStructure, LocateTarget } from '@holistics/anfra-sdk/common';
import { TriangleAlert } from 'lucide-react';
import { type Dispatch, type ReactNode, type SetStateAction, useEffect, useMemo, useState } from 'react';
import { Dialog, DialogContent, DialogDescription, DialogTitle } from '@/components/ui/dialog';
import {
  buildLineageGraph,
  filterGraph,
  focusGraph,
  type LineageCatalog,
  type LineageKind,
  lineageTargets,
  targetKey,
} from '../../model/lineage';
import type { InspectorEnv, RevealTarget } from '../../model/types';
import { Note } from '../shared/fields';
import { LineageCanvas } from './lineage-canvas';
import type { LineageActions } from './lineage-node';
import { LineageToolbar } from './lineage-toolbar';

/** What the canvas shows: the kinds hidden, the node focused on, and the node whose path is pinned. */
export interface LineageView {
  hidden: Set<LineageKind>;
  focus?: string;
  selected?: string;
}

/**
 * What the catalog answered, for the fields asked (`key`). The panel keeps it, so switching tabs
 * doesn't trace again.
 */
export interface LineageFetch {
  key: string;
  status: 'loading' | 'ready' | 'failed';
  catalog?: LineageCatalog;
  error?: string;
}

interface Props {
  apps: InspectedApp[] | undefined;
  structure: InspectedStructure | undefined;
  env: InspectorEnv;
  view: LineageView;
  onView: Dispatch<SetStateAction<LineageView>>;
  fetched: LineageFetch | undefined;
  onFetched: Dispatch<SetStateAction<LineageFetch | undefined>>;
  onLocate: (target: LocateTarget) => void;
  onHighlight: (node: string | null) => void;
  onReveal: (target: RevealTarget) => void;
}

/** Where each number on the page comes from, as a canvas: block, query, field, dataset, model, table. */
export function LineageTab({
  apps,
  structure,
  env,
  view,
  onView,
  fetched,
  onFetched,
  onLocate,
  onHighlight,
  onReveal,
}: Props) {
  const [expanded, setExpanded] = useState(false);
  const targets = useMemo(() => lineageTargets(apps ?? []), [apps]);
  const key = targets.map(targetKey).join('|');

  // Trace the page's fields when they change. A trace outlives the tab: its answer lands in the panel.
  // biome-ignore lint/correctness/useExhaustiveDependencies: traces per set of fields, not per snapshot
  useEffect(() => {
    const source = env.lineage;
    if (!source || (fetched?.key === key && fetched.status !== 'failed')) return;
    const tables = fetched?.catalog?.tables;
    onFetched({ key, status: 'loading', catalog: fetched?.catalog });
    const traced = targets.length ? source.trace(targets) : Promise.resolve({ results: [] });
    const known = tables ? Promise.resolve(tables) : source.tables().catch(() => ({}));
    void Promise.all([
      traced.then(
        (r) => ({ ok: true as const, r }),
        (e: Error) => ({ ok: false as const, e }),
      ),
      known,
    ]).then(([trace, tables]) =>
      onFetched((current) => {
        if (current?.key !== key) return current;
        if (!trace.ok)
          return { key, status: 'failed', error: trace.e.message, catalog: { traced: new Map(), tables } };
        const traced = new Map(trace.r.results.map((r) => [targetKey(r.target), r]));
        return { key, status: 'ready', catalog: { traced, tables } };
      }),
    );
  }, [key, env.lineage]);

  const datasetLabels = useMemo(
    () => Object.fromEntries(Object.entries(env.datasets).map(([fqn, d]) => [fqn, d.label])),
    [env.datasets],
  );
  const graph = useMemo(
    () => buildLineageGraph(apps ?? [], structure, fetched?.catalog, env.metricDocs, datasetLabels),
    [apps, structure, fetched?.catalog, env.metricDocs, datasetLabels],
  );
  const counts = useMemo(() => {
    const counts: Partial<Record<LineageKind, number>> = {};
    for (const node of graph.nodes) counts[node.kind] = (counts[node.kind] ?? 0) + 1;
    return counts;
  }, [graph]);
  const filtered = useMemo(() => filterGraph(graph, view.hidden), [graph, view.hidden]);
  const focus = view.focus ? filtered.nodes.find((n) => n.id === view.focus) : undefined;
  const shown = useMemo(() => (focus ? focusGraph(filtered, focus.id) : filtered), [filtered, focus]);

  // A pinned block or query is outlined on the page too, until the pin moves or the tab closes.
  const selected = view.selected ? shown.nodes.find((n) => n.id === view.selected) : undefined;
  const outlined =
    selected?.kind === 'block' || selected?.kind === 'query' ? selected.structureKey : undefined;
  useEffect(() => {
    if (!outlined) return;
    onHighlight(outlined);
    return () => onHighlight(null);
  }, [outlined, onHighlight]);

  // Esc lets go of the pin.
  useEffect(() => {
    if (!view.selected) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && !expanded) onView((v) => ({ ...v, selected: undefined }));
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [view.selected, expanded, onView]);

  const actions = useMemo<LineageActions>(
    () => ({
      locate: (node) => onLocate({ node }),
      reveal: (target) => {
        setExpanded(false);
        onReveal(target);
      },
      focus: (id) => onView((v) => ({ ...v, focus: id, selected: id })),
    }),
    [onLocate, onReveal, onView],
  );

  if (!apps) return <Padded>Waiting for the Data App…</Padded>;
  if (graph.nodes.length === 0) {
    return (
      <Padded>
        Nothing to trace yet. The lineage starts from the fields the app's queries return: it fills in once
        they have run.
      </Padded>
    );
  }

  const toolbar = (onExpand?: () => void) => (
    <LineageToolbar
      counts={counts}
      hidden={view.hidden}
      onHidden={(hidden) => onView((v) => ({ ...v, hidden }))}
      focus={focus}
      onClearFocus={() => onView((v) => ({ ...v, focus: undefined }))}
      loading={fetched?.status === 'loading'}
      onExpand={onExpand}
    />
  );
  const canvas = (minimap?: boolean) => (
    <LineageCanvas
      graph={shown}
      selected={view.selected}
      onSelect={(selected) => onView((v) => ({ ...v, selected }))}
      actions={actions}
      minimap={minimap}
    />
  );

  return (
    <div className="flex h-full flex-col">
      {toolbar(() => setExpanded(true))}
      <Unavailable env={env} fetched={fetched} />
      <div className="min-h-0 flex-1">{!expanded && canvas()}</div>
      <Dialog open={expanded} onOpenChange={setExpanded}>
        <DialogContent className="flex h-[90vh] w-[95vw] max-w-[95vw] flex-col gap-0 overflow-hidden p-0 sm:max-w-[95vw]">
          <div className="border-b px-4 py-3 pr-12">
            <DialogTitle className="text-base">Lineage</DialogTitle>
            <DialogDescription className="text-xs">
              From the page's blocks to the database tables. Click a card to follow its path.
            </DialogDescription>
          </div>
          {toolbar()}
          <div className="min-h-0 flex-1">{canvas(true)}</div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

/** Why the canvas stops short of the catalog, when it does. */
function Unavailable({ env, fetched }: { env: InspectorEnv; fetched: LineageFetch | undefined }) {
  const message = !env.lineage
    ? "This host doesn't trace lineage: the canvas shows what the page says, without database tables."
    : fetched?.status === 'failed'
      ? `Couldn't trace lineage (${fetched.error}). Metrics stop at their dataset. Tracing needs anfra 0.9.1 or later, and a catalog built with \`anfra ingest\`.`
      : undefined;
  if (!message) return null;
  return (
    <div className="flex items-start gap-1.5 border-b bg-amber-50 px-3 py-1.5 text-xs text-amber-900 dark:bg-amber-400/10 dark:text-amber-200">
      <TriangleAlert className="mt-px size-3.5 shrink-0" />
      <span>{message}</span>
    </div>
  );
}

function Padded({ children }: { children: ReactNode }) {
  return (
    <div className="p-2">
      <Note>{children}</Note>
    </div>
  );
}
