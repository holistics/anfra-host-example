import type {
  InspectedApp,
  InspectedControl,
  InspectedQuery,
  InspectedStructure,
  LocateKind,
  LocateTarget,
} from '@holistics/anfra-sdk/common';
import { ChevronRight, Search } from 'lucide-react';
import { type ReactNode, useEffect, useState } from 'react';
import { Input } from '@/components/ui/input';
import { cn } from '@/lib/utils';
import { entityKey, usageOf } from '../../model/format';
import { controlTargets, queryInputs } from '../../model/inputs';
import type { attributeRequests } from '../../model/requests';
import type { DataFilter, RevealTarget } from '../../model/types';
import { Note } from '../shared/fields';
import { scrollToAndFlash } from '../shared/reveal';
import { ControlRow } from './control-row';
import { QueryRow } from './query-row';
import { RequestList } from './request-list';
import { SelectionCard } from './selection-card';

interface Props {
  apps: InspectedApp[] | undefined;
  structure: InspectedStructure | undefined;
  /** The request log, split by the query each request belongs to. */
  requests: ReturnType<typeof attributeRequests>;
  /** The search and filter, kept by the panel so other parts of it can set them. */
  view: DataFilter;
  onView: (view: DataFilter) => void;
  /** Whether the reader may see generated SQL. */
  canViewSql: boolean;
  /** An entity to open and scroll to, asked for from elsewhere; the nonce repeats a request. */
  focus: { key: string; nonce: number } | undefined;
  onLocate: (target: LocateTarget) => void;
  onReveal: (target: RevealTarget) => void;
}

const matches = (search: string, ...texts: (string | undefined)[]) =>
  !search || texts.some((text) => text?.toLowerCase().includes(search));

function showQuery(view: DataFilter, app: InspectedApp, name: string, query: InspectedQuery) {
  if (view.filter === 'errors' && query.state !== 'error') return false;
  if (view.filter === 'dirty' && !query.isDirty) return false;
  return matches(view.search.trim().toLowerCase(), name, app.declaration.queries[name]?.dataset);
}

function showControl(view: DataFilter, app: InspectedApp, name: string, control: InspectedControl) {
  // Controls have no error state.
  if (view.filter === 'errors') return false;
  if (view.filter === 'dirty' && !control.isDirty) return false;
  const declaration = app.declaration.filters[name] ?? app.declaration.dateDrills[name];
  const field = declaration && 'field' in declaration ? declaration.field : undefined;
  return matches(view.search.trim().toLowerCase(), name, declaration?.label, field);
}

/**
 * Every app's queries, controls and selection, one line each until opened. Which rows and
 * sections are open, and each query's code tab, survive the snapshots the frame keeps posting.
 */
export function DataTab({
  apps,
  structure,
  requests,
  view,
  onView,
  canViewSql,
  focus,
  onLocate,
  onReveal,
}: Props) {
  const [open, setOpen] = useState<Set<string>>(new Set());
  const [closedSections, setClosedSections] = useState<Set<string>>(new Set());

  const toggleIn = (set: Set<string>, key: string) => {
    const next = new Set(set);
    if (!next.delete(key)) next.add(key);
    return next;
  };

  // biome-ignore lint/correctness/useExhaustiveDependencies: runs per request, not per snapshot
  useEffect(() => {
    if (!focus) return;
    const [kind, rest = ''] = focus.key.split(':');
    const app = Number(rest.split('/')[0]);
    const name = rest.slice(rest.indexOf('/') + 1);
    // A search or filter that would hide it goes.
    const inspected = apps?.[app];
    const query = inspected?.queries[name];
    const control = inspected?.controls[name];
    const hidden =
      inspected &&
      (kind === 'query'
        ? query && !showQuery(view, inspected, name, query)
        : control && !showControl(view, inspected, name, control));
    if (hidden) onView({ search: '', filter: 'all' });
    setOpen((prev) => new Set(prev).add(focus.key));
    setClosedSections((prev) => {
      const next = new Set(prev);
      next.delete(`${app}:${kind}`);
      return next;
    });
    scrollToAndFlash(`[data-entity="${CSS.escape(focus.key)}"]`);
  }, [focus]);

  if (!apps) return <Note>Waiting for the Data App…</Note>;
  if (apps.length === 0) return <Note>This Data App hasn't created an SDK app.</Note>;

  const counts = { errors: 0, dirty: 0 };
  for (const app of apps) {
    for (const query of Object.values(app.queries)) {
      if (query.state === 'error') counts.errors++;
      if (query.isDirty) counts.dirty++;
    }
    for (const control of Object.values(app.controls)) if (control.isDirty) counts.dirty++;
  }
  const filtering = view.search.trim() !== '' || view.filter !== 'all';

  return (
    <div>
      <Toolbar view={view} onView={onView} counts={counts} />
      <div className="space-y-5 p-2">
        {apps.map((app, index) => {
          const queries = Object.entries(app.queries);
          const controls = Object.entries(app.controls);
          const shownQueries = queries.filter(([name, q]) => showQuery(view, app, name, q));
          const shownControls = controls.filter(([name, c]) => showControl(view, app, name, c));
          const section = (name: string) => ({
            open: !closedSections.has(`${index}:${name}`),
            onToggle: () => setClosedSections((prev) => toggleIn(prev, `${index}:${name}`)),
          });
          const row = (kind: LocateKind, name: string) => {
            const key = entityKey(kind, index, name);
            return {
              entityKey: key,
              open: open.has(key),
              onToggle: () => setOpen((prev) => toggleIn(prev, key)),
              app: index,
              name,
              usage: usageOf(structure, kind, index, name),
              onLocate,
            };
          };
          const none = (what: string) =>
            view.search.trim() ? `No ${what} match "${view.search.trim()}".` : `No ${what} match the filter.`;
          return (
            // biome-ignore lint/suspicious/noArrayIndexKey: an app's index is its identity in the frame
            <section key={index} className="space-y-3">
              <p className="px-1 text-xs text-muted-foreground">
                {apps.length > 1 && <span className="font-medium text-foreground">App {index + 1} · </span>}
                {app.title || 'Untitled'} · {app.timezone || 'tenant timezone'} ·{' '}
                {app.hasChanges ? (
                  <span className="text-amber-600 dark:text-amber-400">unapplied changes</span>
                ) : (
                  'no unapplied changes'
                )}
              </p>

              <Section
                title="Queries"
                count={queries.length}
                shown={filtering ? shownQueries.length : undefined}
                empty={filtering ? none('queries') : 'None.'}
                {...section('query')}
              >
                {shownQueries.map(([name, query]) => (
                  <QueryRow
                    key={name}
                    query={query}
                    declaration={app.declaration.queries[name]}
                    inputs={queryInputs(app, name)}
                    requests={requests.byQuery.get(`${index}/${name}`) ?? []}
                    canViewSql={canViewSql}
                    onReveal={onReveal}
                    {...row('query', name)}
                  />
                ))}
              </Section>

              <Section
                title="Controls"
                count={controls.length}
                shown={filtering ? shownControls.length : undefined}
                empty={
                  view.filter === 'errors'
                    ? 'Controls have no error state.'
                    : filtering
                      ? none('controls')
                      : 'This app declares no controls.'
                }
                {...section('control')}
              >
                {shownControls.map(([name, control]) => (
                  <ControlRow
                    key={name}
                    control={control}
                    declaration={app.declaration.filters[name] ?? app.declaration.dateDrills[name]}
                    targets={controlTargets(app, name)}
                    onReveal={onReveal}
                    {...row('control', name)}
                  />
                ))}
              </Section>

              {(app.selection || app.appliedSelection) && (
                <Section
                  title="Selection"
                  count={[app.selection, app.appliedSelection].filter(Boolean).length}
                  empty="None."
                  {...section('selection')}
                >
                  {app.selection && <SelectionCard label="Current" selection={app.selection} />}
                  {app.appliedSelection && <SelectionCard label="Applied" selection={app.appliedSelection} />}
                </Section>
              )}
            </section>
          );
        })}

        {requests.other.length > 0 && (
          <Section
            title="Other requests"
            count={requests.other.length}
            empty="None."
            open={!closedSections.has('other')}
            onToggle={() => setClosedSections((prev) => toggleIn(prev, 'other'))}
          >
            <RequestList items={requests.other.map((entry) => ({ entry }))} />
          </Section>
        )}
      </div>
    </div>
  );
}

function Toolbar({
  view,
  onView,
  counts,
}: {
  view: DataFilter;
  onView: (view: DataFilter) => void;
  counts: { errors: number; dirty: number };
}) {
  const filters: { value: DataFilter['filter']; label: string }[] = [
    { value: 'all', label: 'All' },
    { value: 'errors', label: `Errors (${counts.errors})` },
    { value: 'dirty', label: `Dirty (${counts.dirty})` },
  ];
  return (
    <div className="sticky top-0 z-10 space-y-1.5 border-b bg-background p-2">
      <div className="relative">
        <Search className="pointer-events-none absolute top-1/2 left-2 size-3.5 -translate-y-1/2 text-muted-foreground" />
        <Input
          value={view.search}
          onChange={(event) => onView({ ...view, search: event.target.value })}
          onKeyDown={(event) => event.key === 'Escape' && onView({ ...view, search: '' })}
          placeholder="Search names, datasets, labels"
          aria-label="Search queries and controls"
          className="h-7 pl-7 text-xs md:text-xs"
        />
      </div>
      <div className="flex gap-1">
        {filters.map((filter) => (
          <button
            key={filter.value}
            type="button"
            aria-pressed={view.filter === filter.value}
            onClick={() => onView({ ...view, filter: filter.value })}
            className={cn(
              'rounded-md px-2 py-0.5 text-xs text-muted-foreground hover:text-foreground',
              view.filter === filter.value && 'bg-accent font-medium text-foreground',
            )}
          >
            {filter.label}
          </button>
        ))}
      </div>
    </div>
  );
}

function Section(props: {
  title: string;
  count: number;
  /** How many show, when a search or filter hides some. */
  shown?: number;
  empty: string;
  open: boolean;
  onToggle: () => void;
  children: ReactNode;
}) {
  const visible = props.shown ?? props.count;
  return (
    <div>
      <button
        type="button"
        className="flex w-full items-center gap-1 rounded px-1 py-0.5 text-[11px] font-semibold tracking-wide text-muted-foreground uppercase hover:text-foreground"
        onClick={props.onToggle}
        aria-expanded={props.open}
      >
        <ChevronRight className={cn('size-3 transition-transform', props.open && 'rotate-90')} />
        {props.title}
        <span className="font-normal">
          {props.shown === undefined ? props.count : `${props.shown} of ${props.count}`}
        </span>
      </button>
      {props.open && (
        <div className="mt-1 space-y-px">{visible === 0 ? <Note>{props.empty}</Note> : props.children}</div>
      )}
    </div>
  );
}
