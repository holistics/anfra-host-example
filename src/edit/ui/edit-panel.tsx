import type { DatasetDescriptor, InspectedApp } from '@holistics/anfra-sdk/common';
import { Crosshair, PencilLine, Search, X } from 'lucide-react';
import { type ReactNode, useEffect, useMemo, useState, useSyncExternalStore } from 'react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import type { InspectorSource } from '@/inspector';
import { queryInputs } from '@/inspector/model/inputs';
import { CodeBlock } from '@/inspector/ui/shared/code-block';
import { cn } from '@/lib/utils';
import { type AqlEntry, parseExplore } from '../model/aql';
import { nodeTitle, type QueryRef, queriesOfNode } from '../model/block';
import { type FieldGroup, fieldGroups, isAdhoc, usedRefs } from '../model/fields';
import { loadSources, type SourceFile, type TierResult, tierOf } from '../model/tier';

interface Props {
  source: InspectorSource;
  /** The open Data App's path under `apps/`. */
  path: string;
  datasets: Record<string, DatasetDescriptor>;
  /** The picked node's structure key, or none yet. */
  node: string | undefined;
  picking: boolean;
  onTogglePicking: () => void;
  onClose: () => void;
}

const tierTone: Record<TierResult['tier'], string> = {
  1: 'border-emerald-500/40 text-emerald-700 dark:text-emerald-300',
  2: 'border-emerald-500/40 text-emerald-700 dark:text-emerald-300',
  3: 'border-amber-500/40 text-amber-700 dark:text-amber-300',
  4: 'border-amber-500/40 text-amber-700 dark:text-amber-300',
};

/** The Edit panel: what the picked block queries, and what its dataset offers. Read-only for now (SPEC.md). */
export function EditPanel({ source, path, datasets, node, picking, onTogglePicking, onClose }: Props) {
  const snapshot = useSyncExternalStore(source.subscribe, source.getSnapshot);
  const [sources, setSources] = useState<SourceFile[]>();
  const [sourceError, setSourceError] = useState<string>();

  useEffect(() => {
    let cancelled = false;
    setSources(undefined);
    setSourceError(undefined);
    loadSources(path).then(
      (read) => !cancelled && setSources(read),
      (err: Error) => !cancelled && setSourceError(err.message),
    );
    return () => {
      cancelled = true;
    };
  }, [path]);

  const refs = node ? queriesOfNode(snapshot?.structure, node) : [];
  const title = node ? nodeTitle(snapshot?.structure, node) : undefined;

  return (
    <div className="flex h-full flex-col border-l">
      <div className="flex h-10 shrink-0 items-center gap-1 border-b px-2">
        <PencilLine className="ml-1 size-4 text-muted-foreground" />
        <h2 className="min-w-0 flex-1 truncate pl-1 text-sm font-medium">
          {title ? `Edit · ${title}` : 'Edit'}
        </h2>
        <Badge variant="outline">Read-only</Badge>
        <Button
          variant="ghost"
          size="sm"
          className={cn('h-7', picking && 'bg-accent text-accent-foreground')}
          aria-pressed={picking}
          onClick={onTogglePicking}
        >
          <Crosshair />
          Pick
        </Button>
        <Button
          variant="ghost"
          size="icon"
          className="size-7"
          onClick={onClose}
          aria-label="Close the edit panel"
        >
          <X />
        </Button>
      </div>
      <div className="min-h-0 flex-1 space-y-3 overflow-y-auto p-3">
        {sourceError && <Note tone="error">{sourceError}</Note>}
        {!node ? (
          <Note>
            {picking ? 'Click a block on the page to edit it.' : 'Pick a block on the page to edit it.'}
          </Note>
        ) : !snapshot ? (
          <Note>Waiting for the Data App to report its structure…</Note>
        ) : refs.length === 0 ? (
          <Note>This element shows no query. Pick a chart, a table or a KPI.</Note>
        ) : (
          refs.map((ref) => (
            <QuerySection
              key={`${ref.app}/${ref.name}`}
              queryRef={ref}
              app={snapshot.apps[ref.app]}
              datasets={datasets}
              sources={sources}
            />
          ))
        )}
      </div>
    </div>
  );
}

function QuerySection({
  queryRef,
  app,
  datasets,
  sources,
}: {
  queryRef: QueryRef;
  app: InspectedApp | undefined;
  datasets: Record<string, DatasetDescriptor>;
  sources: SourceFile[] | undefined;
}) {
  const declaration = app?.declaration.queries[queryRef.name];
  const query = app?.queries[queryRef.name];
  const dataset = declaration ? datasets[declaration.dataset] : undefined;
  const aql = declaration?.aql ?? '';
  const parts = useMemo(() => parseExplore(aql), [aql]);
  const tier = useMemo(() => {
    if (!sources || !app) return undefined;
    const declared = Object.fromEntries(Object.entries(app.declaration.queries).map(([n, q]) => [n, q.aql]));
    return tierOf(queryRef.name, aql, sources, declared);
  }, [sources, app, queryRef.name, aql]);
  const used = useMemo(
    () => usedRefs(query?.columns ?? [], dataset, parts),
    [query?.columns, dataset, parts],
  );
  const adhoc = (query?.columns ?? []).filter((column) => isAdhoc(column, parts));
  const inputs = app ? queryInputs(app, queryRef.name) : [];
  const [codeTab, setCodeTab] = useState<'declared'>('declared');

  if (!declaration) return <Note tone="error">No query named {queryRef.name} in the app.</Note>;

  return (
    <section className="space-y-3 rounded-lg border p-3">
      <header className="space-y-1.5">
        <div className="flex items-center gap-2">
          <span className="min-w-0 truncate font-medium">{queryRef.name}</span>
          <span className="truncate text-xs text-muted-foreground">{declaration.dataset}</span>
          <span className="flex-1" />
          {tier ? (
            <Tooltip>
              <TooltipTrigger asChild>
                <Badge variant="outline" className={tierTone[tier.tier]}>
                  Tier {tier.tier}
                </Badge>
              </TooltipTrigger>
              <TooltipContent className="max-w-xs">{tier.reason}</TooltipContent>
            </Tooltip>
          ) : (
            <Badge variant="outline">Reading source…</Badge>
          )}
        </div>
        {tier && <p className="text-xs text-muted-foreground">{tier.reason}</p>}
      </header>

      <Fields groups={fieldGroups(dataset)} used={used} />

      {adhoc.length > 0 && (
        <Group
          title="Ad hoc"
          count={adhoc.length}
          hint="Expressions the query writes itself, not dataset fields."
        >
          {adhoc.map((column) => (
            <Row key={column.name} label={column.name} detail={expressionOf(parts, column.name)} />
          ))}
        </Group>
      )}

      <Group title="Filters in the query" count={parts?.filters.length ?? 0} empty="None.">
        {parts?.filters.map((entry) => (
          <Row key={entry.expression} label={entry.expression} />
        ))}
      </Group>

      <Group
        title="Dashboard filters"
        count={inputs.length}
        hint="Set by the reader, sent beside the AQL. Editing the query never changes them."
        empty="None mapped to this query."
      >
        {inputs.map((input) => (
          <Row
            key={`${input.kind}:${input.source}:${input.field}`}
            // A cross-filter has no field until something is selected: say what it is instead of a dash.
            label={
              input.kind === 'crossFilter'
                ? `${input.source} · cross-filter${input.field === '—' ? '' : ` on ${input.field}`}`
                : `${input.source} · ${input.field}`
            }
            detail={input.value}
          />
        ))}
      </Group>

      <Group title="Sorts" count={parts?.sorts.length ?? 0} empty="None in the query.">
        {parts?.sorts.map((entry) => (
          <Row key={entry.expression} label={entry.expression} />
        ))}
      </Group>

      <CodeBlock
        tab={codeTab}
        onTab={setCodeTab}
        sources={{ declared: { label: 'Declared AQL', code: aql, lang: 'aql', empty: 'No AQL.' } }}
      />
    </section>
  );
}

/** The dataset's metrics and fields, searchable, those the query uses ticked and first. */
function Fields({ groups, used }: { groups: FieldGroup[]; used: Set<string> }) {
  const [search, setSearch] = useState('');
  const term = search.trim().toLowerCase();
  const shown = groups
    .map((group) => ({
      ...group,
      options: group.options
        .filter((o) => !term || o.ref.toLowerCase().includes(term) || o.label.toLowerCase().includes(term))
        .sort((a, b) => Number(used.has(b.ref)) - Number(used.has(a.ref))),
    }))
    .filter((group) => group.options.length);
  return (
    <Group
      title="Fields"
      count={used.size}
      hint="Ticked: used by this query. Ticking comes in the next phase."
    >
      <div className="relative">
        <Search className="pointer-events-none absolute top-1/2 left-2 size-3.5 -translate-y-1/2 text-muted-foreground" />
        <Input
          value={search}
          onChange={(event) => setSearch(event.target.value)}
          placeholder="Search metrics and fields"
          className="h-8 pl-7 text-xs"
        />
      </div>
      <div className="max-h-72 space-y-2 overflow-y-auto">
        {shown.map((group) => (
          <div key={group.name}>
            <div className="px-1 pb-0.5 text-[11px] font-medium text-muted-foreground uppercase">
              {group.label}
            </div>
            {group.options.map((option) => (
              <label
                key={option.ref}
                className="flex items-center gap-2 rounded px-1 py-0.5 text-xs hover:bg-muted/50"
                title={option.ref}
              >
                <input
                  type="checkbox"
                  checked={used.has(option.ref)}
                  disabled
                  readOnly
                  className="accent-primary"
                />
                <span className={cn('min-w-0 truncate', used.has(option.ref) && 'font-medium')}>
                  {option.label}
                </span>
                <span className="ml-auto shrink-0 font-mono text-[10px] text-muted-foreground">
                  {option.ref}
                </span>
              </label>
            ))}
          </div>
        ))}
        {shown.length === 0 && <p className="px-1 text-xs text-muted-foreground">Nothing matches.</p>}
      </div>
    </Group>
  );
}

function expressionOf(parts: ReturnType<typeof parseExplore>, alias: string): string | undefined {
  const all: AqlEntry[] = [...(parts?.dimensions ?? []), ...(parts?.measures ?? [])];
  return all.find((entry) => entry.alias === alias)?.expression;
}

function Group({
  title,
  count,
  hint,
  empty,
  children,
}: {
  title: string;
  count: number;
  hint?: string;
  empty?: string;
  children: ReactNode;
}) {
  return (
    <div className="space-y-1.5">
      <div className="flex items-baseline gap-1.5">
        <h3 className="text-xs font-medium">{title}</h3>
        <span className="text-xs text-muted-foreground tabular-nums">{count}</span>
      </div>
      {hint && <p className="text-xs text-muted-foreground">{hint}</p>}
      {count === 0 && empty ? <p className="text-xs text-muted-foreground">{empty}</p> : children}
    </div>
  );
}

function Row({ label, detail }: { label: string; detail?: string }) {
  return (
    <div
      className="space-y-0.5 rounded border bg-muted/20 px-2 py-1 text-xs"
      title={detail ? `${label}\n${detail}` : label}
    >
      <div className="font-mono break-all">{label}</div>
      {detail && <div className="break-words text-muted-foreground">{detail}</div>}
    </div>
  );
}

function Note({ tone, children }: { tone?: 'error'; children: ReactNode }) {
  return (
    <p
      className={cn(
        'rounded-lg border border-dashed p-3 text-xs text-muted-foreground',
        tone === 'error' && 'border-destructive/40 text-destructive',
      )}
    >
      {children}
    </p>
  );
}
